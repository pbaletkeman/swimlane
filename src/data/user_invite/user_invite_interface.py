"""Interface for the user invite data layer."""

import abc
from typing import Optional

from src.data.user_invite.user_invite import UserInvite


class UserInviteInterface(abc.ABC):
    """Abstract base class for storing pending user invites keyed by email hash."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_invite(self, invite: UserInvite) -> Optional[UserInvite]:
        """Create or update an invite keyed by email hash. Returns the stored invite."""

    @abc.abstractmethod
    def get_invite_by_email_hash(self, email_hash: str) -> Optional[UserInvite]:
        """Retrieve an invite by its email hash. Returns None if not found."""

    @abc.abstractmethod
    def delete_invite_by_email_hash(self, email_hash: str) -> bool:
        """Delete an invite by its email hash (consumed on first login). Returns True if deleted."""
