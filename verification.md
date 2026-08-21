# Verification & Polish Plan

Cross-cutting quality sweep after Phases A-J complete. Each numbered task is
a separate **phase** with its own Git branch and PR. Tick checkboxes as you go.
One commit per logical sub-task.

**RULE: NEVER bypass git branch protection.** Every phase MUST follow this flow:
1. Create branch `chore/<phase-slug>` from `main`
2. Commit changes to that branch only
3. Push the branch
4. Generate PR title + description (do NOT actually create the PR)

Do NOT commit directly to `main`. Do NOT open actual PRs — only generate the title and description.

**Branch naming convention**: `chore/<phase-slug>` — e.g. `chore/verify-audit`.

**PR template**: every phase ends with a PR title + description (template below).

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
| Coverage baselines | Unknown — need measurement before improvement |

---

## Phase V1 — Todo/Plan Completeness Audit

**Branch**: `chore/verify-audit` (from `main`)

Verify every item marked complete in the todo files actually ships in
the codebase.

- [x] **1.1** — Diff `missing-features-todo.md` (all `- [x]` items) against
  `missing-features-done.md` table rows. Every ticked todo item must have a
  corresponding commit hash in the done file. Report any gaps.
- [x] **1.2** — Diff `frontend-todo.md` / `frontend-done.md` the same way.
  Report gaps.
- [x] **1.3** — Diff `pdf-todo.md` / `pdf-done.md` the same way. Report gaps.
- [x] **1.4** — For each done-file commit hash, verify the commit exists on
  `main` (`git log --oneline | findstr <hash>`). Flag any orphaned references.
- [x] **1.5** — Spot-check three random done-file entries by reading the
  actual file/endpoint the commit claims to deliver and confirming the code is
  present on `main`.
- [x] **1.6** — Commit audit findings to `chore/verify-audit`, push, and generate PR title + description.

### PR Title

`chore: audit todo/done plan completeness`

### PR Description

# Summary

Cross-references every `- [x]` item in the three todo/done file pairs against
the actual commit history and codebase on `main`, ensuring nothing was
checked off but never shipped.

## What's Included

- **1.1** — Diff of `missing-features-todo.md` vs `missing-features-done.md`.
- **1.2** — Diff of `frontend-todo.md` vs `frontend-done.md`.
- **1.3** — Diff of `pdf-todo.md` vs `pdf-done.md`.
- **1.4** — Commit-hash verification (`git log`) for every done-file hash.
- **1.5** — Spot-check of three random done entries against live code.

## Verification

- Audit report committed as `docs/history/audit-report.md` (or inline in PR body).
- All done-file hashes resolve to real commits on `main`.

## Notes

- Any gaps discovered here become follow-up issues before proceeding.

---

## Phase V2 — Consolidate ToDo/Done/Plan Files into docs/

**Branch**: `chore/file-consolidation` (from `main`)

Move all plan-tracking files out of the repo root into `docs/` so the root
stays clean for the README and AGENTS.md.

- [x] **2.1** — Create `docs/history/` subdirectory for completed plan pairs.
- [x] **2.2** — `git mv` completed pairs into `docs/history/`:
  - `missing-features-todo.md` + `missing-features-done.md`
  - `frontend-todo.md` + `frontend-done.md`
  - `pdf-todo.md` + `pdf-done.md`
- [x] **2.3** — `git mv docs/TODO.md docs/history/legacy-todo.md` and
  `git mv docs/plan.md docs/history/legacy-plan.md`.
- [x] **2.4** — `git mv docs/layout.txt docs/history/layout.txt` (the
  original plan input).
- [x] **2.5** — Move `launch-json.md` and `opencode-bots.md` into `docs/`
  (optional project notes, not todo/done — direct `docs/` not `docs/history/`).
- [x] **2.6** — Update `docs/update_index.py` if it references any moved
  filenames. Run `uv run python docs/update_index.py` and confirm
  `docs/index.md` regenerates without errors.
- [x] **2.7** — Commit, push, and generate PR title + description.

### PR Title

`chore: consolidate plan/todo/done files into docs/`

### PR Description

# Summary

Moves all completed plan-tracking files (todo/done pairs, legacy plan,
layout input) from the repo root into `docs/history/`, keeping the root
clean for `readme.md` and `AGENTS.md`.

## What's Included

