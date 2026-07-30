"""Event data model for the Swimlane application."""

from pydantic import BaseModel


class Event(BaseModel):
    """Data model representing an event (e.g., a swim session)."""

    event_id: int | None = None
    start_date_time: str
    end_date_time: str
    frequency_id: int | None = None
    is_active: bool = True
