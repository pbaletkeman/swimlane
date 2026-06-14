import sqlite3
from typing import Literal

from src.data.users.user_interface import UserInterface
from src.data.users.user import User
from src.config import SQLITE_FILE

class SQLite(UserInterface):
    """An implementation of the user's database opertions"""

    def get_create_table(self) -> str:
        """Get the User's Table DDL"""
        sql = """
            CREATE TABLE IF NOT EXISTS user (
                user_id               INTEGER  PRIMARY KEY AUTOINCREMENT
                                               UNIQUE
                                               NOT NULL,
                sub                   TEXT     NOT NULL,
                role                  TEXT     NOT NULL,
                first_name_nonce      TEXT     NOT NULL,
                first_name_ciphertext TEXT     NOT NULL,
                last_name_nonce       TEXT     NOT NULL,
                last_name_ciphertext  TEXT     NOT NULL,
                email_nonce           TEXT     NOT NULL,
                email_ciphertext      TEXT     NOT NULL,
                created_at            DATETIME NOT NULL
                                               DEFAULT CURRENT_TIMESTAMP,
                updated_at            DATETIME NOT NULL
                                               DEFAULT CURRENT_TIMESTAMP,
                deleted_at            DATETIME NULL,
                is_deleted            BOOLEAN  NOT NULL
                                               DEFAULT [FALSE],
                is_active             BOOLEAN  NOT NULL
                                               DEFAULT [FALSE]
            );
        """
        return sql

    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables.
        For in-memory, this may set up initial state."""

        with sqlite3.connect(SQLITE_FILE) as conn:
            cursor = conn.cursor()
            sql: str = self.get_create_table()
            cursor.execute(sql)
            conn.commit()


    # begin singular methods
    def create_user(self, user: User) -> User:
        """Create a new user or list of users in the data store. Returns the created user(s) with assigned IDs."""


    def update_user(self, current_sub: str, user: User ) -> Optional[User]:
        """Update a user based on current_sub to the values in user. Returns updated user"""

    def create_admin_user(self, sub: str) -> User:
        """Create a new admin user with the given subject identifier (sub). Returns the created user."""

    def get_user_by_sub(self, sub: str) -> Optional[User]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Find a user by email address and return it, or return None"""

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Find a user by user_id and return it, or return None"""

    # end singular methods

    # begin bulk methods
    def list_users_by_role(self, role: str) -> list[User]:
        """List all users that have a specific role."""

    def list_users(self) -> list[User]:
        """List all users in the data store."""

    def create_users_bulk(self, users: list[User]) -> list[User]:
        """Create multiple users in bulk. Returns the created users with assigned IDs."""

    def delete_users_bulk(self, users: list[User]) -> list[User]:
        """Delete multiple users in bulk. Returns the deleted users with assigned IDs."""
    # end bulk methods
