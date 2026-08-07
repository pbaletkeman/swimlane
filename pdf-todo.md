# PDF Form → Web Form Migration TODO

## Decision

Replace the PDF form round-trip in `docs/sequence/new-signup.mmd` (lines 35-36) with
**web-based dynamic forms (Option B)**.

Confirmed requirements:

1. A checkbox is a sufficient signature (no legally binding signatures).
2. Assume no legal/waiver forms for now (may be added later).
3. Facility managers set up the questions.
4. Facility managers may provide facility rules (may or may not be part of a generated PDF).

## Design

- **Source of truth = structured DB rows**, not PDF blobs. Members answer in the browser;
  the signup flow's "Fill out and sign PDF forms" becomes a guided web form with a
  checkbox acceptance.
- **PDF becomes a convenience export** (member downloads a completed copy for records),
  not the upload/return channel. Defer adding a PDF dependency (`reportlab` etc.) and the
  legally-required verbatim-form case.
- Submissions self-attach to the authenticated member via `RoleChecker` → `User.sub`
  (consistent with `Schedule.member_id` and `users.sub`).

## Data Model

New entities follow the existing 3-file pattern per entity
(`<entity>.py` Pydantic + `<entity>_interface.py` ABC + `sqlite.py` SQLite), using
`src/data/facility/` as the canonical example. All are facility-scoped.

### 1. `src/data/form_question/` — configurable questions

- Columns: `form_question_id`, `facility_id` (FK), `prompt`, `question_type`
  (`text|checkbox`), `is_required`, `sort_order`, `is_active`
- CRUD + `list_by_facility`, soft delete via `is_active`

### 2. `src/data/facility_rule/` — facility rules text

- Columns: `rule_id`, `facility_id` (FK), `title`, `content`, `sort_order`, `is_active`
- CRUD + `list_by_facility`, soft delete via `is_active`
- Display-only today; can later fold into a generated PDF

### 3. `src/data/form_submission/` — member submissions (full version)

- `form_submission` table: `submission_id`, `facility_id` (FK), `sub` (FK→users.sub),
  `signed_at`, `submitted_at`, `is_complete`
- `form_response` table: `response_id`, `submission_id` (FK), `question_id` (FK),
  `answer_text`, `answer_bool`
- Tracks who submitted what; `signed_at` timestamp records the checkbox acceptance.
- **One submission token per (sub, facility) with re-submission allowed.**

## Routes

`src/routes/form_routes.py` — class-based router, mirrors `FacilityRoutes`, then
register in `main.py`:

- `facility_manager_role`: CRUD for questions + rules
- `all_users` (GET): fetch a facility's form + rules for display
- `member_role` (POST): submit a completed form; attaches `current_user.sub`, sets `signed_at`

## Foreign Keys

- `form_question.facility_id` → `facility.facility_id`
- `facility_rule.facility_id` → `facility.facility_id`
- `form_submission.facility_id` → `facility.facility_id`
- `form_submission.sub` → `users.sub`
- `form_response.submission_id` → `form_submission.submission_id`
- `form_response.question_id` → `form_question.form_question_id`
- All `ON DELETE CASCADE ON UPDATE CASCADE` (matches `PRAGMA foreign_keys = ON` convention)

## Sequence Wiring (scoped later)

When a member selecting "No" to "Swim Before?" — the site serves the facility's questions
+ rules, collects answers + signature checkbox, and posts the submission. Replaces the
"Fill out and sign PDF forms" → "Completed forms" PDF round-trip steps.

Update `docs/sequence/new-signup.mmd` to reflect the web-form flow.

## Steps

1. Create `src/data/form_question/` (model, interface, sqlite) + README
2. Create `src/data/facility_rule/` (model, interface, sqlite) + README
3. Create `src/data/form_submission/` (models, interface, sqlite) + README
4. Create `src/routes/form_routes.py`
5. Register router in `main.py`
6. Verify with `uv run ruff check .`, `uv run ruff format .`, `uv run pyright`
7. Update sequence diagram in `docs/sequence/new-signup.mmd`
8. (Deferred) PDF export of a completed form for member records
