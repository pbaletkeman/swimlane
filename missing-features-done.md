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

## Phase C — Event detail, capacity, register, reschedule (C.1–C.13 done; C.14 pending) 🔨

Branch: `feature/event-registration`

`layout.txt:11-16` — event cap/max capacity, description, member register + reschedule.
Backend is complete (C.1–C.9), the frontend type layer is in place (C.10), the
API wrappers are ready (C.11), the public event detail page is done (C.12), and
event rows now link into it (C.13). Remaining work is the route registration
(C.14) in `missing-features-todo.md`.

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| C.1 | `Event` model gains `description: str \| None = None`, `coach_id: str \| None = None`, `venue_id: int \| None = None` | `821bbaa` |
| C.2 | `event` DDL gains `description TEXT`, `coach_id TEXT`, `venue_id INTEGER` columns + `FOREIGN KEY (coach_id) REFERENCES users(sub)` / `FOREIGN KEY (venue_id) REFERENCES venue(venue_id)` (cascade, matching the existing `frequency_id` FK convention) + `idx_event_coach_id` / `idx_event_venue_id` indexes | `06b077e` |
| C.3 | `EventSQLite` updated for the new fields: `get_record_select`, `create_event_helper`, `create_event_returning`, `update_event`, `create_events_bulk` INSERT, `list_public_events` + `list_events_in_range` (both plain and venue-scoped select lists), `hard_delete_events_bulk` RETURNING | `06b077e` |
| C.4 | Guarded migration in `EventSQLite.init()`: `PRAGMA table_info(event)` then `ALTER TABLE event ADD COLUMN description/coach_id/venue_id ...` (only when missing, NULL defaults). `get_create_table()` now returns just the `CREATE TABLE` and a new `get_create_indexes()` runs after migration, so pre-C.3 tables get the `idx_event_*` indexes too. Idempotent. | `eb27df5` |
| C.5 | `EventRoutes.get_event_capacity` handler — `{event_id, registered_count, max_capacity}`; count = active `schedule` rows; `max_capacity` resolved from event's `venue→facility.max_capacity` (`None` = unlimited); 404 if event missing/inactive | `6191ca0` |
| C.6 | `EventRoutes.register_for_event` handler — `Depends(member_role)`, creates a `Schedule` at the event's venue for `current_user.sub`; 409 already-registered; 409 at capacity; 400 no venue; 404 inactive event/venue | `6191ca0` |
| C.7 | `ScheduleRoutes.reschedule` handler — `Depends(member_role)`, body `{event_id}`; 403 unless the schedule belongs to `current_user.sub`; target event must be active (404) with a venue (400, venue active 404); 409 same event, 409 already registered on target, 409 target at capacity; updates `schedule.event_id` and moves `schedule.venue_id` to the target event's venue | `0459028` |
| C.8 | `ScheduleSQLite.get_schedule_for_member(event_id, member_id)` (active row) + `count_active_for_event(event_id)`; added to `ScheduleInterface`; `get_event_capacity`/`register_for_event` refactored to use them; capacity resolution hoisted to module-level `resolve_max_capacity(event)` in `event_routes.py` for reuse | `35ebe19` |
| C.9 | Routes wired: `GET /events/{event_id}/capacity` (public, no auth), `POST /events/{event_id}/register` and `POST /schedules/{schedule_id}/reschedule` (auth via `Depends(member_role)` in the handler signatures) | `1a8e164` |
| C.10 | `frontend/src/api/types.ts`: `Event` gains `description`/`coach_id`/`venue_id`; `PublicEvent` gains the same three (backend `/public` endpoints now select them per C.3); new `EventCapacity` (`max_capacity: null` = unlimited), `RegisterResponse` (a created `Schedule`), `RescheduleInput {event_id}` | `75ec70e` |
| C.11 | `frontend/src/api/events.ts`: `getEventCapacity(id)` (public GET) + `registerForEvent(id)` (POST); `frontend/src/api/schedules.ts`: `reschedule(id, { event_id })` (POST). Added as named exports alongside the existing `createCrudApi` consts (no default-export consumers exist) | `c7dd3e4` |
| C.12.1 | `frontend/src/pages/explore/EventDetailPage.tsx` — renders description, start/end times, venue (facility + address), and capacity ("12 / 20 registered" with a progress bar); loading skeletons + 404 `EmptyState`; `PublicEventDetail` type + `getEventDetail(id)` public wrapper. **Enabler:** new `GET /public/events/{event_id}` endpoint (public detail with venue + live capacity) and `/public` event responses now carry `description`/`coach_id`/`venue_id` | `4586bd3`, `a4be87b` |
| C.12.2 | Register button for signed-in users (`useAuth`), calls `registerForEvent(id)` → toast + refreshes capacity via `getEventDetail`; disabled when at capacity or already registered (membership resolved from `schedules.list()` filtered by `user.sub`) | `262691c` |
| C.12.3 | Anonymous users see a "Sign in to register" link to `/login?frontend_url=<origin>` | `262691c` |
| C.12.4 | "Reschedule" card when already registered: shows the current registration, a `Select` picker of alternate upcoming events (`searchEvents()`), and a "Move registration" button calling `reschedule(schedule_id, {event_id})` → toast + refreshes capacity and clears the local registration | `80ba026` |
| C.13 | Event rows link to `/explore/events/:id` — `VenueSchedulePage` rows (already linked since B.7.3) plus new inline `ExploreHomePage` event results. **Enabler:** `GET /public/events?q=` free-text search on `event.description` (deferred from A.3 until descriptions existed) | `9eac47e`, `d3b980e` |