- **2.1** — Created `docs/history/` directory.
- **2.2** — Moved 3 completed todo/done pairs into `docs/history/`.
- **2.3** — Moved `docs/TODO.md` and `docs/plan.md` into `docs/history/`.
- **2.4** — Moved `docs/layout.txt` into `docs/history/`.
- **2.5** — Moved `launch-json.md` and `opencode-bots.md` into `docs/`.
- **2.6** — Updated `docs/update_index.py`; regenerated `docs/index.md`.

## Verification

- `git status` clean after moves.
- `uv run python docs/update_index.py` runs without errors.
- `docs/index.md` includes all new file references.
- No broken links in moved files.

## Notes

- `AGENTS.md` stays at root (agent tooling expects it there).

---

## Phase V3 — Root README Quickstart

**Branch**: `chore/readme-quickstart` (from `main`)

Add a "How To Get Started In Under Ten Minutes" section to `readme.md`.

- [x] **3.1** — Draft the section with these subsections:
  - **Prerequisites** (Python 3.14+, uv, Node 18+, Google OAuth credentials)
  - **Clone + Install** (`uv sync --dev` + `cd frontend && npm install`)
  - **Configure** (copy `client_secret.sample.txt`, edit `config.yaml`)
  - **Run** (`uv run python main.py` + `npm run dev` — two terminals)
  - **Verify** (open `http://localhost:5173`, click Explore venues / Sign in)
  - **Run the tests** (`uv run pytest` + `npm run test`)
- [x] **3.2** — Ensure the section uses copy-pasteable code blocks and avoids
  jargon. Time a fresh clone on a clean machine to validate "under ten minutes."
- [x] **3.3** — Insert the section after the "Getting Started" heading (item 5
  of the existing structure), before "Development."
- [x] **3.4** — Commit, push, and generate PR title + description.

### PR Title

`docs: add "Get Started In Under Ten Minutes" quickstart`

### PR Description

# Summary

Adds a copy-pasteable quickstart section to the root `readme.md` so new
contributors can go from zero to running server + frontend in under ten
minutes.

## What's Included

- **3.1** — Drafted Prerequisites, Clone+Install, Configure, Run, Verify,
  Run the Tests subsections.
- **3.2** — Validated with a fresh clone timing test.
- **3.3** — Inserted at the correct position in the existing README structure.

## Verification

- Fresh clone + `uv sync --dev` + `npm install` + `uv run python main.py` +
  `npm run dev` completes in < 10 minutes on a clean machine.
- All code blocks are copy-pasteable (no smart quotes, no line wrapping).
- `uv run pytest` and `npm run test` pass after following the steps.

## Notes

- This is a docs-only change; no code modified.

---

## Phase V4 — README-Backend.md

**Branch**: `chore/readme-backend` (from `main`)

Create a thorough backend walkthrough in `docs/README-Backend.md`.

- [x] **4.1** — Write the file with these sections:
  1. **Overview** — FastAPI app, entry point, config, encryption, OAuth
  2. **Architecture** — `main.py` -> routers -> data layer -> SQLite; role
     hierarchy; AES-256-GCM PII encryption
  3. **Data Layer Pattern** — 3-file convention (model/interface/sqlite),
     guarded migrations, FK conventions
  4. **Routers** — every router with endpoints, auth deps, guard patterns
  5. **Self-Service Endpoints** — member register/reschedule/cancel/iCal,
     coach event management, staff messaging, profile correspondence
  6. **Public Endpoints** — `/public/*` with view params, event detail, live
     capacity
  7. **Roles & Guards** — hierarchy diagram (WEB_ADMIN > FACILITY_MANAGER >
     COACH > MEMBER), backend `RoleChecker` deps, coach ownership guard
  8. **Testing** — how to run pytest, what each test file covers, how to add
     a new test (conftest pattern)
  9. **Dev Tools** — devtools page, OAuth backend-only flow, env vars
  10. **Configuration** — `config.yaml`, `.secrets/`, env overrides
- [x] **4.2** — Use `AGENTS.md` as source material; verify every claim
  against the actual code.
- [x] **4.3** — Add a link to this file from `readme.md` and `AGENTS.md`.
- [x] **4.4** — Target length: 200-350 lines.
- [x] **4.5** — Commit, push, and generate PR title + description.

### PR Title

`docs: add comprehensive backend README walkthrough`

### PR Description

# Summary

Adds `docs/README-Backend.md`, a thorough walkthrough of the FastAPI backend
covering architecture, data layer patterns, all 12 routers, role guards,
encryption, testing, and configuration.

