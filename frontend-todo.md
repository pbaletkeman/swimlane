# Swimlane Frontend TODO

Build a React + TypeScript UI for the Swimlane FastAPI backend, styled with PrimeReact and PrimeIcons.

**Stack**: React 19 + TypeScript + Vite + PrimeReact (PrimeIcons, PrimeFlex). Backend base URL: `http://127.0.0.1:8000`.

## Backend Integration Prerequisites (before/parallel with UI work)

The FastAPI app needs two small accommodations for a browser SPA:

- [ ] **CORS**: add CORS middleware in `main.py` (allow the frontend origin) if the SPA is served from a different origin. Avoid in dev by using a Vite proxy (see Phase 1).
- [ ] **OAuth callback hand-off**: `GET /auth/callback` currently returns a JSON body (`access_token`, `refresh_token`, `user`). Decide one:
  - Extend `auth_callback` to redirect to the SPA with tokens appended, e.g. `GET {FRONTEND_URL}/auth/callback?access_token=...&refresh_token=...`
  - COMMENT OUT  JSON and have the SPA open `/login` in a popup and poll the session (more complex).
- [ ] Confirm whether `/me` is needed: it returns the raw user row (encrypted PII fields) — use the Google `user` object from the login response for profile display instead.

## Phase 1 — Scaffolding

- 1.1 [ ] Create `frontend/` via `npm create vite@latest frontend -- --template react-ts`
- 1.2 [ ] Install deps: `react`, `react-dom`, `react-router-dom`
- 1.3 [ ] Install UI deps: `primereact`, `primeicons`, `primeflex`
- 1.4 [ ] `vite.config.ts`: add dev proxy so `fetch("/api/...")` → `http://127.0.0.1:8000/...` (avoids CORS in dev)
- 1.5 [ ] `.env` / `.env.example`: `VITE_API_URL` (default `http://127.0.0.1:8000`)
- 1.6 [ ] `src/api/client.ts`: fetch wrapper — prepends `VITE_API_URL`, adds `Authorization: Bearer <token>`, JSON parse, error normalization (`{status, detail}`), 401 handling
- 1.7 [ ] tsconfig strict mode; `paths` alias `@/*` → `src/*`
- 1.8 b[ ] Clean default Vite boilerplate (App.css, logos)

## Phase 2 — Theming (dark / light / system)

- 2.1 [ ] Import PrimeReact theme styles: light + dark variants (e.g. `aura-light` / `aura-dark`) plus `primeicons.css` and `primeflex.css`
- 2.2 [ ] `src/theme/ThemeContext.tsx`: `Theme = "light" | "dark" | "system"`; provider state
- 2.3 [ ] Resolve effective theme from `window.matchMedia("(prefers-color-scheme: dark)")` when `system`
- 2.4 [ ] Toggle by swapping the active theme stylesheet (or `PrimeReact.setTheme`) and setting `data-theme` on `<html>`
- 2.5 [ ] Persist user override in `localStorage["theme"]`; default to `system`
- 2.6 [ ] Listen to `matchMedia` change events so `system` tracks the OS live
- 2.7 b[ ] Theme switch control in the topbar: `pi-sun` / `pi-moon` (and a `system` option in a menu)

## Phase 3 — Authentication

- 3.1 [ ] `src/auth/AuthContext.tsx`: `user`, `accessToken`, `refreshToken`, `loading`, `login()`, `logout()`, `hasRole(role)`
- 3.2 [ ] Token storage helper (`src/auth/tokens.ts`): localStorage access + refresh; clear on logout
- 3.3 [ ] Auto token refresh: on 401 from `api/client.ts`, call `POST /refresh` with refresh token, retry original request; hard redirect to login if refresh fails
- 3.4 [ ] `login()`: `window.location.href = "${VITE_API_URL}/login"` (Google consent screen)
- 3.5 [ ] `/auth/callback` page: read `access_token` / `refresh_token` (and `user`) from URL params (per prerequisite), store them, redirect to `/`
- 3.6 [ ] `logout()`: call `GET /logout`, clear tokens, redirect to `/login`
- 3.7 [ ] `RouteGuard` component: redirects to `/login` when unauthenticated; supports `requiredRole` prop
- 3.8 [ ] Login page: centered card, "Sign in with Google" button (`pi-google`), app title, loading state while checking stored token

## Phase 4 — API types and endpoint modules

- 4.1 [ ] `src/api/types.ts`: TS interfaces for `Frequency`, `Facility`, `Event`, `Venue`, `Schedule`, `FormQuestion`, `FacilityRule`, `FormSubmission`, `FormResponse`, `FacilityForm`, `User`, `Role`
- 4.2 [ ] `src/api/auth.ts`: `login`, `logout`, `refresh`, `me`
- 4.3 [ ] `src/api/frequencies.ts`: `list`, `get`, `create`, `update`, `delete`, `hardDelete`, `createBulk`, `deleteBulk`, `hardDeleteBulk`
- 4.4 [ ] `src/api/facilities.ts`, `src/api/events.ts`, `src/api/venues.ts`, `src/api/schedules.ts`: same CRUD shape
- 4.5 [ ] `src/api/forms.ts`: `getFacilityForm`, `submitForm`, `getSubmissionPdf`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `hardDeleteQuestion`, `createRule`, `updateRule`, `deleteRule`, `hardDeleteRule` (+ bulk variants)
- 4.6 [ ] Shared `src/api/crud.ts` factory to avoid duplicating the same CRUD method bodies per entity

## Phase 5 — Shared CRUD building blocks

