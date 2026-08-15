"""
Form API routes for managing facility signup form questions and rules.

Provides facility-manager CRUD endpoints for form questions and facility rules
following the same class-based router pattern as FacilityRoutes.
"""

import logging
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Flowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from src.data.facility.facility import Facility
from src.data.facility.sqlite import SQLite as FacilitySQLite
from src.data.facility_rule.facility_rule import FacilityRule
from src.data.facility_rule.sqlite import SQLite as FacilityRuleSQLite
from src.data.form_question.form_question import FormQuestion, QuestionType
from src.data.form_question.sqlite import SQLite as FormQuestionSQLite
from src.data.form_submission.form_response import FormResponse
from src.data.form_submission.form_submission import FormSubmission
from src.data.form_submission.sqlite import SQLite as FormSubmissionSQLite
from src.data.users.sqlite import SQLite as UsersSQLite
from src.data.users.user import User
from src.encryption import decrypt_field
from src.roles.roles import admin_role, all_users, facility_manager_role, member_role
from src.roles.user_role import UserRole

logger = logging.getLogger(__name__)


class ResponseItem(BaseModel):
    """Request body for a single answer to a form question."""

    question_id: int
    answer_text: str | None = None
    answer_bool: bool | None = None


class SubmissionRequest(BaseModel):
    """Request body for submitting a completed facility signup form."""

    signed: bool = False
    responses: list[ResponseItem]