## What's Included

- **4.1** — 10-section backend walkthrough with architecture diagrams,
  router-by-router endpoint tables, data layer conventions, and role
  hierarchy documentation.
- **4.2** — Every claim verified against source code on `main`.
- **4.3** — Cross-linked from `readme.md` and `AGENTS.md`.

## Verification

- All endpoint paths, function names, and file paths referenced in the doc
  exist in the codebase.
- Links from `readme.md` and `AGENTS.md` resolve correctly.

## Notes

- This is a docs-only change; no code modified.

---

## Phase V5 — README-Frontend.md

**Branch**: `chore/readme-frontend` (from `main`)

Create a thorough frontend walkthrough in `docs/README-Frontend.md`.

- [x] **5.1** — Write the file with these sections:
  1. **Overview** — React 19 + TypeScript + Vite SPA, PrimeReact 11 + Aura
  2. **Provider Stack** — PrimeReactProvider -> ThemeProvider -> AuthProvider
  3. **Routing** — public routes vs authenticated routes, RouteGuard, AppLayout
  4. **Auth** — Google OAuth flow, JWT storage, `getRoleFromToken`, login
  5. **API Layer** — `client.ts` (Bearer, 401-retry-refresh), per-entity wrappers
  6. **Pages** — every page group with file path, what it renders, role-gating
  7. **Nav & Role Filtering** — `nav.ts` item set, `hasRole` rank-based
  8. **Theming** — Aura preset, `ThemeSwitch`, `@primeuix/themes`
  9. **Build & Lint** — `npm run build`, `npm run lint` (oxlint), lazy chunks
  10. **Testing** — how to run vitest, what each test file covers
- [ ] **5.2** — Read every `frontend/src/pages/*.tsx` file and verify page
  descriptions match the actual code. Fix any discrepancies.
- [ ] **5.3** — Add a link to this file from `readme.md` and `AGENTS.md`.
- [ ] **5.4** — Target length: 200-350 lines.
- [ ] **5.5** — Commit, push, and generate PR title + description.

### PR Title

`docs: add comprehensive frontend README walkthrough`

### PR Description

# Summary

Adds `docs/README-Frontend.md`, a thorough walkthrough of the React 19 SPA
covering provider stack, routing, auth flow, API layer, all page components,
nav filtering, theming, build/lint, and testing.

## What's Included

- **5.1** — 10-section frontend walkthrough with provider diagram,
  page-by-page descriptions, role-gating details, and nav filtering logic.
- **5.2** — Verified every page description against actual `*.tsx` code.
- **5.3** — Cross-linked from `readme.md` and `AGENTS.md`.

## Verification

- All component names, file paths, and props referenced in the doc exist
  in the frontend source.
- Links from `readme.md` and `AGENTS.md` resolve correctly.
- `npm run build` passes (no code changes, but confirms no breakage).

## Notes

- This is a docs-only change; no code modified.

---

## Phase V6 — README Line Budget

**Branch**: `chore/readme-budget` (from `main`)

Ensure `readme.md` stays under 500 lines.

- [ ] **6.1** — After completing Phases V2-V5, count lines in `readme.md`.
  If over 500, identify sections that can be collapsed (e.g., move the full
  endpoint table into `docs/README-Backend.md` and keep only a summary).
- [ ] **6.2** — Restructure as needed: use collapsible `<details>` sections
  or move verbose tables into linked docs.
- [ ] **6.3** — Commit the final `readme.md` with line count verified.
- [ ] **6.4** — Push and generate PR title + description.

### PR Title

`docs: enforce readme.md under 500 lines`

### PR Description

# Summary

Ensures the root `readme.md` stays under 500 lines by collapsing verbose
sections and moving detailed tables into the backend/frontend README docs.

## What's Included

- **6.1** — Line count audit of `readme.md` after Phases V2-V5.
- **6.2** — Restructured sections (collapsible `<details>`, table moves).
- **6.3** — Final line count verified and committed.

## Verification

- `wc -l readme.md` (or equivalent) shows < 500 lines.
- All content preserved — just reorganized, not deleted.
- Links to `docs/README-Backend.md` and `docs/README-Frontend.md` work.

## Notes

- This phase depends on Phases V2-V5 being merged first.

---

## Phase V7 — Cross-Linking

**Branch**: `chore/cross-linking` (from `main`)

