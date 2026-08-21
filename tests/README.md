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

### Module coverage after 8.3

| Area | Modules at 100% | Remaining gaps |
|------|-----------------|----------------|
| Utilities | `dates.py`, `ical.py`, `middleware/logging.py` | `util/logging.py` 73% |
| Encryption | — | `encryption.py` 87% (error branches) |
| Config | — | `configs.py` 85% (unknown-driver branch) |
| Roles | `roles.py`, `roles_checker.py`, `user_role.py` | — |
| Routes | `devtools.py` | `frequency_routes` 21%, `facility_routes` 23%, `venue_routes` 23%, `public_routes` 33%, `auth_routes` 33%, `form_routes` 42%, `user_routes` 54% |
| Data layer | models/interfaces | SQLite implementations 41–64% |

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

## Conventions

- Fixtures are session-scoped: one `client` + one `seed` dict shared by all tests.
- Auth via `headers(sub, UserRole)` helpers from `conftest` (forged HS256 JWTs).
- Tests that mutate state (register/cancel/delete) create their own throwaway
  rows first so ordering doesn't matter.
