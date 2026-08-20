# Missing Features TODO — `docs/layout.txt` Implementation Plan

Gap analysis of `docs/layout.txt` against the current codebase (see analysis in
session). Each line-item of `docs/layout.txt` is decomposed into backend + frontend
tasks. Work bottom-up: data layer → routes → frontend API → UI → verify.

## Rules

- **Branching**: each Phase must be developed on the git branch assigned to it. Create the branch
  (`git checkout -b <branch>`) before starting the Phase; do not commit Phase work on `main`.
  Branch only from `main` (or from the previous Phase's branch if it is not yet merged — note this
  in the PR description).
- **Commit before complete**: a sub-task is only considered complete once its work is
  **committed** on the Phase's branch (a `git commit` with a concise message). Do not tick a
  checkbox until the corresponding commit exists. Batch related small edits into one commit if
  desired, but each sub-task must be represented by at least one commit.
- **Per-Phase PR**: when all sub-tasks of a Phase are committed, open a PR for that Phase's branch
  and follow the required PR title + description format (see **Final Instruction — PR Output** at
  the bottom). Do not start the next Phase until the current PR is opened (merge at your
  discretion).

**Conventions to follow**

- New entities: 3-file pattern (`<entity>.py` Pydantic + `<entity>_interface.py` ABC +
  `sqlite.py`), `src/data/facility/` is the canonical example.
- Routes: class-based router (`<Entity>Routes` in `src/routes/<entity>_routes.py`),
  registered in `main.py` in alphabetical order.
- DB access in routes: `Config().db()` then instance methods.
- Soft deletes via `is_active`; FKs with `ON DELETE CASCADE ON UPDATE CASCADE`.
- Frontend: PrimeReact 11 compound components; v11 `Button` renders children only;
  role maps key on uppercase names (`getRoleFromToken` uppercases).
- Check `AGENTS.md` after finishing and keep it in sync.
- Ruff line-length 120; run `uv run ruff check .`, `uv run pyright`, `npm run lint`,
  `npm run build` after each phase.

---

## Phase A — Public (no-login) read access

Branch: `feature/public-read-access`

`layout.txt:1,3,5` — find-by-address, find-by-event, venues browsing must not require login.

