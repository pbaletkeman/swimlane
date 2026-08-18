# Missing Features — Done

Completed work for the `docs/layout.txt` implementation plan in
`missing-features-todo.md`. One entry per Phase, mirroring the subtask breakdown
and the PR write-up format required by the plan's Final Instruction.

## Phase A — Public (no-login) read access ✅

Branch: `feature/public-read-access`

`layout.txt:1,3,5` — find-by-address, find-by-event, venues browsing must not require login.

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| A.1 | `src/routes/public_routes.py` — `PublicRoutes` router (prefix `/public`, tags `["public"]`), read-only by design, no `Depends(...)` | `4f6a539` |
| A.2 | `VenueSQLite.search_venues(q)` (LIKE on street/city/state/postal_code, `is_active=1`) + `GET /public/venues?q=` returning `PublicVenue` (venue + facility name) | `f227012`, `4f6a539` |
| A.3 | `EventSQLite.list_public_events(start_from, start_to)` — active events in a `start_date_time` range, defaulting to upcoming; `GET /public/events` | `f617f6a`, `4f6a539` |
| A.4 | `VenueSQLite.list_active_venues()` + `GET /public/venues` (no `q`) — active venues with all address fields | `f227012`, `4f6a539` |
| A.5 | `ScheduleSQLite.list_schedules_by_venue_id_with_events(venue_id)` — active schedules joined to active events (start/end times); `GET /public/venues/{id}/schedules` | `3691183`, `4f6a539` |
| A.6 | `GET /public/venues/{venue_id}` — public venue detail, 404 for unknown/inactive | `4f6a539` |
| A.7 | `PublicRoutes` registered in `main.py`; `AGENTS.md` router list updated | `e1d9009` |
| A.8 | Smoke-tested unauthenticated public endpoints + auth-gated CRUD (see Verification) | `e1d9009` + this record |

### Details

- **Dedicated `/public` router** (Key decision #1): all admin CRUD stays behind
  the existing role deps; `/public` is the single auditable unauthenticated
  surface. Endpoints are read-only; inactive/missing venues return 404 so
  soft-deleted rows are not leaked.
- `GET /public/venues` and `GET /public/venues?q=` share one route — `q` is an
  optional query param (search when present, list otherwise).
- `PublicVenue` adds `facility_name` via a `FacilitySQLite.get_facility_by_id`
  enrichment in the route (data layer returns typed `Venue` models).
- **Deferred**: `GET /public/events?q=` free-text search is not implemented in
  Phase A — events have no searchable text field until `description` lands in
  Phase C. The endpoint supports `from`/`to` date filtering now (per the plan's
  "Initially" wording); `q` arrives with Phase C.

### Verification

- `uv run ruff check .` — clean.
- `uv run ruff format --check` on all changed files — clean (the only repo-wide
  format failure is a pre-existing one in `docs/logging-info.md`, untouched).
- `uv run pyright` — 0 errors.
- Backend smoke test (dev server, seeded active/inactive rows, no `Authorization` header):
  - `GET /public/venues` → 200 (active venues + facility names)
  - `GET /public/venues?q=Public` → 200 (address-substring match); `?q=zzzz` → 200 `[]`
  - `GET /public/venues/2` → 200 (detail + facility name); `/9999` → 404; inactive venue → 404
  - `GET /public/venues/2/schedules` → 200 (schedule joined with event start/end times)
  - `GET /public/events` → 200 (future active events only); `?from_dt=2026-09-01` → 200 `[]`
  - `GET /venues`, `/events`, `/schedules`, `/facilities` without a token → all 401
- Seed rows added for testing were removed afterward (DB counts back to original).