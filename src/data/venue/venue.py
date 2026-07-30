"""Venue data model for the Swimlane application."""

from pydantic import BaseModel


class Venue(BaseModel):
    """Data model representing a venue (e.g., a physical location with a facility)."""

    venue_id: int | None = None
    facility_id: int
    street: str
    city: str
    state: str
    postal_code: str
    cost: float = 0.0
    is_active: bool = True
