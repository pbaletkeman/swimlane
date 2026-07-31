"""
SQLite Implementation of Frequency Interface Layer for Swimlane Application.

This module provides database operations for frequency management using SQLite3 connections.
It serves as an interface layer (inheriting from `FrequencyInterface`) to perform
CRUD operations on the 'frequency' table.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.frequency.frequency import Frequency
from src.data.frequency.frequency_interface import FrequencyInterface as FrequencyInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(FrequencyInterfaceBase):
    """An implementation of the frequency database operations"""

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
        """Get the Frequency Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS frequency (
                frequency_id  INTEGER  PRIMARY KEY AUTOINCREMENT,
                name          TEXT     NOT NULL UNIQUE,
                day_interval  TEXT     NOT NULL,
                is_active     INTEGER  NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_frequency_name ON frequency (name);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get frequency info"""
        sql: str = f"""SELECT frequency_id, name, day_interval, is_active
            FROM frequency {where} ORDER BY is_active DESC, name ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_frequency_helper(self, rs: Any) -> Optional[Frequency]:
        """Helper function to transform the sql data into a frequency object"""
        if rs:
            return Frequency(
                frequency_id=rs["frequency_id"],
                name=rs["name"],
                day_interval=rs["day_interval"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_frequency_returning(self) -> str:
        """Create the frequency returning sql"""
        return """RETURNING frequency_id, name, day_interval, is_active;"""

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
    def create_frequency(self, frequency: Frequency) -> Optional[Frequency]:
        """Create a new frequency in the data store. Returns the created frequency with assigned ID."""
        retval: list[Frequency] | None = self.create_frequencies_bulk([frequency])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_frequency(self, frequency: Frequency) -> Optional[Frequency]:
        """Update a frequency based on frequency_id. Returns updated frequency."""
        sql = f"""
            UPDATE frequency SET
                name=?,
                day_interval=?,
                is_active=?
            WHERE frequency_id=?
            {self.create_frequency_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    frequency.name,
                    frequency.day_interval,
                    frequency.is_active,
                    frequency.frequency_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_frequency_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_frequency_by_id(self, frequency_id: int) -> Optional[Frequency]:
        """Retrieve a frequency by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE frequency_id = ?")
            cursor.execute(sql, (frequency_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_frequency_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_frequency_by_name(self, name: str) -> Optional[Frequency]:
        """Retrieve a frequency by its unique name. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE name = ?")
            cursor.execute(sql, (name,))
            rs = cursor.fetchone()
            if rs:
                return self.create_frequency_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_frequency_by_id(self, frequency_id: int) -> bool:
        """Delete a frequency by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM frequency WHERE frequency_id = ?"
            cursor.execute(sql, (frequency_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_frequency_by_id(self, frequency_id: int) -> bool:
        """Soft-delete a frequency by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE frequency SET is_active=0 WHERE frequency_id=?"
            cursor.execute(sql, (frequency_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_frequencies(self) -> Optional[list[Frequency]]:
        """List all frequencies in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            frequencies: list[Frequency] = []
            for rs in cursor:
                f = self.create_frequency_helper(rs)
                if f is not None:
                    frequencies.append(f)

        return frequencies if len(frequencies) > 0 else None

    # ------------------------------------------------------------------
    def create_frequencies_bulk(self, frequencies: list[Frequency]) -> Optional[list[Frequency]]:
        """Create multiple frequencies in bulk. Returns the created frequencies with assigned IDs."""
        if not frequencies:
            return []

        sql: str = """INSERT INTO frequency (name, day_interval, is_active)
            VALUES (?, ?, ?)"""

        data: list[tuple[str, str, int]] = []
        names: list[str] = []
        for freq in frequencies:
            if not freq.name or not freq.day_interval:
                continue
            data.append((freq.name, freq.day_interval, int(freq.is_active)))
            names.append(freq.name)

        with self._connect() as conn:
            conn.executemany(sql, data)

            if not names:
                conn.commit()
                return []

            placeholders = ", ".join(["?"] * len(names))
            sql_retrieve = self.get_record_select(f"WHERE name IN ({placeholders})")
            cursor = conn.cursor()
            cursor.execute(sql_retrieve, names)
            created: list[Frequency] = []
            for rs in cursor:
                f = self.create_frequency_helper(rs)
                if f is not None:
                    created.append(f)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_frequencies_bulk(self, frequencies: list[Frequency]) -> Optional[list[Frequency]]:
        """Delete multiple frequencies in bulk. Returns the deleted frequencies."""
        if not frequencies:
            return []

        ids = [f.frequency_id for f in frequencies if f.frequency_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM frequency WHERE frequency_id IN ({placeholders})
            RETURNING frequency_id, name, day_interval, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[Frequency] = []
            for rs in deleted_rows:
                f = self.create_frequency_helper(rs)
                if f is not None:
                    deleted.append(f)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_frequencies_bulk(self, frequencies: list[Frequency]) -> Optional[list[Frequency]]:
        """Soft-delete multiple frequencies in bulk. Returns the soft-deleted frequencies."""
        if not frequencies:
            return []

        ids = [f.frequency_id for f in frequencies if f.frequency_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE frequency SET is_active=0 WHERE frequency_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE frequency_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[Frequency] = []
            for rs in cursor.fetchall():
                f = self.create_frequency_helper(rs)
                if f is not None:
                    soft_deleted.append(f)

            return soft_deleted if len(soft_deleted) > 0 else None
