# Event Entity

Swim sessions with scheduled times and frequency.

## Files

| File | Description |
|------|-------------|
| `event.py` | Pydantic model — `Event` with `start_date_time`, `end_date_time`, `frequency_id` (FK), `is_active` |
| `event_interface.py` | Abstract base class — CRUD methods including query by `frequency_id` |
| `sqlite.py` | SQLite implementation — full CRUD with `frequency_id` index, bulk operations |

## Table Schema

`event` table with `event_id` (PK), `start_date_time`, `end_date_time`, `frequency_id` (FK), `is_active`.
