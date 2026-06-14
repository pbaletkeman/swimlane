"""
This module defines the UserInterface interface, which abstracts the data management layer for user information.
It provides an abstract base class with methods for creating, retrieving, updating, and deleting user records,
as well as listing users by role. This interface allows for different implementations of user data storage
(e.g., in-memory, database) while maintaining a consistent API for user operations across the application.
"""
import abc
from typing import Optional
from src.users import User

class UserInterface(abc.ABC):
    """Abstract base class defining the interface for user data management.
    This interface abstracts away the underlying data storage mechanism, allowing for different implementations
    (e.g., in-memory, database, etc.) while providing a consistent API for user operations."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables.
        For in-memory, this may set up initial state."""

    # begin singular methods
    @abc.abstractmethod
    def create_user(self, user: User) -> User:
        """Create a new user or list of users in the data store. Returns the created user(s) with assigned IDs."""

    @abc.abstractmethod
    def update_user(self, current_sub: str, user: User ) -> Optional[User]:
        """Update a user based on current_sub to the values in user. Returns updated user"""

    @abc.abstractmethod
    def create_admin_user(self, sub: str) -> User:
        """Create a new admin user with the given subject identifier (sub). Returns the created user."""

    @abc.abstractmethod
    def get_user_by_sub(self, sub: str) -> Optional[User]:
        """Retrieve a user by their unique subject identifier (sub). Returns None if not found."""

    @abc.abstractmethod
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Find a user by email address and return it, or return None"""

    @abc.abstractmethod
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Find a user by user_id and return it, or return None"""

    @abc.abstractmethod
    def delete_user_by_sub(self, sub: str) -> bool:
        """Delete a user by their subject identifier."""

    def user_exists(self, *, sub: str | None = None, email: str | None = None, user_id: str | None = None) -> bool:
        """Check the database to see if the user record is found"""
        if sub:
            return self.get_user_by_sub(sub) is not None
        elif email:
            return self.get_user_by_email(email) is not None
        elif user_id:
            return self.get_user_by_id(user_id) is not None
        else:
            return False
    # end singular methods

    # begin bulk methods
    @abc.abstractmethod
    def list_users_by_role(self, role: str) -> list[User]:
        """List all users that have a specific role."""

    @abc.abstractmethod
    def list_users(self) -> list[User]:
        """List all users in the data store."""

    @abc.abstractmethod
    def create_users_bulk(self, users: list[User]) -> list[User]:
        """Create multiple users in bulk. Returns the created users with assigned IDs."""

    @abc.abstractmethod
    def delete_users_bulk(self, users: list[User]) -> list[User]:
        """Delete multiple users in bulk. Returns the deleted users with assigned IDs."""