### Details

- Column order throughout is `event_id, start_date_time, end_date_time, frequency_id, description, coach_id, venue_id, is_active`; all selects/returns mirror it so `create_event_helper` maps correctly.
- New-field values default to `NULL`/`None` — fully backward compatible for existing callers that don't set them.
- C.4 splits `get_create_table()` into table DDL + `get_create_indexes()` so `init()` runs **CREATE TABLE → migrate → indexes**; without the split, `CREATE INDEX ... ON event (coach_id)` fails on pre-C.3 tables before the `ALTER` runs.
- C.8 hoisted the venue→facility capacity lookup from `EventRoutes._resolve_max_capacity` to module-level `resolve_max_capacity(event)` (in `event_routes.py`) so `ScheduleRoutes.reschedule` shares it — no duplication between routers.
- The `EventRequest` route body does **not** yet carry the new fields (event creation/update of `description`/`coach_id`/`venue_id` still goes through the model defaults; extending the body is out of the C-scope listed in the todo, which targets capacity/register/reschedule).
- Branched from `main` (Phase B merged as `488e168` / PR #30).

### Verification

- `uv run ruff check .` — clean; `uv run ruff format --check` on changed files — clean; `uv run pyright` — 0 errors.
- Smoke tests:
  - **C.4** (throwaway DB) — *old* `event` table (no new columns) → `init()` adds all three columns, preserves an existing row as `NULL`s, second `init()` is a no-op; `get_event_by_id` works on the migrated row.
  - **C.5/C.6** (throwaway DB) — capacity fresh → `{0, 2}`; register m1 → count 1; duplicate → 409; m2 → count 2; m3 → 409 at capacity with **no partial schedule row**; missing/inactive event → 404; no-venue → 400; inactive venue → 404.
  - **C.7/C.8/C.9** (throwaway DB + FastAPI `TestClient` with real HS256 JWTs, routes wired) — capacity is public (no auth) `{0, 2}`; register/reschedule without a token → 401; register m1+m2 → evA full, duplicate → 409, m3 → 409; reschedule moves `event_id` + `venue_id` (evB→evC put the schedule on venue 2, evB dropped to 0); same-event → 409; already-registered target → 409; full target → 409; inactive target → 404; venue-less target → 400; someone else's schedule → 403; missing schedule → 404; final public capacities consistent.
- **Dev DB migrated in place** (`swimlane.db`): after `EventSQLite().init()`, `PRAGMA table_info(event)` shows `description`/`coach_id`/`venue_id` and `list_events()` works again (existing rows keep `NULL`s). No DB reset.
- **Frontend (C.10):** `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) clean — the new required `PublicEvent` fields don't break existing consumers (`getVenueSchedules`, `searchEvents`, `VenueSchedulePage`).
- **Frontend (C.11):** `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) clean — the new named API exports type-check against the `EventCapacity`/`RegisterResponse`/`RescheduleInput`/`Schedule` types.

### Notes

- **Pre-existing quirk (out of scope):** `create_events_bulk` re-selects only `last_insert_rowid()`, so a multi-row bulk returns just the last inserted row. Flagged for a future fix.
- **Postgres**: no `Event`/`Schedule` postgres implementation exists yet, so the postgresql branch of the C.4 migration is N/A until one is added.
- **Deferred:** C.14 route registration for `/explore/events/:eventId`.

### Public event detail page (C.12)

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| C.12.1 | `EventDetailPage.tsx` renders description, times, venue, and a capacity progress bar; `PublicEventDetail` type + `getEventDetail(id)` public API wrapper; `explore-event-meta`/`explore-capacity` styles | `a4be87b` |
| C.12.2 | Register action for signed-in users — `registerForEvent(id)`, toast + capacity refresh, disabled when full or already registered | `262691c` |
| C.12.3 | "Sign in to register" link to `/login?frontend_url=...` for anonymous visitors | `262691c` |
| C.12.4 | Reschedule card — current-event note, alternate-upcoming-event `Select` picker, `reschedule()` call with toast + refresh | `80ba026` |
| C.12 enabler | `GET /public/events/{event_id}` — public single-event detail (`PublicEventDetail` = `PublicEvent` + `venue: PublicVenue \| None` + `registered_count` + `max_capacity`); `_to_public_events` now includes `description`/`coach_id`/`venue_id` | `4586bd3` |

