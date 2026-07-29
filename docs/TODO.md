# Swimlane TODO

Based on ERD (`docs/erd.mmd`) and relationships (`docs/relationships.md`)

---

## Completed

- [x] User entity with encrypted PII (AES-256-GCM)
- [x] Google OAuth2 authentication
- [x] JWT access/refresh token system
- [x] Role-based access control (admin, facility_manager, coach, member)
- [x] Session middleware
- [x] Frequency entity data layer (`src/data/frequency/` — model, interface, SQLite CRUD)
- [x] Frequency API routes (`src/frequency_routes.py`) + router registration in `main.py`

---

## In Progress

---

## To Do

### Event Entity

- [ ] Create `src/data/events/event_interface.py` — abstract base class
- [ ] Create `src/data/events/event.py` — Pydantic model
- [ ] Create `src/data/events/sqlite.py` — SQLite implementation
- [ ] Create `src/event_routes.py` — FastAPI routes
- [ ] Add event router to `main.py`

### Venue Entity

- [ ] Create `src/data/venues/venue_interface.py` — abstract base class
- [ ] Create `src/data/venues/venue.py` — Pydantic model
- [ ] Create `src/data/venues/sqlite.py` — SQLite implementation
- [ ] Create `src/venue_routes.py` — FastAPI routes
- [ ] Add venue router to `main.py`

### Facility Entity

- [ ] Create `src/data/facilities/facility_interface.py` — abstract base class
- [ ] Create `src/data/facilities/facility.py` — Pydantic model
- [ ] Create `src/data/facilities/sqlite.py` — SQLite implementation
- [ ] Create `src/facility_routes.py` — FastAPI routes
- [ ] Add facility router to `main.py`

### Schedule Entity (junction table)

- [ ] Create `src/data/schedule/schedule_interface.py` — abstract base class
- [ ] Create `src/data/schedule/schedule.py` — Pydantic model
- [ ] Create `src/data/schedule/sqlite.py` — SQLite implementation
- [ ] Create `src/schedule_routes.py` — FastAPI routes
- [ ] Add schedule router to `main.py`

### Database Setup

- [ ] Add table creation SQL/migration for `frequency`
- [ ] Add table creation SQL/migration for `event`
- [ ] Add table creation SQL/migration for `venue`
- [ ] Add table creation SQL/migration for `facility`
- [ ] Add table creation SQL/migration for `schedule`
- [ ] Add foreign key constraints per ERD relationships

### Relationships (per `relationships.md`)

- [ ] 1 member → 1+ events (schedule links them)
- [ ] 1 venue → 1+ facilities
- [ ] 1 venue → 1+ events
- [ ] 1 event → 1 frequency (required)
- [ ] 1 schedule → 1 venue, 1 member, 1 event

---

## Notes

- Follow existing patterns in `src/data/users/` for entity structure
- Use `UserInterface` ABC pattern for all new entities
- Encrypted fields pattern: nonce + ciphertext columns (see `user.py`)
- All entities need `is_active` soft-delete support per ERD
