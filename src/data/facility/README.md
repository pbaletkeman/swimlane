# Facility Entity

Physical facilities such as pools, gyms, or courts.

## Files

| File | Description |
|------|-------------|
| `facility.py` | Pydantic model — `Facility` with `name` (unique), `description`, `max_capacity`, `min_capacity`, `is_active` |
| `facility_interface.py` | Abstract base class — CRUD methods including lookup by name |
| `sqlite.py` | SQLite implementation — full CRUD with `name` UNIQUE index, bulk operations |

## Table Schema

`facility` table with `facility_id` (PK), `name` (UNIQUE), `description`, `max_capacity`, `min_capacity`, `is_active`.
