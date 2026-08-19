"""
This module defines the EventInterface interface, which abstracts the data management layer for event information.
It provides an abstract base class with methods for creating, retrieving, updating, and deleting event records.
"""

import abc
from typing import Optional

from src.data.event.event import Event


class EventInterface(abc.ABC):
    """Abstract base class defining the interface for event data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_event(self, event: Event) -> Optional[Event]:
        """Create a new event in the data store. Returns the created event with assigned ID."""

    @abc.abstractmethod
    def update_event(self, event: Event) -> Optional[Event]:
        """Update an event based on event_id. Returns updated event."""

    @abc.abstractmethod
    def get_event_by_id(self, event_id: int) -> Optional[Event]:
        """Retrieve an event by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_event_by_id(self, event_id: int) -> bool:
        """Delete an event by its ID."""

    @abc.abstractmethod
    def delete_event_by_id(self, event_id: int) -> bool:
        """Soft-delete an event by its ID (sets is_active to False)."""

    def event_exists(self, event_id: int) -> bool:
        """Check if an event record exists."""
        return self.get_event_by_id(event_id) is not None

    @abc.abstractmethod
    def list_events(self) -> Optional[list[Event]]:
        """List all events in the data store."""

    @abc.abstractmethod
    def list_public_events(
        self,
        start_from: str | None = None,
        start_to: str | None = None,
        venue_id: int | None = None,
        search: str | None = None,
    ) -> Optional[list[Event]]:
        """List active events within a start_date_time range (defaults to upcoming events).

        Pass ``venue_id`` to scope to events with an active schedule at that venue.
        Pass ``search`` to free-text filter on ``event.description``.
        """

    @abc.abstractmethod
    def list_events_in_range(
        self,
        start_iso: str,
        end_iso: str,
        venue_id: int | None = None,
    ) -> Optional[list[Event]]:
        """List active events overlapping ``[start_iso, end_iso]``.

        Pass ``venue_id`` to scope to events with an active schedule at that venue.
        """

    @abc.abstractmethod
    def list_events_by_frequency_id(self, frequency_id: int) -> Optional[list[Event]]:
        """List all events for a given frequency ID."""

    @abc.abstractmethod
    def create_events_bulk(self, events: list[Event]) -> Optional[list[Event]]:
        """Create multiple events in bulk. Returns the created events with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_events_bulk(self, events: list[Event]) -> Optional[list[Event]]:
        """Delete multiple events in bulk. Returns the deleted events."""

    @abc.abstractmethod
    def delete_events_bulk(self, events: list[Event]) -> Optional[list[Event]]:
        """Soft-delete multiple events in bulk. Returns the deleted events."""
