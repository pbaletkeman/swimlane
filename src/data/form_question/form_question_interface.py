"""
This module defines the FormQuestionInterface, which abstracts the data management layer
for facility signup form questions. It provides an abstract base class with methods for
creating, retrieving, updating, and deleting form question records.
"""

import abc
from typing import Optional

from src.data.form_question.form_question import FormQuestion


class FormQuestionInterface(abc.ABC):
    """Abstract base class defining the interface for form question data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def create_form_question(self, form_question: FormQuestion) -> Optional[FormQuestion]:
        """Create a new form question in the data store. Returns the created form question with assigned ID."""

    @abc.abstractmethod
    def update_form_question(self, form_question: FormQuestion) -> Optional[FormQuestion]:
        """Update a form question based on form_question_id. Returns updated form question."""

    @abc.abstractmethod
    def get_form_question_by_id(self, form_question_id: int) -> Optional[FormQuestion]:
        """Retrieve a form question by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def hard_delete_form_question_by_id(self, form_question_id: int) -> bool:
        """Delete a form question by its ID."""

    @abc.abstractmethod
    def delete_form_question_by_id(self, form_question_id: int) -> bool:
        """Soft-delete a form question by its ID (sets is_active to False)."""

    def form_question_exists(self, *, form_question_id: int | None = None) -> bool:
        """Check if a form question record exists."""
        if form_question_id:
            return self.get_form_question_by_id(form_question_id) is not None
        return False

    @abc.abstractmethod
    def list_form_questions_by_facility(self, facility_id: int) -> Optional[list[FormQuestion]]:
        """List all form questions for a given facility ID."""

    @abc.abstractmethod
    def create_form_questions_bulk(self, form_questions: list[FormQuestion]) -> Optional[list[FormQuestion]]:
        """Create multiple form questions in bulk. Returns the created form questions with assigned IDs."""

    @abc.abstractmethod
    def hard_delete_form_questions_bulk(self, form_questions: list[FormQuestion]) -> Optional[list[FormQuestion]]:
        """Delete multiple form questions in bulk. Returns the deleted form questions."""

    @abc.abstractmethod
    def delete_form_questions_bulk(self, form_questions: list[FormQuestion]) -> Optional[list[FormQuestion]]:
        """Soft-delete multiple form questions in bulk. Returns the soft-deleted form questions."""
