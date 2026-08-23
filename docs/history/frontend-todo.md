# Swimlane Frontend TODO

Build a React + TypeScript UI for the Swimlane FastAPI backend, styled with PrimeReact and PrimeIcons.

**Stack**: React 19 + TypeScript + Vite + PrimeReact (PrimeIcons, PrimeFlex). Backend base URL: `http://127.0.0.1:8000`.

## Backend Integration Prerequisites (before/parallel with UI work)

The FastAPI app needs two small accommodations for a browser SPA:

- [x] **CORS**: add CORS middleware in `main.py` (allow the frontend origin) if the SPA is served from a different origin. Avoid in dev by using a Vite proxy (see Phase 1).
- [x] **OAuth callback hand-off**: `GET /auth/callback` currently returns a JSON body (`access_token`, `refresh_token`, `user`). Decide one:
  - Extend `auth_callback` to redirect to the SPA with tokens appended, e.g. `GET {FRONTEND_URL}/auth/callback?access_token=...&refresh_token=...` — DONE: `auth_callback` now redirects with `access_token`/`refresh_token`/`user` (JSON) query params; `frontend_url` in `config.yaml` (env override `FRONTEND_URL`).
  - COMMENT OUT JSON and have the SPA open `/login` in a popup and poll the session (more complex).
- [x] Confirm whether `/me` is needed: it returns the raw user row (encrypted PII fields) — use the Google `user` object from the login response for profile display instead. — Confirmed: frontend stores the Google `user` object from the callback; `/me` not needed.

## Phase 1 — Scaffolding

- Git Branch = `feature/scaffolding`

- 1.1 [x] Create `frontend/` via `npm create vite@latest frontend -- --template react-ts`
- 1.2 [x] Install deps: `react`, `react-dom`, `react-router-dom`
- 1.3 [x] Install UI deps: `primereact`, `primeicons`, `primeflex`
- 1.4 [x] `vite.config.ts`: add dev proxy so `fetch("/api/...")` → `http://127.0.0.1:8000/...` (avoids CORS in dev)
- 1.5 [x] `.env` / `.env.example`: `VITE_API_URL` (default `http://127.0.0.1:8000`)
- 1.6 [x] `src/api/client.ts`: fetch wrapper — prepends `VITE_API_URL`, adds `Authorization: Bearer <token>`, JSON parse, error normalization (`{status, detail}`), 401 handling (clears token, fires `swimlane:auth-unauthorized`; refresh/redirect in Phase 3)
- 1.7 [x] tsconfig strict mode; `paths` alias `@/*` → `src/*`
- 1.8 [x] Clean default Vite boilerplate (App.css, logos)
- 1.9 [x] git commit
- 1.9.1 [x] provide ONLY a PR title and a PR Description

## Phase 2 — Theming (dark / light / system)

Only continue if previous commit was merged into main branch.

- 2.0 [x] Set Git Branch to `feature/theming`

- 2.1 [x] Import PrimeReact theme styles: light + dark variants (e.g. `aura-light` / `aura-dark`) plus `primeicons.css` and `primeflex.css` — PrimeReact 11 replaced CSS themes with `@primeuix/themes` presets; installed `@primeuix/themes` and wired the `Aura` preset via the v11 `ThemeProvider` (`darkModeSelector` drives dark scheme). `primeicons.css` + `primeflex.css` imported in `main.tsx`.
- 2.2 [x] `src/theme/ThemeContext.tsx`: `Theme = "light" | "dark" | "system"`; provider state — plus `src/theme/theme-context.ts` holding the context/hook/type (Fast Refresh lint).
- 2.3 [x] Resolve effective theme from `window.matchMedia("(prefers-color-scheme: dark)")` when `system`
- 2.4 [x] Toggle by swapping the active theme stylesheet (or `PrimeReact.setTheme`) and setting `data-theme` on `<html>` — v11: `darkModeSelector` is `system` for OS-follow, `[data-theme='dark']` for forced modes; `data-theme` + `color-scheme` set on `<html>`.
- 2.5 [x] Persist user override in `localStorage["theme"]`; default to `system`
- 2.6 [x] Listen to `matchMedia` change events so `system` tracks the OS live
- 2.7 [x] Theme switch control in the topbar: `pi-sun` / `pi-moon` (and a `system` option in a menu)
- 2.8 [x] git commit
- 2.9 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 3 — Authentication

