# Verification & Polish Plan

Cross-cutting quality sweep after Phases A-J complete. Each task is
independent; dependencies are called out where they matter. Work on a
dedicated branch (`chore/verification-sweep`) cut from `main` after Phase J
merges.

**How to use**: tick the checkbox (`- [x]`) when the sub-task is committed.
One commit per logical sub-task.

---

## Current State (ground truth)

| Area | Status |
|------|--------|
| Root markdown files | `AGENTS.md`, `readme.md` + 8 todo/done/plan files |
| docs/ | 24 files (`TODO.md`, `plan.md`, `layout.txt`, `index.md`, `diagrams.md`, etc.) |
| Backend tests | pytest configured; **15 tests** in `tests/`; no coverage tooling |
| Frontend tests | **0 tests**; no vitest/jest config; 57 ts/tsx source files |
| Python docstrings | Most modules have a one-line header; many functions lack docstrings |
| TS/TSX file headers | None |
| Frontend test infra | Zero (no vitest, no @testing-library, no jsdom) |
| Coverage baselines | Unknown - need measurement before improvement |

---

## 1. Todo/Plan Completeness Audit

Verify every item marked complete in the todo files actually ships in
the codebase.

- [ ] **1.1** -- Diff `missing-features-todo.md` (all `- [x]` items) against
  `missing-features-done.md` table rows. Every ticked todo item must have a
  corresponding commit hash in the done file. Report any gaps.
- [ ] **1.2** -- Diff `frontend-todo.md` / `frontend-done.md` the same way.
  Report gaps.
- [ ] **1.3** -- Diff `pdf-todo.md` / `pdf-done.md` the same way. Report gaps.
- [ ] **1.4** -- For each done-file commit hash, verify the commit exists on
  `main` (`git log --oneline | findstr <hash>`). Flag any orphaned references.
- [ ] **1.5** -- Spot-check three random done-file entries by reading the
  actual file/endpoint the commit claims to deliver and confirming the code is
  present on `main`. Commit summary of findings.

---

## 2. Consolidate ToDo/Done/Plan Files into docs/

Move all plan-tracking files out of the repo root into `docs/` so the root
stays clean for the README and AGENTS.md.

- [ ] **2.1** -- Create `docs/history/` subdirectory for completed plan pairs.
- [ ] **2.2** -- `git mv` completed pairs into `docs/history/`:
  - `missing-features-todo.md` + `missing-features-done.md`
  - `frontend-todo.md` + `frontend-done.md`
  - `pdf-todo.md` + `pdf-done.md`
- [ ] **2.3** -- `git mv docs/TODO.md docs/history/legacy-todo.md` and
  `git mv docs/plan.md docs/history/legacy-plan.md`.
- [ ] **2.4** -- `git mv docs/layout.txt docs/history/layout.txt` (the
  original plan input).
- [ ] **2.5** -- Move `launch-json.md` and `opencode-bots.md` into `docs/`
  (optional project notes, not todo/done -- direct `docs/` not `docs/history/`).
- [ ] **2.6** -- Update `docs/update_index.py` if it references any moved
  filenames. Run `uv run python docs/update_index.py` and confirm
  `docs/index.md` regenerates without errors.

---

## 3. Root README Quickstart

Add a "How To Get Started In Under Ten Minutes" section to `readme.md`.

- [ ] **3.1** -- Draft the section with these subsections:
  - **Prerequisites** (Python 3.14+, uv, Node 18+, Google OAuth credentials)
  - **Clone + Install** (`uv sync --dev` + `cd frontend && npm install`)
  - **Configure** (copy `client_secret.sample.txt`, edit `config.yaml`)
  - **Run** (`uv run python main.py` + `npm run dev` -- two terminals)
  - **Verify** (open `http://localhost:5173`, click Explore venues / Sign in)
  - **Run the tests** (`uv run pytest` + `npm run test`)
- [ ] **3.2** -- Ensure the section uses copy-pasteable code blocks and avoids
  jargon. Time a fresh clone on a clean machine to validate "under ten minutes."
- [ ] **3.3** -- Insert the section after the "Getting Started" heading (item 5
  of the existing structure), before "Development."

---

## 4. README-Backend.md

Create a thorough backend walkthrough in `docs/README-Backend.md`.

- [ ] **4.1** -- Write the file with these sections:
  1. **Overview** -- FastAPI app, entry point, config, encryption, OAuth
  2. **Architecture** -- `main.py` -> routers -> data layer -> SQLite; role
     hierarchy; AES-256-GCM PII encryption
  3. **Data Layer Pattern** -- 3-file convention (model/interface/sqlite),
     guarded migrations, FK conventions
  4. **Routers** -- every router with endpoints, auth deps, guard patterns
  5. **Self-Service Endpoints** -- member register/reschedule/cancel/iCal,
     coach event management, staff messaging, profile correspondence
  6. **Public Endpoints** -- `/public/*` with view params, event detail, live
     capacity
  7. **Roles & Guards** -- hierarchy diagram (WEB_ADMIN > FACILITY_MANAGER >
     COACH > MEMBER), backend `RoleChecker` deps, coach ownership guard
  8. **Testing** -- how to run pytest, what each test file covers, how to add
     a new test (conftest pattern)
  9. **Dev Tools** -- devtools page, OAuth backend-only flow, env vars
  10. **Configuration** -- `config.yaml`, `.secrets/`, env overrides
