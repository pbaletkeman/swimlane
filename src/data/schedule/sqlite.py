"""
SQLite Implementation of Schedule Interface Layer for Swimlane Application.

This module provides database operations for schedule management using SQLite3 connections.
It serves as an interface layer (inheriting from `ScheduleInterface`) to perform
CRUD operations on the 'schedule' table.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.schedule.schedule import Schedule
from src.data.schedule.schedule_interface import ScheduleInterface as ScheduleInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(ScheduleInterfaceBase):
    """An implementation of the schedule database operations"""

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
        """Get the Schedule Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS schedule (
                schedule_id INTEGER  PRIMARY KEY AUTOINCREMENT,
                venue_id    INTEGER  NOT NULL,
                member_id   TEXT     NOT NULL,
                event_id    INTEGER  NOT NULL,
                is_active   INTEGER  NULL DEFAULT 1,
                FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (member_id) REFERENCES users(sub) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (event_id) REFERENCES event(event_id) ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_schedule_venue_id ON schedule (venue_id);
            CREATE INDEX IF NOT EXISTS idx_schedule_member_id ON schedule (member_id);
            CREATE INDEX IF NOT EXISTS idx_schedule_event_id ON schedule (event_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get schedule info"""
        sql: str = f"""SELECT schedule_id, venue_id, member_id, event_id, is_active
            FROM schedule {where} ORDER BY is_active DESC, schedule_id ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_schedule_helper(self, rs: Any) -> Optional[Schedule]:
        """Helper function to transform the sql data into a schedule object"""
        if rs:
            return Schedule(
                schedule_id=rs["schedule_id"],
                venue_id=rs["venue_id"],
                member_id=rs["member_id"],
                event_id=rs["event_id"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_schedule_returning(self) -> str:
        """Create the schedule returning sql"""
        return """RETURNING schedule_id, venue_id, member_id, event_id, is_active;"""

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
    def create_schedule(self, schedule: Schedule) -> Optional[Schedule]:
        """Create a new schedule in the data store. Returns the created schedule with assigned ID."""
        retval: list[Schedule] | None = self.create_schedules_bulk([schedule])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_schedule(self, schedule: Schedule) -> Optional[Schedule]:
        """Update a schedule based on schedule_id. Returns updated schedule."""
        sql = f"""
            UPDATE schedule SET
                venue_id=?,
                member_id=?,
                event_id=?,
                is_active=?
            WHERE schedule_id=?
            {self.create_schedule_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    schedule.venue_id,
                    schedule.member_id,
                    schedule.event_id,
                    schedule.is_active,
                    schedule.schedule_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_schedule_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_schedule_by_id(self, schedule_id: int) -> Optional[Schedule]:
        """Retrieve a schedule by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE schedule_id = ?")
            cursor.execute(sql, (schedule_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_schedule_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_schedule_by_id(self, schedule_id: int) -> bool:
        """Delete a schedule by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM schedule WHERE schedule_id = ?"
            cursor.execute(sql, (schedule_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_schedule_by_id(self, schedule_id: int) -> bool:
        """Soft-delete a schedule by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE schedule SET is_active=0 WHERE schedule_id=?"
            cursor.execute(sql, (schedule_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_schedules(self) -> Optional[list[Schedule]]:
        """List all schedules in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            schedules: list[Schedule] = []
            for rs in cursor:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    schedules.append(s)

        return schedules if len(schedules) > 0 else None

    # ------------------------------------------------------------------
    def list_schedules_by_member_id(self, member_id: str) -> Optional[list[Schedule]]:
        """List all schedules for a given member ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE member_id = ?")
            cursor.execute(sql, (member_id,))
            schedules: list[Schedule] = []
            for rs in cursor:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    schedules.append(s)

        return schedules if len(schedules) > 0 else None

    # ------------------------------------------------------------------
    def list_active_schedules_by_member_id(self, member_id: str) -> Optional[list[Schedule]]:
        """List active schedules for a given member ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE member_id = ? AND is_active = 1")
            cursor.execute(sql, (member_id,))
            schedules: list[Schedule] = []
            for rs in cursor:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    schedules.append(s)

        return schedules if len(schedules) > 0 else None

    # ------------------------------------------------------------------
    def list_active_schedules_by_member_id_with_details(self, member_id: str) -> Optional[list[dict[str, Any]]]:
        """List a member's active schedules joined with event, venue, and facility detail."""
        sql = """SELECT s.schedule_id, s.venue_id, s.member_id, s.event_id, s.is_active AS is_active,
                       e.start_date_time AS event_start_date_time,
                       e.end_date_time AS event_end_date_time,
                       e.description AS event_description,
                       v.street AS street, v.city AS city, v.state AS state, v.postal_code AS postal_code,
                       f.name AS facility_name
                FROM schedule s
                JOIN event e ON e.event_id = s.event_id
                JOIN venue v ON v.venue_id = s.venue_id
                JOIN facility f ON f.facility_id = v.facility_id
                WHERE s.member_id = ? AND s.is_active = 1 AND e.is_active = 1 AND v.is_active = 1
                ORDER BY e.start_date_time ASC"""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (member_id,))
            rows = [dict(rs) for rs in cursor.fetchall()]

        return rows if len(rows) > 0 else None

    # ------------------------------------------------------------------
    def list_schedules_by_event_id(self, event_id: int) -> Optional[list[Schedule]]:
        """List all schedules for a given event ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE event_id = ?")
            cursor.execute(sql, (event_id,))
            schedules: list[Schedule] = []
            for rs in cursor:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    schedules.append(s)

        return schedules if len(schedules) > 0 else None

    # ------------------------------------------------------------------
    def list_schedules_by_event_id_with_members(self, event_id: int) -> Optional[list[dict[str, Any]]]:
        """List an event's active schedules joined with the member's raw PII columns.

        Returns rows keyed by schedule fields plus the member's encrypted name/email
        columns (``first_name_nonce``, ``first_name_ciphertext``, etc.) so the caller
        can decrypt them. ``member_id`` is never null (the LEFT JOIN drops no rows).
        """
        sql = """SELECT s.schedule_id, s.venue_id, s.member_id, s.event_id, s.is_active AS is_active,
                       u.first_name_nonce, u.first_name_ciphertext,
                       u.last_name_nonce, u.last_name_ciphertext,
                       u.email_nonce, u.email_ciphertext
                FROM schedule s
                LEFT JOIN users u ON u.sub = s.member_id
                WHERE s.event_id = ? AND s.is_active = 1
                ORDER BY s.schedule_id ASC"""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (event_id,))
            rows = [dict(rs) for rs in cursor.fetchall()]

        return rows if len(rows) > 0 else None

    # ------------------------------------------------------------------
    def get_schedule_for_member(self, event_id: int, member_id: str) -> Optional[Schedule]:
        """Return the active schedule for a member on a specific event, if any."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE event_id = ? AND member_id = ? AND is_active = 1")
            cursor.execute(sql, (event_id, member_id))
            rs = cursor.fetchone()
            if rs:
                return self.create_schedule_helper(rs)

        return None

    # ------------------------------------------------------------------
    def count_active_for_event(self, event_id: int) -> int:
        """Count the number of active schedules registered for an event."""
        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT COUNT(*) AS cnt FROM schedule WHERE event_id = ? AND is_active = 1",
                (event_id,),
            )
            row = cursor.fetchone()
            return int(row["cnt"]) if row else 0

    # ------------------------------------------------------------------
    def list_schedules_by_venue_id(self, venue_id: int) -> Optional[list[Schedule]]:
        """List all schedules for a given venue ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE venue_id = ?")
            cursor.execute(sql, (venue_id,))
            schedules: list[Schedule] = []
            for rs in cursor:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    schedules.append(s)

        return schedules if len(schedules) > 0 else None

    # ------------------------------------------------------------------
    def list_schedules_by_venue_id_with_events(self, venue_id: int) -> Optional[list[dict[str, Any]]]:
        """List active schedules for a venue joined with their event start/end times."""
        sql = """SELECT s.schedule_id, s.venue_id, s.event_id, s.is_active AS is_active,
                       e.start_date_time AS event_start_date_time, e.end_date_time AS event_end_date_time
            FROM schedule s
            JOIN event e ON e.event_id = s.event_id
            WHERE s.venue_id = ? AND s.is_active = 1 AND e.is_active = 1
            ORDER BY e.start_date_time ASC"""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (venue_id,))
            rows = [dict(rs) for rs in cursor.fetchall()]

        return rows if len(rows) > 0 else None

    # ------------------------------------------------------------------
    def create_schedules_bulk(self, schedules: list[Schedule]) -> Optional[list[Schedule]]:
        """Create multiple schedules in bulk. Returns the created schedules with assigned IDs."""
        if not schedules:
            return []

        sql: str = """INSERT INTO schedule (venue_id, member_id, event_id, is_active)
            VALUES (?, ?, ?, ?)"""

        data: list[tuple[int, str, int, int]] = []
        for sched in schedules:
            data.append(
                (
                    sched.venue_id,
                    sched.member_id,
                    sched.event_id,
                    int(sched.is_active),
                )
            )

        with self._connect() as conn:
            conn.executemany(sql, data)

            if not data:
                conn.commit()
                return []

            sql_retrieve = self.get_record_select("WHERE rowid IN (SELECT last_insert_rowid() FROM schedule)")
            cursor = conn.cursor()
            cursor.execute(sql_retrieve)
            created: list[Schedule] = []
            for rs in cursor:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    created.append(s)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_schedules_bulk(self, schedules: list[Schedule]) -> Optional[list[Schedule]]:
        """Delete multiple schedules in bulk. Returns the deleted schedules."""
        if not schedules:
            return []

        ids = [s.schedule_id for s in schedules if s.schedule_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM schedule WHERE schedule_id IN ({placeholders})
            RETURNING schedule_id, venue_id, member_id, event_id, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[Schedule] = []
            for rs in deleted_rows:
                s = self.create_schedule_helper(rs)
                if s is not None:
                    deleted.append(s)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_schedules_bulk(self, schedules: list[Schedule]) -> Optional[list[Schedule]]:
        """Soft-delete multiple schedules in bulk. Returns the soft-deleted schedules."""
        if not schedules:
            return []

        ids = [s.schedule_id for s in schedules if s.schedule_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE schedule SET is_active=0 WHERE schedule_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE schedule_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[Schedule] = []
            for rs in cursor.fetchall():
                s = self.create_schedule_helper(rs)
                if s is not None:
                    soft_deleted.append(s)

            return soft_deleted if len(soft_deleted) > 0 else None
