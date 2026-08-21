"""
SQLite Implementation of Message Interface Layer for Swimlane Application.

This module provides database operations for member messages using SQLite3
connections. It serves as an interface layer (inheriting from `MessageInterface`)
to perform CRUD operations on the 'message' table.
"""

import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.message.message import Message
from src.data.message.message_interface import MessageInterface as MessageInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(MessageInterfaceBase):
    """An implementation of the message database operations"""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._config: dict[str, Any] = Config.yaml_config() or {}
        self._sqlite_file: str = Config.sqlite_file()

    def _connect(self) -> sqlite3.Connection:
        try:
            conn = sqlite3.connect(self._sqlite_file, factory=ClosingConnection)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            return conn
        except sqlite3.Error as e:
            logger.error("Database connection failed: %s", e)
            raise

    # ------------------------------------------------------------------
    def get_create_table(self) -> LiteralString:
        """Get the Message Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS message (
                message_id INTEGER  PRIMARY KEY AUTOINCREMENT,
                member_id  TEXT     NOT NULL,
                sender_id  TEXT     NOT NULL,
                subject    TEXT     NOT NULL,
                body       TEXT     NOT NULL,
                is_read    INTEGER  NULL DEFAULT 0,
                sent_at    TEXT,
                is_active  INTEGER  NULL DEFAULT 1,
                FOREIGN KEY (member_id) REFERENCES users(sub) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(sub) ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_message_member_id ON message (member_id);
            CREATE INDEX IF NOT EXISTS idx_message_sender_id ON message (sender_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get message info"""
        sql: str = f"""SELECT message_id, member_id, sender_id, subject, body, is_read, sent_at, is_active
            FROM message {where} ORDER BY sent_at DESC, message_id DESC"""
        return sql

    # ------------------------------------------------------------------
    def create_message_helper(self, rs: Any) -> Optional[Message]:
        """Helper function to transform the sql data into a message object"""
        if rs:
            return Message(
                message_id=rs["message_id"],
                member_id=rs["member_id"],
                sender_id=rs["sender_id"],
                subject=rs["subject"],
                body=rs["body"],
                is_read=rs["is_read"],
                sent_at=rs["sent_at"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_message_returning(self) -> str:
        """Create the message returning sql"""
        return """RETURNING message_id, member_id, sender_id, subject, body, is_read, sent_at, is_active;"""

    # ------------------------------------------------------------------
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""
        try:
            with self._connect() as conn:
                cursor = conn.cursor()
                sql: str = self.get_create_table()
                cursor.executescript(sql)
                conn.commit()
        except sqlite3.Error as e:
            logger.error("Database initialization failed: %s", e)
            raise

    # ------------------------------------------------------------------
    def create_message(self, message: Message) -> Optional[Message]:
        """Create a new message in the data store. Returns the created message with assigned ID."""
        retval: list[Message] | None = self.create_messages_bulk([message])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_message(self, message: Message) -> Optional[Message]:
        """Update a message based on message_id. Returns the updated message."""
        sql = f"""
            UPDATE message SET
                is_read=?,
                is_active=?
            WHERE message_id=?
            {self.create_message_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    int(message.is_read),
                    int(message.is_active),
                    message.message_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_message_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_message_by_id(self, message_id: int) -> Optional[Message]:
        """Retrieve a message by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE message_id = ?")
            cursor.execute(sql, (message_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_message_helper(rs)

        return None

    # ------------------------------------------------------------------
    def list_messages(self) -> Optional[list[Message]]:
        """List all messages in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            messages: list[Message] = []
            for rs in cursor:
                m = self.create_message_helper(rs)
                if m is not None:
                    messages.append(m)

        return messages if len(messages) > 0 else None

    # ------------------------------------------------------------------
    def list_by_member(self, member_id: str) -> Optional[list[Message]]:
        """List a recipient's active inbox messages."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE member_id = ? AND is_active = 1")
            cursor.execute(sql, (member_id,))
            messages: list[Message] = []
            for rs in cursor:
                m = self.create_message_helper(rs)
                if m is not None:
                    messages.append(m)

        return messages if len(messages) > 0 else None

    # ------------------------------------------------------------------
    def mark_read(self, message_id: int) -> Optional[Message]:
        """Mark a message as read. Returns the updated message."""
        existing = self.get_message_by_id(message_id)
        if not existing:
            return None
        existing.is_read = True
        return self.update_message(existing)

    # ------------------------------------------------------------------
    def hard_delete_message_by_id(self, message_id: int) -> bool:
        """Delete a message by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM message WHERE message_id = ?"
            cursor.execute(sql, (message_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_message_by_id(self, message_id: int) -> bool:
        """Soft-delete a message by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE message SET is_active=0 WHERE message_id=?"
            cursor.execute(sql, (message_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def create_messages_bulk(self, messages: list[Message]) -> Optional[list[Message]]:
        """Create multiple messages in bulk. Returns the created messages with assigned IDs."""
        if not messages:
            return []

        sent_at = datetime.now(timezone.utc)

        sql: str = """INSERT INTO message (member_id, sender_id, subject, body, is_read, sent_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)"""

        data: list[tuple[str, str, str, str, int, str, int]] = []
        for message in messages:
            if not message.member_id or not message.sender_id or not message.subject:
                continue
            data.append(
                (
                    message.member_id,
                    message.sender_id,
                    message.subject,
                    message.body or "",
                    int(message.is_read),
                    message.sent_at.isoformat() if message.sent_at else sent_at.isoformat(),
                    int(message.is_active),
                )
            )

        if not data:
            return []

        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.executemany(sql, data)
            conn.commit()

            last_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            first_id = last_id - len(data) + 1
            cursor.execute(
                self.get_record_select("WHERE message_id >= ? AND message_id <= ?"),
                (first_id, last_id),
            )
            created: list[Message] = []
            for rs in cursor:
                m = self.create_message_helper(rs)
                if m is not None:
                    created.append(m)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_messages_bulk(self, messages: list[Message]) -> Optional[list[Message]]:
        """Delete multiple messages in bulk. Returns the deleted messages."""
        if not messages:
            return []

        ids = [m.message_id for m in messages if m.message_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM message WHERE message_id IN ({placeholders})
            RETURNING message_id, member_id, sender_id, subject, body, is_read, sent_at, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[Message] = []
            for rs in deleted_rows:
                m = self.create_message_helper(rs)
                if m is not None:
                    deleted.append(m)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_messages_bulk(self, messages: list[Message]) -> Optional[list[Message]]:
        """Soft-delete multiple messages in bulk. Returns the soft-deleted messages."""
        if not messages:
            return []

        ids = [m.message_id for m in messages if m.message_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE message SET is_active=0 WHERE message_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE message_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[Message] = []
            for rs in cursor.fetchall():
                m = self.create_message_helper(rs)
                if m is not None:
                    soft_deleted.append(m)

            return soft_deleted if len(soft_deleted) > 0 else None
