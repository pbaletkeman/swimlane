# Frontend Walkthrough

A deep-dive into the Swimlane React SPA — provider stack, routing, auth, API layer, pages, nav filtering, theming, build, and testing.

## Overview

| Component | Technology |
|-----------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| UI Library | PrimeReact 11 (compound components) |
| Theme | `@primeuix/themes` Aura preset |
| Routing | react-router-dom 7 (lazy-loaded) |
| Linting | oxlint |

Entry point: `frontend/src/main.tsx`

## Provider Stack

The React root renders providers in this exact order (outermost to innermost):

```plaintext
StrictMode
  └── PrimeReactProvider        (@primereact/core/config — required by PrimeReact 11)
        └── ThemeProvider        (wraps PrimeReactThemeProvider with Aura preset)
              └── AuthProvider   (JWT session state, login/logout/hasRole)
                    └── ToastProvider + App (BrowserRouter + AppRouter)
```

**Gotcha**: Omitting `PrimeReactProvider` crashes the whole tree at runtime ("[PrimeReact] PrimeReactProvider not found"). The `ThemeProvider` from `@primereact/core/theme` does **not** provide it.

## Routing

All page components are **lazy-loaded** via `React.lazy()` with a spinner fallback.

### Public Routes (outside RouteGuard)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `HomePage` | Landing page with explore + login/dashboard buttons |
| `/login` | `LoginPage` | Google sign-in button |
| `/auth/callback` | `AuthCallbackPage` | OAuth hand-off; stores JWTs from query params |
| `/explore` | `ExploreHomePage` | Address + event search |
| `/explore/venues` | `ExploreVenuesPage` | Public venue grid with `?q=` search |
| `/explore/venues/:venueId` | `VenueSchedulePage` | Week/Month/List schedule views per venue |
| `/explore/events/:eventId` | `EventDetailPage` | Event detail, capacity bar, register/reschedule |

### Authenticated Routes (inside RouteGuard + AppLayout)

| Path | Component | Role Gate |
|------|-----------|-----------|
| `/dashboard` | `DashboardPage` | MEMBER+ |
| `/profile` | `ProfilePage` | MEMBER+ |
| `/my-schedule` | `MySchedulePage` | MEMBER+ |
| `/manage-events` | `CoachEventsPage` | COACH+ |
| `/frequencies` | `FrequenciesPage` | FACILITY_MANAGER+ |
| `/facilities` | `FacilitiesPage` | FACILITY_MANAGER+ |
| `/events` | `EventsPage` | FACILITY_MANAGER+ |
| `/venues` | `VenuesPage` | FACILITY_MANAGER+ |
| `/schedules` | `SchedulesPage` | FACILITY_MANAGER+ |
| `/forms` | `FormsPage` | MEMBER+ |
| `/forms/facility/:facilityId` | `FormViewPage` | MEMBER+ |
| `/forms/builder/:facilityId` | `FormBuilderPage` | FACILITY_MANAGER+ |
| `/manage-users` | `ManageUsersPage` | FACILITY_MANAGER+ (double-guarded) |
| `*` | `NotFoundPage` | 404 |

## Auth Flow

### Login Sequence

```plaintext
1. User clicks "Sign in with Google" on /login
2. Redirect to ${apiBaseUrl}/login?frontend_url=${origin}
3. Backend Google OAuth consent screen
4. Backend callback redirects to /auth/callback?access_token=...&refresh_token=...&user=...
5. AuthCallbackPage stores tokens + user in localStorage
6. Hard navigation to /dashboard
```

### Token Storage

| Key | Content |
|-----|---------|
| `swimlane.accessToken` | JWT access token |
| `swimlane.refreshToken` | JWT refresh token |
| `swimlane.user` | User object (sub, role, name, email) |

### Role Resolution

`getRoleFromToken()` in `frontend/src/auth/tokens.ts` extracts the `role` claim from the JWT, **uppercases** it (backend sends lowercase `facility_manager`), then looks it up in `ROLE_RANK`:

```plaintext
WEB_ADMIN = 0 (highest)
FACILITY_MANAGER = 1
COACH = 2
MEMBER = 3 (lowest)
```

`hasRole(required)` compares ranks: `ROLE_RANK[userRole] <= ROLE_RANK[required]`.

### 401 Handling

The API client dispatches a `swimlane:auth-unauthorized` custom event on unrecoverable 401. `AuthProvider` listens for this, clears localStorage, and hard-redirects to `/login`.

## API Layer

### Client (`frontend/src/api/client.ts`)

| Method | Signature |
|--------|-----------|
| `api.get<T>(path, options?)` | `responseType: 'json' \| 'text' \| 'blob'` |
| `api.post<T>(path, body?)` | JSON body |
| `api.put<T>(path, body?)` | JSON body |
| `api.delete<T>(path, void)` | No body |

### Base URL Resolution

1. `VITE_API_URL` env var (production)
2. Fallback: `/api` (dev Vite proxy strips prefix, forwards to `http://127.0.0.1:8000`)

### Request Flow

```plaintext
1. Attach Authorization: Bearer <token> from localStorage
2. Set Content-Type: application/json for body requests
3. On non-OK: parse backend detail → ApiError(status, message)
4. On 401 (first attempt):
   a. Call POST /refresh with refresh token
   b. Save new access token
   c. Retry original request once
5. On refresh failure: clear tokens, dispatch swimlane:auth-unauthorized
```

Refresh calls are deduplicated via a `refreshInFlight` promise guard.

## Pages

### Member Pages

| File | Renders |
|------|---------|
| `DashboardPage.tsx` | Welcome card, role tag, quick links |
| `ProfilePage.tsx` | Tabs: My Forms, My Events, My Messages |
| `MySchedulePage.tsx` | Registered events, iCal export, reschedule, cancel |

