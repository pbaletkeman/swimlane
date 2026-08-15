"""Facility rule data model for the Swimlane application."""

from pydantic import BaseModel


class FacilityRule(BaseModel):
    """Data model representing a display-only rule for a facility."""

    rule_id: int | None = None
    facility_id: int
    title: str
    content: str
    sort_order: int = 0
    is_active: bool = True
