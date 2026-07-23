---
name: config-management
description: YAML configuration, Google OAuth credential loading, and runtime database provider selection
---

## What this skill covers

Application configuration: YAML settings, Google OAuth credentials, and database provider switching.

## YAML config (`config.yaml`)

Three sections:

1. **security** -- JWT algorithm (`HS256`), access token expiry (15 min), refresh token expiry (7 days), `web_admins` (list of Google OAuth sub IDs)
2. **sql.active** -- Which SQL driver to use (`sqlite` or `postgresql`)
3. **sql.providers** -- Per-database provider config (`sqlite_file` path for sqlite, postgresql config for postgres)

## Google OAuth config

- `.secrets/client_secret.json` loaded at runtime by `Config.google_config()`
- All keys under `"web"` are injected as `GOOGLE_*` environment variables (e.g., `GOOGLE_client_id`, `GOOGLE_client_secret`)
- `.secrets/` directory is gitignored

## Config class (`src/util/configs.py`)

- `Config.yaml_config()` (static) -- reads `config.yaml`, returns parsed dict
- `Config.google_config(file_path)` (static) -- reads `.secrets/client_secret.json`, sets env vars
- `Config.__init__()` -- loads YAML config, calls `google_config()`, selects database provider based on `sql.active`:
  - `"sqlite"` -- imports `SQLite` class, assigns to `self.db`
  - `"postgresql"` -- reads config but no provider class implemented yet
- `self.yamlconfig` -- stores the parsed YAML config dict

## Runtime DB switching

Setting `sql.active: sqlite` in `config.yaml` assigns the `SQLite` class to `Config().db`. The class itself (not an instance) is assigned, so `Config().db` returns the class and `Config().db()` creates an instance.

## Key files

- `config.yaml` -- main configuration file
- `.secrets/client_secret.json` -- Google OAuth credentials (gitignored)
- `src/util/configs.py` -- Config class
- `src/env.py` -- hardcoded fallback constants

## Known issues

- `Config()` is called multiple times across modules, each time re-reading YAML and re-processing Google config
- PostgreSQL path reads config but does not instantiate a provider class
- `Config.yamlconfig` attribute name differs from what some code expects (`yaml_config` vs `yamlconfig`)

## When to use this skill

Use this when modifying configuration settings, switching database providers, updating Google OAuth credentials, or changing how config is loaded.
