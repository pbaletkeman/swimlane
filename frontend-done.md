# Swimlane Frontend — Done

Progress log for the React + TypeScript + PrimeReact UI work tracked in `frontend-todo.md`.

## Phase 2 — Theming (dark / light / system) (complete: 2.0–2.9)

Branch: `feature/theming`

- [x] Installed `@primeuix/themes` (PrimeReact 11 ships no `resources/themes/*.css`; theming is now CSS-in-JS via `@primeuix/themes` presets + `@primeuix/styled` runtime)
- [x] `src/theme/ThemeContext.tsx` — provider component only (Fast Refresh-friendly)
- [x] `src/theme/theme-context.ts` — `Theme` type (`light | dark | system`), `ThemeContext`, `useTheme`
- [x] Wired `<ThemeProvider>` (PrimeReact v11) with the `Aura` preset; `darkModeSelector` = `"system"` (OS `prefers-color-scheme`) or `[data-theme='dark']` (forced modes)
- [x] Effective theme resolved from `window.matchMedia("(prefers-color-scheme: dark)")` when `system`
- [x] Live OS tracking: `useSyncExternalStore` subscribes to `matchMedia` `change` events, so `system` follows the OS in real time (2.6)
- [x] `data-theme` + `color-scheme` set on `<html>` per effective theme
- [x] Persist override in `localStorage["theme"]`, default `system`
- [x] `main.tsx`: wrapped app in `ThemeProvider`, imported `primeicons.css` + `primeflex.css`
- [x] `src/components/ThemeSwitch.tsx`: topbar theme control — `pi-sun`/`pi-moon` trigger (by effective theme) opens a compound `Menu` with Light / Dark / System items and a check on the active one (2.7)
- [x] `App.tsx`: replaced the temp 3-button switcher with `<ThemeSwitch />` in a fixed top-right `header` (topbar stand-in; moves into `AppLayout` in Phase 6)

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes; Aura preset tokens emitted as CSS variables, primeicons fonts bundled
- [ ] Manual browser check of light/dark/system switching (pending)

## Notes

- PrimeReact 11 adaptation: the plan's `aura-light`/`aura-dark` CSS files no longer exist in v11. Used the v11 `ThemeProvider` + `@primeuix/themes/aura` preset instead; the `darkModeSelector` option replaces stylesheet swapping.
- v11 `Menu` is a compound component (`Menu.Root` / `Trigger` / `Portal` / `Positioner` / `Popup` / `List` / `Item`) — the old `model` + `popup` + `ref.toggle()` API is gone. The `Trigger` is itself the toggle `<button>`, so the trigger renders the icon directly (no nested `Button`).
- `theme-context.ts` split from `ThemeContext.tsx` to satisfy the `react(only-export-components)` Fast Refresh lint rule.

## Phase 3 — Authentication (complete: 3.0–3.9.1)

Branch: `feature/authentication`

### Backend prerequisite (done)

- [x] `src/routes/auth_routes.py`: `auth_callback` now redirects the browser to the SPA with `access_token` / `refresh_token` / `user` (JSON) appended as query params (was a JSON body)
- [x] `config.yaml`: added `security.frontend_url` (`http://localhost:5173`), overridable via the `FRONTEND_URL` env var

### Frontend

