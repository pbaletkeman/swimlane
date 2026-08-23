"""
SQLite Implementation of Form Submission Interface Layer for Swimlane Application.

This module provides database operations for member form submissions using SQLite3
connections. It serves as an interface layer (inheriting from
`FormSubmissionInterface`) to perform CRUD operations on the 'form_submission' and
'form_response' tables. Submissions are created atomically with their responses in a
single transaction.
"""

import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.facility_rule.facility_rule import FacilityRule
from src.data.form_question.form_question import FormQuestion
from src.data.form_submission.form_response import FormResponse
from src.data.form_submission.form_submission import FormSubmission
from src.data.form_submission.form_submission_interface import FormSubmissionInterface as FormSubmissionInterfaceBase
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(FormSubmissionInterfaceBase):
    """An implementation of the form submission database operations"""

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
        """Get the Form Submission + Form Response Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS form_submission (
                submission_id INTEGER  PRIMARY KEY AUTOINCREMENT,
                facility_id   INTEGER  NOT NULL,
                sub           TEXT     NOT NULL,
                signed_at     TEXT,
                submitted_at  TEXT,
                is_complete   INTEGER  NULL DEFAULT 0,
                FOREIGN KEY (facility_id) REFERENCES facility(facility_id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (sub) REFERENCES users(sub)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                UNIQUE (sub, facility_id)
            );
            CREATE TABLE IF NOT EXISTS form_response (
                response_id   INTEGER  PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER  NOT NULL,
                question_id   INTEGER  NOT NULL,
                answer_text   TEXT,
                answer_bool   INTEGER,
                FOREIGN KEY (submission_id) REFERENCES form_submission(submission_id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (question_id) REFERENCES form_question(form_question_id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_form_submission_facility_id ON form_submission (facility_id);
            CREATE INDEX IF NOT EXISTS idx_form_submission_sub ON form_submission (sub);
            CREATE INDEX IF NOT EXISTS idx_form_response_submission_id ON form_response (submission_id);
            CREATE INDEX IF NOT EXISTS idx_form_response_question_id ON form_response (question_id);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get form submission info"""
        sql: str = f"""SELECT submission_id, facility_id, sub, signed_at, submitted_at, is_complete
            FROM form_submission {where} ORDER BY submitted_at DESC, submission_id DESC"""
        return sql

    # ------------------------------------------------------------------
    def create_form_submission_helper(self, rs: Any) -> Optional[FormSubmission]:
        """Helper function to transform the sql data into a form submission object"""
        if rs:
            return FormSubmission(
                submission_id=rs["submission_id"],
                facility_id=rs["facility_id"],
                sub=rs["sub"],
                signed_at=rs["signed_at"],
                submitted_at=rs["submitted_at"],
                is_complete=rs["is_complete"],
            )
        return None

    # ------------------------------------------------------------------
    def create_form_response_helper(self, rs: Any) -> Optional[FormResponse]:
        """Helper function to transform the sql data into a form response object"""
        if rs:
            return FormResponse(
                response_id=rs["response_id"],
                submission_id=rs["submission_id"],
                question_id=rs["question_id"],
                answer_text=rs["answer_text"],
                answer_bool=rs["answer_bool"],
            )
        return None

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
    def get_form_by_facility(self, facility_id: int) -> Optional[tuple[list[FormQuestion], list[FacilityRule]]]:
        """Fetch a facility's active signup form: active questions followed by active rules."""
        with self._connect() as conn:
            cursor = conn.cursor()

            questions: list[FormQuestion] = []
            cursor.execute(
                """SELECT form_question_id, facility_id, prompt, question_type, is_required, sort_order, is_active
                FROM form_question WHERE facility_id = ? AND is_active = 1
                ORDER BY sort_order ASC, form_question_id ASC""",
                (facility_id,),
            )
            for rs in cursor:
                questions.append(
                    FormQuestion(
                        form_question_id=rs["form_question_id"],
                        facility_id=rs["facility_id"],
                        prompt=rs["prompt"],
                        question_type=rs["question_type"],
                        is_required=rs["is_required"],
                        sort_order=rs["sort_order"],
                        is_active=rs["is_active"],
                    )
                )

            rules: list[FacilityRule] = []
            cursor.execute(
                """SELECT rule_id, facility_id, title, content, sort_order, is_active
                FROM facility_rule WHERE facility_id = ? AND is_active = 1
                ORDER BY sort_order ASC, rule_id ASC""",
                (facility_id,),
            )
            for rs in cursor:
                rules.append(
                    FacilityRule(
                        rule_id=rs["rule_id"],
                        facility_id=rs["facility_id"],
                        title=rs["title"],
                        content=rs["content"],
                        sort_order=rs["sort_order"],
                        is_active=rs["is_active"],
                    )
                )

        return questions, rules

    # ------------------------------------------------------------------
    def create_submission(self, submission: FormSubmission, responses: list[FormResponse]) -> Optional[FormSubmission]:
        """Create a submission and its responses atomically. Returns the created submission."""
        submitted_at = submission.submitted_at or datetime.now(timezone.utc)
        signed_at = submission.signed_at
        is_complete = int(submission.is_complete)

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT submission_id FROM form_submission WHERE sub = ? AND facility_id = ?",
                (submission.sub, submission.facility_id),
            )
            existing = cursor.fetchone()

            if existing:
                submission_id = existing["submission_id"]
                cursor.execute(
                    """UPDATE form_submission SET signed_at=?, submitted_at=?, is_complete=?
                    WHERE submission_id=?""",
                    (
                        signed_at.isoformat() if signed_at else None,
                        submitted_at.isoformat(),
                        is_complete,
                        submission_id,
                    ),
                )
                cursor.execute("DELETE FROM form_response WHERE submission_id = ?", (submission_id,))
            else:
                cursor.execute(
                    """INSERT INTO form_submission (facility_id, sub, signed_at, submitted_at, is_complete)
                    VALUES (?, ?, ?, ?, ?)""",
                    (
                        submission.facility_id,
                        submission.sub,
                        signed_at.isoformat() if signed_at else None,
                        submitted_at.isoformat(),
                        is_complete,
                    ),
                )
                submission_id = cursor.lastrowid

            if responses:
                data: list[tuple[int, str | None, int | None]] = []
                for response in responses:
                    data.append(
                        (
                            response.question_id,
                            response.answer_text,
                            int(response.answer_bool) if response.answer_bool is not None else None,
                        )
                    )
                cursor.executemany(
                    """INSERT INTO form_response (submission_id, question_id, answer_text, answer_bool)
                    VALUES (?, ?, ?, ?)""",
                    [(submission_id, qid, text, abool) for qid, text, abool in data],
                )

            conn.commit()

        assert submission_id is not None
        return self.get_submission_by_id(submission_id)

    # ------------------------------------------------------------------
    def get_responses_by_submission_id(self, submission_id: int) -> Optional[list[FormResponse]]:
        """Retrieve all responses for a given submission ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """SELECT response_id, submission_id, question_id, answer_text, answer_bool
                FROM form_response WHERE submission_id = ? ORDER BY response_id ASC""",
                (submission_id,),
            )
            responses: list[FormResponse] = []
            for rs in cursor:
                r = self.create_form_response_helper(rs)
                if r is not None:
                    responses.append(r)

        return responses if len(responses) > 0 else None

    # ------------------------------------------------------------------
    def get_submission_by_id(self, submission_id: int) -> Optional[FormSubmission]:
        """Retrieve a submission by its unique ID. Returns None if not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE submission_id = ?")
            cursor.execute(sql, (submission_id,))
            rs = cursor.fetchone()
            if rs:
                return self.create_form_submission_helper(rs)

        return None

    # ------------------------------------------------------------------
    def list_submissions_by_facility(self, facility_id: int) -> Optional[list[FormSubmission]]:
        """List all submissions for a given facility ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE facility_id = ?")
            cursor.execute(sql, (facility_id,))
            submissions: list[FormSubmission] = []
            for rs in cursor:
                s = self.create_form_submission_helper(rs)
                if s is not None:
                    submissions.append(s)

        return submissions if len(submissions) > 0 else None

    # ------------------------------------------------------------------
    def list_submissions_by_sub(self, sub: str) -> Optional[list[FormSubmission]]:
        """List all submissions for a given user sub."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE sub = ?")
            cursor.execute(sql, (sub,))
            submissions: list[FormSubmission] = []
            for rs in cursor:
                s = self.create_form_submission_helper(rs)
                if s is not None:
                    submissions.append(s)

        return submissions if len(submissions) > 0 else None

    # ------------------------------------------------------------------
    def get_by_id_with_responses(self, submission_id: int) -> Optional[tuple[FormSubmission, list[FormResponse]]]:
        """Retrieve a submission with its responses. Returns None if the submission is not found."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE submission_id = ?")
            cursor.execute(sql, (submission_id,))
            rs = cursor.fetchone()
            if not rs:
                return None
            submission = self.create_form_submission_helper(rs)
            if submission is None:
                return None

            cursor.execute(
                """SELECT response_id, submission_id, question_id, answer_text, answer_bool
                FROM form_response WHERE submission_id = ? ORDER BY response_id ASC""",
                (submission_id,),
            )
            responses: list[FormResponse] = []
            for r_rs in cursor:
                r = self.create_form_response_helper(r_rs)
                if r is not None:
                    responses.append(r)

        return submission, responses

    # ------------------------------------------------------------------
    def list_by_member(self, sub: str) -> Optional[list[dict[str, Any]]]:
        """List a member's submissions joined with their facility name."""
        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """SELECT fs.submission_id, fs.facility_id, f.name AS facility_name,
                          fs.signed_at, fs.submitted_at, fs.is_complete
                FROM form_submission fs
                JOIN facility f ON f.facility_id = fs.facility_id
                WHERE fs.sub = ?
                ORDER BY fs.submitted_at DESC, fs.submission_id DESC""",
                (sub,),
            )
            rows = [dict(rs) for rs in cursor.fetchall()]

        return rows if len(rows) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_submission_by_id(self, submission_id: int) -> bool:
        """Delete a submission (and its responses) by its ID."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM form_submission WHERE submission_id = ?"
            cursor.execute(sql, (submission_id,))
            conn.commit()
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    def delete_submission_by_id(self, submission_id: int) -> bool:
        """Soft-delete a submission by its ID (sets is_complete to 0)."""
        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE form_submission SET is_complete=0 WHERE submission_id=?"
            cursor.execute(sql, (submission_id,))
            conn.commit()
            return cursor.rowcount == 1

    # ------------------------------------------------------------------
    def hard_delete_submissions_bulk(self, submissions: list[FormSubmission]) -> Optional[list[FormSubmission]]:
        """Delete multiple submissions in bulk. Returns the deleted submissions."""
        if not submissions:
            return []

        ids = [s.submission_id for s in submissions if s.submission_id is not None]
        placeholders = ", ".join(["?"] * len(ids))
        sql: str = f"""DELETE FROM form_submission WHERE submission_id IN ({placeholders})
            RETURNING submission_id, facility_id, sub, signed_at, submitted_at, is_complete"""

        with self._connect() as conn:
            cursor = conn.cursor()
            deleted_rows = cursor.execute(sql, ids).fetchall()
            conn.commit()

            deleted: list[FormSubmission] = []
            for rs in deleted_rows:
                s = self.create_form_submission_helper(rs)
                if s is not None:
                    deleted.append(s)

        return deleted if len(deleted) > 0 else None

    # ------------------------------------------------------------------
    def delete_submissions_bulk(self, submissions: list[FormSubmission]) -> Optional[list[FormSubmission]]:
        """Soft-delete multiple submissions in bulk. Returns the soft-deleted submissions."""
        if not submissions:
            return []

        ids = [s.submission_id for s in submissions if s.submission_id is not None]
        placeholders = ", ".join(["?"] * len(ids))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"UPDATE form_submission SET is_complete=0 WHERE submission_id IN ({placeholders})"
            cursor.execute(update_sql, ids)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            select_sql = self.get_record_select(f"WHERE submission_id IN ({placeholders})")
            cursor.execute(select_sql, ids)
            soft_deleted: list[FormSubmission] = []
            for rs in cursor.fetchall():
                s = self.create_form_submission_helper(rs)
                if s is not None:
                    soft_deleted.append(s)

            return soft_deleted if len(soft_deleted) > 0 else None
