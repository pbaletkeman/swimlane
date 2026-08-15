# PDF Form → Web Form Migration — Done

Completed work for the PDF → web form migration. One entry per completed step in
`pdf-todo.md`, mirroring the subtask breakdown.

## Step 1. Create `src/data/form_question/` ✅

Files created in `src/data/form_question/`:

| File | Description |
|------|-------------|
| `form_question.py` | Pydantic model — `FormQuestion` (`form_question_id`, `facility_id`, `prompt`, `question_type`, `is_required`, `sort_order`, `is_active`) plus `QuestionType` StrEnum (`text`/`checkbox`) |
| `form_question_interface.py` | ABC — `init`, `create_form_question`, `update_form_question`, `get_form_question_by_id`, `delete_form_question_by_id` (soft), `hard_delete_form_question_by_id`, `list_form_questions_by_facility`, bulk create/delete variants, `form_question_exists` |
| `sqlite.py` | SQLite class — DDL with `facility_id` FK → `facility` (`ON DELETE CASCADE ON UPDATE CASCADE`), `PRAGMA foreign_keys = ON`, `question_type` CHECK constraint, soft delete via `is_active`, index on `facility_id` |
| `__init__.py` | Empty package marker |
| `README.md` | Entity docs matching `src/data/facility/README.md` format |

### Details

- `get_record_select` orders by `sort_order ASC, form_question_id ASC`.
- Bulk create uses `executemany` + `last_insert_rowid()` re-select (matches venue/facility pattern).
- Bulk hard delete uses `DELETE ... RETURNING`.

### Verification

- `uv run ruff check src/data/form_question/` — pass
- `uv run ruff format --check src/data/form_question/` — pass
- `uv run pyright src/data/form_question/` — 0 errors
- Functional smoke test (against SQLite): create single/bulk questions, list by facility,
  get by id, update, soft delete, hard delete — all pass.
- FK enforcement confirmed: insert with nonexistent `facility_id` raises
  `sqlite3.IntegrityError`; hard-deleting a facility cascades and removes its questions
  (verified `list_form_questions_by_facility` returns `None` afterward).

## Step 2. Create `src/data/facility_rule/` ✅

Files created in `src/data/facility_rule/`:

| File | Description |
|------|-------------|
| `facility_rule.py` | Pydantic model — `FacilityRule` (`rule_id`, `facility_id`, `title`, `content`, `sort_order`, `is_active`) |
| `facility_rule_interface.py` | ABC — `init`, `create_rule`, `update_rule`, `get_rule_by_id`, `delete_rule_by_id` (soft), `hard_delete_rule_by_id`, `list_rules_by_facility`, bulk create/delete variants, `rule_exists` |
| `sqlite.py` | SQLite class — DDL with `facility_id` FK → `facility` (`ON DELETE CASCADE ON UPDATE CASCADE`), `PRAGMA foreign_keys = ON`, soft delete via `is_active`, index on `facility_id` |
| `__init__.py` | Empty package marker |
| `README.md` | Entity docs matching `src/data/facility/README.md` format |

### Details

- `get_record_select` orders by `sort_order ASC, rule_id ASC`.
- Bulk create uses `executemany` + `last_insert_rowid()` re-select; bulk hard delete uses `DELETE ... RETURNING`.

### Verification

- `uv run ruff check src/data/facility_rule/` — pass
- `uv run ruff format --check src/data/facility_rule/` — pass
- `uv run pyright src/data/facility_rule/` — 0 errors
- Functional smoke test: create/update/get/list-by-facility, soft delete, hard delete — all pass.
- Cascade confirmed: hard-deleting a facility removes its rules
  (`list_rules_by_facility` returns `None` afterward).

## Step 3. Create `src/data/form_submission/` (complete) ✅

Files created in `src/data/form_submission/`:

| File | Description |
|------|-------------|
| `form_submission.py` | Pydantic model — `FormSubmission` (`submission_id`, `facility_id`, `sub`, `signed_at`, `submitted_at`, `is_complete`); `sub` is the JWT subject claim, timestamps are `datetime.datetime` |
| `form_response.py` | Pydantic model — `FormResponse` (`response_id`, `submission_id`, `question_id`, `answer_text`, `answer_bool`); `submission_id` optional (assigned during atomic create) |
| `form_submission_interface.py` | ABC — `init`, `get_form_by_facility` (returns active questions + rules tuple), `create_submission` (atomic submission + responses), `get_submission_by_id`, `list_submissions_by_facility`, `list_submissions_by_sub`, soft/hard delete (single + bulk), `submission_exists` |
| `sqlite.py` | SQLite implementation — two-table DDL with FKs + `UNIQUE (sub, facility_id)`, transactional submission upsert, response helpers |
| `__init__.py` | Empty package marker |
| `README.md` | Entity docs including schema + behavior notes |

### Details

- **DDL (3.4)**: `form_submission` (`submission_id` PK, `facility_id` FK → `facility`,
  `sub` FK → `users.sub`, `signed_at`, `submitted_at`, `is_complete`,
  `UNIQUE (sub, facility_id)`) and `form_response` (`response_id` PK, `submission_id`
  FK → `form_submission`, `question_id` FK → `form_question`, `answer_text`,
  `answer_bool`). All FKs CASCADE; `PRAGMA foreign_keys = ON` on every connection.
