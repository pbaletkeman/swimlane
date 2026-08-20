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

## Phase C — Event detail, capacity, register, reschedule (C.1–C.14 done) ✅

Branch: `feature/event-registration`

`layout.txt:11-16` — event cap/max capacity, description, member register + reschedule.
Backend complete (C.1–C.9), frontend types + wrappers (C.10–C.11), public event
detail page with register/reschedule (C.12), event links (C.13), and the public
route (C.14). The full self-service flow — browse → event detail → register →
reschedule — is implemented.

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
| C.14 | `frontend/src/router/index.tsx` — `/explore/events/:eventId` registered as a **public** route (outside `RouteGuard`) with lazy `EventDetailPage` import | `42a70bf` |

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
- **Deferred:** none — Phase C is complete. The full manual browser pass (explore → event detail → register → reschedule) is covered by J.6.

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
- The `/explore/events/:eventId` route is registered in C.14; until then the page was unreachable (verified via lint/build and the backend smoke test).
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

### Public route registration (C.14)

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| C.14 | `frontend/src/router/index.tsx` — lazy `EventDetailPage` import + `<Route path="/explore/events/:eventId" element={<EventDetailPage />} />` in the public group (outside `RouteGuard`) | `42a70bf` |

### Details

- The route sits alongside the other public `/explore` routes (`/explore`, `/explore/venues`, `/explore/venues/:venueId`), outside the `RouteGuard`-wrapped `AppLayout` tree, so anonymous visitors can view event details and are prompted to sign in to register (C.12.3).
- `EventDetailPage` is a lazy default-export component; the build now emits its own `EventDetailPage-*.js` chunk, confirming the route resolves the import.

### Verification