Only continue if previous commit was merged into main branch.

- 3.0 [x] Set Git Branch to `feature/authentication`

- 3.1 [x] `src/auth/AuthContext.tsx`: `user`, `accessToken`, `refreshToken`, `loading`, `login()`, `logout()`, `hasRole(role)` — plus `src/auth/auth-context.ts` (context/hook, Fast Refresh) and `src/auth/types.ts` (`User`, `UserRole`, `ROLE_RANK`)
- 3.2 [x] Token storage helper (`src/auth/tokens.ts`): localStorage access + refresh; clear on logout — also stores the Google `user` object and decodes the JWT payload for `hasRole`
- 3.3 [x] Auto token refresh: on 401 from `api/client.ts`, call `POST /refresh` with refresh token, retry original request; hard redirect to login if refresh fails
- 3.4 [x] `login()`: `window.location.href = "${VITE_API_URL}/login"` (Google consent screen) — uses `/api/login` via the Vite proxy when `VITE_API_URL` is unset
- 3.5 [x] `/auth/callback` page: read `access_token` / `refresh_token` (and `user`) from URL params (per prerequisite), store them, redirect to `/` — `AuthCallbackPage.tsx`; minimal `BrowserRouter` with `/auth/callback` + `*` routes (full router in Phase 6.4)
- 3.6 [x] `logout()`: call `GET /logout`, clear tokens, redirect to `/login` — best-effort `GET {apiBaseUrl}/logout` (no access token needed) then local clear + redirect
- 3.7 [x] `RouteGuard` component: redirects to `/login` when unauthenticated; supports `requiredRole` prop — `src/auth/RouteGuard.tsx`; also shows a spinner while `loading`; wraps the main app route
- 3.8 [x] Login page: centered card, "Sign in with Google" button (`pi-google`), app title, loading state while checking stored token — `src/auth/LoginPage.tsx`, route `/login`; redirects to `/` when already authenticated
- 3.9 [x] git commit
- 3.9.1 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 4 — API types and endpoint modules

Only continue if previous commit was merged into main branch.

- 4.0 [x] Set Git Branch to `feature/api-types`

- 4.1 [x] `src/api/types.ts`: TS interfaces for `Frequency`, `Facility`, `Event`, `Venue`, `Schedule`, `FormQuestion`, `FacilityRule`, `FormSubmission`, `FormResponse`, `FacilityForm`, `User`, `Role` — mirrors backend Pydantic models; `Role` is the canonical union and `src/auth/types.ts` now aliases `UserRole = Role`
- 4.2 [x] `src/api/auth.ts`: `login`, `logout`, `refresh`, `me` — `login()` returns the Google OAuth URL (caller assigns `window.location.href`); `logout`/`refresh`/`me` wrap the endpoints
- 4.3 [x] `src/api/frequencies.ts`: `list`, `get`, `create`, `update`, `delete`, `hardDelete`, `createBulk`, `deleteBulk`, `hardDeleteBulk`
- 4.4 [x] `src/api/facilities.ts`, `src/api/events.ts`, `src/api/venues.ts`, `src/api/schedules.ts`: same CRUD shape
- 4.5 [x] `src/api/forms.ts`: `getFacilityForm`, `submitForm`, `getSubmissionPdf`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `hardDeleteQuestion`, `createRule`, `updateRule`, `deleteRule`, `hardDeleteRule` (+ bulk variants) — `getSubmissionPdf` fetches with `responseType: 'blob'` (new `client.ts` option); question/rule bulk deletes accept `ids: number[]` and map to `{form_question_id}`/`{rule_id}` bodies; added input DTOs (`*Input`, `FormResponseInput`, `FormSubmissionInput`) + shared `MessageResponse` to `api/types.ts`
- 4.6 [x] Shared `src/api/crud.ts` factory to avoid duplicating the same CRUD method bodies per entity — `createCrudApi<Entity, Input>(basePath)` returns a `CrudApi` object (`list`/`get`/`create`/`update`/`delete`/`hardDelete`/`createBulk`/`deleteBulk`/`hardDeleteBulk`); frequencies/facilities/events/venues/schedules now delegate to it
- 4.7 [x] git commit
- 4.8 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 5 — Shared CRUD building blocks

Only continue if previous commit was merged into main branch.

- 5.0 [x] Set Git Branch to `feature/crud-building-blocks`

