# Schedule Entity

Junction table linking members to events at venues.

## Files

| File | Description |
|------|-------------|
| `schedule.py` | Pydantic model — `Schedule` with `venue_id`, `member_id`, `event_id`, `is_active` |
| `schedule_interface.py` | Abstract base class — CRUD methods including lookups by member, event, and venue |
| `sqlite.py` | SQLite implementation — full CRUD with indexes on `venue_id`, `member_id`, `event_id`, bulk operations |

## Table Schema

`schedule` table with `schedule_id` (PK), `venue_id` (FK), `member_id` (FK to user.sub), `event_id` (FK), `is_active`.
