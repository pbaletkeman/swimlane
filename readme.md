# Swimlane

A FastAPI web application for managing swimming-related data. Uses Google OAuth2 authentication, session-based identity tracking, and local JWT role tokens for authorization.

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
uv run pylint src/
```

### Type checking

```bash
uv run pyright
```

## API Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/login` | Redirect to Google OAuth | No |
| GET | `/auth/callback` | OAuth callback handler | No |
| POST | `/refresh` | Refresh access token | No |
| GET | `/me` | Get current user profile | Yes |
| GET | `/profile` | Get current user profile | Yes |
| GET | `/logout` | Clear session and redirect | No |

## Project Structure

```plaintext
swimlane/
├── main.py              # FastAPI app entrypoint
├── config.yaml          # Application configuration
├── pyproject.toml       # Dependencies and tool config
├── LICENSE              # MIT License
├── src/
│   ├── auth_routes.py   # Authentication endpoints
│   ├── encryption.py    # AES-256-GCM encryption
│   ├── env.py           # Environment constants
│   ├── misc_models.py   # Shared Pydantic models
│   ├── util/
│   │   └── configs.py   # Configuration management
│   ├── roles/
│   │   ├── roles.py     # Role definitions
│   │   ├── roles_checker.py  # RBAC dependency
│   │   └── user_role.py # UserRole enum
│   └── data/
│       └── users/       # User CRUD operations
└── docs/                # Documentation
```

## Documentation

- [Plan](docs/plan.md)
- [Relationships](docs/relationships.md)
- [Entity Relationship Diagram](docs/erd.mmd)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
