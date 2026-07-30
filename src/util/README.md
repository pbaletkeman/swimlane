# Utilities

Application configuration and database provider management.

## Files

| File | Description |
|------|-------------|
| `configs.py` | `Config` class — loads `config.yaml`, sets Google OAuth env vars, selects active DB driver (SQLite/PostgreSQL). Caches config after first read. |
