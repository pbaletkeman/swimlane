---
name: auth-jwt
description: Google OAuth2 authentication and JWT access/refresh token system for FastAPI
---

## What this skill covers

Google OAuth2 login flow and local JWT token management for the Swimlane FastAPI application.

## Google OAuth2 (Authlib + OpenID Connect)

- OAuth2 authorization code flow via Authlib's Starlette integration
- OpenID Connect metadata discovery from Google's well-known endpoint
- Scopes: `openid email profile`
- Token exchange on callback, userinfo extraction (sub, email, given_name, family_name)
- Server-side session storage via Starlette `SessionMiddleware`

## JWT Token System (python-jose)

- **Access tokens**: 15-minute expiry, HS256 signing, `type: "access"` claim
- **Refresh tokens**: 7-day expiry, HS256 signing, `type: "refresh"` claim
- Token type validation on every protected route (`verify_token` checks expected type)
- Token refresh endpoint (`POST /refresh`) accepts refresh token, issues new access token
- `TokenData` Pydantic model for decoded JWT payload (`sub`, `type`)

## Authentication flow

1. `GET /login` redirects to Google OAuth2 consent screen
2. Google returns tokens + userinfo to `/auth/callback?code=...`
3. On callback: exchange code for token, extract userinfo, lookup user in DB by `sub`, auto-register as default MEMBER role if not found, generate local JWT access+refresh tokens
4. User gets two tokens back: short-lived `access_token` (15 min) and long-lived `refresh_token` (7 days)
5. Backend routes use the HTTP Bearer token via `Depends(security)`

## Key files

- `src/auth_routes.py` -- AuthRoutes class, OAuth2 setup, token creation/verification functions
- `src/misc_models.py` -- TokenData Pydantic model
- `src/env.py` -- TOKEN_SECRET_KEY constant
- `config.yaml` -- algorithm, access_token_expire_minutes, refresh_token_expire_days

## Known issues

- `USER_DB` is referenced in `auth_callback` and `refresh_access_token` but never defined -- would cause `NameError` at runtime
- Session secret (`os.urandom(24).hex()`) regenerated on every restart, invalidating all sessions
- `TOKEN_SECRET_KEY` is hardcoded in `src/env.py` -- should be an environment variable in production

## When to use this skill

Use this when working on authentication routes, JWT token creation/verification, OAuth2 callback handling, or session management. Also relevant when modifying token expiry settings in `config.yaml`.