- [x] `src/auth/types.ts` — `User` (Google userinfo), `UserRole`, `ROLE_RANK` hierarchy (WEB_ADMIN > FACILITY_MANAGER > COACH > MEMBER)
- [x] `src/auth/tokens.ts` — single token store: localStorage access/refresh/user, clear-on-logout, JWT payload decode, role-from-token
- [x] `src/auth/AuthContext.tsx` (+ `auth-context.ts`) — `user`, `accessToken`, `refreshToken`, `loading`, `login()`, `logout()`, `hasRole()`; listens for `swimlane:auth-unauthorized` and hard-redirects to `/login`
- [x] `src/auth/AuthCallbackPage.tsx` — reads the URL params, stores tokens + user, `window.location.replace('/')` to reload the app so `AuthProvider` rehydrates
- [x] `src/api/client.ts` — refactored to the token store; on 401: deduplicated `POST /refresh` + single retry; on refresh failure (or no refresh token) clears tokens and dispatches `swimlane:auth-unauthorized`; exports `apiBaseUrl`
- [x] `src/App.tsx` — minimal `BrowserRouter` with `/login`, `/auth/callback` + `*` routes; main app wrapped in `RouteGuard` (full router + layout land in Phase 6)
- [x] `src/main.tsx` — `AuthProvider` mounted (inside `ThemeProvider`)
- [x] `src/auth/RouteGuard.tsx` — redirects to `/login` when unauthenticated; `requiredRole` prop redirects to `/` when the role is insufficient; spinner while `loading` (3.7)
- [x] `src/auth/LoginPage.tsx` — centered card with app title and "Sign in with Google" (`pi-google`) button; shows a spinner while checking the stored session; redirects to `/` when already authenticated (3.8)
- [x] `logout()` now fires best-effort `GET /logout` (server session clear) before clearing local tokens and redirecting to `/login` (3.6)
- [x] `AuthProvider.loading` — brief initial `true` phase during synchronous hydration so `LoginPage`/`RouteGuard` don't flash

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes
- [x] `uv run ruff check` + `uv run ruff format --check` on `auth_routes.py` — clean
- [x] `uv run pyright src/routes/auth_routes.py` — 0 errors
- [ ] Manual smoke test of the Google OAuth round-trip (pending — needs a browser + Google console callback URI)

## Notes