### Coach Pages

| File | Renders |
|------|---------|
| `CoachEventsPage.tsx` | Coach's own events with scope switcher (upcoming/past/all) |

### Facility Manager Pages

| File | Renders |
|------|---------|
| `FrequenciesPage.tsx` | CRUD table |
| `FacilitiesPage.tsx` | CRUD table |
| `EventsPage.tsx` | CRUD table |
| `VenuesPage.tsx` | CRUD table |
| `SchedulesPage.tsx` | CRUD table |
| `ManageUsersPage.tsx` | User management (double-guarded with `requiredRole="FACILITY_MANAGER"`) |

### Form Pages

| File | Renders |
|------|---------|
| `FormsPage.tsx` | Facility list, links to view/builder |
| `FormViewPage.tsx` | Public-facing signup form with questions, rules, consent, PDF export |
| `FormBuilderPage.tsx` | Manager-only question/rule CRUD builder |

### Public Explore Pages

| File | Renders |
|------|---------|
| `ExploreHomePage.tsx` | Address + event search |
| `ExploreVenuesPage.tsx` | Public venue grid |
| `VenueSchedulePage.tsx` | Venue schedule (week/month/list) |
| `EventDetailPage.tsx` | Event detail with live capacity bar |

## Nav & Role Filtering

### Nav Items (`frontend/src/layout/nav.ts`)

| Label | Icon | Path | Required Role |
|-------|------|------|---------------|
| Dashboard | `pi pi-home` | `/dashboard` | MEMBER |
| My Schedule | `pi pi-calendar-plus` | `/my-schedule` | MEMBER |
| Signup Forms | `pi pi-file-edit` | `/forms` | MEMBER |
| Manage Events | `pi pi-user-edit` | `/manage-events` | COACH |
| Frequencies | `pi pi-calendar` | `/frequencies` | FACILITY_MANAGER |
| Facilities | `pi pi-building` | `/facilities` | FACILITY_MANAGER |
| Events | `pi pi-bolt` | `/events` | FACILITY_MANAGER |
| Venues | `pi pi-map-marker` | `/venues` | FACILITY_MANAGER |
| Schedules | `pi pi-users` | `/schedules` | FACILITY_MANAGER |
| Manage Users | `pi pi-users-cog` | `/manage-users` | FACILITY_MANAGER |

### Visibility by Role

| Role | Visible Items |
|------|--------------|
| MEMBER | Dashboard, My Schedule, Signup Forms, Profile (footer) |
| COACH | + Manage Events |
| FACILITY_MANAGER | + Frequencies, Facilities, Events, Venues, Schedules, Manage Users |
| WEB_ADMIN | Everything |

Filtering uses rank-based `hasRole`: a higher role passes all lower checks automatically.

## Theming

### Architecture

Three-file system in `src/theme/`:

| File | Purpose |
|------|---------|
| `theme-context.ts` | Type definition (`Theme = 'light' \| 'dark' \| 'system'`) and context |
| `ThemeContext.tsx` | Provider: localStorage persistence, OS detection, PrimeReact Aura integration |
| `ThemeSwitch.tsx` | UI: dropdown menu with Light/Dark/System options |

### How It Works

- **Persistence**: Reads/writes `localStorage` under key `'theme'`
- **System detection**: `useSyncExternalStore` with `window.matchMedia('(prefers-color-scheme: dark)')` for real-time OS dark-mode tracking
- **DOM side effect**: Sets `data-theme` attribute and `colorScheme` style on `<html>`
- **PrimeReact integration**: Wraps children in `<PrimeReactThemeProvider preset={Aura} darkModeSelector={...}>`

### ThemeSwitch UI

Uses PrimeReact 11 compound `Menu` components. Trigger button shows `pi pi-moon` (dark) or `pi pi-sun` (light). Dropdown offers Light, Dark, System with check indicator on the active option.

Rendered in the sidebar footer in `AppLayout.tsx`.

## Build & Lint

### Scripts

```bash
npm run dev      # Vite dev server (port 5173)
npm run build    # tsc -b && vite build (type-check then production build)
npm run lint     # oxlint
npm run preview  # preview production build locally
```

### Build Config (`frontend/vite.config.ts`)

- **Plugin**: `@vitejs/plugin-react` (React Fast Refresh, JSX transform)
- **Path alias**: `@` maps to `./src` (imports use `@/components/...`)
- **Dev proxy**: `/api` → `http://127.0.0.1:8000` (prefix stripped, `changeOrigin: true`)

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2.8 | UI framework |
| `react-dom` | ^19.2.8 | DOM renderer |
| `react-router-dom` | ^7.18.2 | Client-side routing |
| `primereact` | ^11.1.0 | UI component library |
| `@primeuix/themes` | ^3.0.0 | Aura theme preset |
| `primeflex` | ^4.0.0 | Utility CSS |
| `primeicons` | ^8.0.0 | Icon set |
| `vite` | ^8.2.0 | Build tool |
| `typescript` | ~6.0.2 | Type checking |
| `oxlint` | ^1.75.0 | Linting |

## Testing

No test framework is currently configured in the frontend. There are no `*.test.tsx` or `*.spec.tsx` files in `frontend/src/`.

Backend tests (`uv run pytest`) cover the API layer that the frontend consumes.

## See Also

- [Project README](../readme.md) — Getting started, quickstart, project structure
- [Architecture](../AGENTS.md) — Commands, patterns, conventions, gotchas
- [Backend Walkthrough](README-Backend.md) — FastAPI backend: architecture, data layer, routers, roles, encryption
