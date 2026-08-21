# Backend Walkthrough

A deep-dive into the Swimlane FastAPI backend — architecture, data layer, routers, roles, encryption, testing, and configuration.

## Overview

Swimlane is a FastAPI application for managing swimming team data — events, venues, facilities, member schedules, and signup forms.

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI (async Python) |
| Auth | Google OAuth2 → session cookie → local JWT |
| Authorization | Hierarchical role-based (`RoleChecker` dependency) |
| PII encryption | AES-256-GCM (nonce + ciphertext per field) |
| Database | SQLite (raw `sqlite3`, no ORM) |
| Entry point | `main.py` |

## Architecture

```plaintext
main.py
  ├── SessionMiddleware        (cookie-based session for OAuth round-trip)
  ├── RequestLoggingMiddleware  (UUID correlation IDs, timing)
  ├── init_db()                (CREATE TABLE IF NOT EXISTS for all entities)
  └── Routers
        ├── auth_routes        → Google OAuth login/callback, JWT issuance
        ├── public_routes      → unauthenticated venue/event browsing
        ├── frequency_routes   → Frequency CRUD
        ├── facility_routes    → Facility CRUD
        ├── event_routes       → Event CRUD + member management
        ├── venue_routes       → Venue CRUD
        ├── schedule_routes    → Schedule CRUD + member self-service
        ├── form_routes        → Form question/rule CRUD, submissions, PDF
        ├── message_routes     → Staff→member inbox
        ├── coach_routes       → Coach-scoped event listing
        ├── user_routes        → User management (facility manager+)
        └── devtools           → API test page (backend-only flow)
```

**Request flow**: Client → middleware (session + logging) → router endpoint → `Config().db()` → SQLite entity class → raw SQL via `sqlite3`.

## Data Layer Pattern

Every entity follows a 3-file convention in `src/data/<entity>/`:

| File | Purpose |
|------|---------|
| `<entity>.py` | Pydantic `BaseModel` — defines the shape of a row |
| `<entity>_interface.py` | `abc.ABC` — abstract CRUD methods (the contract) |
| `sqlite.py` | Concrete implementation — raw `sqlite3`, no ORM |

**Implemented entities**: `users`, `frequency`, `facility`, `event`, `venue`, `schedule`, `form_question`, `facility_rule`, `form_submission`, `message`, `user_invite`.

### Migrations

There are no separate migration files. Each SQLite class's `init()` runs `CREATE TABLE IF NOT EXISTS` at startup. Schema changes are applied inline — for example, `EventSQLite.init()` uses a guarded `ALTER TABLE ADD COLUMN ... REFERENCES ...` to add foreign keys after the table exists.

### Foreign Keys

All FK constraints use `ON DELETE CASCADE ON UPDATE CASCADE`:

| Child | Parent |
|-------|--------|
| `venue` | `facility` |
| `event` | `frequency` |
| `schedule` | `venue`, `users`, `event` |
| `form_question` | `facility` |
| `facility_rule` | `facility` |
| `form_submission` | `facility`, `users` |
| `form_response` | `form_submission`, `form_question` |
| `message` | `users` (member + sender) |
| `event` | `users` (coach), `venue` |

All connections enable `PRAGMA foreign_keys = ON`.

### Soft Deletes

Most entities use an `is_active` column for soft deletes. The `users` table uses both `is_deleted` (flag) and `deleted_at` (timestamp).

## Routers

### Authentication (`src/routes/auth_routes.py`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/login` | No | Redirect to Google OAuth |
| GET | `/auth/callback` | No | OAuth callback — issues JWT, redirects to SPA |
| POST | `/refresh` | No | Refresh access token |
| GET | `/me` | Yes | Current user profile |
| GET | `/profile` | Yes | Current user profile (alias) |
| GET | `/logout` | No | Clear session, redirect |

### Public Browsing (`src/routes/public_routes.py`)

All routes are **unauthenticated** — no `Depends(...)`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/venues` | List active venues |
| GET | `/public/venues/{id}` | Venue detail |
| GET | `/public/venues/{id}/schedules` | Venue schedules (`?view=week\|month\|list`) |
| GET | `/public/events` | Search events (`?q=&venue_id=`) |
| GET | `/public/events/{id}` | Event detail with live capacity |

Inactive or missing rows return 404.

### Entity CRUD

Each entity router follows the same pattern: list, get, create, update, soft delete, hard delete, bulk create.

| Router | Prefix | Auth | Notes |
|--------|--------|------|-------|
| `frequency_routes` | `/frequencies` | facility_manager+ | Standard CRUD |
| `facility_routes` | `/facilities` | facility_manager+ | Standard CRUD |
| `venue_routes` | `/venues` | facility_manager+ | Standard CRUD |
| `event_routes` | `/events` | coach+ (ownership guard) | See below |
| `schedule_routes` | `/schedules` | facility_manager+ / member self-service | See below |

### Event Ownership Guard

Event create/update/delete use `coach_role` with an inline ownership check:

```python
if not self._is_manager_or_admin(current_user) and existing.coach_id != current_user.sub:
    raise HTTPException(status_code=403, detail="Not the coach of this event")
