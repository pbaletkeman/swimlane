"""
SQLite Implementation of Event Interface Layer for Swimlane Application.

This module provides database operations for event management using SQLite3 connections.
It serves as an interface layer (inheriting from `EventInterface`) to perform
CRUD operations on the 'event' table.
"""

import logging
import sqlite3
from datetime import datetime
from typing import Any, LiteralString, Optional

from src.data.event.event import Event
from src.data.event.event_interface import EventInterface as EventInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(EventInterfaceBase):
    """An implementation of the event database operations"""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._config: dict[str, Any] = Config.yaml_config() or {}
        self._sqlite_file: str = Config.sqlite_file()

    def _connect(self) -> sqlite3.Connection:
        try:
            conn = sqlite3.connect(self._sqlite_file)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            return conn
        except sqlite3.Error as e:
            logger.error("Database connection failed: %s", e)
            raise

    # ------------------------------------------------------------------
    def get_create_table(self) -> LiteralString:
        """Get the Event Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS event (
                event_id         INTEGER  PRIMARY KEY AUTOINCREMENT,
                start_date_time  TEXT     NOT NULL,
                end_date_time    TEXT     NOT NULL,
                frequency_id     INTEGER,
                is_active        INTEGER  NULL DEFAULT 1,
                FOREIGN KEY (frequency_id) REFERENCES frequency(frequency_id) ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_event_frequency_id ON event (frequency_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get event info"""
        sql: str = f"""SELECT event_id, start_date_time, end_date_time, frequency_id, is_active
            FROM event {where} ORDER BY is_active DESC, start_date_time ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_event_helper(self, rs: Any) -> Optional[Event]:
        """Helper function to transform the sql data into an event object"""
        if rs:
            return Event(
                event_id=rs["event_id"],
                start_date_time=rs["start_date_time"],
                end_date_time=rs["end_date_time"],
                frequency_id=rs["frequency_id"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_event_returning(self) -> str:
        """Create the event returning sql"""
        return """RETURNING event_id, start_date_time, end_date_time, frequency_id, is_active;"""

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
    def create_event(self, event: Event) -> Optional[Event]:
        """Create a new event in the data store. Returns the created event with assigned ID."""
        retval: list[Event] | None = self.create_events_bulk([event])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_event(self, event: Event) -> Optional[Event]:
        """Update an event based on event_id. Returns updated event."""
        sql = f"""
            UPDATE event SET
                start_date_time=?,
                end_date_time=?,
                frequency_id=?,
                is_active=?
            WHERE event_id=?
            {self.create_event_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    event.start_date_time,
                    event.end_date_time,
                    event.frequency_id,
                    event.is_active,
                    event.event_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_event_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_event_by_id(self, event_id: int) -> Optional[Event]:
        """Retrieve an event by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE event_id = ?")
            cursor.execute(sql, (event_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_event_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_event_by_id(self, event_id: int) -> bool:
        """Delete an event by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM event WHERE event_id = ?"
            cursor.execute(sql, (event_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_event_by_id(self, event_id: int) -> bool:
        """Soft-delete an event by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE event SET is_active=0 WHERE event_id=?"
            cursor.execute(sql, (event_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_events(self) -> Optional[list[Event]]:
        """List all events in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            events: list[Event] = []
            for rs in cursor:
                e = self.create_event_helper(rs)
                if e is not None:
                    events.append(e)

        return events if len(events) > 0 else None

    # ------------------------------------------------------------------
    def list_public_events(self, start_from: str | None = None, start_to: str | None = None) -> Optional[list[Event]]:
        """List active events within a start_date_time range (defaults to upcoming events)."""
        now = datetime.now().isoformat(timespec="seconds")
        conditions = ["is_active = 1"]
        params: list[Any] = []
        conditions.append("start_date_time >= ?")
        params.append(start_from if start_from else now)
        if start_to:
            conditions.append("start_date_time <= ?")
            params.append(start_to)
        where = "WHERE " + " AND ".join(conditions)

        with self._connect() as conn:
            cursor = conn.cursor()
            sql: str = self.get_record_select(where)
            cursor.execute(sql, params)
            events: list[Event] = []
            for rs in cursor:
                e = self.create_event_helper(rs)
                if e is not None:
                    events.append(e)

        return events if len(events) > 0 else None

    # ------------------------------------------------------------------
    def list_events_by_frequency_id(self, frequency_id: int) -> Optional[list[Event]]:
        """List all events for a given frequency ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE frequency_id = ?")
            cursor.execute(sql, (frequency_id,))
            events: list[Event] = []
            for rs in cursor:
                e = self.create_event_helper(rs)
                if e is not None:
                    events.append(e)

        return events if len(events) > 0 else None

    # ------------------------------------------------------------------
    def create_events_bulk(self, events: list[Event]) -> Optional[list[Event]]:
        """Create multiple events in bulk. Returns the created events with assigned IDs."""
        if not events:
            return []

        sql: str = """INSERT INTO event (start_date_time, end_date_time, frequency_id, is_active)
            VALUES (?, ?, ?, ?)"""

        data: list[tuple[str, str, int | None, int]] = []
        for ev in events:
            if not ev.start_date_time or not ev.end_date_time:
                continue
            data.append(
                (
                    ev.start_date_time,
                    ev.end_date_time,
                    ev.frequency_id,
                    int(ev.is_active),
                )
            )

        with self._connect() as conn:
            conn.executemany(sql, data)

            if not data:
                conn.commit()
                return []

            sql_retrieve = self.get_record_select("WHERE rowid IN (SELECT last_insert_rowid() FROM event)")
            cursor = conn.cursor()
            cursor.execute(sql_retrieve)
            created: list[Event] = []
            for rs in cursor:
                e = self.create_event_helper(rs)
                if e is not None:
                    created.append(e)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_events_bulk(self, events: list[Event]) -> Optional[list[Event]]:
        """Delete multiple events in bulk. Returns the deleted events."""
        if not events:
            return []

        ids = [e.event_id for e in events if e.event_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM event WHERE event_id IN ({placeholders})
            RETURNING event_id, start_date_time, end_date_time, frequency_id, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[Event] = []
            for rs in deleted_rows:
                e = self.create_event_helper(rs)
                if e is not None:
                    deleted.append(e)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_events_bulk(self, events: list[Event]) -> Optional[list[Event]]:
        """Soft-delete multiple events in bulk. Returns the soft-deleted events."""
        if not events:
            return []

        ids = [e.event_id for e in events if e.event_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE event SET is_active=0 WHERE event_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE event_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[Event] = []
            for rs in cursor.fetchall():
                e = self.create_event_helper(rs)
                if e is not None:
                    soft_deleted.append(e)

            return soft_deleted if len(soft_deleted) > 0 else None