- [ ] **4.2** -- Use `AGENTS.md` as source material; verify every claim
  against the actual code.
- [ ] **4.3** -- Add a link to this file from `readme.md` and `AGENTS.md`.
- [ ] **4.4** -- Target length: 200-350 lines.

---

## 5. README-Frontend.md

Create a thorough frontend walkthrough in `docs/README-Frontend.md`.

- [ ] **5.1** -- Write the file with these sections:
  1. **Overview** -- React 19 + TypeScript + Vite SPA, PrimeReact 11 + Aura
  2. **Provider Stack** -- PrimeReactProvider -> ThemeProvider -> AuthProvider
  3. **Routing** -- public routes vs authenticated routes, RouteGuard, AppLayout
  4. **Auth** -- Google OAuth flow, JWT storage, `getRoleFromToken`, login
  5. **API Layer** -- `client.ts` (Bearer, 401-retry-refresh), per-entity wrappers
  6. **Pages** -- every page group with file path, what it renders, role-gating
  7. **Nav & Role Filtering** -- `nav.ts` item set, `hasRole` rank-based
  8. **Theming** -- Aura preset, `ThemeSwitch`, `@primeuix/themes`
  9. **Build & Lint** -- `npm run build`, `npm run lint` (oxlint), lazy chunks
  10. **Testing** -- how to run vitest, what each test file covers
- [ ] **5.2** -- Read every `frontend/src/pages/*.tsx` file and verify page
  descriptions match the actual code. Fix any discrepancies.
- [ ] **5.3** -- Add a link to this file from `readme.md` and `AGENTS.md`.
- [ ] **5.4** -- Target length: 200-350 lines.

---

## 6. README Line Budget

Ensure `readme.md` stays under 500 lines.

- [ ] **6.1** -- After completing Tasks 2-5, count lines in `readme.md`.
  If over 500, identify sections that can be collapsed (e.g., move the full
  endpoint table into `docs/README-Backend.md` and keep only a summary).
- [ ] **6.2** -- Restructure as needed: use collapsible `<details>` sections
  or move verbose tables into linked docs.
- [ ] **6.3** -- Commit the final `readme.md` with line count verified.

---

## 7. Cross-Linking

Ensure every markdown file links to related files and the root README.

- [ ] **7.1** -- Audit every `.md` file in the repo root and `docs/` for
  outgoing links. Each should link to `readme.md` at least once.
- [ ] **7.2** -- `readme.md` must link to:
  - `AGENTS.md` (already there)
  - `docs/README-Backend.md` (from Task 4)
  - `docs/README-Frontend.md` (from Task 5)
  - `docs/readme.md` (docs index)
  - `docs/history/` (completed plans)
  - `docs/flow/README.md` and `docs/sequence/README.md`
- [ ] **7.3** -- `AGENTS.md` must link to `readme.md`, `docs/README-Backend.md`,
  `docs/README-Frontend.md`.
- [ ] **7.4** -- `docs/README-Backend.md` must link to `readme.md`, `AGENTS.md`,
  `docs/README-Frontend.md`.
- [ ] **7.5** -- `docs/README-Frontend.md` must link to `readme.md`, `AGENTS.md`,
  `docs/README-Backend.md`.
- [ ] **7.6** -- `docs/flow/README.md` and `docs/sequence/README.md` must each
  link to the root README and `docs/index.md`.
- [ ] **7.7** -- `docs/index.md` should serve as a docs hub linking to all
  docs/ files. Update it.
- [ ] **7.8** -- Run `uv run python docs/update_index.py` to regenerate
  `docs/index.md` after all moves. Verify it picks up the new files.

---

## 8. Backend Test Coverage (target: 80%)

- [ ] **8.1** -- Add `pytest-cov` to dev deps: `uv add --dev pytest-cov`.
- [ ] **8.2** -- Run `uv run pytest --cov=src --cov-report=term-missing` and
  record the baseline percentage. Identify uncovered modules/functions.
- [ ] **8.3** -- Write tests to cover the gaps. Priority order:
  1. `src/encryption.py` (encrypt/decrypt round-trip, hash, edge cases)
  2. `src/util/configs.py` (Config loading, env overrides)
  3. `src/util/ical.py` (iCal builder: events, escaping, CRLF)
  4. `src/util/dates.py` (parse_date, start_of_week, week/month ranges)
  5. `src/routes/event_routes.py` (capacity edge cases, bulk ops, hard delete)
  6. `src/routes/schedule_routes.py` (cancel, iCal content)
  7. `src/routes/form_routes.py` (submission list, PDF export)
  8. `src/routes/message_routes.py` (inbox, mark read, send, hard delete)
  9. `src/middleware/logging.py` (request logging, correlation IDs)
  10. `src/roles/role_checker.py` (hierarchy enforcement)