Ensure every markdown file links to related files and the root README.

- [ ] **7.1** — Audit every `.md` file in the repo root and `docs/` for
  outgoing links. Each should link to `readme.md` at least once.
- [ ] **7.2** — `readme.md` must link to:
  - `AGENTS.md` (already there)
  - `docs/README-Backend.md` (from Phase V4)
  - `docs/README-Frontend.md` (from Phase V5)
  - `docs/readme.md` (docs index)
  - `docs/history/` (completed plans)
  - `docs/flow/README.md` and `docs/sequence/README.md`
- [ ] **7.3** — `AGENTS.md` must link to `readme.md`, `docs/README-Backend.md`,
  `docs/README-Frontend.md`.
- [ ] **7.4** — `docs/README-Backend.md` must link to `readme.md`, `AGENTS.md`,
  `docs/README-Frontend.md`.
- [ ] **7.5** — `docs/README-Frontend.md` must link to `readme.md`, `AGENTS.md`,
  `docs/README-Backend.md`.
- [ ] **7.6** — `docs/flow/README.md` and `docs/sequence/README.md` must each
  link to the root README and `docs/index.md`.
- [ ] **7.7** — `docs/index.md` should serve as a docs hub linking to all
  docs/ files. Update it.
- [ ] **7.8** — Run `uv run python docs/update_index.py` to regenerate
  `docs/index.md` after all moves. Verify it picks up the new files.
- [ ] **7.9** — Commit, push, and generate PR title + description.

### PR Title

`docs: cross-link all markdown files to root README`

### PR Description

# Summary

Adds bidirectional links between every markdown file in the repo, using
`readme.md` as the hub. Ensures no orphaned documentation pages.

## What's Included

- **7.1** — Full audit of outgoing links in every `.md` file.
- **7.2** — `readme.md` links to all major doc files.
- **7.3** — `AGENTS.md` links to `readme.md`, backend/frontend READMEs.
- **7.4** — `docs/README-Backend.md` links back to hub and peers.
- **7.5** — `docs/README-Frontend.md` links back to hub and peers.
- **7.6** — `docs/flow/README.md` and `docs/sequence/README.md` linked.
- **7.7** — `docs/index.md` updated as docs hub.
- **7.8** — Regenerated `docs/index.md` via `update_index.py`.

## Verification

- Every `.md` file has at least one link to `readme.md`.
- No broken links (manual spot-check or `markdown-link-check`).
- `docs/index.md` lists all docs/ files.

## Notes

- This phase depends on Phases V2-V5 being merged first.

---

## Phase V8 — Backend Test Coverage (target: 80%)

**Branch**: `chore/backend-coverage` (from `main`)

- [ ] **8.1** — Add `pytest-cov` to dev deps: `uv add --dev pytest-cov`.
- [ ] **8.2** — Run `uv run pytest --cov=src --cov-report=term-missing` and
  record the baseline percentage. Identify uncovered modules/functions.
- [ ] **8.3** — Write tests to cover the gaps. Priority order:
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
- [ ] **8.4** — After each batch of new tests, re-run coverage. Log progress
  in a coverage report comment in `tests/README.md`.
- [ ] **8.5** — Reach 80% overall coverage on `src/`. Run final
  `uv run pytest --cov=src --cov-report=term-missing` and commit the result.
- [ ] **8.6** — Add a coverage badge or percentage note to `readme.md`.
- [ ] **8.7** — Commit, push, and generate PR title + description.

### PR Title

`test: backend unit test coverage to 80%`

### PR Description

# Summary

Expands the backend pytest suite from 15 tests to achieve 80%+ line coverage
on `src/`, adding `pytest-cov` for measurement and targeting the largest
uncovered modules first.

## What's Included

- **8.1** — Added `pytest-cov` dev dependency.
- **8.2** — Baseline coverage measurement and gap identification.
- **8.3** — New tests covering encryption, config, iCal, dates, events,
  schedules, forms, messages, middleware, and role checker.
- **8.4** — Coverage progress tracked in `tests/README.md`.
- **8.5** — Final 80%+ coverage verified with `--cov-report=term-missing`.
- **8.6** — Coverage percentage noted in `readme.md`.

## Verification

- `uv run pytest --cov=src --cov-report=term-missing` shows 80%+ overall.
- All existing + new tests pass.
- `uv run ruff check .` and `uv run pyright` clean.

## Notes

