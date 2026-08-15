"""
This module defines the FormSubmissionInterface, which abstracts the data management layer
for member form submissions. It provides an abstract base class with methods for fetching
a facility's signup form, creating submissions atomically with their responses, and
querying/deleting submission records.
"""

import abc
from typing import Optional

from src.data.facility_rule.facility_rule import FacilityRule
from src.data.form_question.form_question import FormQuestion
from src.data.form_submission.form_response import FormResponse
from src.data.form_submission.form_submission import FormSubmission


class FormSubmissionInterface(abc.ABC):
    """Abstract base class defining the interface for form submission data management."""

    @abc.abstractmethod
    def init(self) -> None:
        """Initialize the data store, creating necessary structures or tables."""

    @abc.abstractmethod
    def get_form_by_facility(self, facility_id: int) -> Optional[tuple[list[FormQuestion], list[FacilityRule]]]:
        """Fetch a facility's active signup form: active questions followed by active rules."""

    @abc.abstractmethod
    def create_submission(self, submission: FormSubmission, responses: list[FormResponse]) -> Optional[FormSubmission]:
        """Create a submission and its responses atomically. Returns the created submission."""

    @abc.abstractmethod
    def get_submission_by_id(self, submission_id: int) -> Optional[FormSubmission]:
        """Retrieve a submission by its unique ID. Returns None if not found."""

    @abc.abstractmethod
    def list_submissions_by_facility(self, facility_id: int) -> Optional[list[FormSubmission]]:
        """List all submissions for a given facility ID."""

    @abc.abstractmethod
    def list_submissions_by_sub(self, sub: str) -> Optional[list[FormSubmission]]:
        """List all submissions for a given user sub."""

    @abc.abstractmethod
    def hard_delete_submission_by_id(self, submission_id: int) -> bool:
        """Delete a submission (and its responses) by its ID."""

    @abc.abstractmethod
    def delete_submission_by_id(self, submission_id: int) -> bool:
        """Soft-delete a submission by its ID."""

    def submission_exists(self, *, submission_id: int | None = None) -> bool:
        """Check if a submission record exists."""
        if submission_id:
            return self.get_submission_by_id(submission_id) is not None
        return False

    @abc.abstractmethod
    def hard_delete_submissions_bulk(self, submissions: list[FormSubmission]) -> Optional[list[FormSubmission]]:
        """Delete multiple submissions in bulk. Returns the deleted submissions."""

    @abc.abstractmethod
    def delete_submissions_bulk(self, submissions: list[FormSubmission]) -> Optional[list[FormSubmission]]:
        """Soft-delete multiple submissions in bulk. Returns the soft-deleted submissions."""