- 5.1 [x] `src/components/EntityDataTable.tsx`: PrimeReact `DataTable` (pagination, global filter `pi-search`, sortable columns, row actions) �?" v11 compound API: `DataTable.Root`/`Header`/`Table`/`TableContainer`/`THead`/`THeadRow`/`THeadCell`/`Sort`/`SortIndicator`/`TBody`/`Row`/`Cell`/`EmptyTBody`/`Loading`/`Pagination`; global filter via `IconField.Root`+`IconField.Inset`; custom paginator (prev/next `Button`, rows-per-page `<select>`); `DataTablePaginationExposes` render-prop typing
- 5.2 [x] `src/components/EntityFormDialog.tsx`: PrimeReact `Dialog` + `InputText`/`InputNumber`/`Checkbox`/`Dropdown` form with validation �?" v11 compound `Dialog` (`Root`/`Portal`/`Positioner`/`Content`/`Header`/`Title`/`HeaderActions`/`Close`/`Footer`), `InputNumber` (`Root`/`Input`), `Checkbox` (`Root`/`Box`/`Indicator`), `Select` (Dropdown�??s v11 name; `Root`/`Trigger`/`Value`/`Indicator`/`Portal`/`Positioner`/`Popup`/`List`); field schema `EntityFormField<T>` (text/number/checkbox/select) with required/min/max/minLength/custom validation; submit disabled while `submitting`
- 5.3 [x] `src/components/ConfirmDelete.tsx`: `ConfirmDialog` (soft delete, `pi-trash`) + hard-delete path (`pi-times`, admin only) with typed reason �?" v11 has no `ConfirmDialog`; built on the compound `Dialog`. Renders trash (soft) + times (hard) icon buttons; hard button gated by `useAuth().hasRole(hardRole)` (default `WEB_ADMIN`); hard dialog requires a typed `reason` (`InputText`, required) passed to `onHardDelete(reason)`
- 5.4 [x] `src/components/PageHeader.tsx`: title + subtitle + "New" button (`pi-plus`) �?" `PageHeaderProps` (`title`, `subtitle?`, `onNew?`, `newLabel?`); button rendered only when `onNew` is provided
- 5.5 [x] `src/components/ToastProvider.tsx`: global `Toast` for success (`pi-check`) / error (`pi-times-circle`) feedback �?" v11 `Toaster.Root`/`Portal`/`Region` (Region render-prop iterates `toaster.toasts` -> `Toast.Root` with `Toast.Content`/`Icon`/`Message`/`Title`/`Description`/`Close`); helpers in `src/toast/toast-context.ts`: `showToast`/`showToastSuccess`/`showToastError` + `useToast()` wrapping the global `toast()` function (severity shortcuts `success`/`error`)
- 5.6 [x] `src/components/EmptyState.tsx`: placeholder text when list is empty ("No facilities yet…") �?" `EmptyStateProps` (`message`, `hint?`, `icon?` default `pi-inbox`, `action?` ReactNode); centered icon + message + optional hint/action
- 5.7 [x] git commit �?" `1025d18` "feat: shared CRUD building blocks (table, form dialog, confirm delete, header, toasts, empty state)"
- 5.8 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 6 — Layout and navigation

Only continue if previous commit was merged into main branch.

- 6.0 [x] Set Git Branch to `feature/layout`

- 6.1 [x] `src/layout/AppLayout.tsx`: `Sidebar`/`Menu` (or `Menubar`) + `Topbar` + `<Outlet/>` �?" v11 compound `Sidebar` (`Layout`/`Root`/`Spacer`/`Aside`/`Panel`/`Header`/`Content`/`Group`/`GroupLabel`/`GroupContent`/`Menu`/`MenuItem`/`MenuButton`/`Footer`/`Rail`/`Main`/`Trigger`); `collapsible="icon"`; placeholder Dashboard nav item + Profile footer item; topbar (app title + `Sidebar.Trigger` collapse + `ThemeSwitch`) + `<Outlet/>` inside `Sidebar.Main`; wired in `App.tsx` via a pathless `RouteGuard` layout route with a minimal home page (full router in 6.4)
- 6.2 [x] Topbar: logo/title, theme switcher, user chip (name/avatar), logout button (`pi-sign-out`) �?" `AppLayout` topbar-right: user chip (`Avatar.Root`/`Image`/`Fallback` with Google `picture` + initials from name) + `pi-sign-out` logout `Button` (calls `useAuth().logout()`) + existing `ThemeSwitch`; logo/title already in topbar-left
- 6.3 [x] Menu items with PrimeIcons, filtered by role:
  - Dashboard `pi-home`
  - Frequencies `pi-calendar`
  - Facilities `pi-building`
  - Events `pi-bolt`
  - Venues `pi-map-marker`
  - Schedules `pi-users`
  - Signup Forms `pi-file-edit` �?" `src/layout/nav.ts` (`NAV_ITEMS`: label/icon/path/`requiredRole`); `AppLayout` filters with `useAuth().hasRole()` (hierarchical: MEMBER sees Dashboard + Signup Forms; FACILITY_MANAGER+ sees the CRUD pages), navigates via `useNavigate()`, active state via `useLocation()`; gating aligns with backend deps (writes = `facility_manager_role`, lists = `all_users`)