- New test files follow the existing conftest pattern (throwaway SQLite).
- Some route handlers require mock DB setup; follow existing test patterns.

---

## Phase V9 — Frontend Test Coverage (target: 80%)

**Branch**: `chore/frontend-coverage` (from `main`)

- [ ] **9.1** — Add vitest + testing-library to dev deps:
  `cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8`.
- [ ] **9.2** — Create `frontend/vitest.config.ts` with jsdom environment and
  coverage provider configuration.
- [ ] **9.3** — Add `"test"` and `"coverage"` scripts to `frontend/package.json`.
- [ ] **9.4** — Create `frontend/src/test-setup.ts` with global test setup
  (mock `window.matchMedia`, mock `fetch`, etc.).
- [ ] **9.5** — Run baseline coverage: `npm run coverage`. Record the starting
  percentage. Identify uncovered files.
- [ ] **9.6** — Write tests in priority order:
  1. **Pure logic**: `src/auth/tokens.ts`, `src/auth/types.ts` (ROLE_RANK),
     `src/api/client.ts` (fetch wrapper, 401 handling)
  2. **Nav filtering**: `src/layout/nav.ts` (item filtering by role)
  3. **Page components**: smoke-test each page renders without crashing
     (wrap in `MemoryRouter`, provide mock auth context)
  4. **Form components**: `EntityFormDialog`, `ThemeSwitch`, `EmptyState`
  5. **API wrappers**: `src/api/events.ts`, `src/api/schedules.ts`,
     `src/api/forms.ts`, `src/api/messages.ts`, `src/api/users.ts`,
     `src/api/public.ts` (mock fetch, verify call shapes)
- [ ] **9.7** — Reach 80% overall coverage on `frontend/src/`. Run final
  coverage report and commit the result.
- [ ] **9.8** — Commit, push, and generate PR title + description.

### PR Title

`test: frontend unit test coverage to 80%`

### PR Description

# Summary

Adds vitest + @testing-library/react to the frontend, scaffolds the test
infrastructure, and writes unit tests to achieve 80%+ line coverage on
`frontend/src/`.

## What's Included

- **9.1** — Installed vitest, @testing-library/react, jsdom, coverage-v8.
- **9.2** — Created `vitest.config.ts` with jsdom + coverage config.
- **9.3** — Added `test` and `coverage` scripts to `package.json`.
- **9.4** — Created `test-setup.ts` with global mocks.
- **9.5** — Baseline coverage measurement.
- **9.6** — Tests for pure logic (tokens, types, client), nav filtering,
  page component smoke tests, form components, and API wrappers.
- **9.7** — Final 80%+ coverage verified.

## Verification

- `cd frontend && npm run coverage` shows 80%+ overall.
- All tests pass (`npm run test`).
- `npm run lint` clean.
- `npm run build` passes (lazy chunks still work).

## Notes

- This is the frontend's first test infrastructure — sets the foundation
  for ongoing test coverage.

---

## Phase V10 — Docstring & Comment Sweep

**Branch**: `chore/docstring-sweep` (from `main`)

Ensure all methods have valid docstrings or function comments.

- [ ] **10.1** — Python: run `uv add --dev interrogate` then
  `uv run interrogate src/ -v --fail-under 80` to measure current docstring
  coverage. Record the baseline.
- [ ] **10.2** — Add docstrings to all uncovered Python functions/methods.
  Follow Google-style docstring format. Include:
  - One-line summary
  - Args section (for non-trivial parameters)
  - Returns section (for non-trivial returns)
  - Raises section (where applicable)
- [ ] **10.3** — Frontend: add JSDoc comments to all exported functions,
  components, and interfaces. Format:
  ```
  /** Brief description of what this component/function does. */
  ```
- [ ] **10.4** — Re-run `uv run interrogate src/ -v --fail-under 80` and
  commit the result.
- [ ] **10.5** — Add `interrogate` config to `pyproject.toml`:
  ```toml
  [tool.interrogate]
  ignore-init-module = true
  ignore-private = true
  fail-under = 80
  ```
- [ ] **10.6** — Commit, push, and generate PR title + description.

### PR Title

`docs: add docstrings to all Python functions and JSDoc to frontend exports`

### PR Description

# Summary

Adds Google-style docstrings to all Python functions/methods in `src/` and
JSDoc comments to all exported TypeScript functions, components, and
interfaces in `frontend/src/`.

## What's Included

