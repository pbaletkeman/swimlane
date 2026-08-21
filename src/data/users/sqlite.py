"""
SQLite Implementation of User Interface Layer for Swimlane Application (`swimlane/src/data/users/sqlite.py`).

This module provides database operations for user management using SQLite3 connections.
It serves as an interface layer (inheriting from `UserInterfaceBase`) to perform
CRUD operations (Create, Read, Update, Delete) on the 'users' table located in the
SQLite database file configured by `Config`.

Methods include:
- `get_create_table()`: Provides the DDL for setting up the users table schema.
- `get_record_select()`: Creates SQL fragments for selecting user data based on criteria.
- Helper methods (`create_user_helper`, `_get_list_of_users`): Transform raw row results into
  typed `User` objects or lists of subjects.
- Core CRUD operations (`create_user_bulk`, `update_user`, `delete_user_by_sub`, etc.):
  Handle the actual database transactions, managing soft deletes and role assignments.

Attributes:
    _sqlite_file (str): The path to the SQLite database where user data is stored.
"""

import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any, LiteralString, Optional

from src.data.connection import ClosingConnection
from src.data.users.user import User
from src.data.users.user_interface import UserInterface as UserInterfaceBase
from src.encryption import hash_field
from src.roles.roles import UserRole
from src.util.configs import Config

logger = logging.getLogger(__name__)


