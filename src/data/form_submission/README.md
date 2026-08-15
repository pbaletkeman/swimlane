# Form Submission Entity

Member submissions of a facility's signup form, with one response per question.

## Files

| File | Description |
|------|-------------|
| `form_submission.py` | Pydantic model — `FormSubmission` with `facility_id`, `sub`, `signed_at`, `submitted_at`, `is_complete` |
| `form_response.py` | Pydantic model — `FormResponse` with `submission_id`, `question_id`, `answer_text`, `answer_bool` |
| `form_submission_interface.py` | Abstract base class — form fetching, atomic submission creation, queries, soft/hard delete, bulk operations |
| `sqlite.py` | SQLite implementation — two-table DDL with FKs, transactional submission upsert, response helpers |

## Table Schema

`form_submission` table with `submission_id` (PK), `facility_id` (FK → `facility`),
`sub` (FK → `users.sub`), `signed_at`, `submitted_at`, `is_complete`, and a
`UNIQUE (sub, facility_id)` constraint enforcing one submission token per member/facility.

`form_response` table with `response_id` (PK), `submission_id` (FK → `form_submission`),
`question_id` (FK → `form_question`), `answer_text`, `answer_bool`.

All FKs use `ON DELETE CASCADE ON UPDATE CASCADE`. `PRAGMA foreign_keys = ON` is enabled
on every connection.

## Behavior

- **Atomic submission**: `create_submission` inserts/updates the submission and its
  responses inside a single transaction (commit on success, rollback on error).
- **Re-submission**: one token per `(sub, facility)`; a re-submit updates the existing
  submission row and replaces its responses.
- **Soft delete**: `delete_submission_by_id` sets `is_complete = 0` (no `is_active`
  column on this entity).
- **Form view**: `get_form_by_facility` returns the facility's active questions + active
  rules (ordered by `sort_order`) for display.