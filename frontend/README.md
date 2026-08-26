# Swimlane Frontend

React + TypeScript + Vite SPA for the Swimlane FastAPI backend, styled with PrimeReact 11, PrimeIcons, and PrimeFlex.

## Prerequisites

- Node.js (20+)
- The Swimlane backend running on `http://127.0.0.1:8000` (see the root [`readme.md`](../readme.md))

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the backend

```bash
# from the repository root
uv run python main.py
```

The API is available at `http://127.0.0.1:8000`. The frontend does not need a running backend just to render, but login, forms, and CRUD require it.

### 3. Start the dev server

```bash
npm run dev
```

Vite serves the app on `http://localhost:5173` (it picks another port if 5173 is busy). Open that URL and sign in with Google.

`/` is a **public** home page (explore + login/dashboard). Signing in lands on the authenticated dashboard at `/dashboard`; the entity CRUD pages and the signup form view/builder also sit behind the route guard. Explore routes (`/explore/*`) are accessible without auth but use the full app layout (sidebar + topbar).

## How login works (dev)

The frontend calls `{apiBaseUrl}/login?frontend_url=<frontend origin>` (see `src/auth/AuthContext.tsx`). The backend validates the origin, then redirects back to `<origin>/auth/callback` with `access_token`, `refresh_token`, and the Google `user` profile appended after the Google round-trip. Because the frontend passes its own origin, login keeps working even if Vite serves on a non-default port.

## Backend configuration

`VITE_API_URL` is the backend origin:

- **Unset (default)** — API calls go through the Vite dev proxy (`/api` → `http://127.0.0.1:8000`, prefix stripped — see `vite.config.ts`). No CORS.
- **Set** — the frontend calls the backend directly (used for production builds, e.g. `VITE_API_URL=https://swimlane.example.com`).

Copy `.env.example` to `.env` to override:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

The matching backend setting is `security.frontend_url` in the root `config.yaml` (or the `FRONTEND_URL` env var), which is where the OAuth callback redirects the browser when no origin is passed at `/login`. For backend-only testing, point it at `http://localhost:8000` — the callback then lands on the API Devtools page (see the root readme).

## Theme behavior

- Three modes: `light`, `dark`, `system`.
- `system` follows the OS `prefers-color-scheme` live via `matchMedia`.
- The user override persists in `localStorage["theme"]`; `data-theme` is set on `<html>`.
- Built on the PrimeReact 11 `ThemeProvider` with the `Aura` preset.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) + production build to `dist/` |
| `npm run lint` | Oxlint |
| `npm run preview` | Preview the production build |

## Structure

```plaintext
frontend/
├── src/
│   ├── api/           # typed endpoint modules + fetch client (Bearer token, 401 refresh)
│   ├── auth/          # AuthContext, tokens, RouteGuard, LoginPage, callback page
│   ├── components/    # EntityDataTable, EntityFormDialog, ConfirmDelete, toasts, EmptyState…
│   ├── layout/        # AppLayout (responsive Sidebar nav) + nav config
│   ├── pages/         # Dashboard + entity CRUD pages + signup form view/builder
│   ├── router/        # lazy-loaded routes
│   ├── theme/         # light/dark/system theming
│   └── toast/         # global toast helpers
├── vite.config.ts     # dev proxy + @ alias
└── .env.example       # VITE_API_URL documentation
```

See the root `AGENTS.md` and `frontend-todo.md`/`frontend-done.md` for the full feature plan and progress.