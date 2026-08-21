# Backend Tests

pytest suite for the Swimlane FastAPI backend. Tests run against a throwaway
SQLite database — never the dev `swimlane.db` (see `conftest.py`, which
overrides the DB before `main` is imported).

## Running

```bash
uv run pytest                                  # all tests
uv run pytest --cov=src --cov-report=term-missing   # with coverage
```

## Coverage Progress

Tracked per Phase V8 of the verification plan (`verification.md`).
Target: **80% overall on `src/`**.

| Checkpoint | Date | Tests | Coverage | Stmts | Missed | Notes |
|------------|------|-------|----------|-------|--------|-------|
| Baseline (8.2) | 2026-08-21 | 15 | **43%** | 4530 | 2586 | pytest-cov added; gap analysis done |
| After route/util batch (8.3) | 2026-08-21 | 132 | **55%** | 4530 | 2057 | +117 tests across 10 new files |
| Public/auth + CRUD batch | 2026-08-21 | 180 | **70%** | 4530 | 1357 | +48 tests: CRUD trio, public routes, auth basics, form submissions/PDF, coach scopes |
| Final push to target (8.5) | 2026-08-21 | 215 | **80%** ✅ | 4530 | 905 | +35 tests: user mgmt, member edit branches, message/submission/user bulk deletes, event bulk handlers, logging setup |
| Buffer above threshold | 2026-08-21 | 229 | **81%** | 4530 | 854 | +14 tests: auth JWT helpers, `_local_frontend_origin`, `oauth2user`, devtools/profile routes, encryption key-env errors, config provider branches |

### Module coverage after 8.5 (final)

| Area | Status |
|------|--------|
| Utilities (`dates`, `ical`, `logging`, `middleware`) | 100% |
| Roles (`roles`, `roles_checker`, `user_role`) | 100% |
| Encryption / Config | 92% / 92% (remaining lines are error branches) |
| Routes | `public` 83%, `message` 75%, remaining CRUD routes 64–78% (mostly `except → 500` guards) |
| Data layer SQLite | 66–90% per entity |
| **Overall** | **81% (229 tests)** — comfortably above the 80% gate |

## Test File Map

| File | Covers |
|------|--------|
| `conftest.py` | Throwaway SQLite fixture, seeded users/facility/venue/events, forged JWT headers |
| `test_capacity_register_reschedule.py` | Public capacity, member register, duplicate guard, reschedule guards, iCal content type |
| `test_user_role_bounds.py` | User management role bounds (admin-only senior roles), role persistence |
| `test_coach_scoping.py` | Coach event scoping (`/coach/events`) |
| `test_encryption.py` | AES-256-GCM encrypt/decrypt round-trip, nonce uniqueness, unicode, hash determinism |
| `test_dates.py` | `parse_date`, ISO week start, week/month ranges, day boundary ISO strings |
| `test_ical.py` | VCALENDAR structure, CRLF endings, TEXT escaping, multiple/empty events |
| `test_configs.py` | YAML load/cache, sqlite_file, google_config env vars + error paths |
| `test_role_checker.py` | JWT decode, 401/403 boundaries, role enforcement, missing claims |
| `test_middleware.py` | Request-ID generation/uniqueness, noisy-path suppression |
| `test_messages.py` | Staff→member messaging: send, inbox isolation, mark read, soft/hard delete |
| `test_event_routes.py` | Event CRUD, coach ownership guard, bulk ops, hard delete, member management |
| `test_schedule_routes.py` | Schedule list/get, cancel ownership guard, CRUD, hard delete, bulk |
| `test_form_routes.py` | Question/rule CRUD + bulk, form display, submissions |
| `test_public_and_auth.py` | Public browse routes (venues/events/schedules views), `/me`, `/refresh`, `/logout` |
| `test_forms_and_coach.py` | Submission flow (sign, list, detail, PDF export guards), coach event scoping |
| `test_coverage_gaps.py` | User management (list/invite/role/delete), event member-edit branches, message 404s, form/schedule bulk handlers, logging setup |
| `test_data_layer.py` | Direct SQLite ops: user/message/submission bulk deletes, admin helpers, event bulk handlers |
| `test_auth_helpers.py` | JWT create/verify/refresh helpers, localhost-origin validation, `oauth2user`, devtools page, encryption/config error branches |

## Conventions

- Fixtures are session-scoped: one `client` + one `seed` dict shared by all tests.
- Auth via `headers(sub, UserRole)` helpers from `conftest` (forged HS256 JWTs).
- Tests that mutate state (register/cancel/delete) create their own throwaway
  rows first so ordering doesn't matter.