```

- **Facility managers+** can operate on any event.
- **Coaches** can only operate on events they own (`coach_id == current_user.sub`).
- On create, coaches can only set `coach_id` to their own sub.
- On update, coaches cannot reassign `coach_id` to another coach.

### Self-Service Endpoints

| Route | Role | Description |
|-------|------|-------------|
| `GET /schedules/me` | member | List own schedule |
| `GET /schedules/me/ical` | member | iCal export |
| `GET /schedules/me/events` | member | Own events |
| `POST /schedules/{id}/reschedule` | member | Reschedule (capacity check) |
| `POST /schedules/{id}/cancel` | member | Cancel registration |
| `POST /events/{id}/members` | coach+ | Add member to event |
| `DELETE /events/{id}/members/{sub}` | coach+ | Remove member from event |
| `PUT /events/{id}/members/{sub}` | coach+ | Edit member notes |
| `GET /events/{id}/members` | coach+ | List event members |

### Forms (`src/routes/form_routes.py`)

17 endpoints covering form questions, facility rules, submissions, and PDF export.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/forms/{facility_id}` | all | Fetch facility form (questions + rules) |
| POST | `/forms/{facility_id}/submit` | member | Submit completed form |
| GET | `/forms/me/submissions` | member | List own submissions |
| GET | `/forms/submissions/{id}` | member | Submission detail with responses |
| GET | `/forms/submissions/{id}/pdf` | member | PDF export (own only, managers+ any) |
| POST | `/forms/questions` | facility_manager | Create question |
| POST | `/forms/questions/bulk` | facility_manager | Bulk create |
| PUT | `/forms/questions/{id}` | facility_manager | Update question |
| DELETE | `/forms/questions/{id}` | facility_manager | Soft-delete question |
| DELETE | `/forms/questions/{id}/hard` | admin | Hard-delete question |
| POST | `/forms/rules` | facility_manager | Create rule |
| POST | `/forms/rules/bulk` | facility_manager | Bulk create |
| PUT | `/forms/rules/{id}` | facility_manager | Update rule |
| DELETE | `/forms/rules/{id}` | facility_manager | Soft-delete rule |
| DELETE | `/forms/rules/{id}/hard` | admin | Hard-delete rule |

PDF export uses `reportlab` to render facility name, decrypted member name, answers, and facility rules.

### Staff Messaging (`src/routes/message_routes.py`)

One-way staff→member inbox.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/messages/me` | member | List own inbox (decrypted sender names) |
| POST | `/messages` | coach+ | Send message to member |
| PUT | `/messages/{id}/read` | member | Mark as read (own inbox only) |
| DELETE | `/messages/{id}` | all | Soft-delete from own inbox |
| DELETE | `/messages/{id}/hard` | admin | Permanently delete |

### Coach Routes (`src/routes/coach_routes.py`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/coach/events` | coach+ | Caller's own events (`?scope=upcoming\|past\|all`) |

### User Management (`src/routes/user_routes.py`)

Facility manager+ only. Senior roles (`facility_manager`, `web_admin`) are admin-only.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/users` | facility_manager+ | List users (filter by `?role=`) |
| GET | `/users/{sub}` | facility_manager+ | User detail |
| POST | `/users/invite` | facility_manager+ | Email-keyed invite (role on first login) |
| PUT | `/users/{sub}/role` | facility_manager+ | Change role (senior roles: admin only) |
| DELETE | `/users/{sub}` | facility_manager+ | Soft-delete (senior roles: admin only) |
| DELETE | `/users/{sub}/hard` | admin | Hard-delete |

### Dev Tools (`src/routes/devtools.py`)

`GET /devtools` serves a self-contained API test page. When `/auth/callback` is hit without a `code` param, it also returns this page — so backend-only development works by pointing `frontend_url` at the backend origin.

## Roles & Guards

### Hierarchy

```plaintext
WEB_ADMIN > FACILITY_MANAGER > COACH > MEMBER
```

Higher roles include all lower roles. The hierarchy is defined in `src/roles/`:

| Dependency | Allowed Roles |
|------------|--------------|
| `member_role` | MEMBER, COACH, FACILITY_MANAGER, WEB_ADMIN |
| `coach_role` | COACH, FACILITY_MANAGER, WEB_ADMIN |
| `facility_manager_role` | FACILITY_MANAGER, WEB_ADMIN |
| `admin_role` | WEB_ADMIN |

### How It Works

`RoleChecker` is a FastAPI dependency that:
1. Extracts the bearer token from the `Authorization` header.
2. Decodes the JWT with `jose.jwt.decode()`.
3. Extracts `sub` and `role` from the payload (401 if missing).
4. Checks `role in allowed_roles` (403 if denied).
5. Returns a `User(sub=sub, role=role)` object.

### Usage in Routes

```python
# Member self-service
router.add_api_route("/schedules/me", ..., dependencies=[Depends(member_role)])