- **Atomic submission (3.5)**: `create_submission` wraps insert/update + response
  replacement in a single `with self._connect()` transaction (commit on success,
  rollback on error); uses `cursor.lastrowid` after insert.
- **One token per `(sub, facility)` (3.6)**: enforced both by the `UNIQUE` constraint
  and by upsert logic — a re-submit updates the existing row and replaces its responses.
  `signed_at` is persisted from the checkbox acceptance passed on the submission.
- **Soft delete**: no `is_active` column on this entity (per plan); soft delete sets
  `is_complete = 0`. Documented in README.
- `get_form_by_facility` returns active questions + active rules (ordered by
  `sort_order`) for display.
- `FormResponse.submission_id` made optional so responses can be built before the
  submission exists; the SQLite layer assigns it during `create_submission`.

### Verification

- `uv run ruff check src/data/form_submission/` — pass
- `uv run ruff format --check src/data/form_submission/` — pass
- `uv run pyright src/data/form_submission/` — 0 errors
- Functional smoke test: form view returns active-only questions/rules; atomic create
  persists submission + text/bool responses; get/list by id, facility, sub; re-submit
  keeps same `submission_id` and replaces responses; `UNIQUE` constraint confirmed at DB
  level; soft delete sets `is_complete=0`; hard delete cascades responses.
- `uv run ruff check src/` — pass (pre-existing issues only in `referances/` and
  `seed_admins.py`, unrelated to this work).

## Step 4. Create `src/routes/form_routes.py` (partial: 4.1–4.3) ⏳

Files created/modified:

| File | Description |
|------|-------------|
| `src/routes/form_routes.py` | Class-based `FormRoutes` router — `APIRouter(prefix="/forms", tags=["forms"])` |

### 4.1 — Router class

- `FormRoutes.__init__` builds the router and registers all endpoints with
  `dependencies=[Depends(role)]`, mirroring `FacilityRoutes`.
- `/bulk` routes registered **before** `/{id}` routes so `DELETE /forms/questions/bulk`
  is not shadowed by `/{question_id}`.

### 4.2 — Question CRUD (`facility_manager_role`)

- `POST /forms/questions` → `create_question`
- `PUT /forms/questions/{question_id}` → `update_question`
- `DELETE /forms/questions/{question_id}` → soft delete
- `DELETE /forms/questions/{question_id}/hard` → hard delete (`admin_role`)
- `POST /forms/questions/bulk` → `create_questions_bulk`
- `DELETE /forms/questions/bulk` → bulk soft delete by id (`QuestionIdRequest`)
- `DELETE /forms/questions/bulk/hard` → bulk hard delete by id (`admin_role`)

### 4.3 — Rule CRUD (`facility_manager_role`)

- `POST /forms/rules` → `create_rule`
- `PUT /forms/rules/{rule_id}` → `update_rule`
- `DELETE /forms/rules/{rule_id}` → soft delete
- `DELETE /forms/rules/{rule_id}/hard` → hard delete (`admin_role`)
- `POST /forms/rules/bulk` → `create_rules_bulk`
- `DELETE /forms/rules/bulk` → bulk soft delete by id (`RuleIdRequest`)
- `DELETE /forms/rules/bulk/hard` → bulk hard delete by id (`admin_role`)

### 4.6 — Request models + error handling

- `QuestionRequest` / `RuleRequest` (create/update), `QuestionIdRequest` /
  `RuleIdRequest` (bulk delete by id); 404 on missing entity, 400 on empty bulk ids,
  500 fallback — matching existing route style.

### Bonus bugfix (found while testing 4.2)

- `create_form_questions_bulk` and `create_rules_bulk` only returned the **last**
  inserted row (`last_insert_rowid()` returns a single rowid). Fixed to select the full
  id range (`WHERE id BETWEEN ? AND ?` computed from `last_insert_rowid()`), so bulk
  create now returns all created rows. (`cursor.lastrowid` was unreliable after
  `executemany` in this Python version.)

### Verification

- `uv run ruff check src/` — pass; `uv run ruff format --check src/` — pass;
  `uv run pyright src/` — 0 errors.
- Functional test via `TestClient` with real JWTs (`HS256`, `TOKEN_SECRET_KEY`):
  - 401 with no token, 403 for `member` role, 200 for `facility_manager`.
  - Question + rule create/update, bulk create (returns all rows), bulk delete by id,
    soft delete, hard delete; 400 on empty bulk ids; 404 on missing entity.
  - `admin_role` enforcement: `web_admin` hard-deletes OK, `facility_manager` gets 403.
  - Route ordering verified: `DELETE /forms/questions/bulk` hits the bulk handler.

## Pending

- Step 4 (remaining): 4.4 (all_users GET facility form) and 4.5 (member_role submit)
- Step 5. Register router in `main.py`
- Step 6. Verify (ruff / pyright / smoke test)
- Step 7. Update sequence diagram in `docs/sequence/new-signup.mmd`
- Step 8. (Deferred) PDF export of a completed form