- Frontend: `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) clean — `EventDetailPage-y58BGqRA.js` appears as its own lazy chunk (263 modules transformed).
- The route completes the C.12–C.14 flow; backend capacity/register/reschedule endpoints and public event detail/search were smoke-tested in C.12/C.13 verification.

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

## Phase D — Member "My Schedule" + iCal export ✅

Branch: `feature/my-schedule-ical`

`layout.txt:18-19` — my schedule of events, add to calendar (ical).

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| D.1 | `GET /schedules/me` (`member_role`) — caller's active schedules joined with event start/end/description, venue address, facility name, ordered by start time; `MyScheduleItem` response model | `8c87945`, `252f210` |
| D.2 | `GET /schedules/me/ical` — `text/calendar` RFC 5545 VCALENDAR with one `VEVENT` per entry (UID `swimlane-<id>@swimlane`, DTSTART/DTEND in UTC, SUMMARY "Swimlane — \<facility\>", LOCATION venue address), `Content-Disposition: attachment; filename="swimlane-calendar.ics"`. Hand-rolled builder in `src/util/ical.py` — no new dependency | `252f210` |
| D.3 | `ScheduleSQLite.list_active_schedules_by_member_id(member_id)` (active-only) + `list_active_schedules_by_member_id_with_details(member_id)` (the D.1 join helper) + interface entries | `8c87945` |
| D.4 | `frontend/src/api/schedules.ts` — `listMine()`, `getMyCalendarIcs()` (`responseType: 'text'`), `cancelRegistration(id)`; `MyScheduleItem` type in `types.ts` | `b466e75` |
| D.5.1 | `frontend/src/pages/MySchedulePage.tsx` — upcoming/past cards (date range, facility, venue address, description, status tag), loading skeletons, EmptyState | `e136126` |
| D.5.2 | "Add to calendar (iCal)" button → fetches the `.ics` text and downloads it as `swimlane-calendar.ics` via Blob + anchor | `cfe99f1` |
| D.5.3 | Per-row Reschedule (`Select` of alternate upcoming events → `reschedule()`) and Cancel (soft-delete via the new `POST /schedules/{id}/cancel`, `ConfirmDelete` dialog) | `5ca0e5e`, `252f210` |
| D.6 | `My Schedule` in `frontend/src/layout/nav.ts` (`pi-calendar-plus`, `requiredRole: 'MEMBER'`) | `ab34e33` |
| D.7 | `/my-schedule` route inside `RouteGuard` (lazy `MySchedulePage`) | `37e140a` |

### Details

- `/me` and `/me/ical` are registered **before** `/{schedule_id}` in `ScheduleRoutes.__init__` so FastAPI doesn't capture `me` as a schedule id.
- The existing `DELETE /schedules/{schedule_id}` is `facility_manager_role`-gated, so D.5.3's member cancel needed its own endpoint: `POST /schedules/{schedule_id}/cancel` (`member_role`, 403 unless the schedule belongs to `current_user.sub`, 404 if missing) → soft-delete via `delete_schedule_by_id` (sets `is_active=0`).
- `src/util/ical.py` (`_utc_stamp`, `_escape`, `build_member_calendar`) converts the naive local `event` datetimes to UTC `YYYYMMDDTHHMMSSZ` and escapes iCal TEXT reserved characters (`\`, `;`, `,`, newline); CRLF line endings per RFC 5545. The `ics` library was deliberately skipped.
- `DTSTAMP` reuses the event's start time (no separate created timestamp exists on `schedule`); SUMMARY is always "Swimlane — \<facility name\>"; LOCATION is the joined venue address.
- Reschedule reuses the Phase C picker pattern (`searchEvents()` filtered to events the member is not already registered for, `Select` + Move button per row). The page reloads `listMine()` after reschedule/cancel so rows stay consistent.
- Branched from `feature/event-registration` (Phase C branch, unmerged) per the plan's branching rule — this branch carries the full Phase C commit history.

### Verification

- Backend: `uv run ruff check .` clean; `uv run pyright` 0 errors.
- Backend smoke test (`smoke_d1_d2.py`, throwaway DB + FastAPI `TestClient`, real HS256 JWTs, `ScheduleRoutes` wired):
  - `GET /schedules/me` without token → 401; with member token → 200 with both active schedules joined (facility "City Pool", street/city, event times), ordered by start time; each caller sees only their own rows.
  - `GET /schedules/me/ical` without token → 401; with token → 200, `Content-Type: text/calendar`, `Content-Disposition` filename `swimlane-calendar.ics`, body begins `BEGIN:VCALENDAR`, one `VEVENT` per schedule with `UID:swimlane-…`, `DTSTART`/`DTEND`, `SUMMARY:Swimlane — City Pool`, `LOCATION` with escaped commas, CRLF endings.
  - `POST /schedules/{id}/cancel` (own) → 200 `{message: "Registration cancelled"}` and the schedule disappears from `/schedules/me` (and from the iCal VEVENT count); someone else's schedule → 403; missing → 404.
- Frontend: `npm run lint` (oxlint) clean after every commit; `npm run build` (`tsc -b` + Vite) clean — `MySchedulePage-*.js` emits as its own lazy chunk; nav/router changes typecheck.

### Notes

- `event.description` is included in `MyScheduleItem` but unused by the page (kept for future profile/coach views); the page renders `facility_name`, address, and times.
- Manual browser pass (register → my-schedule → reschedule/cancel → iCal download) is deferred to J.6.
- `AGENTS.md` sync (router list, `/public` + new endpoints) is deferred to J.8 per the plan.

## Phase E — Member Profile / Correspondence (E.1–E.10 complete) ✅

Branch: `feature/profile-correspondence`

`layout.txt:21-25` — profile with correspondence: my forms, my events, my messages.
The full Phase E scope is complete: backend (E.1–E.5), frontend API layer + types
(E.6–E.7), the `ProfilePage` (E.8), the sidebar Profile link (E.9), and the
`/profile` route (E.10).

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| E.1 | `GET /forms/me/submissions` (`member_role`) — caller's submissions joined with facility name (`submission_id`, `facility_id`, `facility_name`, `signed_at`, `submitted_at`, `is_complete`); `FormSubmissionSQLite.list_by_member(sub)` + `MySubmissionItem` | `3c0ad23` |
| E.2 | `GET /forms/submissions/{id}` (`member_role`) — submission + answers (`SubmissionDetailResponse`); members may only read their own (403 otherwise), managers/coaches/admins any; `FormSubmissionSQLite.get_by_id_with_responses(submission_id)` | `3c0ad23` |
| E.3 | `GET /schedules/me/events` — **decided: pure alias** of `GET /schedules/me` (same handler, same payload); registered alongside `/me` and `/me/ical` | `d85e0c9` |
| E.4.1 | `src/data/message/message.py` — `Message(message_id, member_id FK→users.sub, sender_id FK→users.sub, subject, body, is_read=False, sent_at, is_active=True)` | `c7875e1` |
| E.4.2 | `src/data/message/message_interface.py` — CRUD + `list_by_member(member_id)`, `mark_read(message_id)` | `c7875e1` |
| E.4.3 | `src/data/message/sqlite.py` — DDL (`is_read` default 0, `sent_at` TEXT, both FKs to `users(sub)` with cascade, `idx_message_member_id`/`idx_message_sender_id`), CRUD impl; `list_by_member` returns **active** inbox rows only | `c7875e1`, `3c0ad23` (fix) |
| E.4.4 | `MessageSQLite` registered in `main.py` `init_db()` | `3151977` |
| E.4.5 | `src/routes/message_routes.py` `MessageRoutes` (`/messages`) — `GET /messages/me` (`member_role`, active inbox + `sender_name` decrypted), `PUT /messages/{id}/read` (`member_role`, own only), `POST /messages` (`coach_role`+, `{member_id, subject, body}`, 404 unknown recipient), `DELETE /messages/{id}` (soft, own inbox only), `DELETE /messages/{id}/hard` (`admin_role`); registered in `main.py` | `3151977` |
| E.5 | `src/routes/README.md` — new rows (`message_routes.py`, `public_routes.py`), endpoint additions for `event_routes.py` (capacity/register), `schedule_routes.py` (member self-service), `form_routes.py` (submission list/detail), and the `coach_role` pattern bullet | `7937970` |
| E.6 | Frontend API layer — `forms.ts`: `listMySubmissions()`, `getSubmission(id)`; new `messages.ts`: `listMine()`, `markRead(id)`, `send(input)`; supporting types in `types.ts` | `82397c5` |
| E.7 | `frontend/src/api/types.ts` — `Message`, `MessageInput`, `MySubmission` (+ `SubmissionDetail`) types | `82397c5` (added as E.6 compile deps) |
| E.8.1 | `frontend/src/pages/ProfilePage.tsx` — header card: Google avatar, name, email, role `Tag` (reuses `getRoleFromToken` + the Dashboard `ROLE_SEVERITY`/`ROLE_LABEL` maps); `profile-header*` CSS in `index.css` | `a55f908` |
| E.8.2 | `ProfilePage` correspondence tabs — PrimeReact `Tabs` (Root/List/Tab/Panels/Panel): **My Forms** (submission list → view detail dialog + PDF download), **My Events** (reuses `listMine()` schedule data inline), **My Messages** (inbox with unread styling + read/unread tag, opens message dialog and auto-marks read); `profile-tab*`/`profile-dialog*`/`profile-response*` CSS | `382c6c6` |
| E.9 | `AppLayout.tsx` sidebar footer — the placeholder Profile item now navigates to `/profile` (`navigate` + `isActive` highlight + close-on-narrow, same as nav items) | `bdd56a0` |
| E.10 | `router/index.tsx` — `/profile` route registered inside `RouteGuard` + `AppLayout`, `ProfilePage` lazy-loaded (own Vite chunk emitted) | `302c203` |

### Details

- **E.3 decision**: `/schedules/me/events` is a pure alias — same handler (`ScheduleRoutes.my_schedule`) registered as an additional route, so "my events" and "my schedule" can never drift. Documented here rather than as a separate aggregate.
- **E.2 ownership guard** reuses the Phase B PDF pattern: `current_user.role == UserRole.MEMBER.value` → must own; coaches/managers/admins pass through. `SubmissionDetailResponse` carries the facility name plus the full `responses` list (needed by the future "my forms" tab to show answers).
- **Message routing order**: `/{message_id}/read`, `/{message_id}`, `/{message_id}/hard` share the `{message_id}` prefix but no conflict exists (distinct literal suffixes + methods); `GET /messages/me` is registered first.
- **`mark_read`** fetches the existing row, flips `is_read`, and re-saves via `update_message` (which only touches `is_read`/`is_active`), avoiding a partial `Message` construction.
- **`create_messages_bulk`** resolves created rows via `SELECT last_insert_rowid()` (the SQL function, not `cursor.lastrowid`, which Python 3.12+ resets to `None` after `executemany`) minus the batch size — the pre-existing "last-row-only" quirk from other bulk creators was deliberately not replicated.
- `sender_name` in `GET /messages/me` decrypts the sender's first/last name (falling back to the sender sub) so the inbox shows who sent each message (Key decision #5).
- Branched from `feature/my-schedule-ical` per the plan's branching rule. Phase C (#31) and Phase D (#32) were merged to `main` during this round, and the Phase D branch tip had been updated to the merged commit — so this branch contains **only** the Phase E.1–E.10 changes (verified: `git diff main...feature/profile-correspondence` touches just the E.1–E.10 files).
- **E.5** (`src/routes/README.md`, `7937970`): added `message_routes.py` and the previously-missing `public_routes.py` rows; extended `event_routes.py` (public capacity, member register), `schedule_routes.py` (`/me`, `/me/ical`, `/me/events`, reschedule/cancel), and `form_routes.py` (submission list/detail) descriptions; added the `coach_role` pattern bullet. Every claim was verified against the actual route registrations (dependencies + handler role deps).
- **E.6** (`82397c5`): added `listMySubmissions`/`getSubmission` to `frontend/src/api/forms.ts` and the new `frontend/src/api/messages.ts` (`listMine`, `markRead`, `send`) following the existing `api.get/post/put` wrapper style. The `Message`/`MessageInput`/`MySubmission`/`SubmissionDetail` types were added to `types.ts` in this commit — they are compile-time dependencies of E.6's functions and also satisfy E.7's type list (E.7 will just confirm/extend them when reached).
- **E.8.2** (`382c6c6`): added the three correspondence tabs using the PrimeReact 11 compound `Tabs` component (`Tabs.Root` with `value`/`onValueChange`, `Tabs.List`+`Tabs.Tab`, `Tabs.Panels`+`Tabs.Panel`). **My Forms** calls `forms.listMySubmissions()` and, per row, opens a detail `Dialog` via `forms.getSubmission(id)` (lists the stored answers) or downloads the PDF via `forms.getSubmissionPdf(id)` (same Blob/anchor pattern as `FormViewPage`). **My Events** reuses the `MySchedulePage` data layer inline (`listMine()` → `MyScheduleItem[]`) with Upcoming/Past tags. **My Messages** calls `messages.listMine()`, shows unread cards with an inset accent + dot and Read/Unread tags, opens a body `Dialog` via `handleOpenMessage`, and auto-calls `messages.markRead(id)` when an unread message is opened (inbox state updated in place). Tabs and dialogs compile via `tsc -b`; page is not yet routed (E.10) or linked (E.9).
- **E.9** (`bdd56a0`): converted the placeholder `Sidebar.Footer` Profile item in `AppLayout.tsx` into a working link — `navigate('/profile')` on click, `isActive('/profile')` highlight, and sidebar close on narrow screens, mirroring the nav-item behavior. The route itself is registered in E.10.
- **E.10** (`302c203`): added the `/profile` route in `frontend/src/router/index.tsx` (lazy `ProfilePage` import, inside the `RouteGuard` + `AppLayout` branch). The Vite build emits a dedicated `ProfilePage-*.js` chunk, confirming the route wiring. Manual browser pass of the tabs is deferred to J.6.

### Verification

- Backend: `uv run ruff check .` clean; `uv run pyright` 0 errors.
- Frontend: `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) passes — including the new `ProfilePage.tsx` (built but not yet routed).
- Backend smoke test (`smoke_e1_e4.py`, throwaway DB + FastAPI `TestClient`, real HS256 JWTs, FormRoutes/ScheduleRoutes/MessageRoutes wired):
  - **E.1** — `/forms/me/submissions` → 401 no auth; 200 with member token (joined `facility_name` "City Pool", `is_complete` true, `submitted_at` set); caller-scoped (m1 sees only m1's, m2 only m2's).
  - **E.2** — `/forms/submissions/{id}` → 401 no auth; 200 own (2 responses with correct answers); m1 reading m2's → 403; facility manager reading m2's → 200; missing → 404.
  - **E.3** — `/schedules/me/events` → 401 no auth; 200 for member, payload identical to `/schedules/me` (event id, facility, times).
  - **E.4** — `/messages/me` → 401 no auth; 200 with the seeded message (sender_id, subject, `is_read: false`); coach `POST /messages` to m2 → 200; member POST → 403; unknown recipient → 404; `PUT /{id}/read` own → `is_read: true`, another member's → 403; `DELETE /{id}` own → soft-deleted (drops out of inbox), another's → 403; `DELETE /{id}/hard` non-admin → 403, admin → 200; missing → 404.
