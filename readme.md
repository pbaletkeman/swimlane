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

## Development

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
| GET | `/auth/callback` | OAuth callback handler | No |
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
│   │   └── schedule/        # Member-event-venue junction
│   ├── roles/               # RBAC (UserRole, RoleChecker)
│   ├── routes/              # API routers (auth, entity CRUD)
│   └── util/                # Config management (YAML, DB provider)
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
- [Development Plan](docs/plan.md)
- [Entity Relationships](docs/relationships.md)
- [ERD](docs/erd.mmd)
- [TODO](docs/TODO.md) — Task tracking

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
