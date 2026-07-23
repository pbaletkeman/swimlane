# Swimlane AGENTS.md

## What is this project?

**Swimlane** is a FastAPI web application for managing swimming-related data. It uses Google OAuth2 authentication, session-based identity tracking, and local JWT role tokens for authorization.

## Tech Stack

- **Framework**: FastAPI + Starlette
- **Auth**: Authlib (OAuth2 client), python-jose/jose (JWT signing), google-auth via Authlib
- **Database**: SQLite (default, switchable to PostgreSQL via `config.yaml`)
- **Sessions**: server-side session middleware (`os.urandom(24).hex()` as secret)
- **Server**: Uvicorn
- **Python encryption** for stored user fields
- **Linting/build**: ruff, pylint

## Project Structure

```
swimlane/
├── main.py              # FastAPI app entrypoint — registers middleware & routers
├── Config.yaml          # Database/config flags (sqlite vs postgresql)
├── requirements.txt     # Python environment specs + dev tools
│
├── src/
│   ├── auth_routes.py       # Google OAuth login, JWT issuance, /me, /profile, /logout
│   ├── sample_route.py      # Sample CRUD routes with role guards (/open, /secure, /admin)
│   ├── config.py            # Config loading
│   ├── encryption.py        # AES encryption for stored fields (name, email)
│   ├── env.py               # Environment variable loader + TOKEN_SECRET_KEY
│   ├── misc_models.py       # Shared dataclasses/models (TokenData)
│   │
│   ├── roles/
│   │   ├── init.py
│   │   ├── roles.py           # admin_role, facility_manager_role, coach_role, member_role, all_users
│   │   ├── roles_checker.py   # Permission checking logic
│   │   └── user_role.py       # User role helper functions
│   │
│   └── data/
│       ├── init.py            # DB path + db_connect() factory function
│       └── users/             # SQLite-backed user CRUD (user_interface, user, sqlite)
```

## Key Configuration File: `Config.yaml`

The database and security settings live in the root `Config.yaml`. It has three sections:

1. **security** — JWT algorithm, access token expiry, refresh token expiry, admin sub IDs
2. **sql.active** — Which SQL driver to use (`sqlite` or `postgresql`)
3. **sql.providers** — Per-database provider config (file path for sqlite, pool URL for postgres)

To switch databases: change the value of `active` from the top-level `sql:` key and update `alg` to match the new configuration.

## Key Constants & Secrets

- **GOOGLE_CLIENT_ID** / **GOOGLE_CLIENT_SECRET** — Loaded at runtime in `AuthRoutes.__init__`, must be set via environment variables
- **TOKEN_SECRET_KEY** — Exposed on Python side as an env var from `.env` file, loaded by `src.env.py`
- These live outside of version control; `.secrets/` is gitignored

## Running the Application

```bash
python main.py
# or
uvicorn main:app --reload
```

Run with SQLite (default). For PostgreSQL, edit `Config.yaml`:

```yaml
sql:
  active: postgresql
```

## Authentication Flow

1. `/login` → redirects to Google OAuth2 consent screen
2. Google returns tokens + `userinfo` (email, name, sub) to `/auth/callback?code=...`
3. On callback: exchange code for token, extract userinfo, lookup user in DB by `sub`, auto-register as default **MEMBER** role if not found, generate local JWT access+refresh tokens
4. User gets two tokens back: short-lived `access_token` (15 min) and long-lived `refresh_token` (7 days)
5. Backend routes use the HTTP Bearer token via `Depends(security)`

## Role-Based Access Control (RBAC)

**Dependency injection** via FastAPI's DI system (not interceptors/middleware). Roles are implemented in `roles.py`:

- `admin_role`, `facility_manager_role` — Require `current_user.role == X`
- `coach_role`, `member_role` — Require `current_user.role == Y`
- `all_users` — Always passes, requires only the user to be present in the database

**Not used by this app**: FastAPI Interceptors (`interceptor.py`) or OpenAPI interceptors. Only standard dependencies are wired up.

## Database Connection

`db_connect()` is a factory in `src/data/init.py` that returns a callable for user CRUD operations. SQLite stores encrypted fields (nonce + ciphertext) for names and emails — never store plaintext.

## Notes

- Some code paths import `User` from two modules (`auth_routes` vs `data.users`) — they may be the same class; avoid circular imports
- The `.venv/` folder is checked into git in this repo but should not be committed to a shared branch — add it to your local `.gitignore`
