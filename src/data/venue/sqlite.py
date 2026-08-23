"""
SQLite Implementation of Venue Interface Layer for Swimlane Application.

This module provides database operations for venue management using SQLite3 connections.
It serves as an interface layer (inheriting from `VenueInterface`) to perform
CRUD operations on the 'venue' table.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.venue.venue import Venue
from src.data.venue.venue_interface import VenueInterface as VenueInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(VenueInterfaceBase):
    """An implementation of the venue database operations"""

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
        """Get the Venue Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS venue (
                venue_id    INTEGER  PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER  NOT NULL,
                street      TEXT     NOT NULL,
                city        TEXT     NOT NULL,
                state       TEXT     NOT NULL,
                postal_code TEXT     NOT NULL,
                cost        REAL     NULL DEFAULT 0.0,
                is_active   INTEGER  NULL DEFAULT 1,
                FOREIGN KEY (facility_id) REFERENCES facility(facility_id) ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_venue_facility_id ON venue (facility_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get venue info"""
        sql: str = f"""SELECT venue_id, facility_id, street, city, state, postal_code, cost, is_active
            FROM venue {where} ORDER BY is_active DESC, city ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_venue_helper(self, rs: Any) -> Optional[Venue]:
        """Helper function to transform the sql data into a venue object"""
        if rs:
            return Venue(
                venue_id=rs["venue_id"],
                facility_id=rs["facility_id"],
                street=rs["street"],
                city=rs["city"],
                state=rs["state"],
                postal_code=rs["postal_code"],
                cost=rs["cost"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_venue_returning(self) -> str:
        """Create the venue returning sql"""
        return "RETURNING venue_id, facility_id, street, city, state, postal_code, cost, is_active;"

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
    def create_venue(self, venue: Venue) -> Optional[Venue]:
        """Create a new venue in the data store. Returns the created venue with assigned ID."""
        retval: list[Venue] | None = self.create_venues_bulk([venue])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_venue(self, venue: Venue) -> Optional[Venue]:
        """Update a venue based on venue_id. Returns updated venue."""
        sql = f"""
            UPDATE venue SET
                facility_id=?,
                street=?,
                city=?,
                state=?,
                postal_code=?,
                cost=?,
                is_active=?
            WHERE venue_id=?
            {self.create_venue_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    venue.facility_id,
                    venue.street,
                    venue.city,
                    venue.state,
                    venue.postal_code,
                    venue.cost,
                    venue.is_active,
                    venue.venue_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_venue_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_venue_by_id(self, venue_id: int) -> Optional[Venue]:
        """Retrieve a venue by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE venue_id = ?")
            cursor.execute(sql, (venue_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_venue_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_venue_by_id(self, venue_id: int) -> bool:
        """Delete a venue by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM venue WHERE venue_id = ?"
            cursor.execute(sql, (venue_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_venue_by_id(self, venue_id: int) -> bool:
        """Soft-delete a venue by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE venue SET is_active=0 WHERE venue_id=?"
            cursor.execute(sql, (venue_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_venues(self) -> Optional[list[Venue]]:
        """List all venues in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            venues: list[Venue] = []
            for rs in cursor:
                v = self.create_venue_helper(rs)
                if v is not None:
                    venues.append(v)

        return venues if len(venues) > 0 else None

    # ------------------------------------------------------------------
    def list_active_venues(self) -> Optional[list[Venue]]:
        """List all active venues in the data store."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE is_active = 1")
            cursor.execute(sql)
            venues: list[Venue] = []
            for rs in cursor:
                v = self.create_venue_helper(rs)
                if v is not None:
                    venues.append(v)

        return venues if len(venues) > 0 else None

    # ------------------------------------------------------------------
    def search_venues(self, query: str) -> Optional[list[Venue]]:
        """Search active venues by address fields (street/city/state/postal_code substring)."""
        like = f"%{query}%"
        sql: str = """SELECT venue_id, facility_id, street, city, state, postal_code, cost, is_active
            FROM venue
            WHERE is_active = 1 AND (street LIKE ? OR city LIKE ? OR state LIKE ? OR postal_code LIKE ?)
            ORDER BY city ASC"""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (like, like, like, like))
            venues: list[Venue] = []
            for rs in cursor:
                v = self.create_venue_helper(rs)
                if v is not None:
                    venues.append(v)

        return venues if len(venues) > 0 else None

    # ------------------------------------------------------------------
    def list_venues_by_facility_id(self, facility_id: int) -> Optional[list[Venue]]:
        """List all venues for a given facility ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE facility_id = ?")
            cursor.execute(sql, (facility_id,))
            venues: list[Venue] = []
            for rs in cursor:
                v = self.create_venue_helper(rs)
                if v is not None:
                    venues.append(v)

        return venues if len(venues) > 0 else None

    # ------------------------------------------------------------------
    def create_venues_bulk(self, venues: list[Venue]) -> Optional[list[Venue]]:
        """Create multiple venues in bulk. Returns the created venues with assigned IDs."""
        if not venues:
            return []

        sql: str = """INSERT INTO venue (facility_id, street, city, state, postal_code, cost, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)"""

        data: list[tuple[int, str, str, str, str, float, int]] = []
        for v in venues:
            data.append(
                (
                    v.facility_id,
                    v.street,
                    v.city,
                    v.state,
                    v.postal_code,
                    v.cost,
                    int(v.is_active),
                )
            )

        with self._connect() as conn:
            conn.executemany(sql, data)

            if not data:
                conn.commit()
                return []

            sql_retrieve = self.get_record_select("WHERE rowid IN (SELECT last_insert_rowid() FROM venue)")
            cursor = conn.cursor()
            cursor.execute(sql_retrieve)
            created: list[Venue] = []
            for rs in cursor:
                v = self.create_venue_helper(rs)
                if v is not None:
                    created.append(v)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_venues_bulk(self, venues: list[Venue]) -> Optional[list[Venue]]:
        """Delete multiple venues in bulk. Returns the deleted venues."""
        if not venues:
            return []

        ids = [v.venue_id for v in venues if v.venue_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM venue WHERE venue_id IN ({placeholders})
            RETURNING venue_id, facility_id, street, city, state, postal_code, cost, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[Venue] = []
            for rs in deleted_rows:
                v = self.create_venue_helper(rs)
                if v is not None:
                    deleted.append(v)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_venues_bulk(self, venues: list[Venue]) -> Optional[list[Venue]]:
        """Soft-delete multiple venues in bulk. Returns the soft-deleted venues."""
        if not venues:
            return []

        ids = [v.venue_id for v in venues if v.venue_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE venue SET is_active=0 WHERE venue_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE venue_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[Venue] = []
            for rs in cursor.fetchall():
                v = self.create_venue_helper(rs)
                if v is not None:
                    soft_deleted.append(v)

            return soft_deleted if len(soft_deleted) > 0 else None