# Coach with ownership guard
router.add_api_route("/events", ..., dependencies=[Depends(coach_role)])
# Then inline: if not manager and event.coach_id != user.sub → 403

# Facility manager CRUD
router.add_api_route("/frequencies", ..., dependencies=[Depends(facility_manager_role)])

# Admin only
router.add_api_route("/users/{sub}/hard", ..., dependencies=[Depends(admin_role)])
```

## Encryption

AES-256-GCM authenticated encryption for PII fields (name, email).

| Component | Detail |
|-----------|--------|
| Algorithm | AES-256-GCM (96-bit nonce, authenticated) |
| Key | `APP_AES_KEY` env var (base64, 32 bytes) |
| Nonce | 12 bytes, random per encryption call |
| Storage | `*_nonce` + `*_ciphertext` columns (never plaintext) |
| Lookup | `email_hash` = SHA-256 of lowercased email |

**Encrypted fields on User model**: `first_name`, `last_name`, `email` — each stored as nonce + ciphertext pair.

**Functions**:
- `encrypt_field(plaintext, aad=None)` → `{"nonce": base64, "ciphertext": base64}`
- `decrypt_field(nonce, ciphertext, aad=None)` → plaintext
- `hash_field(plaintext)` → SHA-256 hex digest (deterministic, for lookups)

## Testing

### Running

```bash
uv run pytest                    # all tests
uv run pytest tests/test_foo.py  # specific file
```

### Setup (`tests/conftest.py`)

Before `main` is imported, `conftest.py` redirects the SQLite database to a temporary directory — tests **never** touch the dev `swimlane.db`.

**Helper functions**:
- `_make_user(sub, role, email)` — creates an encrypted User object
- `token(sub, role)` — forges a JWT (far-future expiry)
- `headers(sub, role)` — returns `{"Authorization": "Bearer <token>"}`

**Fixtures**:
- `client` (session-scoped) — `TestClient(app)` context manager
- `seed` (session-scoped) — seeds a throwaway DB with 7 users, 1 facility, 1 venue, 1 frequency, 2 events, and pre-built auth headers for each role

### What's Covered

| Test File | Coverage |
|-----------|----------|
| `test_capacity_register_reschedule.py` | Public capacity, member registration, reschedule/cancel |
| `test_coach_scoping.py` | Coach ownership guard |
| `test_user_role_bounds.py` | Role assignment limits |

### Adding a New Test

1. Create `tests/test_<feature>.py`
2. Import `client` and `seed` fixtures from conftest
3. Use `seed["headers"]["member"]` (or coach/manager/admin) for auth
4. Tests run against the throwaway DB — no cleanup needed

## Configuration

### `config.yaml`

```yaml
logging:
  level: INFO                    # or override with LOG_LEVEL env var

security:
  algorithm: HS256
  access_token_expire_minutes: 15
  refresh_token_expire_days: 7
  frontend_url: http://localhost:8000   # or FRONTEND_URL env var
  web_admins:
    - your-google-sub-id         # auto-promoted to WEB_ADMIN on login

sql:
  active: sqlite                 # or postgresql (not yet implemented)
  providers:
    sqlite:
      sqlite_file: swimlane.db
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_AES_KEY` | AES-256-GCM encryption key (base64) | Hardcoded fallback (not for production) |
| `TOKEN_SECRET_KEY` | JWT signing key | Hardcoded fallback (not for production) |
| `FRONTEND_URL` | OAuth callback redirect origin | `security.frontend_url` from config |
| `LOG_LEVEL` | Logging level | `INFO` |
| `LOG_FORMAT` | `text` or `json` | `text` |
| `LOG_FILE` | Optional log file path | None (stdout only) |

### `.secrets/`

| File | Purpose |
|------|---------|
| `client_secret.json` | Google OAuth2 client credentials (gitignored) |

### Gotchas

- `Config().db` is a **class**, not an instance — call `Config().db()` to get a SQLite connection.
- `Config.__init__` reads `.secrets/client_secret.json` — the app won't start without it.
- The OAuth session secret is `os.urandom(24)` at startup — regenerated every restart, so interrupted login flows lose their session.
- `src/env.py` has hardcoded fallback keys — override with env vars in production.
- Ruff line-length is 120 (not default 88).

## See Also

- [Project README](../readme.md) — Getting started, quickstart, project structure
- [Architecture](../AGENTS.md) — Commands, patterns, conventions, gotchas
- [Frontend Walkthrough](README-Frontend.md) — React SPA: providers, routing, auth, pages, theming, build
