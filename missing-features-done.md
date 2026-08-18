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

## Phase C — Event detail, capacity, register, reschedule (C.1–C.3 done; C.4+ pending) 🔨

Branch: `feature/event-registration`

`layout.txt:11-16` — event cap/max capacity, description, member register + reschedule.
Data-layer groundwork (C.1–C.3) is complete; migration, endpoints, and frontend
(C.4–C.14) are still open in `missing-features-todo.md`.

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| C.1 | `Event` model gains `description: str \| None = None`, `coach_id: str \| None = None`, `venue_id: int \| None = None` | `821bbaa` |
| C.2 | `event` DDL gains `description TEXT`, `coach_id TEXT`, `venue_id INTEGER` columns + `FOREIGN KEY (coach_id) REFERENCES users(sub)` / `FOREIGN KEY (venue_id) REFERENCES venue(venue_id)` (cascade, matching the existing `frequency_id` FK convention) + `idx_event_coach_id` / `idx_event_venue_id` indexes | `06b077e` |
| C.3 | `EventSQLite` updated for the new fields: `get_record_select`, `create_event_helper`, `create_event_returning`, `update_event`, `create_events_bulk` INSERT, `list_public_events` + `list_events_in_range` (both plain and venue-scoped select lists), `hard_delete_events_bulk` RETURNING | `06b077e` |

### Details

- Column order throughout is `event_id, start_date_time, end_date_time, frequency_id, description, coach_id, venue_id, is_active`; all selects/returns mirror it so `create_event_helper` maps correctly.
- New-field values default to `NULL`/`None` — fully backward compatible for existing callers that don't set them.
- The `EventRequest` route body does **not** yet carry the new fields (that lands with C.9 when the routes are wired).
- Branched from `main` (Phase B merged as `488e168` / PR #30).

### Verification

- `uv run ruff check .` — clean; `uv run ruff format --check` on changed files — clean; `uv run pyright` — 0 errors.
- Smoke test against a **throwaway DB** (fresh DDL + parent tables `facility`/`frequency`/`users`/`venue`/`schedule`), not the dev DB:
  - `create_event` with `description`/`coach_id`/`venue_id` populated → round-trips all three
  - `create_event` with the new fields unset → `None` (backward compatible)
  - `get_event_by_id` / `update_event` (changing description + end time) → correct
  - `create_events_bulk`, `list_events`, `list_public_events` (plain + `venue_id`), `list_events_in_range`, `hard_delete_events_bulk` → all map the new columns without error
- Dev DB `swimlane.db` is **unchanged** (no migration ran); it will keep working until C.4 adds the guarded `ALTER TABLE` — **the server should not be run against the existing dev DB in the interim** because `get_record_select` now selects the new columns.

### Notes

- **Pre-existing quirk (out of scope):** `create_events_bulk` re-selects only `last_insert_rowid()`, so a multi-row bulk returns just the last inserted row. Flagged for a future fix.
- **Deferred:** C.4 migration (required before the app works again on an existing DB), C.5–C.9 endpoints, C.10–C.14 frontend.

### Public routes, HomePage link, and styles (B.8–B.10)

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| B.8 | `router/index.tsx` — `/explore`, `/explore/venues`, `/explore/venues/:venueId` added as public routes (outside `RouteGuard`, alongside `/`, `/login`, `/auth/callback`) | `16357f4` |
| B.9 | `HomePage.tsx` — replaced "content coming soon" tagline; added "Explore venues" button (always shown) alongside the dashboard/login button | `857dbfa` |
| B.10 | `index.css` — `explore-*` page/header/nav/search/venue-grid/schedule/event styles; pages refactored from primeflex utilities onto those classes | `cdc19ba` |

### Details

- The explore pages render outside `AppLayout`, so B.10 styles provide their own
  header/nav chrome (`explore-header`, `explore-brand`, `explore-nav`,
  `explore-back-link`) and content layout (`explore-container`, `explore-page`).
- PrimeReact 11 compound components (`Select.Root`, `DatePicker.Root`) keep their
  headless-layout classes; only outer layout moved to the `explore-*` classes.
- `HomePage` now links to `/explore` for anonymous visitors; the Google sign-in
  and dashboard buttons remain.

### Verification

- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b` + Vite) — clean; `ExploreHomePage`,
  `ExploreVenuesPage`, `VenueSchedulePage` chunks now appear in the bundle,
  confirming the routes resolve the lazy imports.

### Frontend half (B.5–B.7)

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| B.5 | `frontend/src/api/public.ts` — `searchVenues(q)`, `listVenues()`, `getVenue(id)`, `getVenueSchedules(id, {view, date})`, `searchEvents({venueId, from, to})` | `b05254e` |
| B.6 | `frontend/src/api/types.ts` — `PublicVenue`, `PublicEvent`, `VenueScheduleRow` | `50b49bd` |
| B.7.1 | `ExploreHomePage.tsx` — "Find by address" + "Find by event" search boxes → `/explore/venues?q=` | `be8a81f` |
| B.7.2 | `ExploreVenuesPage.tsx` — searchable venue grid (address + facility name), reads `?q=` from the URL | `be8a81f` |
| B.7.3 | `VenueSchedulePage.tsx` — Week / Month / Event-list view switcher (`Select` + `DatePicker`), default current week, rows link to event detail | `be8a81f` |

### Details

- The three pages live under `frontend/src/pages/explore/` and were wired into
  the router as public routes in B.8 (`/explore`, `/explore/venues`,
  `/explore/venues/:venueId`), outside `RouteGuard`.
- `getVenueSchedules` consumes the B.1–B.4 response shape (`PublicEvent[]`,
  distinct events). `VenueScheduleRow` is retained per the plan as the legacy
  Phase A per-booking shape, documented for Phase C use.
- "Find by event" currently routes to the venue grid (`?q=…` matches facility
  name); real event text search + event-detail destination arrive with Phase C.
- Event rows link to `/explore/events/:eventId` per B.7.3; the route itself is
  Phase C (C.12/C.14).
- Layout uses PrimeReact 11 compound components (`Select.Root`, `DatePicker.Root`
  following `EntityFormDialog.tsx`); page structure now uses the semantic explore
  classes added in B.10.

### Verification

- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b` + Vite) — clean; all explore files typecheck.
- Backend smoke tests for the consumed endpoints were run in the B.1–B.4
  verification above.

## Phase B — Public venue schedule views (week / month / event list) (B.1–B.10 done) ✅

Branch: `feature/public-venue-schedules`

`layout.txt:7-10` — venue → schedule, default current week, monthly + event-list options.
Backend (B.1–B.4), frontend API/types + explore pages (B.5–B.7), and the public
routes, HomePage link, and explore styles (B.8–B.10) are all complete.

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