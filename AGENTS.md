# Swimlane

FastAPI app for swimming team management. Google OAuth2 login, local JWT roles, AES-256-GCM encrypted PII.

## Commands

```bash
uv sync --dev                  # install deps
uv run python main.py          # run server (port 8000)
uv run uvicorn main:app --reload

uv run ruff check .            # lint
uv run ruff format .           # format
uv run pyright                 # typecheck
uv run pytest                  # test

cd frontend
npm install                    # install frontend deps
npm run dev                    # Vite dev server (port 5173)
npm run lint                   # oxlint
npm run build                  # tsc -b + vite build
```

Tests live in `tests/` (pytest, throwaway SQLite DB — never the dev `swimlane.db`). They cover public capacity/register/reschedule, coach scoping, and user-role bounds; conftest overrides the DB before `main` is imported.

## Architecture

**Entrypoint**: `main.py` — creates FastAPI app, adds SessionMiddleware, registers routers.

**Routers** (registered in `main.py`):

- `src/routes/auth_routes.py` — Google OAuth login/callback, JWT issuance, `/me`, `/profile`, `/logout`
- `src/routes/public_routes.py` — **unauthenticated** read-only browsing (`/public/venues`, `/public/venues/{id}`, `/public/venues/{id}/schedules` with `view=week|month|list`, `/public/events?q=&venue_id=`, `/public/events/{id}` with live capacity) — no `Depends(...)` on these routes; inactive/missing rows 404
- `src/routes/frequency_routes.py` — Frequency CRUD (`/frequencies`)
- `src/routes/facility_routes.py` — Facility CRUD (`/facilities`)
- `src/routes/event_routes.py` — Event CRUD (`/events`) — create/update/delete are `coach_role` with an inline ownership guard (managers+ any event, coaches only their own; bulk ops stay `facility_manager_role`); public capacity, member register, and coach-managed member list/add/edit/remove under `/events/{id}/members`
- `src/routes/venue_routes.py` — Venue CRUD (`/venues`)
- `src/routes/schedule_routes.py` — Schedule CRUD + member self-service (`/schedules/me`, `/schedules/me/ical`, `/schedules/me/events`, `POST /{id}/reschedule`, `POST /{id}/cancel`)
- `src/routes/form_routes.py` — Form question/rule CRUD, GET facility form, POST submit, member submission list/detail, PDF export (`/forms`)
- `src/routes/message_routes.py` — One-way staff→member inbox (`/messages`): member GET own inbox / mark read / soft delete; coach+ send; admin hard delete
- `src/routes/coach_routes.py` — Coach-scoped endpoints (`/coach/events?scope=upcoming|past|all` — the caller's own events)
- `src/routes/user_routes.py` — User management (facility manager+): list by role, detail, email-keyed invite (role applied on first Google login), role change, soft/hard delete. Senior roles (`facility_manager`, `web_admin`) are listable/assignable/removable by `web_admin` only
- `src/routes/devtools.py` — `DEVTOOLS_HTML`, a self-contained API test page. Served at `GET /devtools` and by `auth_callback` when no OAuth `code` is present, so the post-login redirect can land here (set `FRONTEND_URL`/`security.frontend_url` to the backend origin) and auto-capture the tokens for backend-only testing.

**Data layer** (`src/data/<entity>/`): each entity has 3 files following the same pattern:

- `<entity>.py` — Pydantic model
- `<entity>_interface.py` — Abstract base class (ABC)
- `sqlite.py` — SQLite implementation (raw `sqlite3`, no ORM)

Implemented entities: `users`, `frequency`, `facility`, `event`, `venue`, `schedule`, `form_question`, `facility_rule`, `form_submission`, `message`, `user_invite`.

**Config**: `config.yaml` (root) — YAML loaded by `src/util/configs.py:Config`. Controls DB driver (`sql.active: sqlite|postgresql`) and security settings. `security.frontend_url` is where the OAuth callback redirects the browser with the JWTs appended (override with `FRONTEND_URL` env). `.secrets/client_secret.json` for Google OAuth credentials (gitignored).

**OAuth callback redirect**: after Google auth, `/auth/callback` redirects the browser to the SPA origin that started the login, preferring the `frontend_url` query param passed by the frontend at `/login` (validated to `localhost`/`127.0.0.1`/`::1` only), then the `Origin`/`Referer` headers, then `security.frontend_url`/`FRONTEND_URL`. The chosen origin is stored in the session cookie so it survives the Google round-trip. For backend-only development, point `frontend_url` at the backend origin — the callback then lands on the devtools page (see `src/routes/devtools.py`), which captures the tokens.

**Roles**: `src/roles/` — `UserRole` StrEnum (`WEB_ADMIN`, `FACILITY_MANAGER`, `COACH`, `MEMBER`). `RoleChecker` is a FastAPI dependency that decodes JWT and enforces role. Roles are hierarchical. Usage: `member_role` guards member self-service (register, reschedule, cancel, own schedule/iCal, form submit, own submissions/inbox); `coach_role` guards event create/update/delete (with the inline ownership guard) plus message send and coach event-member management; `facility_manager_role` guards entity CRUD/bulk; senior-role user management (`facility_manager`/`web_admin`) is `web_admin`-only.

**Encryption**: `src/encryption.py` — AES-256-GCM for PII fields. Key from env var (`APP_AES_KEY`). User model stores nonce + ciphertext columns, never plaintext.

**Logging**: `src/util/logging.py` — centralized `setup_logging()`. `src/middleware/logging.py` — request logging middleware with UUID correlation IDs. Env vars: `LOG_LEVEL` (default `INFO`), `LOG_FORMAT` (`text`|`json`), `LOG_FILE` (optional file output).

**DB init**: Each SQLite implementation's `init()` runs `CREATE TABLE IF NOT EXISTS` — no separate migration files. `main.py` calls `init_db()` at startup, which runs every entity SQLite's `init()` so all tables exist before the first request (`Config().db` is only the users SQLite — its `init()` creates just the `users` table). All connections enable `PRAGMA foreign_keys = ON` for FK enforcement.

**Foreign Keys**: FK constraints with `ON DELETE CASCADE ON UPDATE CASCADE` are defined in `CREATE TABLE` DDL for: `venue→facility`, `event→frequency`, `schedule→venue`, `schedule→users`, `schedule→event`, `form_question→facility`, `facility_rule→facility`, `form_submission→facility`, `form_submission→users`, `form_response→form_submission`, `form_response→form_question`, `message→users` (`member_id`, `sender_id`). `event.coach_id→users(sub)` and `event.venue_id→venue(venue_id)` are added by the guarded `ALTER TABLE ADD COLUMN ... REFERENCES ...` migration in `EventSQLite.init()` (SQLite allows the REFERENCES clause on a NULL-default column).

**PDF export**: `GET /forms/submissions/{id}/pdf` renders a member's submission with reportlab (facility, member name, answers, facility rules). Members may export only their own submission; managers/coaches/admins may export any. `itsdangerous` is a declared dep (SessionMiddleware needs it).

**Frontend** (`frontend/`): React 19 + TypeScript + Vite SPA styled with PrimeReact 11 (compound components + `@primeuix/themes` Aura preset). Provider stack in `src/main.tsx`: `PrimeReactProvider` (from `@primereact/core/config`) → `ThemeProvider` (from `@primereact/core/theme`) → `AuthProvider` → `ToastProvider` + `App`. Routes live in `src/router/`: public (outside `RouteGuard`) are `/` (HomePage: explore + login/dashboard), `/login`, `/auth/callback`, and the `/explore/*` browse pages (`/explore`, `/explore/venues`, `/explore/venues/:venueId`, `/explore/events/:eventId`). Authenticated routes sit behind `RouteGuard` + `AppLayout`: `/dashboard`, `/profile`, `/my-schedule`, `/manage-events`, `/manage-users`, the five CRUD pages, `/forms/builder/:facilityId`. The sidebar nav (`src/layout/nav.ts`) is role-filtered via rank-based `hasRole`: MEMBER sees Dashboard, Signup Forms, My Schedule (+ Profile in the sidebar footer); COACH adds Manage Events; FACILITY_MANAGER adds Frequencies/Facilities/Events/Venues/Schedules/Manage Users; WEB_ADMIN sees everything. API calls go through `src/api/client.ts` (Bearer header, single 401 → refresh → retry, then a `swimlane:auth-unauthorized` event that signs the user out). The login flow passes the SPA's own origin via `?frontend_url=` so the OAuth callback always returns to the correct port.

## Gotchas

- `src/env.py` has hardcoded `TOKEN_SECRET_KEY` and `ENCRYPTION_KEY` — not real secrets, just defaults. Override via env vars in production.
- `Config().db` is a **class** (not instance) — call `Config().db()` to get a SQLite instance.
- `Config.__init__` calls `Config.google_config()` which reads `.secrets/client_secret.json` — app won't start without it (or will raise `FileNotFoundError`).
- The OAuth session secret is `os.urandom(24)` at startup (`main.py`) — regenerated every restart, so a login flow interrupted by a restart loses the session cookie.
- `auth_callback` returns `DEVTOOLS_HTML` when called without a `code` param, so `/auth/callback` is safe to visit directly (it renders the test page, not an error).
- Frontend: PrimeReact 11 components require `<PrimeReactProvider>` (exported from `@primereact/core/config`) at the root of `main.tsx`. The `ThemeProvider` from `@primereact/core/theme` does **not** provide it — omitting `PrimeReactProvider` crashes the whole tree at runtime ("[PrimeReact] PrimeReactProvider not found").
- Frontend: PrimeReact 11 `Button` renders only its children — the old `label=`/`icon=` props (v4 API) do nothing and produce an empty button. Pass `<i className="p-button-icon pi pi-google" />` + `<span className="p-button-label">…</span>` inside the button instead.
- Frontend: `npm run build` runs `tsc -b` then Vite; `npm run lint` is oxlint.
- Frontend: JWT `role` claims are the lowercase `UserRole` enum values (e.g. `facility_manager`), but the frontend role maps (`ROLE_RANK`, nav/severity/label maps) key on the uppercase member names (`FACILITY_MANAGER`). `getRoleFromToken` (`frontend/src/auth/tokens.ts`) uppercases the decoded role before the lookup — keep both sides in sync if you change role handling.
- `referances/` directory name is intentionally misspelled.
- `pymarkdownlnt` is in dev deps but no markdown lint config exists — don't run it unless configured.
- Ruff line-length is 120 (not default 88).

## Entity Pattern (when adding new entities)

Follow `src/data/facility/` as the canonical example:

1. Create `src/data/<entity>/<entity>.py` — Pydantic `BaseModel`
2. Create `src/data/<entity>/<entity>_interface.py` — `abc.ABC` with abstract CRUD methods
3. Create `src/data/<entity>/sqlite.py` — concrete SQLite class, inherit interface, implement with raw `sqlite3`
4. Create `src/routes/<entity>_routes.py` — class-based router pattern (see `frequency_routes.py`)
5. Register router in `main.py`

## Conventions

- Route classes: `<Entity>Routes` with `__init__` that builds `self.router = APIRouter(...)`
- DB access in routes: `db = Config().db()` then call methods on the instance
- Soft deletes via `is_active` column (not `is_deleted` — except `users` which uses both)
- Bulk operations use `executemany` + `RETURNING` or re-select after insert

## Further Reading

- [Backend Walkthrough](docs/README-Backend.md) — detailed architecture, data layer, all routers, roles, encryption, testing, configuration
- [Frontend Walkthrough](docs/README-Frontend.md) — React SPA: providers, routing, auth, pages, theming, build
