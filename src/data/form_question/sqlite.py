"""
SQLite Implementation of Form Question Interface Layer for Swimlane Application.

This module provides database operations for facility signup form question management
using SQLite3 connections. It serves as an interface layer (inheriting from
`FormQuestionInterface`) to perform CRUD operations on the 'form_question' table.
"""

import logging
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.form_question.form_question import FormQuestion
from src.data.form_question.form_question_interface import FormQuestionInterface as FormQuestionInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(FormQuestionInterfaceBase):
    """An implementation of the form question database operations"""

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
        """Get the Form Question Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS form_question (
                form_question_id INTEGER  PRIMARY KEY AUTOINCREMENT,
                facility_id      INTEGER  NOT NULL,
                prompt           TEXT     NOT NULL,
                question_type    TEXT     NOT NULL DEFAULT 'text'
                                   CHECK (question_type IN ('text', 'checkbox')),
                is_required      INTEGER  NULL DEFAULT 1,
                sort_order       INTEGER  NULL DEFAULT 0,
                is_active        INTEGER  NULL DEFAULT 1,
                FOREIGN KEY (facility_id) REFERENCES facility(facility_id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_form_question_facility_id ON form_question (facility_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get form question info"""
        sql: str = f"""SELECT form_question_id, facility_id, prompt, question_type, is_required, sort_order, is_active
            FROM form_question {where} ORDER BY sort_order ASC, form_question_id ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_form_question_helper(self, rs: Any) -> Optional[FormQuestion]:
        """Helper function to transform the sql data into a form question object"""
        if rs:
            return FormQuestion(
                form_question_id=rs["form_question_id"],
                facility_id=rs["facility_id"],
                prompt=rs["prompt"],
                question_type=rs["question_type"],
                is_required=rs["is_required"],
                sort_order=rs["sort_order"],
                is_active=rs["is_active"],
            )
        return None

    # ------------------------------------------------------------------
    def create_form_question_returning(self) -> str:
        """Create the form question returning sql"""
        return """RETURNING form_question_id, facility_id, prompt, question_type, is_required, sort_order, is_active;"""

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
    def create_form_question(self, form_question: FormQuestion) -> Optional[FormQuestion]:
        """Create a new form question in the data store. Returns the created form question with assigned ID."""
        retval: list[FormQuestion] | None = self.create_form_questions_bulk([form_question])
        if retval and len(retval) == 1:
            return retval[0]
        return None

    # ------------------------------------------------------------------
    def update_form_question(self, form_question: FormQuestion) -> Optional[FormQuestion]:
        """Update a form question based on form_question_id. Returns updated form question."""
        sql = f"""
            UPDATE form_question SET
                facility_id=?,
                prompt=?,
                question_type=?,
                is_required=?,
                sort_order=?,
                is_active=?
            WHERE form_question_id=?
            {self.create_form_question_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    form_question.facility_id,
                    form_question.prompt,
                    form_question.question_type,
                    form_question.is_required,
                    form_question.sort_order,
                    form_question.is_active,
                    form_question.form_question_id,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_form_question_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_form_question_by_id(self, form_question_id: int) -> Optional[FormQuestion]:
        """Retrieve a form question by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE form_question_id = ?")
            cursor.execute(sql, (form_question_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_form_question_helper(rs)

        return None

    # ------------------------------------------------------------------
    def hard_delete_form_question_by_id(self, form_question_id: int) -> bool:
        """Delete a form question by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM form_question WHERE form_question_id = ?"
            cursor.execute(sql, (form_question_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_form_question_by_id(self, form_question_id: int) -> bool:
        """Soft-delete a form question by its ID (sets is_active to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE form_question SET is_active=0 WHERE form_question_id=?"
            cursor.execute(sql, (form_question_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def list_form_questions_by_facility(self, facility_id: int) -> Optional[list[FormQuestion]]:
        """List all form questions for a given facility ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE facility_id = ?")
            cursor.execute(sql, (facility_id,))
            form_questions: list[FormQuestion] = []
            for rs in cursor:
                fq = self.create_form_question_helper(rs)
                if fq is not None:
                    form_questions.append(fq)

        return form_questions if len(form_questions) > 0 else None

    # ------------------------------------------------------------------
    def create_form_questions_bulk(self, form_questions: list[FormQuestion]) -> Optional[list[FormQuestion]]:
        """Create multiple form questions in bulk. Returns the created form questions with assigned IDs."""
        if not form_questions:
            return []

        sql: str = """INSERT INTO form_question (facility_id, prompt, question_type, is_required, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?)"""

        data: list[tuple[int, str, str, int, int, int]] = []
        for fq in form_questions:
            data.append(
                (
                    fq.facility_id,
                    fq.prompt,
                    str(fq.question_type),
                    int(fq.is_required),
                    fq.sort_order,
                    int(fq.is_active),
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
            sql_retrieve = self.get_record_select("WHERE form_question_id BETWEEN ? AND ?")
            cursor.execute(sql_retrieve, (first_rowid, last_rowid))
            created: list[FormQuestion] = []
            for rs in cursor:
                fq = self.create_form_question_helper(rs)
                if fq is not None:
                    created.append(fq)

        return created if len(created) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_form_questions_bulk(self, form_questions: list[FormQuestion]) -> Optional[list[FormQuestion]]:
        """Delete multiple form questions in bulk. Returns the deleted form questions."""
        if not form_questions:
            return []

        ids = [fq.form_question_id for fq in form_questions if fq.form_question_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM form_question WHERE form_question_id IN ({placeholders})
            RETURNING form_question_id, facility_id, prompt, question_type, is_required, sort_order, is_active"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[FormQuestion] = []
            for rs in deleted_rows:
                fq = self.create_form_question_helper(rs)
                if fq is not None:
                    deleted.append(fq)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_form_questions_bulk(self, form_questions: list[FormQuestion]) -> Optional[list[FormQuestion]]:
        """Soft-delete multiple form questions in bulk. Returns the soft-deleted form questions."""
        if not form_questions:
            return []

        ids = [fq.form_question_id for fq in form_questions if fq.form_question_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE form_question SET is_active=0 WHERE form_question_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE form_question_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[FormQuestion] = []
            for rs in cursor.fetchall():
                fq = self.create_form_question_helper(rs)
                if fq is not None:
                    soft_deleted.append(fq)

            return soft_deleted if len(soft_deleted) > 0 else None
