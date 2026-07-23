---
name: fastapi-patterns
description: FastAPI router registration, dependency injection, middleware, and Pydantic patterns
---

## What this skill covers

FastAPI and Starlette patterns used throughout the Swimlane application.

## Class-based router registration

Route groups are encapsulated in classes with `APIRouter` instances:

```python
class AuthRoutes:
    def __init__(self):
        self.router = APIRouter()
        self.router.add_api_route("/login", self.login, methods=["GET"])
        # ...

# In main.py
app.include_router(AuthRoutes().router)
```

Currently registered: `AuthRoutes` (auth endpoints) and `Sample` (demo endpoints).

## Dependency injection

- `HTTPBearer` -- extracts Bearer token from Authorization header
- `RoleChecker` -- callable class dependency for role enforcement (see rbac skill)
- `Depends(security)` -- token extraction pattern
- Route protection: `dependencies=[Depends(HTTPBearer()), Depends(role_checker)]`

## Session middleware

Starlette `SessionMiddleware` with `os.urandom(24).hex()` secret key, added in `main.py`.

## Pydantic models

- `User` (`src/data/users/user.py`) -- domain model with encrypted PII fields
- `TokenData` (`src/misc_models.py`) -- decoded JWT payload (`sub`, `type`)
- Request/response validation via Pydantic BaseModel

## ASGI server

Uvicorn for development, runs on `127.0.0.1:8000` when `main.py` is executed directly.

## Key files

- `main.py` -- app creation, middleware setup, router registration
- `src/auth_routes.py` -- AuthRoutes class with OAuth2 + JWT routes
- `src/sample_route.py` -- Sample class with demo routes
- `src/misc_models.py` -- shared Pydantic models

## Known issues

- No CORS middleware configured
- No health check endpoint
- No static file serving
- `OAuth2PasswordBearer` instantiated at module level but `HTTPBearer` used as actual dependency (dual pattern)

## When to use this skill

Use this when adding new route groups, modifying middleware, creating Pydantic models, or changing the app setup in `main.py`.
