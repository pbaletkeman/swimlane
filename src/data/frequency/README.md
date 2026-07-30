# Frequency Entity

Event frequency types for scheduling swim sessions.

## Files

| File | Description |
|------|-------------|
| `frequency.py` | Pydantic model — `Frequency` with `name` (unique), `day_interval`, `is_active` |
| `frequency_interface.py` | Abstract base class — CRUD methods including lookup by name |
| `sqlite.py` | SQLite implementation — full CRUD with `name` UNIQUE index, bulk operations |

## Table Schema

`frequency` table with `frequency_id` (PK), `name` (UNIQUE), `day_interval`, `is_active`.