- Dev DB: `main.py` startup creates the `message` table via `init_db()` (idempotent); no migration needed elsewhere.

### Notes

- **Phase E is fully complete.** The next phase is F (coach "Manage Events"); E.5's J.8 aggregate docs sync still pending.
- `POST /messages` sends to any `users.sub`; the member picker arrives with Phase G's user-list endpoint, so staff paste the `sub` for now.
- No `AGENTS.md` sync yet (J.8 covers the aggregate update); the `src/routes/README.md` in-repo route doc is now current.

## Phase F — Coach "Manage Events" (complete)

Branch: `feature/coach-manage-events`

`layout.txt:27-33` — coach-scoped events, create/edit, past/upcoming, manage members.

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| F.1 | `GET /coach/events?scope=upcoming\|past\|all` — `coach_role`; returns only events where `coach_id == current_user.sub`; `EventSQLite.list_events_by_coach(coach_id, scope)`; new `src/routes/coach_routes.py` `CoachRoutes` (`/coach` prefix) registered in `main.py` | `863a8bc` |
| F.2 | `GET /events/{id}/members` — `coach_role`; 403 unless the caller is the event's coach or manager+; returns active schedules joined with member display info (name/email decrypted server-side); `ScheduleSQLite.list_schedules_by_event_id_with_members(event_id)`; `EventMemberItem` response model | `fe94c7a` |
| F.3 | `EventRequest` extended with `description`/`coach_id`/`venue_id`; `POST/PUT/DELETE /events[/{id}]` relaxed from `facility_manager_role` to `coach_role` with an inline guard: managers+ may touch any event, coaches only their own (403 otherwise); a coach's create forces `coach_id = caller.sub`; a coach's update can't reassign the coach; partial manager PUTs preserve the existing `coach_id` instead of nulling it | `777ca3f` |
| F.4 | `POST /events/{id}/members` — `coach_role`; 403 unless the caller is the event's coach or manager+; `{member_id}` body creates a schedule with the Phase C capacity/duplicate checks; returns the new member with decrypted display info | `c6ae0f7` |
| F.5 | `DELETE /events/{id}/members/{schedule_id}` — `coach_role`; 403 unless the caller is the event's coach or manager+; soft-deletes the schedule (404 if missing or not on the event) | `32f4373` |
| F.6 | `PUT /events/{id}/members/{schedule_id}` — `coach_role`; same own-event-or-manager+ guard; `EventMemberEdit` body (`venue_id`/`event_id`) updates the schedule, validating that the new venue/event exist and are active (404); returns the member with decrypted display info | `777ca3f` |
| F.7 | Smoke test (`smoke_f3_f6_f7.py`, throwaway temp DB) exercising `coach_role` for the first time: member can't create; coach1 creates own (coach_id forced to caller); coach1 can't create for another coach (403); manager can create with any coach; coach2 gets 403 on coach1's event for update/delete/member-edit; coach1 update/delete/edit own succeed; invalid venue / wrong schedule → 404 | `777ca3f` |
| F.8 | `frontend/src/api/events.ts` — `listMine(scope)` (`GET /coach/events`), `listMembers(eventId)`, `addMember(eventId, memberId)`, `removeMember(eventId, scheduleId)`, `editMember(eventId, scheduleId, input)`; `types.ts` — `CoachEventScope`, `EventMember`, `EventMemberAddInput`, `EventMemberEditInput`; `EventInput` extended with `description`/`coach_id`/`venue_id` | `8e73095` |
| F.9 | New `frontend/src/pages/CoachEventsPage.tsx` at `/manage-events` — coach's own events with scope switcher, edit/new dialogs, and a members management drawer | `2be4ad0` `2ec234c` `8c08b45` `efa4b5d` |
| F.10 | `Manage Events` added to sidebar nav (`pi-user-edit`, `requiredRole: 'COACH'`) | `52acfb7` |
| F.11 | `/manage-events` route registered inside `RouteGuard` | `8611144` |

