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