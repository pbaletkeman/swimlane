# Source Code

Core application source code for the Swimlane FastAPI application.

## Files

| File | Description |
|------|-------------|
| `encryption.py` | AES-256-GCM authenticated encryption for PII fields (name, email) with random nonces, and SHA-256 hashing for lookups |
| `env.py` | Environment variable defaults for secrets and encryption keys (override via env vars in production) |
| `misc_models.py` | Shared Pydantic models (`TokenData` for JWT payload decoding) |

## Directories

| Directory | Description |
|-----------|-------------|
| `data/` | Data layer — Pydantic models, abstract interfaces, and SQLite implementations for each entity |
| `roles/` | Role-based access control — `UserRole` enum and `RoleChecker` FastAPI dependency |
| `routes/` | API route modules — class-based routers for each entity |
| `util/` | Utility modules — YAML config management and database provider selection |
