"""
This module defines the FrequencyInterface interface, which abstracts the data management layer for frequency information.
It provides an abstract base class with methods for creating, retrieving, updating, and deleting frequency records.
"""
import abc
from typing import Optional
from src.data.frequency.frequency import Frequency


class FrequencyInterface(abc.ABC):
    """Abstract base class defining the interface for frequency data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_frequency(self, frequency: Frequency) -> Optional[Frequency]:
        """Create a new frequency in the data store. Returns the created frequency with assigned ID."""

    @abc.abstractmethod
    def update_frequency(self, frequency: Frequency) -> Optional[Frequency]:
        """Update a frequency based on frequency_id. Returns updated frequency."""

    @abc.abstractmethod
    def get_frequency_by_id(self, frequency_id: int) -> Optional[Frequency]:
        """Retrieve a frequency by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def get_frequency_by_name(self, name: str) -> Optional[Frequency]:
        """Retrieve a frequency by its unique name. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_frequency_by_id(self, frequency_id: int) -> bool:
        """Delete a frequency by its ID."""

    @abc.abstractmethod
    def delete_frequency_by_id(self, frequency_id: int) -> bool:
        """Soft-delete a frequency by its ID (sets is_active to False)."""

    def frequency_exists(self, *, frequency_id: int | None = None, name: str | None = None) -> bool:
        """Check if a frequency record exists."""
        if frequency_id:
            return self.get_frequency_by_id(frequency_id) is not None
        elif name:
            return self.get_frequency_by_name(name) is not None
        else:
            return False

    @abc.abstractmethod
    def list_frequencies(self) -> Optional[list[Frequency]]:
        """List all frequencies in the data store."""

    @abc.abstractmethod
    def create_frequencies_bulk(self, frequencies: list[Frequency]) -> Optional[list[Frequency]]:
        """Create multiple frequencies in bulk. Returns the created frequencies with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_frequencies_bulk(self, frequencies: list[Frequency]) -> Optional[list[Frequency]]:
        """Delete multiple frequencies in bulk. Returns the deleted frequencies."""

    @abc.abstractmethod
    def delete_frequencies_bulk(self, frequencies: list[Frequency]) -> Optional[list[Frequency]]:
        """Soft-delete multiple frequencies in bulk. Returns the deleted frequencies."""
