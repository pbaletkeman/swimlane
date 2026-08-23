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

## Phase 7 — Entity CRUD pages (complete: 7.0–7.9)

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
- [x] `src/pages/VenuesPage.tsx` (7.4) — full CRUD: loads venues + facilities in parallel; columns street/city/state/postal_code/cost (`$` formatted)/facility name/is_active; form fields street/city/state/postal_code (required text), cost (`InputNumber`, placeholder "e.g., 200"), facility `Select` (required, options from `/facilities`), is_active checkbox; nullable cost preserved
- [x] `src/pages/SchedulesPage.tsx` (7.5) — full CRUD: loads schedules + venues + events in parallel; columns venue (street, city) / member_id / event (formatted start datetime) / is_active; form fields venue `Select` (required), member_id free-text required (placeholder "Google sub ID" — no user-list endpoint exists), event `Select` (required), is_active
- [x] Row selection + bulk delete (7.6) — added to ALL five CRUD pages:
  - `EntityDataTable` gained `selectable`/`selectedKeys`/`onSelectionChange`: controlled v11 DataTable selection (`selectionMode="multiple"`, `selectionKeys`, `onSelectionChange`), a leading selection column with the `DataTable.Selection` render prop composing `Checkbox.Root` (header = select-all w/ `indeterminate` for some-selected; row = toggle), and the `__select` column excluded from global-search fields
  - New `BulkDeleteBar` component: selection-count pill + danger "Delete" (`pi-trash`) `Button` opening a compound `Dialog` confirm ("Bulk delete?"); bulk delete via the `/bulk` endpoints — bodies are the selected rows (backend matches natural keys: frequency/facility by `name`, event by `start_date_time`+`end_date_time`, venue by `facility_id`+`street`, schedule by `venue_id`+`member_id`+`event_id`)
  - Selection resets on list reload; `BulkDeleteBar` renders null when nothing is selected
- [x] 7.7 — AGENTS.md checked: backend-focused, no stale frontend references; no change needed
- [x] 7.8 committed — `aa6aa8b` "feat: entity CRUD pages with role-gated actions and bulk delete" (12 files, +1486/−27)
- [x] 7.9 PR title + description provided (below)

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes; per-page lazy chunks emitted for FrequenciesPage/FacilitiesPage/EventsPage/VenuesPage/SchedulesPage

## Notes

- `ToastProvider` takes no children (its `Toaster` uses a portal), so it is rendered as a sibling of `<App />`, not a wrapper.
- v11 `DataTable.Selection` is a render prop with a typed `DataTableSelectionExposes` (`isHeader`, `isAllSelected`, `isSomeSelected`, `toggleAll` in header context; `isSelected`, `toggle` in row context) — the checkbox part's `onCheckedChange` passes `event.originalEvent` into `toggle`/`toggleAll`.
- Remaining in Phase 7: none. Next: Phase 8 — Signup Forms (after `feature/crud-pages` merges into main).

## PR Title (7.9)

`feat: entity CRUD pages with role-gated actions and bulk delete`

## PR Description (7.9)

### Summary

Completes the five entity CRUD pages (Frequencies, Facilities, Events, Venues, Schedules) for the Swimlane frontend, extending the shared building blocks from Phase 5 into full list/search/create/edit/soft-delete/hard-delete flows. Also adds row-selection-based bulk delete to every CRUD page via the backend `/bulk` endpoints.

### What's Included

