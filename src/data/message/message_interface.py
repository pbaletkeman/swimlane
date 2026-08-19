"""
This module defines the MessageInterface, which abstracts the data management
layer for member messages. It provides an abstract base class with methods for
creating, retrieving, updating, and deleting message records.
"""

import abc
from typing import Optional

from src.data.message.message import Message


class MessageInterface(abc.ABC):
    """Abstract base class defining the interface for message data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_message(self, message: Message) -> Optional[Message]:
        """Create a new message in the data store. Returns the created message with assigned ID."""

    @abc.abstractmethod
    def update_message(self, message: Message) -> Optional[Message]:
        """Update a message based on message_id. Returns the updated message."""

    @abc.abstractmethod
    def get_message_by_id(self, message_id: int) -> Optional[Message]:
        """Retrieve a message by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def list_messages(self) -> Optional[list[Message]]:
        """List all messages in the data store."""

    @abc.abstractmethod
    def list_by_member(self, member_id: str) -> Optional[list[Message]]:
        """List a recipient's active inbox messages."""

    @abc.abstractmethod
    def mark_read(self, message_id: int) -> Optional[Message]:
        """Mark a message as read. Returns the updated message."""

    @abc.abstractmethod
    def hard_delete_message_by_id(self, message_id: int) -> bool:
        """Delete a message by its ID."""

    @abc.abstractmethod
    def delete_message_by_id(self, message_id: int) -> bool:
        """Soft-delete a message by its ID (sets is_active to 0)."""

    @abc.abstractmethod
    def create_messages_bulk(self, messages: list[Message]) -> Optional[list[Message]]:
        """Create multiple messages in bulk. Returns the created messages with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_messages_bulk(self, messages: list[Message]) -> Optional[list[Message]]:
        """Delete multiple messages in bulk. Returns the deleted messages."""

    @abc.abstractmethod
    def delete_messages_bulk(self, messages: list[Message]) -> Optional[list[Message]]:
        """Soft-delete multiple messages in bulk. Returns the soft-deleted messages."""