- 6.4 [x] Router (`src/router/index.tsx`): lazy-load routes, wrap authenticated routes in `RouteGuard` �?" `AppRouter` component: `/login` + `/auth/callback` lazy; pathless `RouteGuard` > `AppLayout` route with lazy `/` Dashboard, `/frequencies`, `/facilities`, `/events`, `/venues`, `/schedules`, `/forms`, and `*` NotFound; single `Suspense` with spinner fallback; `App.tsx` slimmed to `BrowserRouter` + `AppRouter`; page targets under `src/pages/` (DashboardPage + placeholder stubs replaced in Phases 7/8); build emits a lazy chunk per page
- 6.5 [x] Dashboard page: welcome card, role badge (`Tag`), quick links �?" `DashboardPage`: compound `Card.Root`/`Header`/`Title`/`Content` welcome card greeting by first name, `Tag` role badge (severity + label per role, read from JWT via `getRoleFromToken(accessToken)`), quick-link `Button`s built from `NAV_ITEMS` filtered by `hasRole` (excluding `/`); styles in `index.css`
- 6.6 [x] git commit �?" `f9298cc` "feat: app layout, role-filtered nav, lazy router, and dashboard"
- 6.7 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 7 — Entity CRUD pages

Only continue if previous commit was merged into main branch.

- 7.0 [x] Set Git Branch to `feature/crud-pages`

Each page: list + search, create/edit dialog, soft delete (confirm), hard delete (admin, confirm), form validation, placeholders on empty lists.

