from datetime import datetime, timezone
import sqlite3
from typing import Any, LiteralString, Optional

from src.data.users.user import User
from src.data.users.user_interface import UserInterface as UserInterfaceBase
from src.roles.roles import UserRole
from src.util.configs import Config


class SQLite(UserInterfaceBase):
    """An implementation of the user's database operations"""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._config = Config().yamlconfig or {}  # type: ignore[union-attr]
        sql_config = dict(self._config).get("sql", {}) if hasattr(dict.keys(), "items") else {}
        self._sqlite_file: str = ""

    # ------------------------------------------------------------------
    def get_create_table(self) -> LiteralString:
        """Get the User's Table DDL"""
        sql = """CREATE TABLE IF NOT EXISTS users (
                id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
                sub                   TEXT     NOT NULL UNIQUE,
                role                  TEXT     NOT NULL DEFAULT 'USER',
                first_name_nonce      TEXT     NOT NULL,
                first_name_ciphertext TEXT     NOT NULL,
                last_name_nonce       TEXT     NOT NULL,
                last_name_ciphertext  TEXT     NOT NULL,
                email_nonce           TEXT     NOT NULL UNIQUE,
                email_ciphertext      TEXT     NOT NULL,
                created_at            TEXT NOT NULL DEFAULT datetime('now', 'utc'),
                updated_at            TEXT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at            TEXT NULL,
                is_deleted            INTEGER  NULL DEFAULT 0, -- Using INTEGER for boolean clarity
                is_active             INTEGER  NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
            CREATE INDEX IF NOT EXISTS idx_users_sub ON users (sub);
            CREATE INDEX IF NOT EXISTS idx_users_email_nonce ON users (email_nonce);"""
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self, where: str = "") -> str:
        """Helper function to create the sql to get user info"""

        sql: str = f"""SELECT id, sub, role, first_name_nonce, first_name_ciphertext, last_name_nonce,
            last_name_ciphertext, email_nonce, email_ciphertext, created_at, updated_at, deleted_at
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
                    is_active=rs["is_active"],
                    is_deleted=rs["is_deleted"],
                    created_at=rs["created_at"],
                    deleted_at=rs["deleted_at"],
                    updated_at=rs["updated_at"],
                )

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

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()
            sql: str = self.get_create_table()
            cursor.execute(sql)
            conn.commit()

    def _get_sqlite_file(self) -> str:
        """Return the path to the SQLite database file."""
        return self._sqlite_file

    # ------------------------------------------------------------------
    @staticmethod
    def _get_list_of_users(user_list: list[User]) -> Optional[list[str]]:  # type: ignore[attr-defined]
        """Helper function to retrieve a list of strings (user sub) from [list]"""
        if not user_list:
            return None

        subs = []
        for u in user_list:
            subs.append(str(u.sub))  # type: ignore[attr-defined]

        return subs

    # ------------------------------------------------------------------
    def get_sub(self, id: int) -> Optional[User]:
        """Retrieve a single user by their ID."""

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            sql = "SELECT * FROM users WHERE id = ?"
            return_user = self.create_user_helper(cursor.execute(sql, (id,)).fetchone())

            return return_user

    # ------------------------------------------------------------------
    def get_sublist(self, user_list: list[User]) -> Optional[list[str]]:  # type: ignore[attr-defined]
        """Retrieve a list of [strings], each one being the sub of it's parent."""

        if not user_list:
            return None

        subs = []
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
        if self._config.get("security", {}).get("web_admin") and user.sub in self._config["security"]["web_admin"]:  # type: ignore[index]
            user.role = UserRole.WEB_ADMIN
            user.role = UserRole.WEB_ADMIN
        self.create_user(user)

    # ------------------------------------------------------------------
    def update_user(self, user: User) -> Optional[User]:
        # Set updated_at to current UTC time
        user.updated_at = datetime.now(timezone.utc)

        sql = f"""
            UPDATE USER SET
                role=?,
                first_name_ciphertext=?,
                first_name_nonce=?,
                last_name_ciphertext=?,
                last_name_nonce=?,
                email_ciphertext=?,
                email_nonce=?,
                is_active=?,
                updated_at=?
            WHERE sub=?
            {self.create_user_returning()}
        """

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            cursor.execute(sql, (
                user.role,
                user.first_name_ciphertext,
                user.first_name_nonce,
                user.last_name_ciphertext,
                user.last_name_nonce,
                user.email_ciphertext,
                user.email_nonce,
                user.is_active,
                user.updated_at,
                user.sub
            ))

            rs = cursor.fetchone()
            if rs:
                return self.create_user_helper(rs)

        return None

    # ------------------------------------------------------------------
    def get_user_by_sub(self, sub: str) -> Optional[User]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

        with sqlite3.connect(self._sqlite_file) as conn:
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

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            return_user: Optional[User] = None
            sql: str = self.get_record_select("WHERE email_nonce = ?")
            cursor.execute(sql, (email,))
            rs = cursor.fetchone()
            if rs:
                return_user = self.create_user_helper(rs)
        return return_user

    # ------------------------------------------------------------------
    def hard_delete_user_by_sub(self, sub: str) -> bool:
        """Delete a user by their subject identifier."""

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM USERS WHERE sub = ?"
            cursor.execute(sql, (sub,))
            conn.commit()
            was_deleted = cursor.rowcount > 0

        return bool(was_deleted)

    # ------------------------------------------------------------------
    def delete_user_by_sub(self, sub: str) -> bool:
        """Soft-delete a user by their subject identifier."""

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            sql = "UPDATE users SET is_deleted=1, deleted_at=CURRENT_TIMESTAMP WHERE sub = ?"
            cursor.execute(sql, (sub,))
            conn.commit()
            return int(cursor.rowcount) == 1

    # end singular methods

    # begin bulk methods
    # ------------------------------------------------------------------
    def list_users_by_role(self, role: str) -> Optional[list[User]]:
        """List all users that have a specific role."""

        with sqlite3.connect(self._sqlite_file) as conn:
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

        with sqlite3.connect(self._sqlite_file) as conn:
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

        subs = ""
        for u in users:
            valid_first_name = bool(u.first_name_nonce and u.first_name_ciphertext)
            valid_last_name = bool(u.last_name_nonce and u.last_name_ciphertext)
            valid_email = bool(u.email_nonce and u.email_ciphertext)

            if bool(u.role and valid_first_name) and valid_last_name and valid_email:
                subs += f" '{u.sub}',"

        sql: str = """INSERT INTO "users" (
                 sub,
                 role,
                 first_name_nonce,
                 first_name_ciphertext,
                 last_name_nonce,
                 last_name_ciphertext,
                 email_nonce,
                 email_ciphertext)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""

        data: list[tuple[str, str, str, str, str, str, str, str]] = []
        subs_params = []  # type: ignore[attr-defined]
        for user in users:
            valid_first_name = bool(user.first_name_nonce and user.first_name_ciphertext)
            valid_last_name = bool(user.last_name_nonce and user.last_name_ciphertext)
            valid_email = bool(user.email_nonce and user.email_ciphertext)

            if not (bool(user.role and valid_first_name) and valid_last_name and valid_email):  # type: ignore[attr-defined]
                continue

            data.append((
                str(user.sub),      # type: ignore[attr-defined]
                str(user.role),     # type: ignore[union-attr]
                user.first_name_nonce or "",
                user.first_name_ciphertext or "",
                user.last_name_nonce or "",
                user.last_name_ciphertext or "",
                user.email_nonce or "",
                user.email_ciphertext or "",
            ))

            subs_params.append(str(user.sub))  # type: ignore[attr-defined]

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            conn.executemany(sql, data)

            if not subs_params:
                conn.commit()
                return []

            params_values_clause_sub = ", ".join([f"'{u}'" for u in subs_params])
            sql_retrieve_users: str = self.get_record_select(f"WHERE sub IN ({params_values_clause_sub})") + " LIMIT 20"

            cursor.execute(sql_retrieve_users)
            users: list[User] = []
            for rs in cursor:
                user = self.create_user_helper(rs)
                if user is not None:
                    users.append(user)

        return users if len(users) > 0 else None

    # ------------------------------------------------------------------
    def hard_delete_users_bulk(self, users: list[User]) -> Optional[list[User]]:
        """Delete multiple users in bulk. Returns the deleted users with assigned IDs."""
        if not users:
            return []

        subs = ", ".join("?" for _ in users)
        sql: str = f"""DELETE FROM users WHERE sub IN ({subs}) {self.create_user_returning()}"""

        with sqlite3.connect(self._sqlite_file) as conn:
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

        params_sql_values_in = ",".join(f"?" for _ in users)
        subs = ",".join(f"'{u.sub}'" for u in users)
        sql: str = f"""UPDATE "users" SET is_deleted=1, deleted_at=CURRENT_TIMESTAMP WHERE sub IN ({params_sql_values_in}) {self.create_user_returning()}"""

        with sqlite3.connect(self._sqlite_file) as conn:
            cursor = conn.cursor()

            cursor.execute(sql)
            return_users: list[User] = []
            deleted_rows = cursor.fetchall()
            for rs in deleted_rows:
                u = self.create_user_helper(rs)
                if u is not None:
                    return_users.append(u)

            conn.commit()
            return return_users if len(return_users) > 0 else None
    # end bulk methods
