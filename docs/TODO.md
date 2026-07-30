# Swimlane TODO

Based on ERD (`docs/erd.mmd`) and relationships (`docs/relationships.md`)

---

## Completed

### Core Infrastructure

- [x] User entity with encrypted PII (AES-256-GCM) — `src/data/users/`
- [x] Google OAuth2 authentication — `src/auth_routes.py`
- [x] JWT access/refresh token system — `src/auth_routes.py`
- [x] Role-based access control (admin, facility_manager, coach, member) — `src/roles/`
- [x] Session middleware — `main.py`
- [x] AES-256-GCM encryption for stored fields — `src/encryption.py`
- [x] YAML config management + Google OAuth credential loading — `src/util/configs.py`

### Frequency Entity

- [x] Pydantic model — `src/data/frequency/frequency.py`
- [x] Abstract interface — `src/data/frequency/frequency_interface.py`
- [x] SQLite CRUD — `src/data/frequency/sqlite.py`
- [x] Table auto-creation via `init()` — `frequency` table with `name` UNIQUE index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/frequency_routes.py`
- [x] Router registered in `main.py`

### Facility Entity

- [x] Pydantic model — `src/data/facility/facility.py`
- [x] Abstract interface — `src/data/facility/facility_interface.py`
- [x] SQLite CRUD — `src/data/facility/sqlite.py`
- [x] Table auto-creation via `init()` — `facility` table with `name` UNIQUE index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/facility_routes.py`
- [x] Router registered in `main.py`

### Event Entity

- [x] Pydantic model — `src/data/event/event.py`
- [x] Abstract interface — `src/data/event/event_interface.py`
- [x] SQLite CRUD — `src/data/event/sqlite.py`
- [x] Table auto-creation via `init()` — `event` table with `frequency_id` index
- [x] API routes (list, get, create, update, soft/hard delete, bulk) — `src/event_routes.py`
- [x] Router registered in `main.py`

---

## In Progress

(none)

---

## To Do

### Venue Entity

- [ ] Create `src/data/venue/venue.py` — Pydantic model
- [ ] Create `src/data/venue/venue_interface.py` — abstract base class
- [ ] Create `src/data/venue/sqlite.py` — SQLite implementation
- [ ] Create `src/venue_routes.py` — FastAPI routes
- [ ] Add venue router to `main.py`

### Schedule Entity (junction table)

- [ ] Create `src/data/schedule/schedule.py` — Pydantic model
- [ ] Create `src/data/schedule/schedule_interface.py` — abstract base class
- [ ] Create `src/data/schedule/sqlite.py` — SQLite implementation
- [ ] Create `src/schedule_routes.py` — FastAPI routes
- [ ] Add schedule router to `main.py`

### Database Constraints

- [ ] Add foreign key constraints per ERD relationships
- [ ] Add `ON DELETE` / `ON UPDATE` cascade rules for venue→facility, event→frequency, schedule→ venue/member/event

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
