# Swimlane Frontend — Done

Progress log for the React + TypeScript + PrimeReact UI work tracked in `frontend-todo.md`.

## Phase 2 — Theming (dark / light / system) (complete: 2.0–2.5)

Branch: `feature/theming`

- [x] Installed `@primeuix/themes` (PrimeReact 11 ships no `resources/themes/*.css`; theming is now CSS-in-JS via `@primeuix/themes` presets + `@primeuix/styled` runtime)
- [x] `src/theme/ThemeContext.tsx` — provider component only (Fast Refresh-friendly)
- [x] `src/theme/theme-context.ts` — `Theme` type (`light | dark | system`), `ThemeContext`, `useTheme`
- [x] Wired `<ThemeProvider>` (PrimeReact v11) with the `Aura` preset; `darkModeSelector` = `"system"` (OS `prefers-color-scheme`) or `[data-theme='dark']` (forced modes)
- [x] Effective theme resolved from `window.matchMedia("(prefers-color-scheme: dark)")` when `system`
- [x] `data-theme` + `color-scheme` set on `<html>` per effective theme
- [x] Persist override in `localStorage["theme"]`, default `system`
- [x] `main.tsx`: wrapped app in `ThemeProvider`, imported `primeicons.css` + `primeflex.css`
- [x] Temporary switcher in `App.tsx` (`pi-sun` / `pi-moon` / `pi-desktop` PrimeReact Buttons) to exercise the theme — to be replaced by the topbar control in 2.7

## Verification

- [x] `npm run lint` (oxlint) — clean
- [x] `npm run build` (`tsc -b && vite build`) — passes; Aura preset tokens emitted as CSS variables, primeicons fonts bundled
- [ ] Manual browser check of light/dark/system switching (pending)

## Notes

- PrimeReact 11 adaptation: the plan's `aura-light`/`aura-dark` CSS files no longer exist in v11. Used the v11 `ThemeProvider` + `@primeuix/themes/aura` preset instead; the `darkModeSelector` option replaces stylesheet swapping.
- `2.6` (live `matchMedia` tracking) and `2.7` (topbar switch) remain — deliberately left for later steps.
- `@primereact/core/theme` exports `ThemeProvider`; `@primeuix/themes/aura` default-exports the preset.
- `theme-context.ts` split from `ThemeContext.tsx` to satisfy the `react(only-export-components)` Fast Refresh lint rule.

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