- [x] **A.1** — Add a new `src/routes/public_routes.py` `PublicRoutes` router (prefix `/public`, tags `["public"]`) — dedicated module so admin CRUD stays auth-gated (see Key decisions #1); public endpoints stay read-only and return 404 for inactive venues/events. Commit.
- [x] **A.2** — `GET /public/venues?q=<address>` — public venue search by `street`/`city`/`state`/`postal_code` substring match; returns `Venue` + facility name. Requires a new `VenueSQLite.search_venues(q)` method (LIKE on address columns, `is_active=1`). Commit.
- [x] **A.3** — `GET /public/events?q=<term>` — public event listing; `EventSQLite` needs a search (start/end range and/or free-text once `description` exists in Phase C). Initially: `list_events()` filtered to future `is_active` events, optional `from`/`to` query params. Commit.
- [x] **A.4** — `GET /public/venues` — public list of active venues (all address fields), no auth. Commit.
- [x] **A.5** — `GET /public/venues/{venue_id}/schedules` — public schedule listing for one venue: active `Schedule` rows joined to `Event` (start/end times), using existing `ScheduleSQLite.list_schedules_by_venue_id` plus an event-detail join helper. Commit.
- [x] **A.6** — `GET /public/venues/{venue_id}` — public venue detail. Commit.
- [x] **A.7** — Register `PublicRoutes` in `main.py`. Commit.
- [x] **A.8** — Verify: public endpoints 200 with no `Authorization` header; admin CRUD still 401/403 unauthenticated. Commit.

## Phase B — Public venue schedule views (week / month / event list)

Branch: `feature/public-venue-schedules`

`layout.txt:7-10` — venue → schedule, default current week, monthly + event-list options.

- [x] **B.1** — `GET /public/venues/{venue_id}/schedules` gains query params: `view=week|month|list`, `date=YYYY-MM-DD`. Default `week` anchored on the given date (or today). Commit.
- [x] **B.2** — `GET /public/events` gains `venue_id` filter so "event listing" for a venue is supported. Commit.
- [x] **B.3** — Add event-date helpers (shared util in `src/util/dates.py`): `start_of_week`, `week_range`, `month_range` (ISO week, Monday-start) used by the schedule queries. Commit.
- [x] **B.4** — `EventSQLite.list_events_in_range(start_iso, end_iso, venue_id=None)` — filters by `start_date_time` overlap; used by week/month views. Commit.
- [x] **B.5** — `frontend/src/api/public.ts` — `searchVenues(q)`, `listVenues()`, `getVenue(id)`, `getVenueSchedules(id, {view, date})`, `searchEvents({venueId, from, to})` calling `/api/public/...`. Commit.
- [x] **B.6** — `frontend/src/api/types.ts` — add `PublicVenue` (Venue + facility_name), `VenueScheduleRow` (schedule + event times), `PublicEvent`. Commit.
- [x] **B.7** — New public pages under `/explore` (do **not** collide with auth-gated `/venues`, `/events`):
  - [x] **B.7.1** — `frontend/src/pages/explore/ExploreHomePage.tsx` at `/explore` — "Find by address" search box + "Find by event" search box; links into results. Commit.
  - [x] **B.7.2** — `frontend/src/pages/explore/ExploreVenuesPage.tsx` at `/explore/venues` — searchable venue grid (address + facility name). Commit.
  - [x] **B.7.3** — `frontend/src/pages/explore/VenueSchedulePage.tsx` at `/explore/venues/:venueId` — schedule with Week / Month / Event-list view switcher (`Select` + `DatePicker`); default current week; each event row links to event detail (Phase C). Commit.
- [x] **B.8** — Add the three routes to `frontend/src/router/index.tsx` as **public** (outside `RouteGuard`). Commit.
- [x] **B.9** — Update `HomePage.tsx` to link to `/explore` (replace "content coming soon"). Commit.
- [x] **B.10** — Styles for explore pages in `index.css`. Commit.

## Phase C — Event detail, capacity, register, reschedule

Branch: `feature/event-registration`

`layout.txt:11-16` — event cap/max capacity, description, member register + reschedule.

- [x] **C.1** — Extend `Event` model (`src/data/event/event.py`) with `description: str | None = None`, `coach_id: str | None = None`, `venue_id: int | None = None`. Commit.
- [x] **C.2** — Update `Event` DDL in `src/data/event/sqlite.py` (`get_create_table`) with the new columns + `FOREIGN KEY (coach_id) REFERENCES users(sub)` and `FOREIGN KEY (venue_id) REFERENCES venue(venue_id)`. Commit.
- [x] **C.3** — Update `EventSQLite` select/RETURNING/INSERT/UPDATE statements + `create_event_helper` for the new fields (mirror existing column lists). Commit.
- [x] **C.4** — **Migration**: `CREATE TABLE IF NOT EXISTS` will not add columns to an existing `swimlane.db` — add guarded migrations in `EventSQLite.init()`: sqlite → check `PRAGMA table_info(event)` then `ALTER TABLE event ADD COLUMN coach_id TEXT NULL REFERENCES users(sub)` / `ADD COLUMN venue_id INTEGER NULL REFERENCES venue(venue_id)`; postgresql → `ADD COLUMN IF NOT EXISTS`. No dev DB reset (see Key decisions #2). Commit.
- [x] **C.5** — `GET /events/{event_id}/capacity` — public: returns `{event_id, registered_count, max_capacity}`. Registered count = count of active `schedule` rows for the event; `max_capacity` from the event's `venue→facility.max_capacity`; **`max_capacity: null` = unlimited** (no 409). Add helper `EventSQLite`/`ScheduleSQLite` for the count + a facility-capacity join (or a small query in the route). Commit.
- [x] **C.6** — `POST /events/{event_id}/register` — `member_role`; creates a `Schedule` for `current_user.sub` at the event's venue; 409 if already registered; 409 if `registered_count >= max_capacity`; 404 if event/venue inactive. Commit.
- [x] **C.7** — `POST /schedules/{schedule_id}/reschedule` — `member_role`; body `{event_id}`; validates the target event (active, not full, not the same); updates the caller's own schedule (must match `current_user.sub`) and moves `schedule.venue_id` to the target event's venue. Commit.
- [x] **C.8** — Add `ScheduleSQLite.get_schedule_for_member(event_id, member_id)` and `count_active_for_event(event_id)` helpers. Commit.
- [x] **C.9** — Wire `/events/{event_id}/capacity` + register + reschedule into `EventRoutes`/`ScheduleRoutes` (register/reschedule auth = `member_role`). Commit.
- [x] **C.10** — `frontend/src/api/types.ts` — `Event` gains `description`/`coach_id`/`venue_id`; add `EventCapacity`, `RegisterResponse`, `RescheduleInput`. Commit.
- [x] **C.11** — `frontend/src/api/events.ts` — `getCapacity(id)`, `register(id)`; `frontend/src/api/schedules.ts` — `reschedule(id, input)`. Commit.
- [x] **C.12** — New public `frontend/src/pages/explore/EventDetailPage.tsx` at `/explore/events/:eventId`:
  - [x] **C.12.1** — Render description + times + venue + capacity ("12 / 20 registered" with progress indicator). Commit.
  - [x] **C.12.2** — If logged-in member: "Register" button → `register()` → toast + refresh capacity; disable when at capacity or already registered. Commit.
  - [x] **C.12.3** — If not logged in: "Sign in to register" link to `/login?frontend_url=...`. Commit.
  - [x] **C.12.4** — "Reschedule" flow: if member already registered, show their current schedule's event and a picker of alternate upcoming events → `reschedule()`. Commit.
- [x] **C.13** — Link event rows from `VenueSchedulePage` (Phase B) and `ExploreHomePage` event results into `/explore/events/:id`. Commit.
- [x] **C.14** — Route registered in router (public). Commit.

## Phase D — Member "My Schedule" + iCal export

Branch: `feature/my-schedule-ical`

`layout.txt:18-19` — my schedule of events, add to calendar (ical).

- [x] **D.1** — `GET /schedules/me` — `member_role`; returns caller's active schedules joined with event (start/end), venue (address), facility (name). Use existing `ScheduleSQLite.list_schedules_by_member_id(sub)` + join helper. Commit.
- [x] **D.2** — `GET /schedules/me/ical` — `member_role`; returns `text/calendar` (RFC 5545) `VEVENT` per scheduled event (UID, DTSTART/DTEND, SUMMARY "Swimlane — <facility>", LOCATION venue address). Use `ics` lib? No — hand-rolled string builder in `src/routes/schedule_routes.py` or `src/util/ical.py` (no new dependency). Set `Content-Disposition: attachment; filename="swimlane-calendar.ics"`. Commit.
- [x] **D.3** — Add `ScheduleSQLite.list_active_schedules_by_member_id(member_id)` (active-only variant). Commit.
- [x] **D.4** — `frontend/src/api/schedules.ts` — `listMine()`, `getMyCalendarIcs()` (blob or text; use `responseType: 'text'` and build a Blob, or direct link). Commit.
- [x] **D.5** — New `frontend/src/pages/MySchedulePage.tsx` at `/my-schedule` (authenticated, `member_role`):
  - [x] **D.5.1** — Table/list of upcoming scheduled events (date, facility, venue, status). Commit.
  - [x] **D.5.2** — "Add to calendar (iCal)" button → downloads/opens the `.ics`. Commit.
  - [x] **D.5.3** — Per-row "Reschedule" → reuses Phase C reschedule picker; "Cancel" → soft-deletes the schedule (confirm dialog). Commit.
- [x] **D.6** — Add `My Schedule` to `frontend/src/layout/nav.ts` (`pi-calendar-plus`, `requiredRole: 'MEMBER'`). Commit.
- [x] **D.7** — Route in router (inside `RouteGuard`). Commit.

## Phase E — Member Profile / Correspondence

Branch: `feature/profile-correspondence`

`layout.txt:21-25` — profile with correspondence: my forms, my events, my messages.

- [x] **E.1** — `GET /forms/me/submissions` — `member_role`; list caller's submissions (facility name, submitted_at, is_complete, submission_id). Add `FormSubmissionSQLite.list_by_member(sub)`. Commit.
- [x] **E.2** — `GET /forms/submissions/{id}` — `member_role` (own only) / manager+ (any): return a submission with its responses (needed so "my forms" can show answers). Add `FormSubmissionSQLite.get_by_id_with_responses(submission_id)`. Commit.
- [x] **E.3** — `GET /schedules/me/events` — alias/aggregate for "my events" (reuse Phase D `GET /schedules/me`; may be the same endpoint — decide and document). Commit.
- [x] **E.4** — **New `message` entity** (3-file pattern):
  - [x] **E.4.1** — `src/data/message/message.py` — `Message(message_id, member_id FK→users.sub, sender_id FK→users.sub, subject, body, is_read, sent_at, is_active)` — `sender_id` records who sent it (staff → member inbox; see Key decisions #5). Commit.
- [x] **E.4.2** — `src/data/message/message_interface.py` — CRUD + `list_by_member(member_id)`, `mark_read(message_id)`. Commit.
- [x] **E.4.3** — `src/data/message/sqlite.py` — DDL (`is_read` default 0, FKs to users with cascade), CRUD impl. Commit.
- [x] **E.4.4** — Register `MessageSQLite` in `main.py` `init_db()`. Commit.
- [x] **E.4.5** — `src/routes/message_routes.py` `MessageRoutes` (`/messages`): `GET /messages/me` (`member_role`), `PUT /messages/{id}/read` (`member_role`, own only), `POST /messages` (`coach_role`+ send to a member), soft/hard delete (`all_users` own / admin). Register in `main.py`. Commit.
- [x] **E.5** — `src/routes/README.md` update for new endpoints. Commit.
- [x] **E.6** — `frontend/src/api/forms.ts` — `listMySubmissions()`, `getSubmission(id)`; `frontend/src/api/messages.ts` — `listMine()`, `markRead(id)`, `send(input)`. Commit.
- [x] **E.7** — `frontend/src/api/types.ts` — `Message`, `MessageInput`, `MySubmission` types. Commit.
- [x] **E.8** — New `frontend/src/pages/ProfilePage.tsx` at `/profile` (authenticated):
  - [x] **E.8.1** — Header card: name, email, role tag, avatar (Google `user` object). Commit.
  - [x] **E.8.2** — Correspondence tabs (`Tabs`/`TabView`): **My Forms** (list of submissions → view/PDF), **My Events** (reuse `MySchedulePage` data or inline), **My Messages** (inbox with read/unread, view message dialog). Commit.
- [x] **E.9** — Add Profile link to sidebar footer (`frontend/src/layout/AppLayout.tsx` currently has a placeholder Profile footer item). Commit.
- [x] **E.10** — Route in router. Commit.

## Phase F — Coach "Manage Events"

Branch: `feature/coach-manage-events`

`layout.txt:27-33` — coach-scoped events, create/edit, past/upcoming, manage members.

- [x] **F.1** — `GET /coach/events?scope=upcoming|past|all` — `coach_role`; returns only events where `coach_id == current_user.sub`; `upcoming` = future `start_date_time`, `past` = past. Add `EventSQLite.list_events_by_coach(coach_id, scope)`. Commit.
- [x] **F.2** — `GET /events/{id}/members` — `coach_role`, requires `coach_id == current_user.sub` (403 otherwise) or manager+; returns schedules for the event joined with member display info. Add `ScheduleSQLite.list_schedules_by_event_id_with_members(event_id)` (left-join users for name/email; decrypt PII or return masked). Commit.
- [x] **F.3** — Relax `EventRoutes` create/update to `coach_role` **when the event's `coach_id` is the caller** (guard inside the handler); keep `facility_manager_role` for all events. Implement a small dependency `is_event_coach(event_id)` or inline check in `create_event`/`update_event`/`delete_event`. Commit.
- [x] **F.4** — `POST /events/{id}/members` — `coach_role` (own event) or manager+: add a member (creates schedule, with capacity check). Reuse Phase C register internals. Commit.
- [x] **F.5** — `DELETE /events/{id}/members/{schedule_id}` — remove a member (soft delete schedule), same role guard. Commit.
- [x] **F.6** — `PUT /events/{id}/members/{schedule_id}` — edit a member's schedule (change venue/event) if needed. Commit.
- [x] **F.7** — `coach_role` (currently unused) is now exercised — add a smoke test that coach gets 403 on another coach's event. Commit.
- [x] **F.8** — `frontend/src/api/events.ts` — `listMine(scope)` (coach), `listMembers(eventId)`, `addMember(eventId, memberId)`, `removeMember(eventId, scheduleId)`. Commit.
- [x] **F.9** — New `frontend/src/pages/CoachEventsPage.tsx` at `/manage-events` (`coach_role`):
  - [x] **F.9.1** — Scope switcher: Upcoming / Past / All. Commit.
  - [x] **F.9.2** — Event table (date, facility/venue, capacity) → edit dialog (Phase C fields incl. description, venue, coach_id auto-set to caller). Commit.
  - [x] **F.9.3** — "New Event" dialog (create with `coach_id = caller.sub`). Commit.
  - [x] **F.9.4** — Row → "Members" drawer/table: add member by selecting from user list (needs Phase G user-list endpoint) or by sub; remove/edit members. Commit.
- [x] **F.10** — Add `Manage Events` to nav (`pi-user-edit`, `requiredRole: 'COACH'`). Commit.
- [x] **F.11** — Route in router. Commit.

## Phase G — Facility Manager: manage coach accounts

Branch: `feature/manage-coach-accounts`

`layout.txt:37-38` — edit/create/delete/list coach accounts.

- [x] **G.1** — New `src/routes/user_routes.py` `UserRoutes` (`/users`, `facility_manager_role` for coach management):
  - [x] **G.1.1** — `GET /users?role=coach` — list users filtered by role (uses existing `UserSQLite.list_users_by_role`). Expose role choices `member|coach|facility_manager|web_admin`. Commit.
  - [x] **G.1.2** — `GET /users/{sub}` — detail. Commit.
  - [x] **G.1.3** — `POST /users` — email-keyed invite (`facility_manager_role`; role `coach` or lower; body `{email, role}` → `email_hash`). No raw `sub` pre-seed — a manager can't know a Google `sub` and the `users` PII columns are NOT NULL. Record the intended role keyed by `email_hash`; `auth_callback` resolves it before auto-registering so first Google login applies the invited role (see Key decisions #3). If a lean Phase G is preferred, defer this sub-task — list/role-change/delete suffice. Commit.
  - [x] **G.1.4** — `PUT /users/{sub}` — change role (coach/member for facility managers). Commit.
  - [x] **G.1.5** — `DELETE /users/{sub}` / `DELETE /users/{sub}/hard` — soft/hard delete (`facility_manager_role` soft, `admin_role` hard). Commit.
  - [x] **G.1.6** — Enforce privilege bounds: a facility manager may only assign `coach`/`member`, never `facility_manager`/`web_admin`. Commit.
- [x] **G.2** — Register `UserRoutes` in `main.py`; update `src/routes/README.md`. Commit.
- [x] **G.3** — PII handling: user list returns **masked** name/email (decrypt in server then truncate, or return only sub + role) to avoid leaking encrypted fields raw. Commit.
- [x] **G.4** — `frontend/src/api/users.ts` — `list({role})`, `get(sub)`, `create(input)`, `updateRole(sub, role)`, `softDelete(sub)`, `hardDelete(sub)`. Commit.
- [x] **G.5** — `frontend/src/api/types.ts` — `ManagedUser`, `ManagedUserInput`. Commit. (Types already landed with G.4 — a required dependency of the wrappers; ticking is a formality.)
- [x] **G.6** — New `frontend/src/pages/ManageUsersPage.tsx` at `/manage-users` (`facility_manager_role`): coach accounts table, create/edit dialog (role select limited to coach/member), soft + admin-only hard delete, role filter. Commit.
- [x] **G.7** — Add `Manage Users` (Coaches) to nav (`pi-users-cog`, `requiredRole: 'FACILITY_MANAGER'`). Commit.
- [x] **G.8** — Route in router; this endpoint also unblocks the Schedules page member picker (currently raw sub paste) — optional: swap `SchedulesPage.tsx` member field to a user select. Commit.

## Phase H — Admin: manage facility managers

Branch: `feature/manage-facility-managers`

`layout.txt:40-42` — everything under manage facility plus facility-manager accounts.

- [x] **H.1** — Reuse `UserRoutes` with `admin_role` guard for `facility_manager` + `web_admin` role assignment:
  - [x] **H.1.1** — `GET /users?role=facility_manager` (`admin_role` only). Commit.
  - [x] **H.1.2** — Extend `PUT /users/{sub}` so admins may assign `facility_manager`/`web_admin`; non-admins blocked server-side (guard in handler, not just role dependency). Commit.
- [x] **H.2** — Verify hierarchical guard logic: `facility_manager_role` can't escalate itself; only `admin_role` can. Commit.
- [x] **H.3** — `ManageUsersPage` gains a role-filter: FACILITY_MANAGER sees only Coaches; WEB_ADMIN sees Coaches + Facility Managers and can assign those roles (role select options widen by `hasRole('WEB_ADMIN')`). Commit.
- [x] **H.4** — Nav item already added in Phase G; WEB_ADMIN automatically sees it (hierarchical rank). No new page needed — document in nav. Commit.

## Phase I — Public/frontend wiring polish

Branch: `feature/nav-wiring`

- [x] **I.1** — `frontend/src/router/index.tsx`: confirm public routes (`/explore/*`, `/explore/events/:eventId`) live **outside** `RouteGuard`; authenticated routes (`/my-schedule`, `/profile`, `/manage-events`, `/manage-users`) inside. Commit.
- [x] **I.2** — `frontend/src/layout/nav.ts` final item set + `requiredRole` per item:
  - MEMBER: Dashboard, Signup Forms, My Schedule, Profile(footer)
  - COACH: + Manage Events
  - FACILITY_MANAGER: + Frequencies, Facilities, Events, Venues, Schedules, Manage Users, Signup Forms builder
  - WEB_ADMIN: all. Commit.
- [x] **I.3** — Dashboard quick links auto-reflect new nav items (already filters `NAV_ITEMS`). Commit.
- [x] **I.4** — Verify `/` HomePage links to `/explore` and Login; `/login?frontend_url=` still round-trips. Commit.
- [x] **I.5** — `HomePage`/`ExploreHomePage` copy and styles. Commit.

## Phase J — Verification, docs, build

Branch: `feature/verify-document`

- [ ] **J.1** — Backend: `uv run ruff check .` and `uv run ruff format .` clean. Commit.
- [ ] **J.2** — Backend: `uv run pyright` clean. Commit.
- [ ] **J.3** — Backend smoke test (devtools or curl): public endpoints unauthenticated 200; register/reschedule/capacity; member self-schedule + iCal content-type `text/calendar`; coach scoping (403 on others' events); user management role bounds (facility manager cannot assign `web_admin`). Commit.
- [ ] **J.4** — Frontend: `npm run lint` (oxlint) clean. Commit.
- [ ] **J.5** — Frontend: `npm run build` (`tsc -b && vite build`) passes; each new page emits its own lazy chunk. Commit.
- [ ] **J.6** — Manual browser pass: public browse → venue schedule (week/month/list) → event detail → register → my-schedule → iCal download → profile correspondence tabs → coach manage-events → manage users (coach then facility manager) → admin assigns facility manager. Commit.
- [ ] **J.7** — Update `docs/flow/new-signup.mmd` / `docs/flow/new-reschedule.mmd` to match implemented self-service flows if they drift. Commit.
- [ ] **J.8** — Update `AGENTS.md` (routers list, roles usage, public endpoints, message entity, new nav) and `src/routes/README.md`, `src/data/README.md`. Commit.
- [ ] **J.9** — Update `README.md` project structure with new pages/entities. Commit.
- [ ] **J.10** — Optional: add `tests/` for capacity + register/reschedule + coach scoping + user-role bounds (pytest config already present; currently no tests exist). Commit.

---

## Final Instruction — PR Output

Only after each Phase's final sub-task is committed, provide **ONLY** the PR title and the PR
description, formatted as markdown:

```markdown
# Summary
\n
## What's Included
\n
## Verification
\n
## Notes
```

Provide this for everything in the change set

Use the following structure (adapted from the existing `frontend-done.md` PR write-ups):

### PR Title

`<type>: <phase subject>` — e.g. `feat: public no-login venue and event browsing`

### PR Description

# Summary

One or two sentences describing what the Phase delivers and why (reference the `docs/layout.txt`
line-items covered).

## What's Included

- Bulleted list of each sub-task (A.1, A.2, …) delivered, with file-level detail where useful.
- Call out any schema changes, new entities, new dependencies, and the branch base
  (e.g. "branched from `feature/event-registration` (Phase C unmerged), so this branch carries its
  commits too").
- Note any deliberate trade-offs (e.g. "public routes live in a dedicated `/public` router",
  "member_iCal is hand-rolled RFC 5545, no new dependency").

## Verification

- Backend: `uv run ruff check .` clean; `uv run pyright` clean; smoke-test results
  (list the endpoints exercised and their status).
- Frontend: `npm run lint` clean; `npm run build` passes (per-page lazy chunks).
- Manual browser checks performed and their outcome.

## Notes

- Anything the reviewer/next Phase needs to know: migration requirements, role-boundary behavior,
  deferred items, follow-up work.

---

## Key decisions (resolved — recommended approach)

Confirmed before starting; deviating from these requires updating this section.

1. **Public route placement** — **RESOLVED: dedicated `/public` router** (`src/routes/public_routes.py`, `PublicRoutes`, prefix `/public`, tags `["public"]`). Keeps all admin CRUD behind existing role deps; `/public` is the single auditable unauthenticated surface. Read-only: reuse `Config().db()` + new search helpers, return 404 for inactive venues/events (don't leak soft-deleted rows). See A.1.
2. **Coach scoping** — **RESOLVED: add `coach_id` to `event`** (FK → `users(sub)`) with **guarded `ALTER TABLE ADD COLUMN` migrations** in `EventSQLite.init()` — sqlite: `PRAGMA table_info(event)` then `ADD COLUMN ... REFERENCES ...` (allowed when default is NULL); postgresql: `ADD COLUMN IF NOT EXISTS`. No dev DB reset; no alternative carrier for "which coach owns this event". See C.2/C.4.
3. **User creation without Google OAuth** — **RESOLVED: email-keyed invite, NOT raw `sub` pre-seed.** A facility manager knows an email, never a Google `sub`, and the `users` PII columns are `NOT NULL` (no placeholder row pre-login). `POST /users` takes `{email, role}`, records the intended role keyed by `email_hash`; `auth_callback` checks `email_hash` **before** auto-registering and applies the invited role on first Google login. If a lean Phase G is preferred, defer `POST /users` (list/role-change/delete suffice). See G.1.3.
4. **Event ↔ venue association** — **RESOLVED: `venue_id` on `event`; capacity derives from `venue→facility.max_capacity`** (matches `relationships.md`: `venueid` is an event attribute, capacity is a facility property). No capacity column on event. **Nullable `max_capacity` = unlimited** (no 409). Registration/reschedule write the event's venue onto the created/updated `schedule` row. See C.5/C.6/C.7.
5. **Messages** — **RESOLVED: one-way staff → member only** (facility-manager/coach → member); no member→staff messaging or threads in v1. **Add `sender_id` (FK `users.sub`)** to `Message` so the inbox shows who sent it. `POST /messages` sender guard = `coach_role`+. See E.4.
