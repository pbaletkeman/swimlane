"""Form response data model for the Swimlane application."""

from pydantic import BaseModel


class FormResponse(BaseModel):
    """Data model representing a single answer to a form question within a submission."""

    response_id: int | None = None
    submission_id: int
    question_id: int
    answer_text: str | None = None
    answer_bool: bool | None = None
