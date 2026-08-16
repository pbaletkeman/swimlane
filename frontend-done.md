# Swimlane Frontend — Done

Progress log for the React + TypeScript + PrimeReact UI work tracked in `frontend-todo.md`.

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