- 7.1 [x] **Frequencies** `/frequencies`: columns `name`, `day_interval`, `is_active`; form fields name (placeholder "e.g., Weekly"), day_interval (placeholder "e.g., 7 days") �?" full CRUD wired to `frequencies` API: `PageHeader` (New), `EntityDataTable` (search name/day_interval, sortable, `Tag` for is_active, edit `pi-pencil` + `ConfirmDelete` actions), `EntityFormDialog` (required validation, placeholders, is_active checkbox defaults true on create), `EmptyState` with create action, toast success/error via `showToastSuccess`/`showToastError`; also mounted `ToastProvider` in `main.tsx` (portalled `Toaster` as sibling of `App`)
- 7.2 [x] **Facilities** `/facilities`: columns `name`, `description`, `max_capacity`, `min_capacity`, `is_active`; fields with number inputs (placeholder "e.g., 50") and description textarea �?" `EntityFormDialog` gained `textarea` + `datetime` field types (v11 `Textarea`, compound `DatePicker`); FacilitiesPage: description textarea, capacity `InputNumber`s (placeholder `e.g., 50`, min bounds), nullable capacity handling, `Tag` for is_active, edit + `ConfirmDelete`, `EmptyState` with create action
- 7.3 [x] **Events** `/events`: columns `start_date_time`, `end_date_time`, `frequency_id`, `is_active`; use `Calendar` datetime picker; frequency chosen via `Dropdown` (optional) �?" v11 `Calendar` = compound `DatePicker` (`Root`/`Input`/`Trigger`/`Portal`/`Positioner`/`Popup`/`Calendar`/`Header`/`Table`/`TableHead`/`TableBody`/`Time`/`Picker`/`Footer`); EventsPage loads events + frequencies in parallel (`Promise.all`), datetime fields required + cross-field validation (end > start), frequency `Select` options from `/frequencies`, frequency name column via map; formatted datetimes via `toLocaleString()`
- 7.4 [x] **Venues** `/venues`: columns `street`, `city`, `state`, `postal_code`, `cost`, `facility_id`; facility `Dropdown` (required, from `/facilities`), cost `InputNumber` �?" VenuesPage loads venues + facilities in parallel; facility `Select` (required) with options from `/facilities` + facility-name column via map; cost `InputNumber` (placeholder "e.g., 200"); full CRUD + `ConfirmDelete` + `EmptyState` + bulk delete (natural key `facility_id` + `street`)
- 7.5 [x] **Schedules** `/schedules`: columns `venue_id`, `member_id`, `event_id`, `is_active`; venue + event `Dropdown`s; `member_id` = user `sub` (free-text, placeholder "Google sub ID") — note: no user-list endpoint exists �?" SchedulesPage loads schedules + venues + events in parallel; venue/event `Select`s (required) + label columns (venue "street, city", event formatted start datetime); `member_id` free-text required (placeholder "Google sub ID"); bulk delete (natural key `venue_id` + `member_id` + `event_id`)
- 7.6 [x] **Bulk ops** (optional per page): "Bulk delete" toolbar with selected rows (`pi-trash`), using the `/bulk` endpoints �?" `EntityDataTable` gained row selection (v11 `DataTable.Selection` render prop + controlled `selectionKeys`/`onSelectionChange` + select-all header checkbox via `Checkbox.Root`; selection column filtered out of global search); new `BulkDeleteBar` component (count pill + `Delete` button + compound `Dialog` confirm); wired into ALL five CRUD pages (frequencies, facilities, events, venues, schedules) — bulk bodies are the selected rows (backend matches natural keys: frequency/facility by `name`, event by `start_date_time`+`end_date_time`, venue by `facility_id`+`street`, schedule by `venue_id`+`member_id`+`event_id`); selection cleared on reload
- 7.7 [x] update AGENTS.md if out of date �?" checked; AGENTS.md is backend-focused and has no stale frontend references, no change needed
- 7.8 [x] git commit �?" `aa6aa8b` "feat: entity CRUD pages with role-gated actions and bulk delete"
- 7.9 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 8 — Signup Forms

Only continue if previous commit was merged into main branch.

- 8.0 [x] Set Git Branch to `feature/forms` �?" branched from `feature/crud-pages` (Phase 7 unmerged, so this branch carries Phase 7's shared components; will shrink to Phase 8-only after `feature/crud-pages` merges)

- 8.1 [x] **Member view** `/forms/facility/:facilityId`:
  - Fetch `GET /forms/{facility_id}` → render questions (`InputText` for text, `Checkbox` for checkbox; mark required)
  - Render rules as an `Accordion`/list with `pi-exclamation-circle`
  - Signature consent `Checkbox` ("I agree…") before submit (`pi-pencil`)
  - Submit via `POST /forms/{facility_id}/submit` → success toast, disable re-entry (upsert supported) �?" `FormViewPage`: loads facility + form in parallel; questions rendered per `question_type` (compound `Checkbox.Root` for checkbox, `InputText` for text) with `*` required markers + inline `small` errors (required checkbox must be checked); rules list with `pi-exclamation-circle`; consent `Checkbox` gates the `pi-pencil` submit; on success stores the returned `submission_id`, disables inputs, shows a submitted banner + "Download PDF" button; `GET /forms/facility/:id` returns only ACTIVE questions/rules
- 8.2 [x] **PDF export**: after submit, "Download PDF" button (`pi-file-pdf`) → `GET /forms/submissions/{submission_id}/pdf` fetched with Bearer token, save as blob, trigger download �?" `forms.getSubmissionPdf(submissionId)` (blob responseType, Bearer via client); object URL + `<a download>` click + revoke
- 8.3 [x] **Manager builder** `/forms/builder/:facilityId`:
  - Questions `DataTable`: `prompt`, `question_type` (`Dropdown`: Text/Checkbox), `is_required`, `sort_order`, `is_active`
  - Question create/edit dialog (same fields, placeholder prompt "e.g., Emergency contact phone number")
  - Rules `DataTable`: `title`, `content`, `sort_order`, `is_active`; rule dialog with `content` textarea
  - Soft/hard delete per row + bulk via `/forms/questions/bulk` and `/forms/rules/bulk` �?" `FormBuilderPage`: two sections (Questions/Rules) each with `PageHeader`-style section header + New button, `EntityDataTable` (search/sort/`Tag`s, edit + `ConfirmDelete`, selectable + `BulkDeleteBar`); question dialog (`prompt` placeholder "e.g., Emergency contact phone number", `question_type` select Text/Checkbox, required/sort_order/is_active checkboxes+number, defaults `text`/required/sort 0); rule dialog (`title` text, `content` textarea, `sort_order`, `is_active`); bulk deletes send ids via `deleteQuestionsBulk`/`deleteRulesBulk`
