"""Form submission data model for the Swimlane application."""

import datetime

from pydantic import BaseModel


class FormSubmission(BaseModel):
    """Data model representing a member's submitted signup form for a facility."""

    submission_id: int | None = None
    facility_id: int
    sub: str  # Unique identifier for the user (e.g., subject claim from JWT)
    signed_at: datetime.datetime | None = None
    submitted_at: datetime.datetime | None = None
    is_complete: bool = False
