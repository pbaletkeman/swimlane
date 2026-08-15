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

## Pending

- Step 3. Create `src/data/form_submission/`
- Step 4. Create `src/routes/form_routes.py`
- Step 5. Register router in `main.py`
- Step 6. Verify (ruff / pyright / smoke test)
- Step 7. Update sequence diagram in `docs/sequence/new-signup.mmd`
- Step 8. (Deferred) PDF export of a completed form