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
uv run pytest                  # test (currently no tests exist)
```

No test files exist yet. `pytest` config is in `pyproject.toml` (`tests/` dir).

## Architecture

**Entrypoint**: `main.py` — creates FastAPI app, adds SessionMiddleware, registers routers.

**Routers** (registered in `main.py`):

- `src/auth_routes.py` — Google OAuth login/callback, JWT issuance, `/me`, `/profile`, `/logout`
- `src/frequency_routes.py` — Frequency CRUD (`/frequencies`)
- `src/facility_routes.py` — Facility CRUD (`/facilities`)

**Data layer** (`src/data/<entity>/`): each entity has 3 files following the same pattern:

- `<entity>.py` — Pydantic model
- `<entity>_interface.py` — Abstract base class (ABC)
- `sqlite.py` — SQLite implementation (raw `sqlite3`, no ORM)

Implemented entities: `users`, `frequency`, `facility`, `event`. Planned: `venue`, `schedule`.

**Config**: `config.yaml` (root) — YAML loaded by `src/util/configs.py:Config`. Controls DB driver (`sql.active: sqlite|postgresql`) and security settings. `.secrets/client_secret.json` for Google OAuth credentials (gitignored).

**Roles**: `src/roles/` — `UserRole` StrEnum (`WEB_ADMIN`, `FACILITY_MANAGER`, `COACH`, `MEMBER`). `RoleChecker` is a FastAPI dependency that decodes JWT and enforces role. Roles are hierarchical.

**Encryption**: `src/encryption.py` — AES-256-GCM for PII fields. Key from env var (`APP_AES_KEY`). User model stores nonce + ciphertext columns, never plaintext.

**DB init**: Each SQLite implementation's `init()` runs `CREATE TABLE IF NOT EXISTS` — no separate migration files. Call `Config().db().init()` to ensure tables exist.

## Gotchas

- `src/env.py` has hardcoded `TOKEN_SECRET_KEY` and `ENCRYPTION_KEY` — not real secrets, just defaults. Override via env vars in production.
- `Config().db` is a **class** (not instance) — call `Config().db()` to get a SQLite instance.
- `Config.__init__` calls `Config.google_config()` which reads `.secrets/client_secret.json` — app won't start without it (or will raise `FileNotFoundError`).
- `referances/` directory name is intentionally misspelled.
- The `.venv/` folder is in git but should not be committed to shared branches.
- `pymarkdownlnt` is in dev deps but no markdown lint config exists — don't run it unless configured.
- Ruff line-length is 120 (not default 88).

## Entity Pattern (when adding new entities)

Follow `src/data/facility/` as the canonical example:

1. Create `src/data/<entity>/<entity>.py` — Pydantic `BaseModel`
2. Create `src/data/<entity>/<entity>_interface.py` — `abc.ABC` with abstract CRUD methods
3. Create `src/data/<entity>/sqlite.py` — concrete SQLite class, inherit interface, implement with raw `sqlite3`
4. Create `src/<entity>_routes.py` — class-based router pattern (see `frequency_routes.py`)
5. Register router in `main.py`

## Conventions

- Route classes: `<Entity>Routes` with `__init__` that builds `self.router = APIRouter(...)`
- DB access in routes: `db = Config().db()` then call methods on the instance
- Soft deletes via `is_active` column (not `is_deleted` — except `users` which uses both)
- Bulk operations use `executemany` + `RETURNING` or re-select after insert
- No `__init__.py` files in `src/` packages (implicit namespace packages)