- **CRUD pages** — `FrequenciesPage`, `FacilitiesPage`, `EventsPage`, `VenuesPage`, `SchedulesPage`, each with a searchable/sortable `EntityDataTable`, a schema-driven `EntityFormDialog` (create + edit), `ConfirmDelete` (soft delete + admin-only hard delete), and an `EmptyState` with a create action.
- **Form dialog extension** — `EntityFormDialog` gained `textarea` and `datetime` field types (PrimeReact 11 `Textarea` and compound `DatePicker`), plus `placeholder` passthrough on `InputNumber`; datetime fields validate empty/invalid values and support cross-field validation (e.g. event end > start).
- **Lookup-driven pages** — Facilities/Events/Venues/Schedules load their reference data (`/facilities`, `/frequencies`, `/venues`, `/events`) in parallel and render friendly names (facility name, frequency name, venue "street, city", event start datetime) in place of raw foreign keys.
- **Row selection** — `EntityDataTable` supports checkbox row selection (select-all header with indeterminate state) driven by controlled v11 DataTable selection keys.
- **Bulk delete** — new `BulkDeleteBar` (selection count + confirm dialog) wired into all five pages using the `/bulk` soft-delete endpoints; bulk bodies carry the selected rows, which the backend matches by natural keys.
- **Docs** — `frontend-todo.md` Phase 7 items and `frontend-done.md` updated; AGENTS.md reviewed (no changes needed).

### Verification

- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b && vite build`) — passes; each page emits its own lazy chunk.
- Manual smoke test against the running backend still pending (Phase 10).

### Notes

- Hard deletes (single-row and any bulk hard-delete) remain gated to WEB_ADMIN; the hard-delete confirm requires a typed reason.
- Bulk delete is soft delete only (matches the Phase 7 plan); selection clears automatically after each reload.
- `member_id` on Schedules is a free-text Google `sub` (placeholder "Google sub ID") because no user-list endpoint exists.

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
## Phase 8 � Signup Forms (complete: 8.0�8.5)

Branch: eature/forms

- [x] 8.0: branch created from eature/crud-pages (Phase 7 not yet merged into main, so this branch carries Phase 7's shared components � EntityDataTable selection, BulkDeleteBar, EntityFormDialog textarea/datetime, ConfirmDelete, ToastProvider � and will reduce to a Phase 8-only diff once eature/crud-pages merges)
- [x] src/pages/FormsPage.tsx (facility picker for /forms) � replaces the placeholder: lists facilities (EntityDataTable, search/sort, Tag is_active); per-row "View Signup Form" (pi-file-edit) -> /forms/facility/:id and, for FACILITY_MANAGER+, a "Manage" (pi-pencil) icon -> /forms/builder/:id
- [x] src/pages/FormViewPage.tsx (8.1/8.2, member view /forms/facility/:facilityId):
  - Loads facility (acilities.get) + form (orms.getFacilityForm) in parallel; facility name becomes the page title
  - Questions rendered by question_type: InputText (text) / compound Checkbox.Root (checkbox); required marked with a red * + inline small errors; required text must be non-empty and required checkbox must be checked (checked on submit)
  - Rules section: list items with pi-exclamation-circle (title bold + content)
  - Signature-consent Checkbox ("I agree to the facility rules and consent to this signup.") gates the pi-pencil Submit button; consent hint shown when unchecked
  - Submits POST /forms/{facility_id}/submit with { signed: true, responses }; on success keeps the returned submission_id, disables all inputs/submit (prevents re-entry), shows a success banner, and reveals the pi-file-pdf "Download PDF" button
  - PDF export (8.2): orms.getSubmissionPdf(submissionId) -> blob -> object URL -> <a download="submission-<id>.pdf"> click -> revoke
  - Handles: loading spinner, facility-not-found, and "no signup form yet" (with a Back-to-facilities button)
- [x] src/pages/FormBuilderPage.tsx (8.3, manager builder /forms/builder/:facilityId):
  - Two sections (Questions + Rules), each with its own header row (h2 + New button), EmptyState, BulkDeleteBar, and EntityDataTable (search/sort, Tag columns, edit pi-pencil + ConfirmDelete, selectable with bulk delete)
  - Questions table columns: prompt (sortable), question_type (Tag Text info / Checkbox warn), is_required (Tag Required danger / Optional secondary), sort_order, is_active (Tag)
  - Question dialog: prompt (required, placeholder "e.g., Emergency contact phone number"), question_type (Select Text/Checkbox, required), is_required checkbox, sort_order number, is_active checkbox; create defaults text/required/sort 0/active; edit pre-filled from the row
  - Rules table columns: title (sortable), content, sort_order, is_active (Tag)
  - Rule dialog: title (required), content (	extarea, required), sort_order number, is_active checkbox
  - Per-row soft/hard delete via deleteQuestion/hardDeleteQuestion and deleteRule/hardDeleteRule; bulk soft delete via deleteQuestionsBulk(ids) / deleteRulesBulk(ids)
  - Uses GET /forms/{facility_id} for its list, so it manages the facility's ACTIVE questions/rules (the only listing endpoint available)
- [x] Router (src/router/index.tsx) � added /forms/facility/:facilityId (FormViewPage) and /forms/builder/:facilityId (FormBuilderPage) alongside /forms; each lazy page gets its own chunk
- [x] index.css � form-view styles (.form-card, questions/labels/* marker/errors, .form-rules list, .form-consent, .form-actions, .form-submitted-banner, .form-consent-hint) and builder styles (.form-builder-* section headers/back button)

## Verification

- [x] 
pm run lint (oxlint) � clean
- [x] 
pm run build (	sc -b && vite build) � passes; FormViewPage/FormBuilderPage emit their own lazy chunks
- [ ] Manual browser smoke test of submit + PDF download (pending � Phase 10)

## Notes

- GET /forms/{facility_id} returns only ACTIVE questions + rules, so both the member view and the builder operate on active items; soft-deleted/inactive items are not listed (no all-questions-by-facility endpoint exists). Toggling is_active off hides an item from the view AND the builder.
- The backend upserts a submission per (sub, facility) and returns the created/updated FormSubmission � the frontend keeps its submission_id in state for the PDF export; a reload loses it until the member resubmits (no "my submission" GET endpoint exists).
- Signature consent + required-question validation happen client-side; the backend independently requires signed=true and enforces roles (member_role on submit/PDF, acility_manager_role on question/rule writes, dmin_role on hard deletes).
- Remaining in Phase 8: commit (8.4) + PR title/description (8.5) below.
- [x] 8.4 committed — `9597fdf` "feat: signup form member view, PDF export, and manager builder"
- [x] 8.5 PR title + description provided (below)

## PR Title (8.5)

`feat: signup form member view, PDF export, and manager builder`

## PR Description (8.5)

### Summary

Implements the Signup Forms feature: a facility picker at `/forms`, a member-facing form view at `/forms/facility/:facilityId` that renders questions + facility rules, gates submission on a signature consent, and exports a PDF of the completed submission; plus a facility-manager builder at `/forms/builder/:facilityId` for CRUD + bulk delete of form questions and facility rules.

### What's Included

- **Facility picker (`/forms`)** — replaces the placeholder `FormsPage` with a facility list; "View Signup Form" (`pi-file-edit`) for members and a "Manage" (`pi-pencil`) action for FACILITY_MANAGER+.
- **Member view (`/forms/facility/:facilityId`)** — renders questions by type (`InputText` for text, `Checkbox` for checkbox) with required markers and inline validation, facility rules as a list with `pi-exclamation-circle`, and a signature-consent checkbox that gates the submit button. Submit posts `POST /forms/{facility_id}/submit` (upsert per `(sub, facility)`), disables re-entry, and toasts success.
- **PDF export** — after submit, a `pi-file-pdf` "Download PDF" button fetches `GET /forms/submissions/{submission_id}/pdf` as a blob (Bearer token attached) and triggers a browser download.
- **Manager builder (`/forms/builder/:facilityId`)** — Questions and Rules sections, each with search/sort tables (`Tag` columns), create/edit `EntityFormDialog`s (question prompt placeholder "e.g., Emergency contact phone number"; rule `content` textarea), per-row soft/hard delete via `ConfirmDelete`, and row-selection bulk delete via `/forms/questions/bulk` and `/forms/rules/bulk`.
- **Routing/styles** — new lazy routes for the view and builder; form view + builder styles in `index.css`.

### Verification

- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b && vite build`) — passes; `FormViewPage`/`FormBuilderPage` emit their own lazy chunks.
- Manual browser smoke test (submit + PDF download) pending — Phase 10.

