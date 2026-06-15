import sqlite3
from typing import Any, LiteralString, Optional

from src.data.users.user_interface import UserInterface
from src.data.users.user import User
from src.config import SQLITE_FILE

class SQLite(UserInterface):
    """An implementation of the user's database opertions"""

    # ------------------------------------------------------------------
    def get_create_table(self) -> LiteralString:
        """Get the User's Table DDL"""
        sql = """
            CREATE TABLE IF NOT EXISTS user (
                sub                   TEXT     PRIMARY KEY UNIQUE NOT NULL,
                role                  TEXT     NOT NULL,
                first_name_nonce      TEXT     NOT NULL,
                first_name_ciphertext TEXT     NOT NULL,
                last_name_nonce       TEXT     NOT NULL,
                last_name_ciphertext  TEXT     NOT NULL,
                email_nonce           TEXT     NOT NULL,
                email_ciphertext      TEXT     NOT NULL,
                created_at            DATETIME NULL
                                               DEFAULT CURRENT_TIMESTAMP,
                updated_at            DATETIME NULL
                                               DEFAULT CURRENT_TIMESTAMP,
                deleted_at            DATETIME NULL,
                is_deleted            BOOLEAN  NULL
                                               DEFAULT [FALSE],
                is_active             BOOLEAN  NULL
                                               DEFAULT [TRUE]
            );
        """
        return sql

    # ------------------------------------------------------------------
    def get_record_select(self)  -> LiteralString:
        """Helper function to create the sql to get user info"""

        sql: str = """
            SELECT
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
                is_deleted
            FROM USERS
            """
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
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables.
        For in-memory, this may set up initial state."""

        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()
            sql: str = self.get_create_table()
            cursor.execute(sql)
            conn.commit()

    # begin singular methods
    # ------------------------------------------------------------------
    def create_user(self, user: User) -> Optional[User]:
        """Create a new user in the data store. Returns the created user(s) with assigned IDs."""

    # ------------------------------------------------------------------
    def update_user(self, current_sub: str, user: User ) -> Optional[User]:
        """Update a user based on current_sub to the values in user. Returns updated user"""

    # ------------------------------------------------------------------
    def create_admin_user(self, sub: str) -> Optional[User]:
        """Create a new admin user with the given subject identifier (sub). Returns the created user."""

    # ------------------------------------------------------------------
    def get_user_by_sub(self, sub: str) -> Optional[User]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            return_user: Optional[User] = None
            sql: str = f"""{self.get_record_select()} WHERE sub = ?"""
            cursor.execute(sql, sub)
            rs = cursor.fetchone()
            if rs:
                return_user = self.create_user_helper(rs)
        return return_user

    # ------------------------------------------------------------------
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Find a user by email address and return it, or return None"""

        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            return_user: Optional[User] = None
            sql: str = f"""{self.get_record_select()} WHERE email = ?"""
            cursor.execute(sql, email)
            rs = cursor.fetchone()
            if rs:
                return_user = self.create_user_helper(rs)
        return return_user

    # ------------------------------------------------------------------
    def hard_delete_user_by_sub(self, sub: str) -> bool:
        """Delete a user by their subject identifier."""

        was_deleted: bool = False
        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            sql: str = "DELETE FROM USERS WHERE sub = ?"
            cursor.execute(sql, sub)
            conn.commit()

            was_deleted = cursor.rowcount > 0

        return was_deleted


# ------------------------------------------------------------------
    def delete_user_by_sub(self, sub: str) -> bool:
        """Delete a user by their subject identifier."""

        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            sql: str = "UPDATE USERS SET is_deleted='TRUE', deleted_at='NOW()' WHERE sub = ?"
            cursor.execute(sql, sub)
            conn.commit()

            return cursor.rowcount == 1

    # end singular methods

    # begin bulk methods
    # ------------------------------------------------------------------
    def list_users_by_role(self, role: str) -> Optional[list[User]]:
        """List all users that have a specific role."""

        users: list[User] = []
        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            sql: str = f"""{self.get_record_select()} WHERE role = ?
                ORDER BY is_deleted, is_active, created_at, updated_at"""
            cursor.execute(sql, role)
            for rs in cursor:
                user = self.create_user_helper(rs)
                if user:
                    users.append(user)
        return users

    # ------------------------------------------------------------------
    def list_users(self) -> Optional[list[User]]:
        """List all users in the data store."""

        users: list[User] = []
        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            sql: str = f"""{self.get_record_select()} ORDER BY is_deleted, is_active, created_at, updated_at"""
            cursor.execute(sql)
            for rs in cursor:
                u = self.create_user_helper(rs)
                if u:
                    users.append(u)
        return users

    # ------------------------------------------------------------------
    def create_users_bulk(self, users: list[User]) -> Optional[list[User]]:
        """Create multiple users in bulk. Returns the created users with assigned IDs."""

        if len(users) == 0:
            return []

        sql: str = """
            INSERT INTO USERS (
                sub,
                role,
                first_name_nonce,
                first_name_ciphertext,
                last_name_nonce,
                last_name_ciphertext,
                email_nonce,
                email_ciphertext) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        data: list[tuple[str, str, str, str, str, str, str, str]] = []
        for user in users:
            d = (
                user.sub,
                user.role,
                user.first_name_nonce,
                user.first_name_ciphertext,
                user.last_name_nonce,
                user.last_name_ciphertext,
                user.email_nonce,
                user.email_ciphertext,
            )
            data.append(d)
        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            # executemany automatically handles compilation and transactional grouping
            cursor.executemany(sql, data)
            conn.commit()
        return []

    # ------------------------------------------------------------------
    def hard_delete_users_bulk(self, users: list[User]) -> Optional[list[User]]:
        """Delete multiple users in bulk. Returns the deleted users with assigned IDs."""
        if len(users) == 0:
            return []

        subs = ",".join(f"'{u.sub}'" for u in users)

        sql = f"""DELETE FROM USERS WHERE sub in ({subs}) RETURNING
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

        return_users: list[User] = []
        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            cursor.execute(sql)

            deleted_rows = cursor.fetchall()
            for rs in deleted_rows:
                u = self.create_user_helper(rs)
                if u:
                    return_users.append(u)

            conn.commit()

        return return_users

    # ------------------------------------------------------------------
    def delete_users_bulk(self, users: list[User]) -> Optional[list[User]]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

        if len(users) == 0:
            return []

        subs = ",".join(f"'{u.sub}'" for u in users)
        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()

            sql: str = f"""UPDATE USERS SET is_deleted='True', deleted_at='NOW()' WHERE sub in ({subs}) RETURNING
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

            return_users: list[User] = []
            with sqlite3.connect(SQLITE_FILE) as conn:
                cursor = conn.cursor()

                cursor.execute(sql)

                deleted_rows = cursor.fetchall()
                for rs in deleted_rows:
                    u = self.create_user_helper(rs)
                    if u:
                        return_users.append(u)

                conn.commit()

            return return_users
    # end bulk methods
