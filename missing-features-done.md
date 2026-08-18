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

## Phase B — Public venue schedule views (week / month / event list) (B.1–B.4 done; B.5–B.10 pending) 🔨

Branch: `feature/public-venue-schedules`

`layout.txt:7-10` — venue → schedule, default current week, monthly + event-list options.
Backend half complete; the frontend sub-tasks (B.5–B.10) are still open in
`missing-features-todo.md`.

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| B.1 | `GET /public/venues/{venue_id}/schedules` gains `view=week\|month\|list` + `date=YYYY-MM-DD` (default `week` anchored on the date or today); invalid `view` → 422 | `9c4a2b3` |
| B.2 | `GET /public/events` gains `venue_id` filter (upcoming active events at a venue) | `9c4a2b3` |
| B.3 | `src/util/dates.py` — `parse_date`, `start_of_week`, `week_range`, `month_range` (ISO week, Monday-start), `day_start_iso`, `day_end_iso` | `0675ab6` |
| B.4 | `EventSQLite.list_events_in_range(start_iso, end_iso, venue_id=None)` — interval overlap on `start_date_time`/`end_date_time`, optional venue scope via `schedule` join (distinct events) | `a44436b` |

### Details

- **Response shape changed from Phase A**: the venue schedules endpoint now
  returns distinct `PublicEvent` rows (not per-booking schedule rows) so a venue's
  week/month/list view shows each event once. Nothing consumes the old
  `PublicVenueSchedule` shape yet (frontend Phase B.5+ not built), so the change is
  safe on this branch. The A.5 helper `list_schedules_by_venue_id_with_events`
  remains in the data layer but is no longer used by the public routes.
- `view=list` returns upcoming active events at the venue
  (`list_public_events(venue_id=…)`); `week`/`month` return events overlapping the
  ISO-week / calendar-month range via `list_events_in_range`.
- `venue_id` scoping joins `event` → `schedule` (events have no `venue_id` column
  until Phase C) and filters to active schedules, deduping with `DISTINCT`.

### Verification

- `uv run ruff check .` — clean; `uv run ruff format --check` on all changed files — clean.
- `uv run pyright` — 0 errors.
- `src/util/dates.py` unit-check: 2026-08-18 (Tue) → week Mon 08-17 → Sun 08-23;
  month 08-01 → 08-31; day-start/end ISO strings correct.
- Backend smoke test (dev server, seeded active events in current week / later that
  month / previous month at venue 1, no auth):
  - `/public/venues/1/schedules` (default week) → only the current-week event
  - `?view=month` → both August events; `?view=list` → both upcoming August events
  - `?view=week&date=2026-07-13` and `?view=month&date=2026-07-01` → the July event
  - `?view=invalid` → 422
  - `/public/events?venue_id=1` → upcoming events at venue 1
  - `/public/venues/9999/schedules` → 404
- Seed rows added for testing were removed afterward (DB counts back to original).