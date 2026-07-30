"""Schedule data model for the Swimlane application."""

from pydantic import BaseModel


class Schedule(BaseModel):
    """Data model representing a schedule (junction of member, event, and venue)."""

    schedule_id: int | None = None
    venue_id: int
    member_id: str
    event_id: int
    is_active: bool = True
