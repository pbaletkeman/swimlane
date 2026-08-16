# Swimlane TODO

Based on ERD (`docs/erd.mmd`) and relationships (`docs/relationships.md`)

---

## Completed

### Core Infrastructure

- [x] User entity with encrypted PII (AES-256-GCM) — `src/data/users/`
- [x] Google OAuth2 authentication — `src/routes/auth_routes.py`
- [x] JWT access/refresh token system — `src/routes/auth_routes.py`
- [x] Role-based access control (admin, facility_manager, coach, member) — `src/roles/`
- [x] Session middleware — `main.py`
- [x] AES-256-GCM encryption for stored fields — `src/encryption.py`
- [x] YAML config management + Google OAuth credential loading — `src/util/configs.py`

### Frequency Entity

- [x] Pydantic model — `src/data/frequency/frequency.py`
- [x] Abstract interface — `src/data/frequency/frequency_interface.py`
- [x] SQLite CRUD — `src/data/frequency/sqlite.py`
- [x] Table auto-creation via `init()` — `frequency` table with `name` UNIQUE index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/routes/frequency_routes.py`
- [x] Router registered in `main.py`

### Facility Entity

- [x] Pydantic model — `src/data/facility/facility.py`
- [x] Abstract interface — `src/data/facility/facility_interface.py`
- [x] SQLite CRUD — `src/data/facility/sqlite.py`
- [x] Table auto-creation via `init()` — `facility` table with `name` UNIQUE index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/routes/facility_routes.py`
- [x] Router registered in `main.py`

### Event Entity

- [x] Pydantic model — `src/data/event/event.py`
- [x] Abstract interface — `src/data/event/event_interface.py`
- [x] SQLite CRUD — `src/data/event/sqlite.py`
- [x] Table auto-creation via `init()` — `event` table with `frequency_id` index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/routes/event_routes.py`
- [x] Router registered in `main.py`

### Venue Entity

- [x] Pydantic model — `src/data/venue/venue.py`
- [x] Abstract interface — `src/data/venue/venue_interface.py`
- [x] SQLite CRUD — `src/data/venue/sqlite.py`
- [x] Table auto-creation via `init()` — `venue` table with `facility_id` index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/routes/venue_routes.py`
- [x] Router registered in `main.py`

### Schedule Entity

- [x] Pydantic model — `src/data/schedule/schedule.py`
- [x] Abstract interface — `src/data/schedule/schedule_interface.py`
- [x] SQLite CRUD — `src/data/schedule/sqlite.py`
- [x] Table auto-creation via `init()` — `schedule` table with `venue_id`, `member_id`, `event_id` indexes
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/routes/schedule_routes.py`
- [x] Router registered in `main.py`

### Form Question Entity

- [x] Pydantic model — `src/data/form_question/form_question.py`
- [x] Abstract interface — `src/data/form_question/form_question_interface.py`
- [x] SQLite CRUD — `src/data/form_question/sqlite.py`
- [x] Table auto-creation via `init()` — `form_question` table with `facility_id` FK/index
- [x] API routes (question CRUD, bulk, soft/hard delete) — `src/routes/form_routes.py`
- [x] Router registered in `main.py`

### Facility Rule Entity

- [x] Pydantic model — `src/data/facility_rule/facility_rule.py`
- [x] Abstract interface — `src/data/facility_rule/facility_rule_interface.py`
- [x] SQLite CRUD — `src/data/facility_rule/sqlite.py`
- [x] Table auto-creation via `init()` — `facility_rule` table with `facility_id` FK/index
- [x] API routes (rule CRUD, bulk, soft/hard delete) — `src/routes/form_routes.py`
- [x] Router registered in `main.py`

### Form Submission Entity

- [x] Pydantic models — `src/data/form_submission/form_submission.py`, `form_response.py`
- [x] Abstract interface — `src/data/form_submission/form_submission_interface.py`
- [x] SQLite CRUD — `src/data/form_submission/sqlite.py` (atomic submission + responses, `UNIQUE (sub, facility_id)` upsert)
- [x] Table auto-creation via `init()` — `form_submission` + `form_response` tables
- [x] API endpoints — `src/routes/form_routes.py`: GET facility form, POST submit, PDF export
- [x] Router registered in `main.py`

### Web Form Migration (PDF → web)

- [x] Replaced PDF round-trip in `docs/sequence/new-signup.mmd` with web-form flow
- [x] PDF export of a completed submission (reportlab) — `GET /forms/submissions/{id}/pdf`

### Database Constraints

- [x] Add foreign key constraints per ERD relationships
- [x] Add `ON DELETE` / `ON UPDATE` cascade rules for venue→facility, event→frequency, schedule→venue/member/event
- [x] Enable `PRAGMA foreign_keys = ON` in all SQLite connections

---

## In Progress

(none)

---

## To Do

### Testing

- [ ] Add pytest tests for user CRUD
- [ ] Add pytest tests for frequency CRUD
- [ ] Add pytest tests for facility CRUD
- [ ] Add pytest tests for auth/JWT flow
- [ ] Add pytest tests for RBAC role enforcement

---

## Notes

- Follow existing patterns in `src/data/frequency/` and `src/data/facility/` for new entities
- Use abstract interface ABC pattern for all new entities
- Table auto-creation is handled by each SQLite implementation's `init()` method — no separate migration files
- All entities use `is_active` soft-delete support per ERD
- Facility entity lives at `src/data/facility/` (singular, not plural)