### Notes

- `GET /forms/{facility_id}` returns only ACTIVE questions/rules, so both the view and the builder manage active items; toggling `is_active` off hides an item from both.
- The submission `submission_id` is kept in page state for the PDF export; it is lost on reload (no "my submission" GET endpoint exists) — a re-submit returns it again (upsert).
- Client-side consent + required validation mirror the backend rules (`signed` must be true; `member_role` on submit/PDF, `facility_manager_role` on question/rule writes, `admin_role` on hard deletes).
- Branch `feature/forms` was created from `feature/crud-pages` (Phase 7 unmerged), so it currently includes Phase 7 commits; the diff will shrink to Phase 8-only once `feature/crud-pages` merges to main.

## Phase 9 — Polish and validation (complete: 9.0–9.9)

Branch: `feature/validation`

- [x] 9.0: branch created from `feature/forms` (Phases 7/8 not yet merged into main, so this branch carries their commits too)
- [x] `src/util/media-query.ts` (9.6) — `useMediaQuery(query)` hook built on `useSyncExternalStore` (`matchMedia` + `change` listener), returns a live boolean snapshot
- [x] `src/layout/AppLayout.tsx` (9.6) — responsive sidebar:
  - `Sidebar.Root` is now controlled (`open={sidebarOpen}` + `onOpenChange` via `UseSidebarOpenChangeEvent`) instead of `defaultOpen`
  - Below 768px (`MOBILE_QUERY = '(max-width: 767px)'`) the sidebar auto-collapses to the icon rail and re-expands when the viewport grows (a `useEffect` syncs `sidebarOpen` to `!isNarrow`)
  - Clicking a nav `MenuButton` on narrow screens closes the menu (dismisses the rail) after navigating
- [x] `src/components/EntityDataTable.tsx` (9.2) — loading skeletons: the `DataTable.Loading` overlay now renders skeleton placeholder rows (`primereact/skeleton`, `animation="wave"`, per-column `Skeleton` bars) instead of the spinner; shared by every list/table page
- [x] `src/components/ConfirmDelete.tsx` (9.3) — the confirm dialog body now leads with an icon chip: `pi-trash` for soft delete, `pi-exclamation-triangle` (danger-styled) for the "Permanently delete?" hard-delete path
- [x] `src/pages/ErrorPage.tsx` (9.4) — new shared error page: `pi-exclamation-circle` icon chip, optional `code`, `title`, `message`, and optional primary `Button` action (`actionLabel`/`onAction`)
- [x] `src/router/index.tsx` (9.4) — the `*` NotFound route now renders `<ErrorPage code={404} title="Page not found" ... />` (stays inside the layout)
- [x] `src/pages/FormViewPage.tsx` (9.4) — the "Form not found" branch now renders `ErrorPage` (with a Back-to-facilities action)
- [x] `src/components/EmptyState.tsx` (9.5) — added `actionLabel`/`onAction` props that render a primary `Button` (existing `action` ReactNode prop retained)
- [x] `src/pages/FormsPage.tsx` (9.5) — empty state now offers a "Manage Facilities" primary action for FACILITY_MANAGER+ (navigates to `/facilities`); all other list pages already had primary actions
- [x] 9.1 — shared form validation + inline `small` errors already shipped in `EntityFormDialog` (required, number `min`/`max`, `minLength`, custom `validate`); verified, no change needed
- [x] 9.7 — accessible labels: audited every icon-only control (nav trigger, logout, theme switch, pagination prev/next, rows-per-page select, select-all/row checkboxes, edit/manage/delete buttons, dialog closes); all already carry `aria-label` (plus `title`), no changes needed
- [x] `index.css` — styles added for skeleton loading rows (`.entity-datatable-loading-*`, grid columns adapt at ≥768px), the confirm-delete icon chip (`.confirm-delete-icon`, `.confirm-delete-icon-hard`), and the error page (`.app-error-*`)
- [x] 9.8 committed
- [x] 9.9 PR title + description provided (below)

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes
- [ ] Manual browser check of the responsive sidebar collapse + skeleton loading (pending — Phase 10)