- [ ] **8.4** -- After each batch of new tests, re-run coverage. Log progress
  in a coverage report comment in `tests/README.md`.
- [ ] **8.5** -- Reach 80% overall coverage on `src/`. Run final
  `uv run pytest --cov=src --cov-report=term-missing` and commit the result.
- [ ] **8.6** -- Add a coverage badge or percentage note to `readme.md`.

---

## 9. Frontend Test Coverage (target: 80%)

- [ ] **9.1** -- Add vitest + testing-library to dev deps:
  `cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8`.
- [ ] **9.2** -- Create `frontend/vitest.config.ts` with jsdom environment and
  coverage provider configuration.
- [ ] **9.3** -- Add `"test"` and `"coverage"` scripts to `frontend/package.json`.
- [ ] **9.4** -- Create `frontend/src/test-setup.ts` with global test setup
  (mock `window.matchMedia`, mock `fetch`, etc.).
- [ ] **9.5** -- Run baseline coverage: `npm run coverage`. Record the starting
  percentage. Identify uncovered files.
- [ ] **9.6** -- Write tests in priority order:
  1. **Pure logic**: `src/auth/tokens.ts`, `src/auth/types.ts` (ROLE_RANK),
     `src/api/client.ts` (fetch wrapper, 401 handling)
  2. **Nav filtering**: `src/layout/nav.ts` (item filtering by role)
  3. **Page components**: smoke-test each page renders without crashing
     (wrap in `MemoryRouter`, provide mock auth context)
  4. **Form components**: `EntityFormDialog`, `ThemeSwitch`, `EmptyState`
  5. **API wrappers**: `src/api/events.ts`, `src/api/schedules.ts`,
     `src/api/forms.ts`, `src/api/messages.ts`, `src/api/users.ts`,
     `src/api/public.ts` (mock fetch, verify call shapes)
- [ ] **9.7** -- Reach 80% overall coverage on `frontend/src/`. Run final
  coverage report and commit the result.

---

## 10. Docstring & Comment Sweep

Ensure all methods have valid docstrings or function comments.

- [ ] **10.1** -- Python: run `uv add --dev interrogate` then
  `uv run interrogate src/ -v --fail-under 80` to measure current docstring
  coverage. Record the baseline.
- [ ] **10.2** -- Add docstrings to all uncovered Python functions/methods.
  Follow Google-style docstring format. Include:
  - One-line summary
  - Args section (for non-trivial parameters)
  - Returns section (for non-trivial returns)
  - Raises section (where applicable)
- [ ] **10.3** -- Frontend: add JSDoc comments to all exported functions,
  components, and interfaces. Format:
  ```
  /** Brief description of what this component/function does. */
  ```
- [ ] **10.4** -- Re-run `uv run interrogate src/ -v --fail-under 80` and
  commit the result.
- [ ] **10.5** -- Add `interrogate` config to `pyproject.toml`:
  ```toml
  [tool.interrogate]
  ignore-init-module = true
  ignore-private = true
  fail-under = 80
  ```

---

## 11. File-Header Documentation

Every source file must have a top-of-file comment explaining its contents.

- [ ] **11.1** -- Python: verify every `.py` file in `src/` has a module
  docstring (first non-comment line). Most already do -- fill gaps.
- [ ] **11.2** -- TypeScript/TSX: add a header comment block to every
  `frontend/src/**/*.ts` and `frontend/src/**/*.tsx` file:
  ```
  /**
   * Brief description of what this file contains and its role in the app.
   */
  ```
- [ ] **11.3** -- CSS: add a header comment to `frontend/src/index.css` and
  any component-specific CSS files.
- [ ] **11.4** -- Verify no generated or vendored files were accidentally
  annotated (skip `dist/`, `node_modules/`, `__pycache__/`).

---

## 12. Final Repo-Wide Audit

Run a final sweep to confirm everything is in order.

- [ ] **12.1** -- `uv run ruff check .` + `uv run ruff format .` -- clean.
- [ ] **12.2** -- `uv run pyright` -- 0 errors.
- [ ] **12.3** -- `uv run pytest --cov=src --cov-report=term-missing` --
  80%+ coverage, all tests pass.
- [ ] **12.4** -- `uv run interrogate src/ -v --fail-under 80` -- passes.
- [ ] **12.5** -- `cd frontend && npm run lint` -- clean.
- [ ] **12.6** -- `cd frontend && npm run build` -- passes.
- [ ] **12.7** -- `cd frontend && npm run coverage` -- 80%+ coverage.
- [ ] **12.8** -- `readme.md` under 500 lines.
- [ ] **12.9** -- Every `.md` file links to `readme.md` and at least one
  other doc file (no orphaned pages).
- [ ] **12.10** -- `git status` clean (no uncommitted changes).
- [ ] **12.11** -- Create a PR from `chore/verification-sweep` to `main`.
  Title: `chore: verification sweep -- docs, tests, docstrings, coverage`.
