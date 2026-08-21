# Data Layer

Entity data models, abstract interfaces, and database implementations following a consistent 3-file pattern per entity.

## Pattern

Each entity directory contains:

- `<entity>.py` — Pydantic `BaseModel` defining the data schema
- `<entity>_interface.py` — Abstract base class (`abc.ABC`) with CRUD method signatures
- `sqlite.py` — Concrete SQLite implementation using raw `sqlite3` (no ORM)

Column additions use guarded migrations in `init()` (`PRAGMA table_info(...)` then `ALTER TABLE ... ADD COLUMN` only when missing) so existing dev databases upgrade in place — see `event/sqlite.py`.

## Entities

| Directory | Entity | Description |
|-----------|--------|-------------|
| `users/` | User | Encrypted PII (AES-256-GCM), Google OAuth subject, roles |
| `frequency/` | Frequency | Event frequency types (one-time, weekly, monthly, annually) |
| `facility/` | Facility | Physical facilities (pool, gym) with capacity |
| `event/` | Event | Swim sessions with start/end times, frequency, description, coach (`users.sub`), and venue |
| `venue/` | Venue | Physical locations linked to facilities with address and cost |
| `schedule/` | Schedule | Member-event-venue junction with dates |
| `form_question/` | FormQuestion | Facility signup-form questions (text / checkbox) |
| `facility_rule/` | FacilityRule | Facility signup-form rules and agreements |
| `form_submission/` | FormSubmission + FormResponse | Member signup submissions with atomic question responses |
| `message/` | Message | One-way staff→member inbox messages (`member_id` + `sender_id` → `users.sub`, read flag) |
| `user_invite/` | UserInvite | Email-keyed pre-registration invites; the invited role is applied on first Google login |