## Notes

- Phase 9.1/9.7 were already satisfied by earlier phases; the work concentrated on skeletons (9.2), confirm-dialog icons (9.3), the shared error page (9.4), empty-state actions (9.5), and the responsive sidebar (9.6).
- Responsive approach: v11 `Sidebar` has no built-in breakpoint behavior, so the sidebar auto-collapses to the icon rail below 768px via the controlled `open` state. This keeps the layout intact on phones/tablets while preserving the rail + topbar trigger to expand on demand.
- Sidebar styles are injected at runtime by `@primeuix/themes`/`@primeuix/styled`, so the theme package ships no media queries — confirmed before implementing the JS-controlled collapse.

## PR Title (9.9)

`feat: loading skeletons, error page, accessible labels, responsive sidebar`

## PR Description (9.9)

### Summary

Polish pass over the frontend: skeleton loading placeholders on every list/table page, a shared error/404 page, clearer soft-vs-hard delete confirmation, empty-state primary actions, accessible labels on all icon-only controls, and a responsive sidebar that auto-collapses to the icon rail on small screens.

### What's Included

- **Loading skeletons** — `EntityDataTable`'s loading overlay now renders per-column `Skeleton` bars (`animation="wave"`) instead of a spinner, giving every list/table page a stable, shimmer-style loading state.
- **Shared error page** — new `ErrorPage` (`pi-exclamation-circle`, optional code/title/message/action) powers the router's `*` NotFound route (404) and FormViewPage's "Form not found" branch; API error toasts continue to flow from normalized `ApiError`s.
- **Confirm-delete clarity** — the confirm dialog leads with an icon chip: `pi-trash` for soft delete, `pi-exclamation-triangle` (danger-styled) for "Permanently delete?" hard deletes.
- **Empty-state actions** — `EmptyState` gained `actionLabel`/`onAction` (renders a primary button); the Forms page empty state now points managers to `/facilities`.
- **Responsive sidebar** — `useMediaQuery` drives a controlled `Sidebar.Root`: auto-collapses to the icon rail below 768px, re-expands on larger viewports, and closes the menu after a nav click on narrow screens.
- **Accessibility** — audited all icon-only buttons/controls (nav trigger, logout, theme switch, pagination, checkboxes, edit/manage/delete, dialog closes); all carry `aria-label` (with `title`).
- **Validation** — shared required/number-range/min-length validation with inline `small` errors confirmed present in `EntityFormDialog` (no change needed).

### Verification

- `npm run lint` (oxlint) — clean.
- `npm run build` (`tsc -b && vite build`) — passes.
- Manual smoke test of the responsive collapse and skeleton loading pending — Phase 10.

### Notes

- v11 `Sidebar` ships no breakpoint behavior (styles are runtime-injected by `@primeuix/themes`/`@primeuix/styled` with no media queries), so the responsive collapse is implemented in JS by controlling the `open` state.
- Phases 9.1 (form validation) and 9.7 (aria-labels) were already satisfied by earlier phases and verified rather than re-implemented.
- Branch `feature/validation` was created from `feature/forms`, so it currently includes the unmerged Phase 7 and Phase 8 commits; the diff will shrink once those branches merge to main.

## Phase 10 — Build, verify, document (in progress: 10.0–10.6)

Branch: `feature/document`

