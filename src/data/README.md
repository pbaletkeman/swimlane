# Data Layer

Entity data models, abstract interfaces, and database implementations following a consistent 3-file pattern per entity.

## Pattern

Each entity directory contains:

- `<entity>.py` — Pydantic `BaseModel` defining the data schema
- `<entity>_interface.py` — Abstract base class (`abc.ABC`) with CRUD method signatures
- `sqlite.py` — Concrete SQLite implementation using raw `sqlite3` (no ORM)

## Entities

| Directory | Entity | Description |
|-----------|--------|-------------|
| `users/` | User | Encrypted PII (AES-256-GCM), Google OAuth subject, roles |
| `frequency/` | Frequency | Event frequency types (one-time, weekly, monthly, annually) |
| `facility/` | Facility | Physical facilities (pool, gym) with capacity |
| `event/` | Event | Swim sessions with start/end times and frequency |
| `venue/` | Venue | Physical locations linked to facilities with address and cost |
| `schedule/` | Schedule | Member-event-venue junction with dates |
| `form_question/` | FormQuestion | Facility signup-form questions (text / checkbox) |
| `facility_rule/` | FacilityRule | Facility signup-form rules and agreements |
| `form_submission/` | FormSubmission + FormResponse | Member signup submissions with atomic question responses |
