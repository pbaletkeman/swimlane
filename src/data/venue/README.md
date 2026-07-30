# Venue Entity

Physical locations linked to facilities with address and cost information.

## Files

| File | Description |
|------|-------------|
| `venue.py` | Pydantic model — `Venue` with `facility_id` (FK), `street`, `city`, `state`, `postal_code`, `cost`, `is_active` |
| `venue_interface.py` | Abstract base class — CRUD methods including query by `facility_id` |
| `sqlite.py` | SQLite implementation — full CRUD with `facility_id` index, bulk operations |

## Table Schema

`venue` table with `venue_id` (PK), `facility_id` (FK), `street`, `city`, `state`, `postal_code`, `cost`, `is_active`.
