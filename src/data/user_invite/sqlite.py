"""
SQLite Implementation of the User Invite Interface for Swimlane Application.

Stores pending role invites keyed by email hash so `auth_callback` can apply
an invited role when a user first logs in with Google.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.user_invite.user_invite import UserInvite
from src.data.user_invite.user_invite_interface import UserInviteInterface as UserInviteInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(UserInviteInterfaceBase):
    """An implementation of the user invite database operations."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Load the YAML config and SQLite database file path."""
        super().__init__(*args, **kwargs)
        self._config: dict[str, Any] = Config.yaml_config() or {}
        self._sqlite_file: str = Config.sqlite_file()

    def _connect(self) -> sqlite3.Connection:
        """Open a SQLite connection with Row rows and foreign keys enabled."""
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
        """Get the user invite table DDL."""
        sql = """CREATE TABLE IF NOT EXISTS user_invite (
                id          INTEGER  PRIMARY KEY AUTOINCREMENT,
                email_hash  TEXT     NOT NULL UNIQUE,
                role        TEXT     NOT NULL,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                is_active   INTEGER  NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_user_invite_email_hash ON user_invite (email_hash);"""
        return sql

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
    def _invite_from_row(self, rs: Any) -> Optional[UserInvite]:
        """Helper function to transform the sql data into a user invite object"""
        if rs:
            return UserInvite(email_hash=rs["email_hash"], role=rs["role"], is_active=bool(rs["is_active"]))
        return None

    # ------------------------------------------------------------------
    def create_invite(self, invite: UserInvite) -> Optional[UserInvite]:
        """Create or update an invite keyed by email hash (upsert on email_hash)."""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO user_invite (email_hash, role, is_active)
                   VALUES (?, ?, 1)
                   ON CONFLICT(email_hash) DO UPDATE SET role=excluded.role, is_active=1""",
                (invite.email_hash, invite.role),
            )
            conn.commit()
            return self.get_invite_by_email_hash(invite.email_hash)

    # ------------------------------------------------------------------
    def get_invite_by_email_hash(self, email_hash: str) -> Optional[UserInvite]:
        """Retrieve an invite by its email hash. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()
            sql = "SELECT email_hash, role, is_active FROM user_invite WHERE email_hash = ?"
            cursor.execute(sql, (email_hash,))
            rs = cursor.fetchone()
            return self._invite_from_row(rs)

    # ------------------------------------------------------------------
    def delete_invite_by_email_hash(self, email_hash: str) -> bool:
        """Delete an invite by its email hash. Returns True if a row was deleted."""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_invite WHERE email_hash = ?", (email_hash,))
            conn.commit()
            return cursor.rowcount > 0
