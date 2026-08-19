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

## Phase E — Member Profile / Correspondence (E.1–E.7 done) ✅

Branch: `feature/profile-correspondence`

`layout.txt:21-25` — profile with correspondence: my forms, my events, my messages.
The backend (E.1–E.5) and the frontend API layer + types (E.6–E.7) are done; the
`ProfilePage` UI (E.8–E.10) remains for a later round.

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

### Details

- **E.3 decision**: `/schedules/me/events` is a pure alias — same handler (`ScheduleRoutes.my_schedule`) registered as an additional route, so "my events" and "my schedule" can never drift. Documented here rather than as a separate aggregate.
- **E.2 ownership guard** reuses the Phase B PDF pattern: `current_user.role == UserRole.MEMBER.value` → must own; coaches/managers/admins pass through. `SubmissionDetailResponse` carries the facility name plus the full `responses` list (needed by the future "my forms" tab to show answers).
- **Message routing order**: `/{message_id}/read`, `/{message_id}`, `/{message_id}/hard` share the `{message_id}` prefix but no conflict exists (distinct literal suffixes + methods); `GET /messages/me` is registered first.
- **`mark_read`** fetches the existing row, flips `is_read`, and re-saves via `update_message` (which only touches `is_read`/`is_active`), avoiding a partial `Message` construction.
- **`create_messages_bulk`** resolves created rows via `SELECT last_insert_rowid()` (the SQL function, not `cursor.lastrowid`, which Python 3.12+ resets to `None` after `executemany`) minus the batch size — the pre-existing "last-row-only" quirk from other bulk creators was deliberately not replicated.
- `sender_name` in `GET /messages/me` decrypts the sender's first/last name (falling back to the sender sub) so the inbox shows who sent each message (Key decision #5).
- Branched from `feature/my-schedule-ical` per the plan's branching rule. Phase C (#31) and Phase D (#32) were merged to `main` during this round, and the Phase D branch tip had been updated to the merged commit — so this branch contains **only** the Phase E.1–E.7 changes (verified: `git diff main...feature/profile-correspondence` touches just the E.1–E.7 files).
- **E.5** (`src/routes/README.md`, `7937970`): added `message_routes.py` and the previously-missing `public_routes.py` rows; extended `event_routes.py` (public capacity, member register), `schedule_routes.py` (`/me`, `/me/ical`, `/me/events`, reschedule/cancel), and `form_routes.py` (submission list/detail) descriptions; added the `coach_role` pattern bullet. Every claim was verified against the actual route registrations (dependencies + handler role deps).
- **E.6** (`82397c5`): added `listMySubmissions`/`getSubmission` to `frontend/src/api/forms.ts` and the new `frontend/src/api/messages.ts` (`listMine`, `markRead`, `send`) following the existing `api.get/post/put` wrapper style. The `Message`/`MessageInput`/`MySubmission`/`SubmissionDetail` types were added to `types.ts` in this commit — they are compile-time dependencies of E.6's functions and also satisfy E.7's type list (E.7 will just confirm/extend them when reached).
- **E.7** (no code change): the `Message`, `MessageInput`, `MySubmission`, and `SubmissionDetail` types in `frontend/src/api/types.ts` (committed with E.6 in `82397c5`) were re-verified field-for-field against the backend models: `MySubmission` ↔ `MySubmissionItem`, `SubmissionDetail` ↔ `SubmissionDetailResponse` (incl. `responses: FormResponse[]`), `Message` ↔ `MessageItem` (incl. `sender_name`), `MessageInput` ↔ backend `MessageInput` (optional `body` defaults to `""`).

### Verification

- Backend: `uv run ruff check .` clean; `uv run pyright` 0 errors.
- Frontend: `npm run lint` (oxlint) clean; `npm run build` (`tsc -b` + Vite) passes — the E.6 wrappers and their types compile into the production bundle.
- Backend smoke test (`smoke_e1_e4.py`, throwaway DB + FastAPI `TestClient`, real HS256 JWTs, FormRoutes/ScheduleRoutes/MessageRoutes wired):
  - **E.1** — `/forms/me/submissions` → 401 no auth; 200 with member token (joined `facility_name` "City Pool", `is_complete` true, `submitted_at` set); caller-scoped (m1 sees only m1's, m2 only m2's).
  - **E.2** — `/forms/submissions/{id}` → 401 no auth; 200 own (2 responses with correct answers); m1 reading m2's → 403; facility manager reading m2's → 200; missing → 404.
  - **E.3** — `/schedules/me/events` → 401 no auth; 200 for member, payload identical to `/schedules/me` (event id, facility, times).
  - **E.4** — `/messages/me` → 401 no auth; 200 with the seeded message (sender_id, subject, `is_read: false`); coach `POST /messages` to m2 → 200; member POST → 403; unknown recipient → 404; `PUT /{id}/read` own → `is_read: true`, another member's → 403; `DELETE /{id}` own → soft-deleted (drops out of inbox), another's → 403; `DELETE /{id}/hard` non-admin → 403, admin → 200; missing → 404.
- Dev DB: `main.py` startup creates the `message` table via `init_db()` (idempotent); no migration needed elsewhere.

### Notes

- **E.8–E.10** (frontend: `ProfilePage`, nav footer Profile link, route) are deferred to the next Phase E round, as requested.
- `POST /messages` sends to any `users.sub`; the member picker arrives with Phase G's user-list endpoint, so staff paste the `sub` for now.
- No `AGENTS.md` sync yet (J.8 covers the aggregate update); the `src/routes/README.md` in-repo route doc is now current.