- Security trade-off (per the plan's prerequisite): tokens are passed via URL query params on the callback redirect; the callback page uses `window.location.replace('/')` so the token-bearing URL never stays in the browser history. A cookie/`code`-exchange flow would be more robust in production.
- The access token is in `localStorage` by design (plan decision); the refresh token also lives there for now — a hardened release should move the refresh token out of `localStorage` (e.g. httpOnly cookie).
- `/refresh` returns only a new `access_token` (no rotation) — the stored refresh token is reused until it expires (7 days).
- `RouteGuard` role enforcement is UI-level only; the backend remains the source of truth for authorization.
- 3.9/3.9.1: committed and PR description provided.

## Phase 4 — API types and endpoint modules (complete: 4.0–4.8)

Branch: `feature/api-types`

- [x] `src/api/types.ts` — TS mirrors of the backend Pydantic models: `Frequency`, `Facility`, `Event`, `Venue`, `Schedule`, `FormQuestion` (+ `QuestionType`), `FacilityRule`, `FormSubmission`, `FormResponse`, `FacilityForm`, `User` (backend row), `Role` — plus request DTOs: `FrequencyInput`, `FacilityInput`, `EventInput`, `VenueInput`, `ScheduleInput`, `QuestionInput`, `RuleInput`, `FormResponseInput`, `FormSubmissionInput`, and the shared `MessageResponse`
- [x] `src/api/auth.ts` — endpoint wrappers: `login()` (returns the Google OAuth URL), `logout`, `refresh`, `me`; `MessageResponse` now imported from `types.ts`
- [x] `src/auth/types.ts` — `UserRole` now aliases the canonical `Role` union from `api/types.ts` (single source of truth); Google OIDC `User` unchanged
- [x] `src/api/frequencies.ts` (4.3) — `list`, `get`, `create`, `update`, `delete`, `hardDelete`, `createBulk`, `deleteBulk`, `hardDeleteBulk` (paths `/{id}`, `/{id}/hard`, `/bulk`, `/bulk/hard`)
- [x] `src/api/facilities.ts`, `src/api/events.ts`, `src/api/venues.ts`, `src/api/schedules.ts` (4.4) — same CRUD shape per entity
- [x] `src/api/forms.ts` (4.5) — `getFacilityForm`, `submitForm`, `getSubmissionPdf`, question CRUD (`createQuestion`, `updateQuestion`, `deleteQuestion`, `hardDeleteQuestion`, `createQuestionsBulk`, `deleteQuestionsBulk`, `hardDeleteQuestionsBulk`), rule CRUD (`createRule`, `updateRule`, `deleteRule`, `hardDeleteRule`, `createRulesBulk`, `deleteRulesBulk`, `hardDeleteRulesBulk`); question/rule bulk deletes take `ids: number[]` and map to `{form_question_id}`/`{rule_id}` bodies
- [x] `src/api/crud.ts` (4.6) — shared `createCrudApi<Entity, Input>(basePath)` factory returning a `CrudApi<Entity, Input>` object with the standard 9 methods; the five flat entity modules now delegate to it (no duplicated method bodies). `forms.ts` keeps its custom shape (nested paths, id-based bulk deletes).
- [x] `src/api/client.ts` — new `RequestOptions.responseType: 'json' | 'text' | 'blob'` (blob needed for the PDF endpoint); preserved through the 401 refresh-retry
- [x] 4.7 committed; 4.8 PR title + description provided

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes

## Notes

- Field names/optionality mirror `src/data/`; datetimes serialize as ISO-8601 strings.
- `api/types.ts` `User` is the backend row (PII ciphertext columns); `auth/types.ts` `User` is the Google OIDC profile used for display — two intentionally distinct shapes.
- `login()` returns the URL string rather than performing the redirect so `AuthContext` stays the orchestrator (backend redirects to `/auth/callback` with tokens).
- `getSubmissionPdf` returns a `Blob` (caller triggers the browser download); `client.ts` parses PDF/other non-JSON bodies via `responseType: 'blob'`.
- The `createCrudApi` factory is generic over `Entity`/`Input` and typed per entity; bulk deletes of the flat entities send the full input objects (matched by fields server-side), while form question/rule bulk deletes send id wrappers — the latter stays bespoke in `forms.ts`.

## Phase 5 — Shared CRUD building blocks (complete: 5.0–5.8)

Branch: `feature/crud-building-blocks`

- [x] 5.0: branch created from `main` (after Phase 4 merged as `e0730c3`)
- [x] `src/components/EntityDataTable.tsx` (5.1) — generic `EntityDataTable<T>` built on the PrimeReact 11 compound `DataTable`:
  - `DataTable.Root` with `data`, `dataKey`, `loading`, `paginator`, `defaultRows`/`rowsPerPageOptions`, `globalFilter`/`globalFilterFields`, `defaultSortField`/`defaultSortOrder`, `removableSort`, `stripedRows`, `size="small"`
  - Global filter box (`pi-search`) via `IconField.Root` + `IconField.Inset` + `InputText` (controlled state)
  - Sortable `THeadCell`s using `DataTable.Sort` (prop `field`) with `DataTable.SortIndicator` matches `asc`/`desc`/`unsorted`
  - `DataTable.TBody` render prop maps rows into `DataTable.Row`/`Cell`; column defs are `EntityDataTableColumn<T>` (`field`, `header`, `sortable?`, `body?`)
  - `DataTable.EmptyTBody` empty message; `DataTable.Loading` overlay with a `pi-spin pi-spinner` icon
  - Custom `DataTable.Pagination` render prop typed with `DataTablePaginationExposes` (`page`/`pageCount`/`rows`/`totalRecords`/`canPrev`/`canNext`/`onPageChange`/`onRowsChange`): prev/next icon `Button`s, rows-per-page `<select>`, record count
  - Optional `actions` render prop appends a `__actions` column (row action buttons)
- [x] `src/components/EntityFormDialog.tsx` (5.2) — generic `EntityFormDialog<T>` schema-driven form in a PrimeReact 11 compound `Dialog`:
  - `Dialog.Root` (`visible`, `modal`, `dismissable`, `blockScroll`, `onOpenChange` → `onHide`) wrapping `Portal`/`Positioner`/`Content`/`Header`/`Title`/`HeaderActions`/`Close`/`Footer`
  - Field schema `EntityFormField<T>` (`name`, `label`, `type`, `required?`, `placeholder?`, `options?`, `min?`, `max?`, `minLength?`, `validate?`)
  - Field types: `text` (`InputText`), `number` (`InputNumber.Root`/`Input`), `checkbox` (`Checkbox.Root`/`Box`/`Indicator`), `select` (v11 `Select.Root`/`Trigger`/`Value`/`Indicator`/`Portal`/`Positioner`/`Popup`/`List` — options auto-rendered via `optionLabel`/`optionValue`)
  - Validation: required, numeric min/max, min-length, custom `validate`; inline `small` error text; errors clear on edit
  - Values reset from `initialValues` (or field defaults) whenever the dialog opens; refs mirror latest `fields`/`values` so the submit handler and open-reset use fresh data without re-running on prop identity changes
  - Submit/cancel `Button`s in `Dialog.Footer`; submit disabled while `submitting`; `p-button-label` span for the button text (v11 `Button` is a pass-through that renders children only)
- [x] `src/components/ConfirmDelete.tsx` (5.3) — delete action buttons + confirm `Dialog`:
  - Soft-delete trigger: `pi-trash` icon button (`variant="text" severity="danger"`, `iconOnly`) opening a confirm dialog ("Delete {itemName}? It will be deactivated and can be reactivated later.")
  - Hard-delete path: `pi-times` icon button shown only when `onHardDelete` is provided AND `useAuth().hasRole(hardRole)` (default `WEB_ADMIN`); dialog warns the action cannot be undone and requires a typed `reason` (`InputText`, required — confirm disabled until non-empty), passed as `onHardDelete(reason)`
  - Built on the v11 compound `Dialog` (`Root`/`Portal`/`Positioner`/`Content`/`Header`/`Title`/`HeaderActions`/`Close`/`Footer`); mode state `'soft' | 'hard' | null` drives one dialog; reason resets on open/close; v11 has no `ConfirmDialog` component
- [x] `src/components/PageHeader.tsx` (5.4) — page header with `title` (`<h1>`), optional `subtitle` (`<p>`), and an optional "New" `Button` (`pi-plus`, `newLabel` default `'New'`) rendered only when `onNew` is provided
- [x] `src/components/ToastProvider.tsx` (5.5) — global toast host + feedback helpers:
  - Renders the v11 compound `Toaster`/`Toast`: `Toaster.Root` (`position`, default `top-right`) > `Toaster.Portal` > `Toaster.Region` whose render-prop iterates `toaster.toasts` into `Toast.Root` templates (`Toast.Content`/`Icon match="success|error|warn|info"`/`Message`/`Title`/`Description`/`Close`); success `pi-check`, error `pi-times-circle`
  - `src/toast/toast-context.ts` — `showToast(options)`, `showToastSuccess(title, description?)`, `showToastError(title, description?)`, and `useToast()` hook, all wrapping the global `toast()` function from `primereact/toaster` (severity shortcuts `toast.success`/`toast.error`); `ToastType` imported from `@primereact/types/primitive/toaster`
- [x] `src/components/EmptyState.tsx` (5.6) — centered empty-list placeholder: `EmptyStateProps` (`message`, `hint?`, `icon?` default `pi-inbox`, `action?` for the optional primary-action button from 9.5)
- [x] 5.7 committed — `1025d18` "feat: shared CRUD building blocks (table, form dialog, confirm delete, header, toasts, empty state)"
- [x] 5.8 PR title + description provided (below)

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes

## Notes

- PrimeReact 11 removed the classic `DataTable value`/`Column`/`globalFilter`-props API and the `Dropdown` component entirely. Everything is now compound parts: `DataTable.*`, `Dialog.*`, `InputNumber.*`, `Checkbox.*`, and `Select.*` (the Dropdown successor). `InputIcon` no longer exists — icons render as plain `<i className="pi pi-...">` children (the `IconField.Inset` positions the search icon).
- v11 renders part-level event props (`onChange`, `onClick`, `onValueChange`, `onCheckedChange`, `onOpenChange`) with `unknown`/pass-through types, so handlers must be annotated explicitly with the event types imported from `@primereact/types/primitive/*` (e.g. `DataTablePaginationExposes`, `InputNumberRootValueChangeEvent`, `CheckboxRootChangeEvent`, `SelectValueChangeEvent`, `DialogRootChangeEvent`).
- `Button` in v11 is a bare pass-through: no `label`/`icon` props; pass `<span className="p-button-label">`/`<i className="p-button-icon pi pi-...">` as children.
- `DataTable.Root` types `data` as `Record<string, unknown>[] | object[]`, so generic rows are passed as `data as object[]`.
- All 5.1–5.6 components built, committed (5.7), and PR description provided (5.8).

## Phase 6 — Layout and navigation (complete)

Branch: `feature/layout`

- [x] 6.0: branch created from `main` (after Phase 5 merged as `6b799fb` / PR #23)
- [x] `src/layout/AppLayout.tsx` (6.1) — app shell built on the v11 compound `Sidebar`:
  - `Sidebar.Layout` > `Sidebar.Root` (`id="main"`, `collapsible="icon"`, `defaultOpen`) > `Sidebar.Spacer`/`Sidebar.Aside` > `Sidebar.Panel` with `Header` (logo/title), `Content` (a "Navigation" `Group`/`GroupLabel`/`GroupContent` + `Menu` with a placeholder Dashboard `MenuItem`/`MenuButton`), `Footer` (placeholder Profile item), `Rail`
  - `Sidebar.Main` holds the topbar (`app-topbar`: `Sidebar.Trigger` collapse toggle + app title on the left, `ThemeSwitch` on the right) and `<main className="app-content"><Outlet /></main>`
  - Wired in `App.tsx`: `*`/pathless route wrapped in `RouteGuard` renders `AppLayout`; a minimal `/` home page feeds the `Outlet` (full router + lazy loading land in 6.4; Dashboard page in 6.5)
- [x] Topbar (6.2) — `app-topbar-right` now holds the user chip and logout:
  - User chip: compound `Avatar.Root` (`shape="circle"`) with `Avatar.Image` (Google `user.picture`) + `Avatar.Fallback` initials (derived from `user.name`) and the display name (`user.name ?? user.email ?? 'User'`)
  - Logout `Button` (`pi-sign-out`, icon-only, `aria-label="Sign out"`) calling `useAuth().logout()`; `ThemeSwitch` stays beside it; logo/title already in `app-topbar-left`
- [x] Role-filtered nav menu (6.3):
  - `src/layout/nav.ts` — `NAV_ITEMS: NavItem[]` (`label`, `icon`, `path`, `requiredRole`) for Dashboard (`pi-home`), Frequencies (`pi-calendar`), Facilities (`pi-building`), Events (`pi-bolt`), Venues (`pi-map-marker`), Schedules (`pi-users`), Signup Forms (`pi-file-edit`)
  - `AppLayout` filters items with `useAuth().hasRole(item.requiredRole)` (hierarchical rank check) — MEMBER sees Dashboard + Signup Forms; FACILITY_MANAGER and above (WEB_ADMIN) additionally see the five CRUD pages; navigation via `useNavigate()`, active highlight via `useLocation()` (exact match, with `path/` prefix for nested routes)
  - Role gating mirrors the backend: list/get endpoints use `all_users`, create/update/delete use `facility_manager_role`, hard deletes use `admin_role` (grep of `src/routes/*_routes.py` dependencies)
- [x] Router module (6.4):
  - `src/router/index.tsx` — `AppRouter` with `React.lazy` code-split pages wrapped in one `Suspense` (spinner fallback)
  - Unauthenticated: `/login`, `/auth/callback` (named-export pages mapped to default via `.then((m) => ({ default: m.X }))`)
  - Authenticated: pathless `RouteGuard` > `AppLayout` route hosting `/` Dashboard, `/frequencies`, `/facilities`, `/events`, `/venues`, `/schedules`, `/forms`, and `*` NotFound page (stays inside the layout so nav remains visible)
  - `App.tsx` slimmed to `BrowserRouter` + `<AppRouter />`; `src/pages/` created: `DashboardPage.tsx` (minimal, enhanced in 6.5) + `PlaceholderPage.tsx` and stub pages (Frequencies/Facilities/Events/Venues/Schedules/Forms) to be replaced by real pages in Phases 7/8
  - Build output confirms a separate lazy chunk per page (LoginPage, DashboardPage, each entity page, etc.)
- [x] Dashboard page (6.5):
  - `DashboardPage.tsx` replaces the minimal home: compound `Card.Root`/`Header`/`Title`/`Content` welcome card greeting the user by first name (`given_name` or first word of `name`)
  - Role badge: `Tag` (`severity` + friendly label per role — WEB_ADMIN danger, FACILITY_MANAGER warn, COACH info, MEMBER secondary); role read from the JWT via `getRoleFromToken(useAuth().accessToken)` (the Google `user` profile has no role)
  - Quick links: outlined `Button`s built from `NAV_ITEMS` filtered by `hasRole(item.requiredRole)` (excluding `/`), navigating via `useNavigate()`
  - Layout styles (`.app-dashboard`, header row, quick-links grid) added to `index.css`; its own lazy chunk now bundles Card + Tag
- [x] Committed (6.6): `feat: app layout, role-filtered nav, lazy router, and dashboard` — 15 files (+374/−38), all Phase 6 code plus tracked `frontend-todo.md`/`frontend-done.md`
- [x] PR title + description provided (6.7) — waiting on merge into main before starting Phase 7

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes (Sidebar adds ~192 modules)

## Notes

- PrimeReact 11 has no `Menubar`/`Sidebar`-overlay-old API; the `primereact/sidebar` compound (`Layout`/`Root`/`Aside`/`Panel`/`Header`/`Content`/`Footer`/`Group`/`Menu`/`MenuItem`/`MenuButton`/`Rail`/`Main`/`Trigger`) is the sidebar-nav layout. `MenuButton` takes `isActive`; `Sidebar.Trigger` toggles the `Sidebar.Root` it targets (defaults to the layout's sidebar).
- Next: Phase 7 — CRUD pages for Frequencies, Facilities, Events, Venues, Schedules (start only after `feature/layout` merges into main).

## Phase 7 — Entity CRUD pages (in progress: 7.0–7.3)

Branch: `feature/crud-pages`

- [x] 7.0: branch created from `main` (after Phase 6 merged as `f810b87` / PR #24)
- [x] `src/pages/FrequenciesPage.tsx` (7.1) — full CRUD for `/frequencies`:
  - `PageHeader` (title/subtitle, "New Frequency" `pi-plus` button); `EntityDataTable` with search (name/day_interval, `pi-search`), sortable `name` + `day_interval` columns, `is_active` as a `Tag` (success Active / secondary Inactive), row actions = edit `pi-pencil` button + `ConfirmDelete` (soft `pi-trash` + admin-only hard `pi-times`); `EmptyState` ("No frequencies yet.") with a create action replaces the table when the list is empty
  - `EntityFormDialog` fields: name (required, placeholder "e.g., Weekly"), day_interval (required, placeholder "e.g., 7 days"), is_active checkbox (defaults to `true` on create via `initialValues`); submit calls `frequencies.create` / `frequencies.update`, reloads the list, and toasts success/error (`showToastSuccess`/`showToastError`); soft delete → `frequencies.delete`, hard delete → `frequencies.hardDelete`
- [x] Mounted `ToastProvider` in `src/main.tsx` (rendered as a portalled sibling of `<App />` inside `AuthProvider` — it takes no children) so the global `toast()` used by pages has a `Toaster` to render into
- [x] `EntityFormDialog` extended (7.2/7.3 enabler) — new field types:
  - `textarea` → v11 `Textarea` (simple pass-through; optional `rows`, default 3)
  - `datetime` → v11 compound `DatePicker` (the `Calendar` successor: `Root`/`Input`/`Trigger`/`Portal`/`Positioner`/`Popup`/`Calendar`/`Header`/`Table`/`TableHead`/`TableBody view="date"`/`Time` with `Picker type="hour"|"minute"` + `Increment`/`Decrement`/`Hour`/`Minute`/`Separator`/`Footer` with `Today`/`Clear`), `showTime` + `hourFormat="24"`; value stored as `Date | null` (ISO strings converted to `Date` for editing), required-empty check covers invalid `Date`s; number fields now pass `placeholder` to `InputNumber.Input`
- [x] `src/pages/FacilitiesPage.tsx` (7.2) — full CRUD: columns name/description/max_capacity/min_capacity/is_active (`Tag`), form fields name (required), description (`textarea`), max_capacity + min_capacity (`InputNumber` with `placeholder="e.g., 50"` and min bounds), is_active checkbox; nullable capacity values preserved (`number | null`)
- [x] `src/pages/EventsPage.tsx` (7.3) — full CRUD:
  - Loads events + frequencies in parallel (`Promise.all`); frequency `Select` options and the frequency-name column map derive from the fetched frequencies
  - Datetime columns formatted with `toLocaleString()`; start/end `datetime` fields required with cross-field validation (end must be after start); submitted as ISO-8601 strings

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes; `FrequenciesPage` gets its own lazy chunk (bundling DataTable/Dialog/InputNumber/etc.)

## Notes

- `ToastProvider` takes no children (its `Toaster` uses a portal), so it is rendered as a sibling of `<App />`, not a wrapper.
- Remaining in Phase 7: 7.4 Venues, 7.5 Schedules, 7.6 optional bulk ops, 7.7 commit, 7.8 PR description.

## Phase 1 — Scaffolding (complete)

- [x] Created `frontend/` via `npm create vite@latest frontend -- --template react-ts` (Vite 8, React 19, TS 6, oxlint)
- [x] Installed `react`, `react-dom`, `react-router-dom`
- [x] Installed `primereact`, `primeicons`, `primeflex`
- [x] `vite.config.ts`: dev proxy — `fetch("/api/...")` → `http://127.0.0.1:8000/...` (prefix stripped), plus `@/*` → `src/*` alias
- [x] `.env` / `.env.example`: documented `VITE_API_URL` (default `http://127.0.0.1:8000`); left unset in dev so requests use the proxy
- [x] `src/api/client.ts`: fetch wrapper — URL resolution (env or `/api` proxy), `Authorization: Bearer <token>`, JSON body handling, `ApiError` with backend `detail`, 204 handling, network errors normalized into `ApiError`, 401 clears the token and fires `swimlane:auth-unauthorized` (refresh/redirect wired in Phase 3)
- [x] tsconfig: added `strict: true` and `paths` alias `@/*` → `./src/*` (no `baseUrl` — deprecated in TS 6)
- [x] Cleaned Vite boilerplate — removed `App.css`, `react.svg`, `vite.svg`, `hero.png`, `public/icons.svg`; replaced `App.tsx` with a minimal placeholder; set index title to "Swimlane"

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes, dist generated

## Notes

- React Router v7 installed (re-exports from `react-router`).
- `tsconfig.app.json` uses `verbatimModuleSyntax` — type-only imports must use `import type`.
- Dev proxy requires the FastAPI backend on `127.0.0.1:8000`.
- Code review follow-ups addressed: network failures now throw `ApiError` (status 0); `BASE_URL` trailing slashes are stripped; `.env` is gitignored (only `.env.example` tracked).
- Known/deferred: the OAuth callback returns the browser to the backend origin in dev (`changeOrigin`), and tokens live in `localStorage` — both deliberate, tracked in `frontend-todo.md` (Phase 3 / prerequisites).