- **10.1** — Baseline docstring coverage measured with `interrogate`.
- **10.2** — Python docstrings added (Google-style, with Args/Returns/Raises).
- **10.3** — Frontend JSDoc comments added to all exports.
- **10.4** — Final coverage verified with `interrogate`.
- **10.5** — `interrogate` config added to `pyproject.toml`.

## Verification

- `uv run interrogate src/ -v --fail-under 80` passes.
- `uv run ruff check .` clean (no docstring-related warnings).
- All JSDoc comments are syntactically valid.

## Notes

- No code logic changed — comments and docstrings only.

---

## Phase V11 — File-Header Documentation

**Branch**: `chore/file-headers` (from `main`)

Every source file must have a top-of-file comment explaining its contents.

- [ ] **11.1** — Python: verify every `.py` file in `src/` has a module
  docstring (first non-comment line). Most already do — fill gaps.
- [ ] **11.2** — TypeScript/TSX: add a header comment block to every
  `frontend/src/**/*.ts` and `frontend/src/**/*.tsx` file:
  ```
  /**
   * Brief description of what this file contains and its role in the app.
   */
  ```
- [ ] **11.3** — CSS: add a header comment to `frontend/src/index.css` and
  any component-specific CSS files.
- [ ] **11.4** — Verify no generated or vendored files were accidentally
  annotated (skip `dist/`, `node_modules/`, `__pycache__/`).
- [ ] **11.5** — Commit, push, and generate PR title + description.

### PR Title

`docs: add file-header documentation to all source files`

### PR Description

# Summary

Adds top-of-file docstrings/comments to every source file in the repo
(Python modules, TypeScript/TSX files, CSS files) explaining what each
file contains and its role in the app.

## What's Included

- **11.1** — Python module docstrings verified/added in `src/`.
- **11.2** — TypeScript/TSX header comments added to all 57 files in
  `frontend/src/`.
- **11.3** — CSS header comments added to `index.css` and component styles.
- **11.4** — Verified no generated/vendored files were annotated.

## Verification

- Every `.py` in `src/` has a module docstring as first non-comment line.
- Every `.ts`/`.tsx` in `frontend/src/` has a `/** ... */` header block.
- No headers in `dist/`, `node_modules/`, `__pycache__/`.

## Notes

- No code logic changed — file headers only.

---

## Phase V12 — Final Repo-Wide Audit

**Branch**: `chore/final-audit` (from `main`)

Run a final sweep to confirm everything is in order.

- [ ] **12.1** — `uv run ruff check .` + `uv run ruff format .` — clean.
- [ ] **12.2** — `uv run pyright` — 0 errors.
- [ ] **12.3** — `uv run pytest --cov=src --cov-report=term-missing` —
  80%+ coverage, all tests pass.
- [ ] **12.4** — `uv run interrogate src/ -v --fail-under 80` — passes.
- [ ] **12.5** — `cd frontend && npm run lint` — clean.
- [ ] **12.6** — `cd frontend && npm run build` — passes.
- [ ] **12.7** — `cd frontend && npm run coverage` — 80%+ coverage.
- [ ] **12.8** — `readme.md` under 500 lines.
- [ ] **12.9** — Every `.md` file links to `readme.md` and at least one
  other doc file (no orphaned pages).
- [ ] **12.10** — `git status` clean (no uncommitted changes).
- [ ] **12.11** — Commit, push, and generate PR title + description.

### PR Title

`chore: final verification sweep — all checks pass`

### PR Description

# Summary

Final repo-wide audit confirming all verification goals are met: lint
clean, typecheck clean, 80%+ test coverage (backend + frontend), docstring
coverage passing, all markdown files cross-linked, README under 500 lines.

## What's Included

- **12.1** — Ruff lint + format clean.
- **12.2** — Pyright typecheck clean (0 errors).
- **12.3** — Backend pytest at 80%+ coverage.
- **12.4** — Interrogate docstring coverage passing.
- **12.5** — Frontend oxlint clean.
- **12.6** — Frontend build passes.
- **12.7** — Frontend vitest at 80%+ coverage.
- **12.8** — `readme.md` under 500 lines.
- **12.9** — All markdown files cross-linked.
- **12.10** — Working tree clean.

## Verification

- Every check item above is a pass/fail gate. All must pass.
- PR is the final gate before considering the verification sweep complete.

## Notes

- This PR merges last — it is the confirmation that all prior phases landed
  correctly and the repo is in its final state.