- 8.4 [x] git commit �?" `9597fdf` "feat: signup form member view, PDF export, and manager builder" (7 files, +1019/−9)
- 8.5 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 9 — Polish and validation

Only continue if previous commit was merged into main branch.

- 9.0 [x] Set Git Branch to `feature/validation` — branched from `feature/forms` (Phases 7/8 unmerged, so this branch carries their commits too)

- 9.1 [x] Shared form validation (required fields, number ranges); inline `small` error text via PrimeReact `FloatLabel`/validation state — already implemented in `EntityFormDialog` (required + `min`/`max` for numbers + `minLength` + custom `validate`, each with inline `small` error under the field); verified, no change needed
- 9.2 [x] Loading skeletons (`Skeleton`) on all list/table pages while fetching — `EntityDataTable` `DataTable.Loading` now renders skeleton row placeholders (`primereact/skeleton`, `animation="wave"`, per-column bars) instead of the spinner; applies to every list/table page via the shared component
- 9.3 [x] Confirm dialog copy distinguishes soft vs hard delete ("Permanently delete?" warning icon `pi-exclamation-triangle`) — `ConfirmDelete` body now leads with an icon chip: `pi-trash` for soft, `pi-exclamation-triangle` (danger-styled) for hard
- 9.4 [x] 404 / error page (`pi-exclamation-circle`) and error toasts from normalized API errors — new shared `ErrorPage` component (`src/pages/ErrorPage.tsx`, `pi-exclamation-circle` icon + optional code/title/message/action) used by the router `*` NotFound route (404) and FormViewPage's "Form not found" branch; error toasts already flow from normalized `ApiError` everywhere
- 9.5 [x] Empty states with placeholder copy and primary action button on every list page — `EmptyState` gained `actionLabel`/`onAction` (renders a `Button`); FormsPage empty state now offers a "Manage Facilities" primary action for FACILITY_MANAGER+; all other list pages already had primary actions
- 9.6 [x] Responsive: collapse menu to `Siderbar`/drawer on small screens — new `useMediaQuery` hook (`src/util/media-query.ts`, `useSyncExternalStore`); `AppLayout` auto-collapses the sidebar to the icon rail below 768px (`Sidebar.Root` is now controlled via `open`/`onOpenChange`, `UseSidebarOpenChangeEvent`) and re-expands above it; clicking a nav item on narrow screens closes the menu
- 9.7 [x] Accessible labels (`aria-label`) on icon-only buttons — audited all icon-only controls (nav trigger, logout, theme switch, pagination, select-all/row checkboxes, edit/manage/delete buttons, dialog closes); all already have `aria-label` (+ `title`), no changes needed
- 9.8 [x] git commit
- 9.9 [x] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

## Phase 10 — Build, verify, document

Only continue if previous commit was merged into main branch.

- 10.0 [x] Set Git Branch to `feature/document`

- 10.1 [x] `npm run build` passes with `tsc -b` (typecheck, no unused locals)
- 10.2 [x] `npm run lint` clean
- 10.3 [x] Manual smoke test against running backend: login, theme toggle, full CRUD on each entity, form submit + PDF, logout
- 10.4 [x] Verify role-gated menu/actions (MEMBER vs FACILITY_MANAGER vs WEB_ADMIN)
- 10.5 [x] Write `frontend/README.md`: run instructions (`uv run python main.py` + `npm run dev`), `VITE_API_URL` config, theme behavior
- 10.6 [x] Update root `readme.md` with frontend setup and structure
- 10.7 [x] Ensure that `AGENTS.md` has information on both the backend and the frontend aspect of this app and this it is up to date
- 10.8 [ ] Remove/fix any non-printable characters e.g. � from all markdown files
- 10.9 [ ] git commit
- 10.10 [ ] provide ONLY a PR title and a PR Description as a markdown description with the following sections:
  - Summary
  - What's Included
  - Verification
  - Notes

---

[Back to README](../../readme.md) | [Documentation Index](../index.md)