- [x] 10.0: branch created from `main` (after Phase 9 merged as `f4f7a5a` / PR #27; main tip then `de8d68f`)
- [x] 10.1: `npm run build` (`tsc -b && vite build`) passes — 257 modules, per-page lazy chunks emitted, `dist/` generated with no type errors or unused-locals failures
- [x] 10.2: `npm run lint` (oxlint) clean
- [x] 10.3: manual smoke test against the running backend (full CRUD per entity, forms submit + PDF, auth, theme, logout):
  - **Backend API smoke test** — minted dev-secret JWTs (lowercase role claims) for `smoke-member` / `smoke-manager` / `smoke-admin`, seeded users, then exercised every endpoint: `/me` (200 + 401 unauth), `/refresh` (new access token), `/logout` (307), `/devtools` (HTML); frequency CRUD + bulk create; facility CRUD; event CRUD; venue CRUD; schedule CRUD; soft delete; hard-delete gating (manager 403 / admin 200); form question + rule create, `GET /forms/{id}` (2 questions + 1 rule), member submit (`signed: true`), member PDF download (`%PDF`). **33/33 PASS.**
  - **Bug found & fixed (backend)** — `POST /venues` returned 500 (`sqlite3.OperationalError: no such table: venue`); the app never called any entity `init()`, so `venue` (and any fresh-DB table) was never created. Fixed by adding `init_db()` in `main.py` that runs each SQLite class's `init()` (`CREATE TABLE IF NOT EXISTS`) at startup.
  - **Frontend smoke test (headless Chrome)** — `/` renders the public HomePage; `/login` renders the Google sign-in card; `/auth/callback` captures tokens and lands on `/dashboard`; theme switch present with `<html data-theme="dark">` set (light/dark/system toggle via `ThemeSwitch`); all five entity pages (`/frequencies`, `/facilities`, `/events`, `/venues`, `/schedules`) and `/forms`, `/forms/builder/:id`, `/forms/facility/:id` render with zero console errors (seeded question text visible in both builder and member view).
  - **Bug found & fixed (frontend)** — the role-gated nav was EMPTY for every role: the backend writes lowercase role claims (`member`, `facility_manager`) but `ROLE_RANK` keys are uppercase, so `getRoleFromToken` returned `null` and `hasRole` filtered everything out. Fixed in `src/auth/tokens.ts` by uppercasing the decoded role before the `ROLE_RANK` check.
- [x] 10.4: role-gated menu/actions verified (headless Chrome, one profile per role, lowercase-role tokens):
  - MEMBER — nav: Dashboard, Signup Forms; role badge `Member`; no CRUD links.
  - FACILITY_MANAGER — nav adds Frequencies, Facilities, Events, Venues, Schedules; role badge `Facility Manager`.
  - WEB_ADMIN — all nav items; role badge `Web Admin`.
  - API-level action gating re-confirmed in 10.3: member create → 403; manager hard-delete → 403; admin hard-delete → 200.
- [x] 10.5: `frontend/README.md` — run instructions (`uv run python main.py` from the repo root, then `npm run dev` in `frontend/`), `VITE_API_URL` config (unset → Vite dev proxy `/api` → `http://127.0.0.1:8000`; set → direct calls for production), theme behavior (light/dark/system, `localStorage["theme"]`, `data-theme` on `<html>`, PrimeReact 11 `ThemeProvider` + Aura). Reviewed against the actual config (`vite.config.ts`, `.env.example`, `ThemeContext.tsx`, `AuthContext.tsx`) — all accurate. Added a note that `/` is the public home and authenticated pages live at `/dashboard` + entity routes.
- [x] 10.6: root `readme.md` already carried the frontend setup and structure — "Running the frontend" section (`npm install`/`npm run dev`, proxy note, `/` public home vs `/dashboard`), frontend checks (`npm run lint`/`npm run build`), `frontend/` in the Project Structure tree, and a `Frontend` link in Documentation. Verified accurate; no further changes needed.

## Verification

- [x] `npm run build` (`tsc -b && vite build`) — passes
- [x] `npm run lint` (oxlint) — clean
- [x] Manual smoke test against the running backend (10.3) — 33/33 API checks pass; all frontend pages render headless with zero console errors
- [x] Role-gated menu/actions verified (10.4) — MEMBER vs FACILITY_MANAGER vs WEB_ADMIN nav + badges correct

---

[Back to README](../../readme.md) | [Documentation Index](../index.md)
