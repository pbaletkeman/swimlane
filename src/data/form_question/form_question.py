"""Form question data model for the Swimlane application."""

from enum import StrEnum

from pydantic import BaseModel


class QuestionType(StrEnum):
    """Defines the available answer types for a form question."""

    TEXT = "text"
    CHECKBOX = "checkbox"


class FormQuestion(BaseModel):
    """Data model representing a configurable question in a facility's signup form."""

    form_question_id: int | None = None
    facility_id: int
    prompt: str
    question_type: QuestionType = QuestionType.TEXT
    is_required: bool = True
    sort_order: int = 0
    is_active: bool = True
