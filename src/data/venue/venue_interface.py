"""
This module defines the VenueInterface interface, which abstracts the data management
layer for venue information. It provides an abstract base class with methods for
creating, retrieving, updating, and deleting venue records.
"""

import abc
from typing import Optional

from src.data.venue.venue import Venue


class VenueInterface(abc.ABC):
    """Abstract base class defining the interface for venue data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_venue(self, venue: Venue) -> Optional[Venue]:
        """Create a new venue in the data store. Returns the created venue with assigned ID."""

    @abc.abstractmethod
    def update_venue(self, venue: Venue) -> Optional[Venue]:
        """Update a venue based on venue_id. Returns updated venue."""

    @abc.abstractmethod
    def get_venue_by_id(self, venue_id: int) -> Optional[Venue]:
        """Retrieve a venue by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_venue_by_id(self, venue_id: int) -> bool:
        """Delete a venue by its ID."""

    @abc.abstractmethod
    def delete_venue_by_id(self, venue_id: int) -> bool:
        """Soft-delete a venue by its ID (sets is_active to False)."""

    def venue_exists(self, venue_id: int) -> bool:
        """Check if a venue record exists."""
        return self.get_venue_by_id(venue_id) is not None

    @abc.abstractmethod
    def list_venues(self) -> Optional[list[Venue]]:
        """List all venues in the data store."""

    @abc.abstractmethod
    def list_venues_by_facility_id(self, facility_id: int) -> Optional[list[Venue]]:
        """List all venues for a given facility ID."""

    @abc.abstractmethod
    def create_venues_bulk(self, venues: list[Venue]) -> Optional[list[Venue]]:
        """Create multiple venues in bulk. Returns the created venues with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_venues_bulk(self, venues: list[Venue]) -> Optional[list[Venue]]:
        """Delete multiple venues in bulk. Returns the deleted venues."""

    @abc.abstractmethod
    def delete_venues_bulk(self, venues: list[Venue]) -> Optional[list[Venue]]:
        """Soft-delete multiple venues in bulk. Returns the deleted venues."""
