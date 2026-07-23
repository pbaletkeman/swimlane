---
name: devops
description: Git hooks, environment setup, Docker, linting, and development tooling
---

## What this skill covers

Development operations: git hooks, environment setup, Docker infrastructure, linting, and tooling.

## Git hooks (`.githooks/prepare-commit-msg`)

- Python-based git hook enforcing branch naming convention: branches must start with `feature/` or `bug/`
- Prepends `[branch-name]` prefix to commit messages
- Blocks commits on branches not matching the pattern
- Configured by `init_env.py` which sets `core.hooksPath` to `.githooks/`

## Environment setup (`init_env.py`)

One-command setup script that:
1. Configures git hooks path to `.githooks/`
2. Upgrades pip
3. Installs from `requirements.txt`

## Docker (`config/postgresql/`)

PostgreSQL + pgAdmin4 setup:
- `docker-compose.yml` with PostgreSQL 18 and pgAdmin4
- Persistent volume for data
- Network isolation via `pgnet`
- `readme.md` with setup instructions

## Linting

Installed via `requirements.txt`:
- **ruff** -- fast Python linter
- **pylint** -- comprehensive Python linter
- **pymarkdownlnt** -- Markdown linter

## Reference prototypes (`referances/`)

Early prototype code for login flows:
- `sqlite-login.py` -- session-based auth, raw SQL, simple RoleChecker, plaintext PII
- `postgresql-login.py` -- dual-database class, Pydantic schemas, admin CRUD endpoints
- `env.txt` -- example environment variable exports

## Other dev files

- `activate.bat` -- Windows venv activation shortcut
- `basic-request.http-request` -- VS Code REST Client test file for `/secure` endpoint
- `launch-json.md` -- sample VS Code launch.json for debugging
- `client_secret.sample.txt` -- sample Google OAuth client secret JSON

## Key files

- `.githooks/prepare-commit-msg` -- branch naming and commit message hook
- `init_env.py` -- environment setup script
- `config/postgresql/docker-compose.yml` -- Docker infrastructure
- `requirements.txt` -- Python dependencies (pip list format)

## When to use this skill

Use this when setting up the development environment, configuring git hooks, running linters, working with Docker, or debugging build/deployment issues.