class FacilityFormResponse(BaseModel):
    """Response body for a facility's signup form (questions + rules) for display."""

    facility_id: int
    questions: list[FormQuestion]
    rules: list[FacilityRule]


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

        # --- Facility form (display) ---
        self.router.add_api_route(
            "/{facility_id}",
            self.get_form,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )

        # --- Submission ---
        self.router.add_api_route(
            "/{facility_id}/submit",
            self.submit_form,
            methods=["POST"],
            dependencies=[Depends(member_role)],
        )
        self.router.add_api_route(
            "/submissions/{submission_id}/pdf",
            self.export_submission_pdf,
            methods=["GET"],
            dependencies=[Depends(member_role)],
        )

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
    def _get_form_db(self) -> FormSubmissionSQLite:
        return FormSubmissionSQLite()

    # ------------------------------------------------------------------
    def _get_facility_db(self) -> FacilitySQLite:
        return FacilitySQLite()

    # ------------------------------------------------------------------
    # Facility form (display)
    # ------------------------------------------------------------------
    async def get_form(self, facility_id: int) -> FacilityFormResponse:
        """Fetch a facility's signup form: active questions + active rules for display."""
        try:
            facility = self._get_facility_db().get_facility_by_id(facility_id)
            if not facility:
                raise HTTPException(status_code=404, detail="Facility not found")
            questions, rules = self._get_form_db().get_form_by_facility(facility_id) or ([], [])
            return FacilityFormResponse(facility_id=facility_id, questions=questions, rules=rules)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get form")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    # Submission
    # ------------------------------------------------------------------
    async def submit_form(
        self, facility_id: int, body: SubmissionRequest, current_user: User = Depends(member_role)
    ) -> FormSubmission:
        """Submit a completed signup form for the authenticated member."""
        try:
            if not body.signed:
                raise HTTPException(status_code=400, detail="Signature required")
            facility = self._get_facility_db().get_facility_by_id(facility_id)
            if not facility:
                raise HTTPException(status_code=404, detail="Facility not found")
            submission = FormSubmission(
                facility_id=facility_id,
                sub=current_user.sub,
                signed_at=datetime.now(timezone.utc),
                is_complete=True,
            )
            responses = [FormResponse(**r.model_dump()) for r in body.responses]
            created = self._get_form_db().create_submission(submission, responses)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to submit form")
            return created
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to submit form")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def export_submission_pdf(self, submission_id: int, current_user: User = Depends(member_role)) -> Response:
        """Export a member's completed submission as a PDF record."""
        try:
            db = self._get_form_db()
            submission = db.get_submission_by_id(submission_id)
            if not submission:
                raise HTTPException(status_code=404, detail="Submission not found")
            if current_user.role == UserRole.MEMBER.value and submission.sub != current_user.sub:
                raise HTTPException(status_code=403, detail="Cannot access another member's submission")
            facility = self._get_facility_db().get_facility_by_id(submission.facility_id)
            questions = self._get_question_db().list_form_questions_by_facility(submission.facility_id) or []
            rules = self._get_rule_db().list_rules_by_facility(submission.facility_id) or []
            responses = db.get_responses_by_submission_id(submission_id) or []
            pdf_bytes = self._build_submission_pdf(submission, facility, questions, rules, responses)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="submission-{submission_id}.pdf"'},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to export submission PDF")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    def _get_member_name(self, sub: str) -> str:
        """Return the member's decrypted display name, falling back to their sub."""
        try:
            user = UsersSQLite().get_user_by_sub(sub)
            if not user or not user.first_name_nonce or not user.first_name_ciphertext:
                return sub
            first = decrypt_field(user.first_name_nonce, user.first_name_ciphertext)
            last = ""
            if user.last_name_nonce and user.last_name_ciphertext:
                last = decrypt_field(user.last_name_nonce, user.last_name_ciphertext)
            return f"{first} {last}".strip() or sub
        except Exception:
            return sub

    # ------------------------------------------------------------------
    def _build_submission_pdf(
        self,
        submission: FormSubmission,
        facility: Facility | None,
        questions: list[FormQuestion],
        rules: list[FacilityRule],
        responses: list[FormResponse],
    ) -> bytes:
        """Render a submission (facility, member, answers, rules) into a PDF document."""
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("FormTitle", parent=styles["Title"], fontSize=16, spaceAfter=12)
        label_style = ParagraphStyle("Label", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
        value_style = styles["Normal"]
        cell_style = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=10, leading=13)
        rule_style = ParagraphStyle("Rule", parent=styles["Normal"], fontSize=10, leading=13, spaceAfter=6)
        rule_title_style = ParagraphStyle(
            "RuleTitle", parent=styles["Normal"], fontSize=11, fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4
        )

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
        story: list[Flowable] = []

        story.append(Paragraph("Facility Signup Form", title_style))

        meta: list[tuple[str, str]] = [
            ("Facility", facility.name if facility is not None else str(submission.facility_id)),
            ("Member", self._get_member_name(submission.sub)),
            ("Submission ID", str(submission.submission_id)),
            ("Submitted", str(submission.submitted_at) if submission.submitted_at else "-"),
            ("Signed", str(submission.signed_at) if submission.signed_at else "-"),
        ]
        for label, value in meta:
            story.append(Paragraph(label, label_style))
            story.append(Paragraph(value or "-", value_style))
        story.append(Spacer(1, 14))

        question_map: dict[int, FormQuestion] = {
            q.form_question_id: q for q in questions if q.form_question_id is not None
        }

        def answer_text(response: FormResponse) -> str:
            if response.answer_text is not None:
                return response.answer_text
            if response.answer_bool is not None:
                return "Yes" if response.answer_bool else "No"
            return "-"

        def sort_key(response: FormResponse) -> tuple[int, int]:
            question = question_map.get(response.question_id)
            if question is not None:
                return question.sort_order, response.response_id or 0
            return 0, response.response_id or 0

        rows: list[list[Flowable]] = [
            [
                Paragraph("Question", ParagraphStyle("H", parent=cell_style, fontName="Helvetica-Bold")),
                Paragraph("Answer", ParagraphStyle("H2", parent=cell_style, fontName="Helvetica-Bold")),
            ]
        ]
        for response in sorted(responses, key=sort_key):
            question = question_map.get(response.question_id)
            prompt = question.prompt if question else f"(question {response.question_id})"
            rows.append([Paragraph(prompt, cell_style), Paragraph(answer_text(response), cell_style)])

        table = Table(rows, colWidths=[280, 210])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8e8e8")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)

        if rules:
            story.append(Paragraph("Facility Rules", ParagraphStyle("RulesHeader", parent=title_style, fontSize=13)))
            for rule in sorted(rules, key=lambda r: (r.sort_order, r.rule_id or 0)):
                story.append(Paragraph(rule.title or "Rule", rule_title_style))
                story.append(Paragraph(rule.content or "-", rule_style))

        doc.build(story)
        return buf.getvalue()

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
