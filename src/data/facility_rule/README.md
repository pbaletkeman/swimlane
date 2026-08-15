# Facility Rule Entity

Display-only rules text associated with a facility.

## Files

| File | Description |
|------|-------------|
| `facility_rule.py` | Pydantic model — `FacilityRule` with `facility_id`, `title`, `content`, `sort_order`, `is_active` |
| `facility_rule_interface.py` | Abstract base class — CRUD methods plus `list_rules_by_facility` and bulk operations |
| `sqlite.py` | SQLite implementation — full CRUD with `facility_id` FK, bulk operations |

## Table Schema

`facility_rule` table with `rule_id` (PK), `facility_id` (FK → `facility`), `title`,
`content`, `sort_order`, `is_active`. Index on `facility_id`; rows ordered by
`sort_order ASC, rule_id ASC`.