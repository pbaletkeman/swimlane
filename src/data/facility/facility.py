"""Facility data model for the Swimlane application."""

from pydantic import BaseModel


class Facility(BaseModel):
    """Data model representing a facility (e.g., pool, gym)."""

    facility_id: int | None = None
    name: str
    description: str | None = None
    max_capacity: int | None = None
    min_capacity: int | None = None
    is_active: bool = True
