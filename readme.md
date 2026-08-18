# Swimlane

A FastAPI web application for managing swimming team data — events, venues, facilities, and member schedules. Uses Google OAuth2 authentication, session-based identity tracking, and local JWT role tokens for authorization.

## Prerequisites

- Python 3.14+
- [uv](https://docs.astral.sh/uv/) package manager
- Google OAuth2 credentials (for authentication)

## Getting Started

### 1. Install dependencies

```bash
uv sync --dev
```

### 2. Set up Google OAuth

Copy the sample client secret file and add your Google OAuth credentials:

```bash
cp client_secret.sample.txt .secrets/client_secret.json
```

Edit `.secrets/client_secret.json` with your Google OAuth2 client credentials from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

### 3. Configure the application

Edit `config.yaml` to set your preferences:

```yaml
security:
  algorithm: HS256
  access_token_expire_minutes: 15
  refresh_token_expire_days: 7
  frontend_url: http://localhost:8000  # SPA origin the OAuth callback redirects to (env: FRONTEND_URL)
  web_admins:
    - your-google-sub-id  # Add admin Google subject IDs here

sql:
  active: sqlite  # or postgresql
  providers:
    sqlite:
      sqlite_file: swimlane.db
```

### 4. Run the application

```bash
uv run python main.py
```

Or with auto-reload for development:

```bash
uv run uvicorn main:app --reload
```

The app will be available at `http://127.0.0.1:8000`.

### 5. Set up git hooks (optional)

```bash
uv run python init_env.py
```

### Backend-only API testing (no frontend)

With `security.frontend_url` (or `FRONTEND_URL`) pointing at the backend origin (the default), the post-login redirect lands on a self-contained API test page:

1. Open `http://localhost:8000/login`, pick a Google account.
2. The browser lands on `http://localhost:8000/auth/callback?...` which renders the **API Devtools** page (`GET /devtools` also serves it) and auto-captures the JWTs from the URL.
3. Use the quick-endpoint buttons (`/me`, `/frequencies`, `/facilities`, `/events`, `/venues`, `/schedules`, `/forms`), `POST /refresh`, `GET /logout`, or the custom method/path/body form to call the API from the browser (same origin — no CORS, no curl).

## Development

### Running the frontend

The UI is a React + TypeScript + Vite SPA in [`frontend/`](frontend/). With the backend running, start it with:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app on `http://localhost:5173` (it picks another port if 5173 is busy). In dev, API calls are proxied to the backend (`/api` → `http://127.0.0.1:8000`), and the login flow returns to whichever port the frontend is actually served on.

`/` is a **public** home page (placeholder content — TBD); signing in lands on the authenticated dashboard at `/dashboard`. All entity pages, signup forms, and the dashboard sit behind the route guard.

Frontend checks:

```bash
cd frontend
npm run lint   # oxlint
npm run build  # tsc -b + vite build
```

See [`frontend/README.md`](frontend/README.md) for full setup, `VITE_API_URL` configuration, and theme behavior.

### Running tests

```bash
uv run pytest
uv run pytest tests/test_specific.py
```

### Linting and formatting

```bash
uv run ruff check .
uv run ruff format .
```

### Type checking

```bash
uv run pyright
```

## API Endpoints

### Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/login` | Redirect to Google OAuth | No |
| GET | `/auth/callback` | OAuth callback handler (serves the API Devtools page when no `code` is present) | No |
| GET | `/devtools` | Self-contained API test page (same origin as the API) | No |
| POST | `/refresh` | Refresh access token | No |
| GET | `/me` | Get current user profile | Yes |
| GET | `/profile` | Get current user profile | Yes |
| GET | `/logout` | Clear session and redirect | No |

### Entities

| Prefix | Entity | Endpoints | Auth |
|--------|--------|-----------|------|
| `/frequencies` | Frequency | list, get, create, update, soft/hard delete, bulk | All users / Facility manager |
| `/facilities` | Facility | list, get, create, update, soft/hard delete, bulk | All users / Facility manager |
| `/events` | Event | list, get, create, update, soft/hard delete, bulk | All users / Facility manager |
| `/venues` | Venue | list, get, create, update, soft/hard delete, bulk | All users / Facility manager |
| `/schedules` | Schedule | list, get, create, update, soft/hard delete, bulk | All users / Facility manager |
| `/forms` | Form | question/rule CRUD, get facility form, submit, PDF export | All users / Facility manager / Member |

## Project Structure

```plaintext
swimlane/
├── main.py                  # FastAPI app entrypoint
├── config.yaml              # Application configuration
├── pyproject.toml           # Dependencies and tool config
├── LICENSE                  # MIT License
├── src/
│   ├── encryption.py        # AES-256-GCM encryption for PII
│   ├── env.py               # Environment variable defaults
│   ├── misc_models.py       # Shared Pydantic models (TokenData)
│   ├── data/                # Data layer (entity models + SQLite)
│   │   ├── users/           # User entity with encrypted PII
│   │   ├── frequency/       # Event frequency types
│   │   ├── facility/        # Physical facilities
│   │   ├── event/           # Swim sessions
│   │   ├── venue/           # Locations with facilities
│   │   ├── schedule/        # Member-event-venue junction
│   │   ├── form_question/   # Facility signup-form questions
│   │   ├── facility_rule/   # Facility signup-form rules
│   │   └── form_submission/ # Member signup submissions + responses
│   ├── roles/               # RBAC (UserRole, RoleChecker)
│   ├── routes/              # API routers (auth, entity CRUD, devtools)
│   └── util/                # Config management (YAML, DB provider)
├── frontend/                # React + TypeScript + Vite SPA (see frontend/README.md)
├── docs/                    # Documentation
│   ├── erd.mmd              # Entity-Relationship diagram
│   ├── flow/                # Workflow flowcharts
│   └── sequence/            # Sequence diagrams
├── config/                  # Deployment configs (PostgreSQL)
└── referances/              # Reference implementations
```

## Entity Pattern

Each entity follows a consistent 3-file pattern:

1. `<entity>.py` — Pydantic `BaseModel`
2. `<entity>_interface.py` — Abstract base class (`abc.ABC`)
3. `sqlite.py` — Concrete SQLite implementation

See [`src/data/`](src/data/README.md) for details.

## Documentation

- [Architecture](AGENTS.md) — Commands, patterns, conventions, gotchas
- [Frontend](frontend/README.md) — Run instructions, config, structure
- [Development Plan](docs/plan.md)
- [Entity Relationships](docs/relationships.md)
- [ERD](docs/erd.mmd)
- [TODO](docs/TODO.md) — Task tracking

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
