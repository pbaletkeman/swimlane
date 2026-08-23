"""
SQLite Implementation of Facility Interface Layer for Swimlane Application.

This module provides database operations for facility management using SQLite3 connections.
It serves as an interface layer (inheriting from `FacilityInterface`) to perform
CRUD operations on the 'facility' table.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.facility.facility import Facility
from src.data.facility.facility_interface import FacilityInterface as FacilityInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(FacilityInterfaceBase):
    """An implementation of the facility database operations"""

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
        """Get the Facility Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS facility (
                facility_id  INTEGER  PRIMARY KEY AUTOINCREMENT,
                name         TEXT     NOT NULL UNIQUE,
                description  TEXT,
                max_capacity INTEGER,
                min_capacity INTEGER,
                is_active    INTEGER  NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_facility_name ON facility (name);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get facility info"""
        sql: str = f"""SELECT facility_id, name, description, max_capacity, min_capacity, is_active
            FROM facility {where} ORDER BY is_active DESC, name ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_facility_helper(self, rs: Any) -> Optional[Facility]:
        """Helper function to transform the sql data into a facility object"""
        if rs:
            return Facility(
                facility_id=rs["facility_id"],
                name=rs["name"],
                description=rs["description"],
                max_capacity=rs["max_capacity"],
                min_capacity=rs["min_capacity"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_facility_returning(self) -> str:
        """Create the facility returning sql"""
        return """RETURNING facility_id, name, description, max_capacity, min_capacity, is_active;"""

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
    def create_facility(self, facility: Facility) -> Optional[Facility]:
        """Create a new facility in the data store. Returns the created facility with assigned ID."""
        retval: list[Facility] | None = self.create_facilities_bulk([facility])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_facility(self, facility: Facility) -> Optional[Facility]:
        """Update a facility based on facility_id. Returns updated facility."""
        sql = f"""
            UPDATE facility SET
                name=?,
                description=?,
                max_capacity=?,
                min_capacity=?,
                is_active=?
            WHERE facility_id=?
            {self.create_facility_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    facility.name,
                    facility.description,
                    facility.max_capacity,
                    facility.min_capacity,
                    facility.is_active,
                    facility.facility_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_facility_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_facility_by_id(self, facility_id: int) -> Optional[Facility]:
        """Retrieve a facility by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE facility_id = ?")
            cursor.execute(sql, (facility_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_facility_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_facility_by_name(self, name: str) -> Optional[Facility]:
        """Retrieve a facility by its unique name. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE name = ?")
            cursor.execute(sql, (name,))
            rs = cursor.fetchone()
            if rs:
                return self.create_facility_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_facility_by_id(self, facility_id: int) -> bool:
        """Delete a facility by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM facility WHERE facility_id = ?"
            cursor.execute(sql, (facility_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_facility_by_id(self, facility_id: int) -> bool:
        """Soft-delete a facility by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE facility SET is_active=0 WHERE facility_id=?"
            cursor.execute(sql, (facility_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_facilities(self) -> Optional[list[Facility]]:
        """List all facilities in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            facilities: list[Facility] = []
            for rs in cursor:
                f = self.create_facility_helper(rs)
                if f is not None:
                    facilities.append(f)

        return facilities if len(facilities) > 0 else None

    # ------------------------------------------------------------------
    def create_facilities_bulk(self, facilities: list[Facility]) -> Optional[list[Facility]]:
        """Create multiple facilities in bulk. Returns the created facilities with assigned IDs."""
        if not facilities:
            return []

        sql: str = """INSERT INTO facility (name, description, max_capacity, min_capacity, is_active)
            VALUES (?, ?, ?, ?, ?)"""

        data: list[tuple[str, str | None, int | None, int | None, int]] = []
        names: list[str] = []
        for fac in facilities:
            if not fac.name:
                continue
            data.append(
                (
                    fac.name,
                    fac.description,
                    fac.max_capacity,
                    fac.min_capacity,
                    int(fac.is_active),
                )
            )
            names.append(fac.name)

        with self._connect() as conn:
            conn.executemany(sql, data)

            if not names:
                conn.commit()
                return []

            placeholders = ", ".join(["?"] * len(names))
            sql_retrieve = self.get_record_select(f"WHERE name IN ({placeholders})")
            cursor = conn.cursor()
            cursor.execute(sql_retrieve, names)
            created: list[Facility] = []
            for rs in cursor:
                f = self.create_facility_helper(rs)
                if f is not None:
                    created.append(f)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_facilities_bulk(self, facilities: list[Facility]) -> Optional[list[Facility]]:
        """Delete multiple facilities in bulk. Returns the deleted facilities."""
        if not facilities:
            return []

        ids = [f.facility_id for f in facilities if f.facility_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM facility WHERE facility_id IN ({placeholders})
            RETURNING facility_id, name, description, max_capacity, min_capacity, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[Facility] = []
            for rs in deleted_rows:
                f = self.create_facility_helper(rs)
                if f is not None:
                    deleted.append(f)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_facilities_bulk(self, facilities: list[Facility]) -> Optional[list[Facility]]:
        """Soft-delete multiple facilities in bulk. Returns the soft-deleted facilities."""
        if not facilities:
            return []

        ids = [f.facility_id for f in facilities if f.facility_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE facility SET is_active=0 WHERE facility_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE facility_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[Facility] = []
            for rs in cursor.fetchall():
                f = self.create_facility_helper(rs)
                if f is not None:
                    soft_deleted.append(f)

            return soft_deleted if len(soft_deleted) > 0 else None
