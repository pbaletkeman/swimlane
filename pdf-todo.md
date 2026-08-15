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
including rules, collects answers + signature checkbox, and posts the submission. Replaces the
"Fill out and sign PDF forms" → "Completed forms" PDF round-trip steps.

Update `docs/sequence/new-signup.mmd` to reflect the web-form flow.

## Steps

### 1. Create `src/data/form_question/` ✅

- 1.1 [x] `form_question.py` — Pydantic model: `form_question_id`, `facility_id`, `prompt`,
      `question_type` (`text|checkbox`), `is_required`, `sort_order`, `is_active`
- 1.2 [x] `form_question_interface.py` — ABC (mirror `FacilityInterface`): `init`,
      `create_form_question`, `update_form_question`, `get_form_question_by_id`,
      `list_form_questions_by_facility`, `delete_form_question_by_id` (soft),
      `hard_delete_form_question_by_id`, bulk create/delete variants
- 1.3 [x] `sqlite.py` — SQLite class; `get_create_table()` DDL with
      `FOREIGN KEY (facility_id) REFERENCES facility(facility_id) ON DELETE CASCADE ON UPDATE CASCADE`,
      `PRAGMA foreign_keys = ON`, soft delete via `is_active`, index on `facility_id` + `sort_order`
- 1.4 [x] `__init__.py`
- 1.5 [x] `README.md` (follow `src/data/facility/README.md` format)

### 2. Create `src/data/facility_rule/` ✅

- 2.1 [x] `facility_rule.py` — Pydantic model: `rule_id`, `facility_id`, `title`, `content`,
      `sort_order`, `is_active`
- 2.2 [x] `facility_rule_interface.py` — ABC: `init`, `create_rule`, `update_rule`,
      `get_rule_by_id`, `list_rules_by_facility`, `delete_rule_by_id` (soft),
      `hard_delete_rule_by_id`, bulk variants
- 2.3 [x] `sqlite.py` — SQLite class; DDL with `facility_id` FK (CASCADE), `PRAGMA foreign_keys = ON`,
      soft delete via `is_active`, index on `facility_id` + `sort_order`
- 2.4 [x] `__init__.py`
- 2.5 [x] `README.md`

### 3. Create `src/data/form_submission/` ✅

- 3.1 [x] `form_submission.py` — Pydantic model: `submission_id`, `facility_id`, `sub`,
      `signed_at`, `submitted_at`, `is_complete`
- 3.2 [x] `form_response.py` — Pydantic model: `response_id`, `submission_id`, `question_id`,
      `answer_text`, `answer_bool`
- 3.3 [x] `form_submission_interface.py` — ABC: `init`, `get_form_by_facility` (fetch active
      questions + rules), `create_submission` (atomic: insert submission + responses in a
      single transaction), `get_submission_by_id`, `list_submissions_by_facility`,
      `list_submissions_by_sub`, soft/hard delete
- 3.4 [x] `sqlite.py` — SQLite class; `get_create_table()` DDL creates **both** tables
      (`form_submission`, `form_response`) with FKs:
      `form_submission.facility_id → facility`, `form_submission.sub → users.sub`,
      `form_response.submission_id → form_submission`, `form_response.question_id → form_question`
      (all CASCADE), `PRAGMA foreign_keys = ON`
- 3.5 [x] `sqlite.py` — submission uses a single `BEGIN`/`commit`/`rollback` transaction so
      responses are all-or-nothing; insert submission, capture `last_insert_rowid()`, insert responses
- 3.6 [x] Enforce one submission token per `(sub, facility)`; `signed_at` recorded from the
      checkbox acceptance on (re)submit
- 3.7 [x] `__init__.py`
- 3.8 [x] `README.md`

### 4. Create `src/routes/form_routes.py` ✅

- 4.1 [x] Class-based router `FormRoutes` with `APIRouter(prefix="/forms", tags=["forms"])`
      (mirror `FacilityRoutes`)
- 4.2 [x] `facility_manager_role` — question CRUD: `POST /forms/questions`,
      `PUT /forms/questions/{id}`, `DELETE /forms/questions/{id}` (soft), bulk variants
- 4.3 [x] `facility_manager_role` — rule CRUD: `POST /forms/rules`, `PUT /forms/rules/{id}`,
      `DELETE /forms/rules/{id}` (soft), bulk variants
- 4.4 [x] `all_users` GET — `GET /forms/{facility_id}` returns facility questions + rules
      (sorted by `sort_order`, active only) for display
- 4.5 [x] `member_role` POST — `POST /forms/{facility_id}/submit`; attaches
      `current_user.sub` (via `RoleChecker`), sets `signed_at`, calls
      `create_submission` transactionally
- 4.6 [x] Request/response Pydantic bodies + 404/409/500 `HTTPException` handling matching
      existing route style

### 5. Register router in `main.py` ✅

- 5.1 [x] `from src.routes.form_routes import FormRoutes`
- 5.2 [x] `form_routes = FormRoutes()` + `app.include_router(form_routes.router)` alongside
      the other routers
- 5.3 [x] Confirm entity tables are created (call each entity's `init()` / verify on first
      `Config().db()` use per existing startup pattern)

### 6. Verify ✅

- 6.1 [x] `uv run ruff check .`
- 6.2 [x] `uv run ruff format .`
- 6.3 [x] `uv run pyright`
- 6.4 [x] Manual smoke test: create question/rule, GET facility form, submit form, re-submit
      for same `(sub, facility)`

### 7. Update sequence diagram in `docs/sequence/new-signup.mmd`

- 7.1 [x] Replace lines 35-36 ("Fill out and sign PDF forms" / "Completed forms") with the
      web-form flow: Site serves facility questions + rules, Member answers + checks
      signature box, Member posts submission
- 7.2 [x] Add `Site->>Record: Save form submission (questions, answers, signed_at)` step
- 7.3 [ ] Keep the PDF export as a deferred convenience export (no round-trip step in diagram)

### 8. (Deferred) PDF export of a completed form

- 8.1 [ ] Choose PDF library (e.g., `reportlab`) and add to deps — only when required
- 8.2 [ ] Endpoint to render a member's completed submission as PDF for records
- 8.3 [ ] Optional: fold facility rules into the exported PDF