### Details

- **F.1** (`863a8bc`): added `EventInterface.list_events_by_coach(coach_id, scope)` + SQLite impl in `src/data/event/sqlite.py`. `scope` defaults to `all`; `upcoming` filters `start_date_time >= now`, `past` filters `start_date_time < now`, with `now` as `datetime.now().isoformat(timespec="seconds")` matching the stored TEXT format. Results reuse `get_record_select(where)` so ordering (`is_active DESC, start_date_time ASC`) is consistent with the rest of the Event SQLite.
- New router `src/routes/coach_routes.py` (`CoachRoutes`, `APIRouter(prefix="/coach")`) hosts coach-scoped endpoints; F.1's `GET /coach/events` is the first. It's registered in `main.py` right after `AuthRoutes`. `scope` is typed as a `Literal["upcoming", "past", "all"]` query param so an invalid value is rejected by FastAPI (422) without manual validation.
- The route depends on `coach_role` (COACH + FACILITY_MANAGER + WEB_ADMIN) and scopes by `current_user.sub`, so a facility manager hitting `/coach/events` gets their own coach-assigned events (which is empty unless they're also assigned) — consistent with the "own events" rule in the plan.
- **F.2** (`fe94c7a`): added `ScheduleInterface.list_schedules_by_event_id_with_members` + SQLite impl in `src/data/schedule/sqlite.py` — `LEFT JOIN users u ON u.sub = s.member_id` over the event's **active** schedules, selecting the member's raw PII columns (nonce + ciphertext for first/last name and email) plus the schedule fields, ordered by `schedule_id`. `GET /events/{id}/members` is registered on `EventRoutes` (shares the `/events` prefix). The handler depends on `coach_role`, then enforces the plan's rule inline: the caller must either be the event's coach (`event.coach_id == current_user.sub`) or manager+ (`role in {FACILITY_MANAGER, WEB_ADMIN}`), else 403; missing event → 404. PII is decrypted server-side into `EventMemberItem.member_name`/`.email` (falling back to the `member_id`/`None` on missing or undecryptable columns), so no encrypted fields ever leak to the client.
- **F.4** (`c6ae0f7`): `POST /events/{id}/members` takes `{member_id}` and creates a schedule. The Phase C `register_for_event` internals were factored into a shared `_create_schedule_for_member(event_id, member_id)` helper (404 missing/inactive event, 400 no venue, 404 missing venue, 409 already registered, 409 at capacity, create → 500 on failure); `register_for_event` now just calls it with `user.sub` and F.4 calls it with `body.member_id` after the own-event-or-manager+ guard (the same guard as F.2, now shared via `_is_manager_or_admin(user)`). The response re-queries the joined member row so it carries the same decrypted `member_name`/`email` as the F.2 list.
- **F.5** (`32f4373`): `DELETE /events/{id}/members/{schedule_id}` applies the same own-event-or-manager+ guard, then verifies the schedule exists **and belongs to the event** (`schedule.event_id != event_id` → 404) before soft-deleting via the existing `ScheduleSQLite.delete_schedule_by_id` (sets `is_active = 0`, so removed members disappear from the F.2 list). Returns `{message: "Member removed"}`; missing event or schedule → 404. Re-removing an already soft-deleted schedule is idempotent (200) because the UPDATE still matches one row.
- **F.3** (`777ca3f`): `EventRequest` gained `description`, `coach_id`, and `venue_id` (all optional). The three event-mutating routes dropped `facility_manager_role` for `coach_role`, with the ownership rule enforced inline (shared `_is_manager_or_admin(user)` helper): a non-manager is 403 unless the event's `coach_id` is their own `sub`. `create_event` forces a non-manager's `coach_id` to the caller's `sub` (403 if the body names someone else); `update_event` prevents a non-manager from reassigning the coach (403) and preserves the existing `coach_id` when the body omits it — this also fixed a latent bug where a manager's partial PUT (no `coach_id` in the body) would have nulled the field. `delete_event` is soft (reuses `delete_event_by_id`).
- **F.6** (`777ca3f`): `PUT /events/{id}/members/{schedule_id}` takes `EventMemberEdit` (`venue_id` and/or `event_id`, both optional). After the same own-event-or-manager+ guard, it verifies the schedule belongs to the event (404), validates any new venue/event exist and are active (404), then `update_schedule`s and re-queries the joined member row for the decrypted `EventMemberItem` response (same `_member_display_name`/`_member_email` fallbacks as F.2/F.4).
- **F.7** (`777ca3f`): the first smoke test to exercise `coach_role` end-to-end (`smoke_f3_f6_f7.py`, against a throwaway temp DB — never the dev `swimlane.db`, per the F.1 lesson). All checks passed; see Verification.
- **F.8** (`8e73095`): frontend wrappers for the Phase F endpoints. `listMine(scope)` hits `/coach/events?scope=` (defaults to `upcoming`); the member endpoints hit `/events/{id}/members[...]`. `editMember` was added beyond the todo's four (F.9.4 needs it). `EventInput` picked up `description`/`coach_id`/`venue_id` to mirror the extended `EventRequest`.
- **F.9** (`2be4ad0` shell, `2ec234c` edit dialog, `8c08b45` new dialog, `efa4b5d` members drawer): `CoachEventsPage` is the coach's `/manage-events` view.
  - **F.9.1** — Select scope switcher (Upcoming/Past/All) refetches `listMine(scope)`; the table also loads venues/facilities/frequencies and per-event capacity (`getEventCapacity`) to render Facility/Venue, Capacity, and Frequency columns.
  - **F.9.2** — Edit dialog (`EntityFormDialog`) with the Phase C fields plus `description` (textarea) and `venue_id` (facility/venue select); `coach_id` is auto-set to `callerSub` in the payload.
  - **F.9.3** — "New Event" button in the `PageHeader` opens the same dialog in create mode with `coach_id = callerSub` (the backend forces this anyway for coaches).
  - **F.9.4** — "Members" action opens a drawer dialog: lists members via `listMembers` (name/email/venue), add-by-sub (`InputText` → `addMember`), per-member venue edit (`editMember` via `EntityFormDialog`), and remove (`removeMember` via `ConfirmDelete` soft path). Capacity refreshes after each member change.
- **F.10** (`52acfb7`): `Manage Events` added to `frontend/src/layout/nav.ts` after `My Schedule` with `requiredRole: 'COACH'` — visible to COACH and above via the hierarchical `hasRole` filter in `AppLayout`.
- **F.11** (`8611144`): lazy `CoachEventsPage` registered at `/manage-events` inside the `RouteGuard`/`AppLayout` group.

### Verification

- Backend: `uv run ruff check .` clean; `uv run ruff format` clean on the touched files; `uv run pyright` 0 errors across the F.3/F.6/F.7 changes.
- Backend smoke test (`smoke_f3_f6_f7.py`, throwaway temp DB + real HS256 JWTs + `TestClient`, full app): `member` create → 403; `coach1` create own → 200 with `coach_id` forced to coach1; `coach1` create naming `coach2` → 403; `facility_manager` create with `coach2` → 200; `coach2` update/delete `coach1`'s event → 403; `coach1` update own → 200; manager update any → 200; `coach2` delete `coach1`'s event → 403; `coach1` delete own → 200; `coach1` edit a member schedule on `coach2`'s event → 403; `coach1` edit own event's member → 200 with decrypted `First1 Last1` / `member1@x.com`; invalid venue → 404; schedule not on the event → 404; `member` edit → 403.
- Frontend: `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) succeeds — `CoachEventsPage` is lazy-chunked (≈9.6 kB gzip ≈3.3 kB). Build verified after F.9.1, F.9.2, F.9.3, F.9.4, F.10/F.11, and the CSS commit.
- Manual browser pass deferred to Phase J.6 (as planned), since the Google login flow can't be exercised headlessly here.

### Notes

- The F.3/F.6/F.7 backend and F.8+ frontend landed on the same branch as F.1/F.2/F.4/F.5; **Phase F is fully complete.**
- F.1's `CoachRoutes` lives in its own file so future coach-scoped endpoints (the plan keeps coach work on `/coach` and `/events/{id}/members`) have a natural home; the `GET/POST /events/{id}/members` routes (F.2/F.4) went on `EventRoutes` since they share the `/events` prefix.
- F.2/F.4 share the own-event-or-manager+ guard via `_is_manager_or_admin(user)`; the Phase C register internals live in `_create_schedule_for_member(event_id, member_id)` (F.4 reuses them verbatim). F.3's create/update/delete guard reuses the same helper.
- F.9.4 adds a member **by `sub`** (an `InputText`) because the Phase G user-list endpoint doesn't exist yet; the todo notes this explicitly. When Phase G lands, the add control can become a user `Select`.

## Phase H — Admin: manage facility managers (H.1.1 complete)

Branch: `feature/manage-coach-accounts`

`layout.txt:37-38` — edit/create/delete/list coach accounts.

| Sub-task | Deliverable | Commit |
|----------|-------------|--------|
| G.1.1 | `GET /users` — `facility_manager_role`; optional `role` query param typed as `Literal["member", "coach", "facility_manager", "web_admin"]` (422 on invalid); uses existing `UserSQLite.list_users_by_role(role)` (all users when omitted); senior-role lookups (`facility_manager`/`web_admin`) are admin-only (403 for a manager); responses expose `sub`/`role`/`is_active`/`is_deleted` only — never ciphertext | `fa7572d` |
| G.1.2 | `GET /users/{sub}` — `facility_manager_role`; returns one managed user (same shape as the list); 404 for unknown subs | `a1585bd` |
| G.1.3 | `POST /users` — `facility_manager_role`; `{email, role}` with `role` limited to `coach`/`member` (privilege bound, 422 otherwise); records the intended role in a new `user_invite` table keyed by `email_hash` (upsert on `email_hash`); `auth_callback` resolves the invite **before** auto-registering so the user's first Google login applies the invited role, then consumes the invite; registered emails → 409 (role changes are the G.1.4 role-change endpoint's job); registered in `init_db()` | `ca7ef40` |
| G.1.4 | `PUT /users/{sub}` — `facility_manager_role`; `{role}` body typed as `Literal["member", "coach", "facility_manager", "web_admin"]`; facility managers may only assign `coach`/`member` (403 for senior roles — the G.1.6 privilege bound, enforced here); web admins may assign any role; 404 for unknown subs; returns the updated managed user | `d855025` |
| G.1.5 | `DELETE /users/{sub}` — `facility_manager_role`, soft via `delete_user_by_sub`; `DELETE /users/{sub}/hard` — `admin_role`, hard via `hard_delete_user_by_sub`; facility managers may not soft-delete `facility_manager`/`web_admin` users (403); 404 for unknown subs; returns a message dict | `8b6ee91` |
| G.1.6 | Privilege bounds verified — a facility manager can only ever assign `coach`/`member` (never `facility_manager`/`web_admin`): invite body is `Literal["coach", "member"]` (G.1.3), role change 403s on senior targets (G.1.4), soft delete 403s on senior targets (G.1.5), senior-role list lookups 403 for managers (G.1.1). No new code — confirmed by a consolidated `smoke_g116.py` | `965e21d` |
| G.2 | `UserRoutes` registered in `main.py` (already done in G.1.1); `src/routes/README.md` updated — added `user_routes.py` (`/users`) and fixed a Phase F omission by adding the missing `coach_routes.py` (`/coach`) row | `f0883e7` |
| G.3 | `ManagedUser` gained `name`/`email` — decrypted server-side via `decrypt_field` then masked (`_mask`/`_mask_email`: first char + asterisks, email local part masked, domain kept); raw ciphertext or plaintext PII never leaves the API; applies to `GET /users` and `GET /users/{sub}` | `49ad660` |
| G.4 | `frontend/src/api/users.ts` — `listUsers(role?)` (optional role filter), `getUser(sub)`, `createUser(ManagedUserInput)`, `updateUserRole(sub, role)`, `softDeleteUser(sub)`, `hardDeleteUser(sub)`; default export bundles them | `dee64fc` |
| G.5 | `frontend/src/api/types.ts` — `ManagedUser`, `ManagedUserInput` (plus `UserInviteResult`, `UserRoleUpdateInput`, `ManagedUserRoleFilter`) | `dee64fc` |
| G.6 | `frontend/src/pages/ManageUsersPage.tsx` — role-filtered coach/member table (name/email/role/active), email invite + role-edit dialogs (role select limited to coach/member), soft delete (managers+), admin-only hard delete; senior-role filter options shown to admins only; `.manage-users-*` CSS | `4c5285b` |
| G.7 | Nav — `Manage Users` (`pi pi-users-cog`, `/manage-users`, `requiredRole: 'FACILITY_MANAGER'`) inserted between Schedules and Signup Forms | `aaaad9a` |
| G.8 | Router — `/manage-users` lazy route behind a `FACILITY_MANAGER` `RouteGuard`; optional SchedulesPage member-picker swap done — raw sub text input → `listUsers`-backed select (masked name/email, sub as value), Member column shows the masked name | `275b353` |
| H.1.1 | `GET /users?role=facility_manager` admin-only — no code change; the G.1.1 inline guard (`role in ("facility_manager", "web_admin")` → 403 for non-`web_admin`) already enforces it | `22b42c7` (docs) |

### Details

- **G.1.1** (`fa7572d`): new `src/routes/user_routes.py` `UserRoutes` (`APIRouter(prefix="/users", tags=["users"])`). Role filtering delegates to the existing `UserSQLite.list_users_by_role` — no new data-layer code was needed. The route is guarded by `facility_manager_role` (FACILITY_MANAGER + WEB_ADMIN). The `ManagedUser` response model deliberately omits every nonce/ciphertext column (G.3's masked name/email is still a separate sub-task, but the raw encrypted blobs are never serialized).
- **G.1.2** (`a1585bd`): detail handler reuses the same `_to_managed` helper, so the list and detail shapes stay identical.
- **G.1.3** (`ca7ef40`): the email-keyed invite resolves Key decisions #3 (no raw `sub` pre-seed — the `users` PII columns are `NOT NULL`, so a placeholder row isn't possible). New `src/data/user_invite/` entity (`user_invite.py` model, `user_invite_interface.py` ABC, `sqlite.py` impl) with `CREATE TABLE IF NOT EXISTS user_invite` (`email_hash` UNIQUE, `role`, `is_active`) plus `create_invite` (upsert), `get_invite_by_email_hash`, `delete_invite_by_email_hash`. `auth_callback` looks up the invite by `oauth_user.email_hash` before `db_connect().create_user(...)`, applies `invite.role` instead of the default `MEMBER`, and deletes the invite only after the user row is created. `user_invite` was added to `main.py`'s `init_db()` so the table exists before the first request.
- **G.1.4** (`d855025`): `PUT /users/{sub}` fetches the target user (404 if missing), swaps in the requested role, and persists via the existing `UserSQLite.update_user` (which updates `updated_at` and returns the refreshed row). A new `UserRoleInput` body model types `role` as the full `RoleChoice` Literal (422 on invalid). The G.1.6 privilege bound is enforced inline here: a facility manager assigning `facility_manager`/`web_admin` gets 403, while a web admin may assign any role. This is the single mechanism for changing an existing user's role — `POST /users` (G.1.3) rejects registered emails with 409 for exactly this reason.
- **G.1.5** (`8b6ee91`): soft delete reuses the existing `delete_user_by_sub` (sets `is_deleted=1`/`deleted_at`), hard delete reuses `hard_delete_user_by_sub` (removes the row). Both fetch the target first (404 for unknown subs) and return a message dict, mirroring the message_routes delete convention. The `/{sub}` DELETE route registers **before** `/{sub}/hard`, but FastAPI matches on path length so there is no shadowing; the hard route carries the `admin_role` dependency, and the handler additionally blocks facility managers from soft-deleting senior-role users (403 — the same G.1.6/H.1 privilege-bound theme).
- **G.1.6** (no new code — `965e21d` docs): the privilege bound was already enforced inline in each role-mutating handler, so this sub-task is a verification pass. A consolidated smoke test (`smoke_g116.py`) exercises all four guards in one run: invites to `web_admin`/`facility_manager` → 422 (G.1.3 Literal); role changes to senior roles → 403 for a manager, 200 for an admin (G.1.4); soft-delete of a `facility_manager` → 403 for a manager, 200 for an admin (G.1.5); senior-role list lookups → 403 for a manager, 200 for an admin (G.1.1).
- **G.2** (`f0883e7`): `UserRoutes` registration in `main.py` landed with G.1.1 (it must be mounted for the endpoints to exist), so this sub-task was the README sync. The Files table gained a `user_routes.py` row (`/users`, list/detail/invite/role-change/soft+hard delete). While there, the missing `coach_routes.py` row (`/coach`, `GET /events` scope filter) from Phase F was also added — it was the one registered router absent from the doc.
- **G.3** (`49ad660`): `ManagedUser` now carries masked `name` and `email`. Both are decrypted server-side (`decrypt_field`, same fallback pattern as message_routes) then masked: `_mask` keeps the first character and asterisks out the rest; `_mask_email` masks only the local part so the domain stays readable. This satisfies the "decrypt in server then truncate" option from the todo — it's strictly safer than the previous sub/role-only shape since callers still get displayable PII without any full plaintext or ciphertext leaving the server.
- **G.4** (`dee64fc`): `frontend/src/api/users.ts` wraps all six `/users` endpoints following the `events.ts` pattern (named exports + a bundled default export, `satisfies` for request bodies, `encodeURIComponent` on the role query param). The types it needs — `ManagedUser`, `ManagedUserInput`, `UserInviteResult`, `UserRoleUpdateInput`, `ManagedUserRoleFilter` — were added to `types.ts` as a required dependency, which pre-lands G.5's `ManagedUser`/`ManagedUserInput` (G.5 becomes a pure formality tick).
- **G.5** (`dee64fc`): no code change — `ManagedUser` (sub/role/name/email/is_active/is_deleted — masked PII) and `ManagedUserInput` (email + `role: 'coach' | 'member'`) already exist in `types.ts` from G.4, where they were required to type the wrappers. This sub-task is a formality tick.
- **G.6** (`4c5285b`): `ManageUsersPage.tsx` mirrors the CoachEventsPage/CRUD page patterns (`app-crud-page`, `PageHeader`, `EntityDataTable`, `EntityFormDialog`, `EmptyState`, `ConfirmDelete`). Default view lists all users; the role filter restricts to coach/member for managers and adds Facility Manager/Web Admin options for admins (matching the backend's admin-only senior-role lookups). The create dialog is an email invite (`createUser`) and the edit dialog changes role via `updateUserRole` — both role selects are hard-limited to coach/member (G.6 spec; the backend would 403 senior assignments for managers anyway). Hard delete relies on `ConfirmDelete`'s built-in `hasRole('WEB_ADMIN')` gate so it only renders for admins. Route/nav wiring is intentionally deferred to G.7/G.8 (same split Phase F used for CoachEventsPage → nav → router).
- **G.7** (`aaaad9a`): one-line nav insertion — `Manage Users` (`pi-users-cog`, `/manage-users`, `FACILITY_MANAGER`) between Schedules and Signup Forms. Nav filtering is automatic via `AppLayout`'s `hasRole(item.requiredRole)`; the route also enforces the backend's `facility_manager_role` dependency once wired in G.8.
- **G.8** (`275b353`): two changes. (1) Router: lazy-imported `ManageUsersPage` at `/manage-users`, wrapped in a `RouteGuard requiredRole="FACILITY_MANAGER"` so non-managers are redirected to `/dashboard` even on direct URL access. (2) SchedulesPage member picker: the raw Google-sub text input is replaced with a `listUsers`-backed select — options show masked name + email with the `sub` as the value, and the Member column now renders the masked name instead of the raw sub. This closes the loop the todo flagged: Phase F's member picker could not select users until Phase G exposed the user list.
- **H.1.1** (no new code): the admin-only `?role=facility_manager` filter shipped inside G.1.1 — `list_users` rejects any non-`web_admin` caller who asks for a senior-role filter (403), so H.1.1 is a verification pass. Branch `feature/manage-facility-managers` was cut from `main` (Phase G merged via PR #35), so the endpoint already exists here.

### Verification

- Backend: `uv run ruff check .` clean; `uv run ruff format` clean on the touched files; `uv run pyright` 0 errors.
- Backend smoke tests (throwaway temp DB + real HS256 JWTs + `TestClient`, full app):
  - **G.1.1** (`smoke_g111.py`): member → 403; manager lists all (both seeded users); `?role=coach` returns only the coach; manager → 403 for `?role=web_admin`; admin → 200 for `?role=web_admin`; invalid role → 422; no token → 401.
  - **G.1.2** (`smoke_g112.py`): member → 403; manager detail → 200 with correct `sub`/`role`; response body contains no `ciphertext`/`nonce`; unknown sub → 404.
  - **G.1.3** (`smoke_g113.py`): member → 403; manager invite → 200 `{email, role, status: "invited"}`; invite stored keyed by `hash_field(email)`; manager inviting `web_admin` → 422 (Literal bound); registered email → 409; simulated first Google login applies the invited `coach` role and consumes the invite; the new user then appears under `?role=coach`.
  - **G.1.4** (`smoke_g114.py`): member → 403; manager changes `member` → `coach` → 200 and the role persists in the DB; manager assigning `facility_manager`/`web_admin` → 403; admin assigning `web_admin` → 200; unknown sub → 404; invalid role → 422; response contains no `ciphertext`/`nonce`.
  - **G.1.5** (`smoke_g115.py`): member → 403 on both delete routes; manager soft-deletes a coach → 200 and `is_deleted` persists; re-soft-delete → 200; manager soft-deleting a `facility_manager` → 403; unknown sub soft delete → 404; manager hard delete → 403; admin hard-deletes a member → 200 and the row is gone; unknown sub hard delete → 404.
  - **G.1.6** (`smoke_g116.py`): consolidated privilege-bounds pass — invite `web_admin`/`facility_manager` → 422, `coach` → 200; role change to `web_admin`/`facility_manager` → 403 for a manager, `web_admin` → 200 for an admin; soft-delete of a `facility_manager` → 403 for a manager, 200 for an admin; `?role=facility_manager` list → 403 for a manager, 200 for an admin.
  - **G.2**: no runtime behavior changed — registration and the `init_db()` mount were verified by the G.1 smoke tests; the README diff is the deliverable.
  - **G.3** (`smoke_g3.py`): list and detail both return masked values — `"Alice Coach"` → `A**********`, `alice@example.com` → `a****@example.com`; responses contain no `ciphertext`, no `nonce`, and no plaintext name/email anywhere.
  - **G.4**: `npm run lint` (oxlint) and `npm run build` (`tsc -b` + Vite) both clean with the new `users.ts`/`types.ts`.
  - **G.5**: no new verification needed — the types shipped with G.4 and were covered by its build/lint run.
  - **G.6**: `npm run lint` + `npm run build` clean. Caught one tsc error during dev — `Tag` severity uses `'warn'`, not `'warning'` — fixed before committing. Page is not yet reachable (route lands in G.8), so runtime behavior is verified by type-check + the G.1 smoke tests on the underlying endpoints.
  - **G.7**: `npm run lint` + `npm run build` clean after the nav edit.
  - **G.8**: `npm run lint` + `npm run build` clean. `/manage-users` now reachable and role-gated; SchedulesPage member select is covered by the same type-check and the G.1.1/G.4 list endpoints it calls.
  - **H.1.1** (`smoke_h111.py`): web_admin lists `?role=facility_manager` → 200 with exactly the manager row(s) and `?role=web_admin` → 200 with the admin row(s); facility manager gets 403 on both senior-role filters but 200 on `?role=coach`; unfiltered `GET /users` → 200 for both. Note: the test users must include encrypted first/last names — `create_users_bulk` silently skips rows without them.

### Notes

- Only G.1–G.8 are in scope so far (the user's requests) — **Phase G is now fully complete.** Phase H (admin: manage facility managers) is next on the todo. The G.1.3 `Literal["coach", "member"]`, the G.1.1 senior-role 403, G.1.4's assign bound, and G.1.5's delete bound together satisfy G.1.6 — a facility manager can never assign or manage senior roles.
- H.1.1 done on `feature/manage-facility-managers` (branch-cut from `main` after PR #35 merged Phase G). Remaining Phase H: H.1.2 (admins assign senior roles via `PUT /users/{sub}` — the G.1.4 inline guard already permits `web_admin`, so this is likely also a verification pass), H.2 (hierarchical guard verification), H.3 (ManageUsersPage role-select widening for admins), H.4 (nav doc).
- `UserRoutes` registration in `main.py` was required by G.1.1 (the endpoints must be mounted to exist/test); G.2's `src/routes/README.md` update is the piece that was still pending and is now done.
- G.3's mask keeps the first character so rows remain distinguishable (e.g. initials) without exposing full names/emails; the domain suffix stays visible to make email lists scannable.
- `POST /users` only creates pre-registration invites; changing an existing user's role deliberately returns 409 so the role-change path (G.1.4) stays the single mechanism for that. Existing users auto-login with their current role unchanged — the invite is only consulted when auto-registering.
- G.1.4 reuses `UserSQLite.update_user` (no new data-layer code) and applies the same no-ciphertext response shape as G.1.1/G.1.2.
- G.1.5 reuses the existing soft/hard delete methods (no new data-layer code) and returns message dicts like the message_routes delete routes.
- G.1.6 adds no code — it documents and verifies the bounds already spread across G.1.1/G.1.3/G.1.4/G.1.5; H.1 (admin-only senior-role assignment) builds on these guards.