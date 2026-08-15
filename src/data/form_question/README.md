# Form Question Entity

Configurable questions in a facility's signup form.

## Files

| File | Description |
|------|-------------|
| `form_question.py` | Pydantic model — `FormQuestion` with `facility_id`, `prompt`, `question_type` (`text\|checkbox`), `is_required`, `sort_order`, `is_active` |
| `form_question_interface.py` | Abstract base class — CRUD methods plus `list_form_questions_by_facility` and bulk operations |
| `sqlite.py` | SQLite implementation — full CRUD with `facility_id` FK, bulk operations |

## Table Schema

`form_question` table with `form_question_id` (PK), `facility_id` (FK → `facility`),
`prompt`, `question_type` (CHECK `text`/`checkbox`), `is_required`, `sort_order`, `is_active`.
Index on `facility_id`; rows ordered by `sort_order ASC, form_question_id ASC`.