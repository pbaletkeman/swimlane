"""
SQLite Implementation of Facility Rule Interface Layer for Swimlane Application.

This module provides database operations for facility rules text management using
SQLite3 connections. It serves as an interface layer (inheriting from
`FacilityRuleInterface`) to perform CRUD operations on the 'facility_rule' table.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.facility_rule.facility_rule import FacilityRule
from src.data.facility_rule.facility_rule_interface import FacilityRuleInterface as FacilityRuleInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(FacilityRuleInterfaceBase):
    """An implementation of the facility rule database operations"""

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
        """Get the Facility Rule Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS facility_rule (
                rule_id     INTEGER  PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER  NOT NULL,
                title       TEXT     NOT NULL,
                content     TEXT     NOT NULL,
                sort_order  INTEGER  NULL DEFAULT 0,
                is_active   INTEGER  NULL DEFAULT 1,
                FOREIGN KEY (facility_id) REFERENCES facility(facility_id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_facility_rule_facility_id ON facility_rule (facility_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get facility rule info"""
        sql: str = f"""SELECT rule_id, facility_id, title, content, sort_order, is_active
            FROM facility_rule {where} ORDER BY sort_order ASC, rule_id ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_facility_rule_helper(self, rs: Any) -> Optional[FacilityRule]:
        """Helper function to transform the sql data into a facility rule object"""
        if rs:
            return FacilityRule(
                rule_id=rs["rule_id"],
                facility_id=rs["facility_id"],
                title=rs["title"],
                content=rs["content"],
                sort_order=rs["sort_order"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_facility_rule_returning(self) -> str:
        """Create the facility rule returning sql"""
        return """RETURNING rule_id, facility_id, title, content, sort_order, is_active;"""

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
    def create_rule(self, facility_rule: FacilityRule) -> Optional[FacilityRule]:
        """Create a new facility rule in the data store. Returns the created rule with assigned ID."""
        retval: list[FacilityRule] | None = self.create_rules_bulk([facility_rule])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_rule(self, facility_rule: FacilityRule) -> Optional[FacilityRule]:
        """Update a facility rule based on rule_id. Returns updated rule."""
        sql = f"""
            UPDATE facility_rule SET
                facility_id=?,
                title=?,
                content=?,
                sort_order=?,
                is_active=?
            WHERE rule_id=?
            {self.create_facility_rule_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    facility_rule.facility_id,
                    facility_rule.title,
                    facility_rule.content,
                    facility_rule.sort_order,
                    facility_rule.is_active,
                    facility_rule.rule_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_facility_rule_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_rule_by_id(self, rule_id: int) -> Optional[FacilityRule]:
        """Retrieve a facility rule by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE rule_id = ?")
            cursor.execute(sql, (rule_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_facility_rule_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_rule_by_id(self, rule_id: int) -> bool:
        """Delete a facility rule by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM facility_rule WHERE rule_id = ?"
            cursor.execute(sql, (rule_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_rule_by_id(self, rule_id: int) -> bool:
        """Soft-delete a facility rule by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE facility_rule SET is_active=0 WHERE rule_id=?"
            cursor.execute(sql, (rule_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_rules_by_facility(self, facility_id: int) -> Optional[list[FacilityRule]]:
        """List all facility rules for a given facility ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE facility_id = ?")
            cursor.execute(sql, (facility_id,))
            facility_rules: list[FacilityRule] = []
            for rs in cursor:
                fr = self.create_facility_rule_helper(rs)
                if fr is not None:
                    facility_rules.append(fr)

        return facility_rules if len(facility_rules) > 0 else None

    # ------------------------------------------------------------------
    def create_rules_bulk(self, facility_rules: list[FacilityRule]) -> Optional[list[FacilityRule]]:
        """Create multiple facility rules in bulk. Returns the created rules with assigned IDs."""
        if not facility_rules:
            return []

        sql: str = """INSERT INTO facility_rule (facility_id, title, content, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?)"""

        data: list[tuple[int, str, str, int, int]] = []
        for fr in facility_rules:
            data.append(
                (
                    fr.facility_id,
                    fr.title,
                    fr.content,
                    fr.sort_order,
                    int(fr.is_active),
                )
            )

        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.executemany(sql, data)

            if not data:
                conn.commit()
                return []

            cursor.execute("SELECT last_insert_rowid() AS last_rowid")
            last_rowid: int | None = cursor.fetchone()["last_rowid"]
            assert last_rowid is not None
            first_rowid: int = last_rowid - len(data) + 1
            sql_retrieve = self.get_record_select("WHERE rule_id BETWEEN ? AND ?")
            cursor.execute(sql_retrieve, (first_rowid, last_rowid))
            created: list[FacilityRule] = []
            for rs in cursor:
                fr = self.create_facility_rule_helper(rs)
                if fr is not None:
                    created.append(fr)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_rules_bulk(self, facility_rules: list[FacilityRule]) -> Optional[list[FacilityRule]]:
        """Delete multiple facility rules in bulk. Returns the deleted rules."""
        if not facility_rules:
            return []

        ids = [fr.rule_id for fr in facility_rules if fr.rule_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM facility_rule WHERE rule_id IN ({placeholders})
            RETURNING rule_id, facility_id, title, content, sort_order, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[FacilityRule] = []
            for rs in deleted_rows:
                fr = self.create_facility_rule_helper(rs)
                if fr is not None:
                    deleted.append(fr)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_rules_bulk(self, facility_rules: list[FacilityRule]) -> Optional[list[FacilityRule]]:
        """Soft-delete multiple facility rules in bulk. Returns the soft-deleted rules."""
        if not facility_rules:
            return []

        ids = [fr.rule_id for fr in facility_rules if fr.rule_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE facility_rule SET is_active=0 WHERE rule_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE rule_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[FacilityRule] = []
            for rs in cursor.fetchall():
                fr = self.create_facility_rule_helper(rs)
                if fr is not None:
                    soft_deleted.append(fr)

            return soft_deleted if len(soft_deleted) > 0 else None
