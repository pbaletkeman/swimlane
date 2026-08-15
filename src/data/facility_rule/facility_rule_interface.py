"""
This module defines the FacilityRuleInterface, which abstracts the data management layer
for facility rules text. It provides an abstract base class with methods for creating,
retrieving, updating, and deleting facility rule records.
"""

import abc
from typing import Optional

from src.data.facility_rule.facility_rule import FacilityRule


class FacilityRuleInterface(abc.ABC):
    """Abstract base class defining the interface for facility rule data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_rule(self, facility_rule: FacilityRule) -> Optional[FacilityRule]:
        """Create a new facility rule in the data store. Returns the created rule with assigned ID."""

    @abc.abstractmethod
    def update_rule(self, facility_rule: FacilityRule) -> Optional[FacilityRule]:
        """Update a facility rule based on rule_id. Returns updated rule."""

    @abc.abstractmethod
    def get_rule_by_id(self, rule_id: int) -> Optional[FacilityRule]:
        """Retrieve a facility rule by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_rule_by_id(self, rule_id: int) -> bool:
        """Delete a facility rule by its ID."""

    @abc.abstractmethod
    def delete_rule_by_id(self, rule_id: int) -> bool:
        """Soft-delete a facility rule by its ID (sets is_active to False)."""

    def rule_exists(self, *, rule_id: int | None = None) -> bool:
        """Check if a facility rule record exists."""
        if rule_id:
            return self.get_rule_by_id(rule_id) is not None
        return False

    @abc.abstractmethod
    def list_rules_by_facility(self, facility_id: int) -> Optional[list[FacilityRule]]:
        """List all facility rules for a given facility ID."""

    @abc.abstractmethod
    def create_rules_bulk(self, facility_rules: list[FacilityRule]) -> Optional[list[FacilityRule]]:
        """Create multiple facility rules in bulk. Returns the created rules with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_rules_bulk(self, facility_rules: list[FacilityRule]) -> Optional[list[FacilityRule]]:
        """Delete multiple facility rules in bulk. Returns the deleted rules."""

    @abc.abstractmethod
    def delete_rules_bulk(self, facility_rules: list[FacilityRule]) -> Optional[list[FacilityRule]]:
        """Soft-delete multiple facility rules in bulk. Returns the soft-deleted rules."""
