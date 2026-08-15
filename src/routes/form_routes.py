"""
Form API routes for managing facility signup form questions and rules.

Provides facility-manager CRUD endpoints for form questions and facility rules
following the same class-based router pattern as FacilityRoutes.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.facility_rule.facility_rule import FacilityRule
from src.data.facility_rule.sqlite import SQLite as FacilityRuleSQLite
from src.data.form_question.form_question import FormQuestion, QuestionType
from src.data.form_question.sqlite import SQLite as FormQuestionSQLite
from src.roles.roles import admin_role, facility_manager_role

logger = logging.getLogger(__name__)


class QuestionRequest(BaseModel):
    """Request body for creating/updating a form question."""

    facility_id: int
    prompt: str
    question_type: QuestionType = QuestionType.TEXT
    is_required: bool = True
    sort_order: int = 0
    is_active: bool = True


class RuleRequest(BaseModel):
    """Request body for creating/updating a facility rule."""

    facility_id: int
    title: str
    content: str
    sort_order: int = 0
    is_active: bool = True


class QuestionIdRequest(BaseModel):
    """Request body for bulk-deleting form questions by id."""

    form_question_id: int


class RuleIdRequest(BaseModel):
    """Request body for bulk-deleting facility rules by id."""

    rule_id: int


class FormRoutes:
    """Defines all form-related routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/forms", tags=["forms"])

        # --- Questions ---
        self.router.add_api_route(
            "/questions",
            self.create_question,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/questions/bulk",
            self.create_questions_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/questions/bulk",
            self.delete_questions_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/questions/bulk/hard",
            self.hard_delete_questions_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/questions/{question_id}",
            self.update_question,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/questions/{question_id}",
            self.delete_question,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/questions/{question_id}/hard",
            self.hard_delete_question,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

        # --- Rules ---
        self.router.add_api_route(
            "/rules",
            self.create_rule,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/rules/bulk",
            self.create_rules_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/rules/bulk",
            self.delete_rules_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/rules/bulk/hard",
            self.hard_delete_rules_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/rules/{rule_id}",
            self.update_rule,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/rules/{rule_id}",
            self.delete_rule,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/rules/{rule_id}/hard",
            self.hard_delete_rule,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_question_db(self) -> FormQuestionSQLite:
        return FormQuestionSQLite()

    # ------------------------------------------------------------------
    def _get_rule_db(self) -> FacilityRuleSQLite:
        return FacilityRuleSQLite()

    # ------------------------------------------------------------------
    # Questions
    # ------------------------------------------------------------------
    async def create_question(self, body: QuestionRequest) -> FormQuestion:
        """Create a new form question."""
        try:
            db = self._get_question_db()
            form_question = FormQuestion(**body.model_dump())
            created = db.create_form_question(form_question)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to create question")
            return created
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create question")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def update_question(self, question_id: int, body: QuestionRequest) -> FormQuestion:
        """Update an existing form question."""
        try:
            db = self._get_question_db()
            existing = db.get_form_question_by_id(question_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Question not found")
            form_question = FormQuestion(form_question_id=question_id, **body.model_dump())
            updated = db.update_form_question(form_question)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update question")
            return updated
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to update question")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_question(self, question_id: int) -> dict[str, str]:
        """Soft-delete a form question."""
        try:
            db = self._get_question_db()
            existing = db.get_form_question_by_id(question_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Question not found")
            db.delete_form_question_by_id(question_id)
            return {"message": "Question deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete question")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_question(self, question_id: int) -> dict[str, str]:
        """Hard-delete a form question."""
        try:
            db = self._get_question_db()
            existing = db.get_form_question_by_id(question_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Question not found")
            db.hard_delete_form_question_by_id(question_id)
            return {"message": "Question permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete question")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_questions_bulk(self, bodies: list[QuestionRequest]) -> list[FormQuestion]:
        """Create multiple form questions in bulk."""
        try:
            db = self._get_question_db()
            questions = [FormQuestion(**b.model_dump()) for b in bodies]
            created = db.create_form_questions_bulk(questions)
            return created if created else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create questions in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_questions_bulk(self, bodies: list[QuestionIdRequest]) -> dict[str, str]:
        """Soft-delete multiple form questions by id."""
        try:
            db = self._get_question_db()
            ids = [b.form_question_id for b in bodies]
            if not ids:
                raise HTTPException(status_code=400, detail="No question ids provided")
            existing = [q for qid in ids if (q := db.get_form_question_by_id(qid)) is not None]
            if not existing:
                raise HTTPException(status_code=404, detail="No questions found")
            db.delete_form_questions_bulk(existing)
            return {"message": f"{len(existing)} question(s) deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete questions in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_questions_bulk(self, bodies: list[QuestionIdRequest]) -> dict[str, str]:
        """Hard-delete multiple form questions by id."""
        try:
            db = self._get_question_db()
            ids = [b.form_question_id for b in bodies]
            if not ids:
                raise HTTPException(status_code=400, detail="No question ids provided")
            existing = [q for qid in ids if (q := db.get_form_question_by_id(qid)) is not None]
            if not existing:
                raise HTTPException(status_code=404, detail="No questions found")
            db.hard_delete_form_questions_bulk(existing)
            return {"message": f"{len(existing)} question(s) permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete questions in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    # Rules
    # ------------------------------------------------------------------
    async def create_rule(self, body: RuleRequest) -> FacilityRule:
        """Create a new facility rule."""
        try:
            db = self._get_rule_db()
            facility_rule = FacilityRule(**body.model_dump())
            created = db.create_rule(facility_rule)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to create rule")
            return created
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create rule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def update_rule(self, rule_id: int, body: RuleRequest) -> FacilityRule:
        """Update an existing facility rule."""
        try:
            db = self._get_rule_db()
            existing = db.get_rule_by_id(rule_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Rule not found")
            facility_rule = FacilityRule(rule_id=rule_id, **body.model_dump())
            updated = db.update_rule(facility_rule)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update rule")
            return updated
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to update rule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_rule(self, rule_id: int) -> dict[str, str]:
        """Soft-delete a facility rule."""
        try:
            db = self._get_rule_db()
            existing = db.get_rule_by_id(rule_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Rule not found")
            db.delete_rule_by_id(rule_id)
            return {"message": "Rule deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete rule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_rule(self, rule_id: int) -> dict[str, str]:
        """Hard-delete a facility rule."""
        try:
            db = self._get_rule_db()
            existing = db.get_rule_by_id(rule_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Rule not found")
            db.hard_delete_rule_by_id(rule_id)
            return {"message": "Rule permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete rule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_rules_bulk(self, bodies: list[RuleRequest]) -> list[FacilityRule]:
        """Create multiple facility rules in bulk."""
        try:
            db = self._get_rule_db()
            rules = [FacilityRule(**b.model_dump()) for b in bodies]
            created = db.create_rules_bulk(rules)
            return created if created else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create rules in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_rules_bulk(self, bodies: list[RuleIdRequest]) -> dict[str, str]:
        """Soft-delete multiple facility rules by id."""
        try:
            db = self._get_rule_db()
            ids = [b.rule_id for b in bodies]
            if not ids:
                raise HTTPException(status_code=400, detail="No rule ids provided")
            existing = [r for rid in ids if (r := db.get_rule_by_id(rid)) is not None]
            if not existing:
                raise HTTPException(status_code=404, detail="No rules found")
            db.delete_rules_bulk(existing)
            return {"message": f"{len(existing)} rule(s) deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete rules in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_rules_bulk(self, bodies: list[RuleIdRequest]) -> dict[str, str]:
        """Hard-delete multiple facility rules by id."""
        try:
            db = self._get_rule_db()
            ids = [b.rule_id for b in bodies]
            if not ids:
                raise HTTPException(status_code=400, detail="No rule ids provided")
            existing = [r for rid in ids if (r := db.get_rule_by_id(rid)) is not None]
            if not existing:
                raise HTTPException(status_code=404, detail="No rules found")
            db.hard_delete_rules_bulk(existing)
            return {"message": f"{len(existing)} rule(s) permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete rules in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