- 5.1 [ ] `src/components/EntityDataTable.tsx`: PrimeReact `DataTable` (pagination, global filter `pi-search`, sortable columns, row actions)
- 5.2 [ ] `src/components/EntityFormDialog.tsx`: PrimeReact `Dialog` + `InputText`/`InputNumber`/`Checkbox`/`Dropdown` form with validation
- 5.3 [ ] `src/components/ConfirmDelete.tsx`: `ConfirmDialog` (soft delete, `pi-trash`) + hard-delete path (`pi-times`, admin only) with typed reason
- 5.4 [ ] `src/components/PageHeader.tsx`: title + subtitle + "New" button (`pi-plus`)
- 5.5 [ ] `src/components/ToastProvider.tsx`: global `Toast` for success (`pi-check`) / error (`pi-times-circle`) feedback
- 5.6 [ ] `src/components/EmptyState.tsx`: placeholder text when list is empty ("No facilities yet…")

## Phase 6 — Layout and navigation

- 6.1 [ ] `src/layout/AppLayout.tsx`: `Sidebar`/`Menu` (or `Menubar`) + `Topbar` + `<Outlet/>`
- 6.2 [ ] Topbar: logo/title, theme switcher, user chip (name/avatar), logout button (`pi-sign-out`)
- 6.3 [ ] Menu items with PrimeIcons, filtered by role:
  - Dashboard `pi-home`
  - Frequencies `pi-calendar`
  - Facilities `pi-building`
  - Events `pi-bolt`
  - Venues `pi-map-marker`
  - Schedules `pi-users`
  - Signup Forms `pi-file-edit`
- 6.4 [ ] Router (`src/router/index.tsx`): lazy-load routes, wrap authenticated routes in `RouteGuard`
- 6.5 [ ] Dashboard page: welcome card, role badge (`Tag`), quick links

## Phase 7 — Entity CRUD pages

Each page: list + search, create/edit dialog, soft delete (confirm), hard delete (admin, confirm), form validation, placeholders on empty lists.

- 7.1 [ ] **Frequencies** `/frequencies`: columns `name`, `day_interval`, `is_active`; form fields name (placeholder "e.g., Weekly"), day_interval (placeholder "e.g., 7 days")
- 7.2 [ ] **Facilities** `/facilities`: columns `name`, `description`, `max_capacity`, `min_capacity`, `is_active`; fields with number inputs (placeholder "e.g., 50") and description textarea
- 7.3 [ ] **Events** `/events`: columns `start_date_time`, `end_date_time`, `frequency_id`, `is_active`; use `Calendar` datetime picker; frequency chosen via `Dropdown` (optional)
- 7.4 [ ] **Venues** `/venues`: columns `street`, `city`, `state`, `postal_code`, `cost`, `facility_id`; facility `Dropdown` (required, from `/facilities`), cost `InputNumber`
- 7.5 [ ] **Schedules** `/schedules`: columns `venue_id`, `member_id`, `event_id`, `is_active`; venue + event `Dropdown`s; `member_id` = user `sub` (free-text, placeholder "Google sub ID") — note: no user-list endpoint exists
- 7.6 [ ] **Bulk ops** (optional per page): "Bulk delete" toolbar with selected rows (`pi-trash`), using the `/bulk` endpoints

## Phase 8 — Signup Forms

- 8.1 [ ] **Member view** `/forms/facility/:facilityId`:
  - Fetch `GET /forms/{facility_id}` → render questions (`InputText` for text, `Checkbox` for checkbox; mark required)
  - Render rules as an `Accordion`/list with `pi-exclamation-circle`
  - Signature consent `Checkbox` ("I agree…") before submit (`pi-pencil`)
  - Submit via `POST /forms/{facility_id}/submit` → success toast, disable re-entry (upsert supported)
- 8.2 [ ] **PDF export**: after submit, "Download PDF" button (`pi-file-pdf`) → `GET /forms/submissions/{submission_id}/pdf` fetched with Bearer token, save as blob, trigger download
- 8.3 [ ] **Manager builder** `/forms/builder/:facilityId`:
  - Questions `DataTable`: `prompt`, `question_type` (`Dropdown`: Text/Checkbox), `is_required`, `sort_order`, `is_active`
  - Question create/edit dialog (same fields, placeholder prompt "e.g., Emergency contact phone number")
  - Rules `DataTable`: `title`, `content`, `sort_order`, `is_active`; rule dialog with `content` textarea
  - Soft/hard delete per row + bulk via `/forms/questions/bulk` and `/forms/rules/bulk`

## Phase 9 — Polish and validation

- 9.1 [ ] Shared form validation (required fields, number ranges); inline `small` error text via PrimeReact `FloatLabel`/validation state
- 9.2 [ ] Loading skeletons (`Skeleton`) on all list/table pages while fetching
- 9.3 [ ] Confirm dialog copy distinguishes soft vs hard delete ("Permanently delete?" warning icon `pi-exclamation-triangle`)
- 9.4 [ ] 404 / error page (`pi-exclamation-circle`) and error toasts from normalized API errors
- 9.5 [ ] Empty states with placeholder copy and primary action button on every list page
- 9.6 [ ] Responsive: collapse menu to `Siderbar`/drawer on small screens
- 9.7 [ ] Accessible labels (`aria-label`) on icon-only buttons

## Phase 10 — Build, verify, document

- 10.1 [ ] `npm run build` passes with `tsc -b` (typecheck, no unused locals)
- 10.2 [ ] `npm run lint` clean
- 10.3 [ ] Manual smoke test against running backend: login, theme toggle, full CRUD on each entity, form submit + PDF, logout
- 10.4 [ ] Verify role-gated menu/actions (MEMBER vs FACILITY_MANAGER vs WEB_ADMIN)
- 10.5 [ ] Write `frontend/README.md`: run instructions (`uv run python main.py` + `npm run dev`), `VITE_API_URL` config, theme behavior
- 10.6 [ ] Update root `readme.md` with frontend setup and structure