### Details

- C.12.1 renders event details **publicly** (no login required), so the page needed a public single-event source: `/public/events` only listed upcoming events and dropped the Phase C fields, and there was no `/public/events/{id}`. Added the enabler endpoint (`PublicRoutes.get_event_detail`) returning the event fields plus its venue summary (via the existing `_with_facility_name`) and live capacity (`ScheduleSQLite.count_active_for_event` + `resolve_max_capacity` from `event_routes.py`). 404 for missing/inactive events.
- `_to_public_events` was updated to carry `description`/`coach_id`/`venue_id` so `/public/events` matches the `PublicEvent` type shipped in C.10 (previously those fields were silently dropped by the public router while the TS type declared them required).
- The page is a lazy default-export component under `frontend/src/pages/explore/`, following `VenueSchedulePage.tsx` conventions (loading skeletons, `EmptyState` on 404, `explore-page`/`explore-container` chrome, `formatDateTime` helper).
- Membership is resolved from `schedules.list()` filtered to `is_active && event_id === id && member_id === user.sub`; the register response (a full `Schedule`) is used to set the local registration without a refetch. Reschedule uses the matched `schedule_id` and clears it locally after success.
- Capacity bar only renders when `max_capacity` is non-null (unlimited events show "N / unlimited registered"); the Register button label becomes "Event full" and is disabled when full.
- The `/explore/events/:eventId` route itself is registered in C.14 — until then the page is unreachable (verified via lint/build and the backend smoke test).
- Branched from `main` (Phase B merged as `488e168` / PR #30); C.1–C.11 commits carried forward from the earlier C-phase work.

### Verification

- **Backend (C.12 enabler):** `uv run ruff check .` clean; `uv run pyright` 0 errors. Throwaway-DB smoke test (`smoke_c12.py`, FastAPI `TestClient`):
  - `GET /public/events` → 200 and the listing now carries `description`/`coach_id`/`venue_id`.
  - `GET /public/events/{id}` → 200 with `venue.facility_name`/`street`, `registered_count`, `max_capacity`; after registering a member the count reflects it (1).
  - Venue-less event → `venue: null`, `max_capacity: null`; inactive event → 404; missing event → 404.
- **Frontend:** `npm run lint` (oxlint) clean after each of the C.12.1/C.12.2-3/C.12.4 commits; `npm run build` (`tsc -b` + Vite) clean — `EventDetailPage` compiles as a lazy chunk and the new `public`/`types` changes typecheck against existing consumers.

### Notes (C.12)

- Scope note: C.12 is listed in the todo as frontend-only, but the page must render event details anonymously; the small `GET /public/events/{event_id}` endpoint was added as a C.12 enabler and is the only backend change in this round.
- The reschedule picker uses `searchEvents()` (upcoming active events) excluding the current event; a member who reschedules away is no longer registered for this page's event, so the local registration is cleared and capacity refreshed.
- No manual browser pass yet — the route is registered in C.14.

### Event links (C.13)

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| C.13 | `ExploreHomePage` "Find by event" now runs the public event search inline and renders result rows (time, description, end time) each linking to `/explore/events/:id`; `EventSearchOptions` gains `q`; `searchEvents` passes it as `?q=`; `.explore-event-description` style | `9eac47e` |
| C.13 enabler | `GET /public/events?q=` free-text search on `event.description` (`EventSQLite.list_public_events(search=…)` + interface, route `q` param) — the A.3-deferred search, now that Phase C descriptions exist | `d3b980e` |

### Details

- `VenueSchedulePage` already linked every event row to `/explore/events/:eventId` ("View details" button) since Phase B (B.7.3) — that half of C.13 needed no change, only the `ExploreHomePage` half.
- The home page now shows results below the search card (loading skeletons while fetching, `EmptyState` when empty); a blank "Find by event" search lists all upcoming active events.
- `q` combines with the existing `from_dt`/`to_dt`/`venue_id` filters in `list_public_events` (case-insensitive `LIKE`, active events only).
- Branched from `main` (Phase B merged as `488e168`); this branch carries the full C.1–C.12 history plus the C.13 commits.

### Verification

- Backend: `uv run ruff check .` clean; `uv run pyright` 0 errors.
- Backend smoke test (`smoke_c13.py`, throwaway DB + `TestClient`): `?q=city` matches the active "City meet" description only (inactive "finals" excluded); `q` + `venue_id` combine; `?q=zzz` → `[]`; no `q` → all upcoming events (2); inactive events never match.
- Frontend: `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) clean — `ExploreHomePage` compiles (lazy chunk grew to include the result rendering + toast) and the `q` param typechecks against `searchEvents`.

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