class SQLite(UserInterfaceBase):
    """An implementation of the user's database operations"""

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
        """Get the User's Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS users (
                id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
                sub                   TEXT     NOT NULL UNIQUE,
                role                  TEXT     NOT NULL DEFAULT 'member',
                first_name_nonce      TEXT     NOT NULL,
                first_name_ciphertext TEXT     NOT NULL,
                last_name_nonce       TEXT     NOT NULL,
                last_name_ciphertext  TEXT     NOT NULL,
                email_nonce           TEXT     NOT NULL UNIQUE,
                email_ciphertext      TEXT     NOT NULL,
                email_hash            TEXT     NOT NULL UNIQUE,
                created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at            TEXT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at            TEXT NULL,
                is_deleted            INTEGER  NULL DEFAULT 0,
                is_active             INTEGER  NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
            CREATE INDEX IF NOT EXISTS idx_users_sub ON users (sub);
            CREATE INDEX IF NOT EXISTS idx_users_email_nonce ON users (email_nonce);
            CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users (email_hash);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get user info"""

        sql: str = f"""SELECT id, sub, role, first_name_nonce, first_name_ciphertext, last_name_nonce,
            last_name_ciphertext, email_nonce, email_ciphertext, email_hash, created_at, updated_at, deleted_at,
            is_deleted, is_active
            FROM users {where} ORDER BY is_active DESC, created_at ASC"""
        return sql

    # ------------------------------------------------------------------
    def create_user_helper(self, rs: Any) -> Optional[User]:
        """Helper function to transform the sql data into a user object"""

        if rs:
            return User(
                sub=rs["sub"],
                role=rs["role"],
                first_name_ciphertext=rs["first_name_ciphertext"],
                first_name_nonce=rs["first_name_nonce"],
                last_name_ciphertext=rs["last_name_ciphertext"],
                last_name_nonce=rs["last_name_nonce"],
                email_ciphertext=rs["email_ciphertext"],
                email_nonce=rs["email_nonce"],
                email_hash=rs["email_hash"],
                is_active=rs["is_active"],
                is_deleted=rs["is_deleted"],
                created_at=rs["created_at"],
                deleted_at=rs["deleted_at"],
                updated_at=rs["updated_at"],
            )
        return None

    # ------------------------------------------------------------------
    def create_user_returning(self) -> str:
        """Create the user returning sql"""
        retval = """
            RETURNING
                sub,
                role,
                first_name_nonce,
                first_name_ciphertext,
                last_name_nonce,
                last_name_ciphertext,
                email_nonce,
                email_ciphertext,
                email_hash,
                created_at,
                updated_at,
                deleted_at,
                is_active,
                is_deleted;
"""
        return retval

    # ------------------------------------------------------------------
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables.
        For in-memory, this may set up initial state."""
        try:
            with self._connect() as conn:
                cursor = conn.cursor()
                sql: str = self.get_create_table()
                cursor.executescript(sql)
                conn.commit()
        except sqlite3.Error as e:
            logger.error("Database initialization failed: %s", e)
            raise

    def _get_sqlite_file(self) -> str:
        """Return the path to the SQLite database file."""
        return self._sqlite_file

    # ------------------------------------------------------------------
    @staticmethod
    def _get_list_of_users(user_list: list[User]) -> Optional[list[str]]:  # type: ignore[attr-defined]
        """Helper function to retrieve a list of strings (user sub) from [list]"""
        if not user_list:
            return None

        subs: list[str] = []
        for u in user_list:
            subs.append(str(u.sub))  # type: ignore[attr-defined]

        return subs

    # ------------------------------------------------------------------
    def get_sub(self, user_id: int) -> Optional[User]:
        """Retrieve a single user by their ID."""

        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "SELECT * FROM users WHERE id = ?"
            return_user = self.create_user_helper(cursor.execute(sql, (user_id,)).fetchone())

            return return_user

    # ------------------------------------------------------------------
    def get_sublist(self, user_list: list[User]) -> Optional[list[str]]:  # type: ignore[attr-defined]
        """Retrieve a list of [strings], each one being the sub of it's parent."""

        if not user_list:
            return None

        subs: list[str] = []
        for u in user_list:
            subs.append(str(u.sub))  # type: ignore[attr-defined]

        return subs

    # begin singular methods
    # ------------------------------------------------------------------
    def create_user(self, user: User) -> Optional[User]:
        """
        Create a new user in the data store. Returns the created user(s) with assigned ID.
        Delegate to `create_users_bulk`
        """

        retval: list[User] | None = self.create_users_bulk([user])
        if retval and len(retval) == 1:
            return retval[0]

    # ------------------------------------------------------------------
    def create_admin_user(self, user: User) -> Optional[User]:
        """Create a new admin user with the given subject identifier (sub). Returns the created user."""
        if self._config.get("security", {}).get("web_admins") and user.sub in self._config["security"]["web_admins"]:  # type: ignore[index]
            user.role = UserRole.WEB_ADMIN
        return self.create_user(user)

    # ------------------------------------------------------------------
    def update_user(self, user: User) -> Optional[User]:
        # Set updated_at to current UTC time
        user.updated_at = datetime.now(timezone.utc)

        sql = f"""
            UPDATE users SET
                role=?,
                first_name_ciphertext=?,
                first_name_nonce=?,
                last_name_ciphertext=?,
                last_name_nonce=?,
                email_ciphertext=?,
                email_nonce=?,
                email_hash=?,
                is_active=?,
                updated_at=?
            WHERE sub=?
            {self.create_user_returning()}
        """

        with self._connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                sql,
                (
                    user.role,
                    user.first_name_ciphertext,
                    user.first_name_nonce,
                    user.last_name_ciphertext,
                    user.last_name_nonce,
                    user.email_ciphertext,
                    user.email_nonce,
                    user.email_hash,
                    user.is_active,
                    # stored as TEXT (matches the CURRENT_TIMESTAMP column default);
                    # avoids the deprecated Python 3.12+ default datetime adapter
                    user.updated_at.strftime("%Y-%m-%d %H:%M:%S") if user.updated_at else None,
                    user.sub,
                ),
            )

            rs = cursor.fetchone()
            if rs:
                return self.create_user_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_user_by_sub(self, sub: str) -> Optional[User]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

        with self._connect() as conn:
            cursor = conn.cursor()

            return_user: Optional[User] = None
            sql: str = self.get_record_select("WHERE sub = ?")
            cursor.execute(sql, (sub,))
            rs = cursor.fetchone()
            if rs:
                return_user = self.create_user_helper(rs)
        return return_user

    # ------------------------------------------------------------------
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Find a user by email address and return it, or return None"""

        with self._connect() as conn:
            cursor = conn.cursor()

            return_user: Optional[User] = None
            email_h = hash_field(email)
            sql: str = self.get_record_select("WHERE email_hash = ?")
            cursor.execute(sql, (email_h,))
            rs = cursor.fetchone()
            if rs:
                return_user = self.create_user_helper(rs)
        return return_user

    # ------------------------------------------------------------------
    def hard_delete_user_by_sub(self, sub: str) -> bool:
        """Delete a user by their subject identifier."""

        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM USERS WHERE sub = ?"
            cursor.execute(sql, (sub,))
            conn.commit()
            was_deleted = cursor.rowcount > 0

        return bool(was_deleted)

    # ------------------------------------------------------------------
    def delete_user_by_sub(self, sub: str) -> bool:
        """Soft-delete a user by their subject identifier."""

        with self._connect() as conn:
            cursor = conn.cursor()

            sql = "UPDATE users SET is_deleted=1, deleted_at=CURRENT_TIMESTAMP WHERE sub = ?"
            cursor.execute(sql, (sub,))
            conn.commit()
            return cursor.rowcount == 1

    # end singular methods

    # begin bulk methods
    # ------------------------------------------------------------------
    def list_users_by_role(self, role: str) -> Optional[list[User]]:
        """List all users that have a specific role."""

        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select("WHERE role = ?")
            cursor.execute(sql, (role,))
            users: list[User] = []
            for rs in cursor:
                user = self.create_user_helper(rs)
                if user is not None:
                    users.append(user)

        return users if len(users) > 0 else None

    # ------------------------------------------------------------------
    def list_users(self) -> Optional[list[User]]:
        """List all users in the data store."""

        with self._connect() as conn:
            cursor = conn.cursor()

            sql: str = self.get_record_select()
            cursor.execute(sql)
            users: list[User] = []
            for rs in cursor:
                u = self.create_user_helper(rs)
                if u is not None:
                    users.append(u)

        return users if len(users) > 0 else None

    # ------------------------------------------------------------------
    def create_users_bulk(self, users: list[User]) -> Optional[list[User]]:  # type: ignore[attr-defined]
        """Create multiple users in bulk. Returns the created users with assigned IDs."""

        if not users:
            return []

        sql: str = """INSERT INTO "users" (
                 sub,
                 role,
                 first_name_nonce,
                 first_name_ciphertext,
                 last_name_nonce,
                 last_name_ciphertext,
                 email_nonce,
                 email_ciphertext,
                 email_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"""

        data: list[tuple[str, str, str, str, str, str, str, str, str]] = []
        subs_params: list[str] = []
        for user in users:
            valid_first_name = bool(user.first_name_nonce and user.first_name_ciphertext)
            valid_last_name = bool(user.last_name_nonce and user.last_name_ciphertext)
            valid_email = bool(user.email_nonce and user.email_ciphertext and user.email_hash)

            if not (
                bool(user.role and valid_first_name)  # type: ignore[attr-defined]
                and valid_last_name
                and valid_email
            ):
                continue

            data.append(
                (
                    str(user.sub),  # type: ignore[attr-defined]
                    str(user.role),  # type: ignore[union-attr]
                    user.first_name_nonce or "",
                    user.first_name_ciphertext or "",
                    user.last_name_nonce or "",
                    user.last_name_ciphertext or "",
                    user.email_nonce or "",
                    user.email_ciphertext or "",
                    user.email_hash or "",  # type: ignore[arg-type]
                )
            )

            subs_params.append(str(user.sub))  # type: ignore[attr-defined]

        with self._connect() as conn:
            cursor = conn.cursor()

            conn.executemany(sql, data)

            if not subs_params:
                conn.commit()
                return []

            placeholders = ", ".join(["?"] * len(subs_params))
            sql_retrieve_users: str = self.get_record_select(f"WHERE sub IN ({placeholders})") + " LIMIT 20"

            cursor.execute(sql_retrieve_users, subs_params)
            created_users: list[User] = []
            for rs in cursor:
                user = self.create_user_helper(rs)
                if user is not None:
                    created_users.append(user)

        return created_users if len(created_users) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_users_bulk(self, users: list[User]) -> Optional[list[User]]:
        """Delete multiple users in bulk. Returns the deleted users with assigned IDs."""
        if not users:
            return []

        subs = ", ".join("?" for _ in users)
        sql: str = f"""DELETE FROM users WHERE sub IN ({subs}) {self.create_user_returning()}"""

        with self._connect() as conn:
            cursor = conn.cursor()

            param_values = [u.sub for u in users if u.sub is not None]  # type: ignore[attr-defined]
            deleted_rows = cursor.execute(sql, param_values).fetchall()
            return_users: list[User] = []
            for rs in deleted_rows:
                u = self.create_user_helper(rs)
                if u is not None:
                    return_users.append(u)

            conn.commit()

        return return_users if len(return_users) > 0 else None

    # ------------------------------------------------------------------
    def delete_users_bulk(self, users: list[User]) -> Optional[list[User]]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

        if not users:
            return []

        sub_list = [str(u.sub) for u in users if u.sub is not None]  # type: ignore[attr-defined]

        placeholders = ", ".join(["?"] * len(sub_list))

        with self._connect() as conn:
            cursor = conn.cursor()

            update_sql = f"""UPDATE users SET is_deleted=1, deleted_at=CURRENT_TIMESTAMP WHERE sub IN
                ({placeholders})"""
            cursor.execute(update_sql, sub_list)
            conn.commit()

            if cursor.rowcount == 0:
                return []

            # Fetch the detailed records of the users that were just updated (by querying against their subjects)
            select_sql = self.get_record_select(f"WHERE sub IN ({placeholders}) AND deleted_at IS NOT NULL")
            cursor.execute(select_sql, sub_list)

            return_users: list[User] = []
            for rs in cursor.fetchall():
                u = self.create_user_helper(rs)
                if u is not None:
                    return_users.append(u)

            return return_users if len(return_users) > 0 else None

    # end bulk methods
