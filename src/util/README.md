# Utilities

Application configuration, logging, and database provider management.

## Files

| File | Description |
|------|-------------|
| `configs.py` | `Config` class — loads `config.yaml`, sets Google OAuth env vars, selects active DB driver (SQLite/PostgreSQL). Caches config after first read. |
| `logging.py` | `setup_logging()` — configures root logger with text/JSON formatters, optional file rotation. Env vars: `LOG_LEVEL`, `LOG_FORMAT`, `LOG_FILE`. |
