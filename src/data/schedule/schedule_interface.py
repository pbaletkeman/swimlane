"""
This module defines the ScheduleInterface interface, which abstracts the data management layer for schedule information.
It provides an abstract base class with methods for creating, retrieving, updating, and deleting schedule records.
"""

import abc
from typing import Optional

from src.data.schedule.schedule import Schedule


class ScheduleInterface(abc.ABC):
    """Abstract base class defining the interface for schedule data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_schedule(self, schedule: Schedule) -> Optional[Schedule]:
        """Create a new schedule in the data store. Returns the created schedule with assigned ID."""

    @abc.abstractmethod
    def update_schedule(self, schedule: Schedule) -> Optional[Schedule]:
        """Update a schedule based on schedule_id. Returns updated schedule."""

    @abc.abstractmethod
    def get_schedule_by_id(self, schedule_id: int) -> Optional[Schedule]:
        """Retrieve a schedule by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_schedule_by_id(self, schedule_id: int) -> bool:
        """Delete a schedule by its ID."""

    @abc.abstractmethod
    def delete_schedule_by_id(self, schedule_id: int) -> bool:
        """Soft-delete a schedule by its ID (sets is_active to False)."""

    def schedule_exists(self, schedule_id: int) -> bool:
        """Check if a schedule record exists."""
        return self.get_schedule_by_id(schedule_id) is not None

    @abc.abstractmethod
    def list_schedules(self) -> Optional[list[Schedule]]:
        """List all schedules in the data store."""

    @abc.abstractmethod
    def list_schedules_by_member_id(self, member_id: str) -> Optional[list[Schedule]]:
        """List all schedules for a given member ID."""

    @abc.abstractmethod
    def list_schedules_by_event_id(self, event_id: int) -> Optional[list[Schedule]]:
        """List all schedules for a given event ID."""

    @abc.abstractmethod
    def list_schedules_by_venue_id(self, venue_id: int) -> Optional[list[Schedule]]:
        """List all schedules for a given venue ID."""

    @abc.abstractmethod
    def create_schedules_bulk(self, schedules: list[Schedule]) -> Optional[list[Schedule]]:
        """Create multiple schedules in bulk. Returns the created schedules with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_schedules_bulk(self, schedules: list[Schedule]) -> Optional[list[Schedule]]:
        """Delete multiple schedules in bulk. Returns the deleted schedules."""

    @abc.abstractmethod
    def delete_schedules_bulk(self, schedules: list[Schedule]) -> Optional[list[Schedule]]:
        """Soft-delete multiple schedules in bulk. Returns the soft-deleted schedules."""
