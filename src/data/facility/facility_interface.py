"""
This module defines the FacilityInterface interface, which abstracts the data management layer for facility information.
It provides an abstract base class with methods for creating, retrieving, updating, and deleting facility records.
"""
import abc
from typing import Optional

from src.data.facility.facility import Facility


class FacilityInterface(abc.ABC):
    """Abstract base class defining the interface for facility data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_facility(self, facility: Facility) -> Optional[Facility]:
        """Create a new facility in the data store. Returns the created facility with assigned ID."""

    @abc.abstractmethod
    def update_facility(self, facility: Facility) -> Optional[Facility]:
        """Update a facility based on facility_id. Returns updated facility."""

    @abc.abstractmethod
    def get_facility_by_id(self, facility_id: int) -> Optional[Facility]:
        """Retrieve a facility by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def get_facility_by_name(self, name: str) -> Optional[Facility]:
        """Retrieve a facility by its unique name. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_facility_by_id(self, facility_id: int) -> bool:
        """Delete a facility by its ID."""

    @abc.abstractmethod
    def delete_facility_by_id(self, facility_id: int) -> bool:
        """Soft-delete a facility by its ID (sets is_active to False)."""

    def facility_exists(self, *, facility_id: int | None = None, name: str | None = None) -> bool:
        """Check if a facility record exists."""
        if facility_id:
            return self.get_facility_by_id(facility_id) is not None
        elif name:
            return self.get_facility_by_name(name) is not None
        else:
            return False

    @abc.abstractmethod
    def list_facilities(self) -> Optional[list[Facility]]:
        """List all facilities in the data store."""

    @abc.abstractmethod
    def create_facilities_bulk(self, facilities: list[Facility]) -> Optional[list[Facility]]:
        """Create multiple facilities in bulk. Returns the created facilities with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_facilities_bulk(self, facilities: list[Facility]) -> Optional[list[Facility]]:
        """Delete multiple facilities in bulk. Returns the deleted facilities."""

    @abc.abstractmethod
    def delete_facilities_bulk(self, facilities: list[Facility]) -> Optional[list[Facility]]:
        """Soft-delete multiple facilities in bulk. Returns the deleted facilities."""
