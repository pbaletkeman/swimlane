---
name: rbac
description: Role-based access control with hierarchical roles and FastAPI dependency injection
---

## What this skill covers

The 4-tier hierarchical RBAC system implemented via FastAPI dependency injection.

## Role hierarchy

Four roles defined in `UserRole` StrEnum (`src/roles/user_role.py`):

- `WEB_ADMIN` -- full system access
- `FACILITY_MANAGER` -- facility operations oversight
- `COACH` -- team/member management
- `MEMBER` -- end-user

Roles are hierarchical -- higher roles inherit access to lower-role endpoints.

## Role checker dependency

`RoleChecker` (`src/roles/roles_checker.py`) is a callable FastAPI dependency class:

- `__init__(allowed_roles)`: stores a list of allowed role strings
- `__call__(token)`: decodes JWT, extracts `sub` (as `email`) and `role` claims, checks if `role` is in `allowed_roles`
- Returns `User(email=email, role=role)` on success
- Raises HTTP 401 for invalid/missing token claims, HTTP 403 for insufficient role

## Pre-built role instances (`src/roles/roles.py`)

- `admin_role` -- allows WEB_ADMIN only
- `facility_manager_role` -- allows FACILITY_MANAGER, WEB_ADMIN
- `coach_role` -- allows COACH, FACILITY_MANAGER, WEB_ADMIN
- `member_role` -- allows MEMBER, COACH, FACILITY_MANAGER, WEB_ADMIN
- `all_users` -- allows all UserRole values

## Usage pattern

```python
from src.roles.roles import admin_role, member_role


@router.get("/admin-only", dependencies=[Depends(HTTPBearer()), Depends(admin_role)])
def admin_endpoint():
    return {"message": "Admin only"}
```

## Key files

- `src/roles/user_role.py` -- UserRole StrEnum definition
- `src/roles/roles_checker.py` -- RoleChecker callable dependency class
- `src/roles/roles.py` -- pre-built role instances with hierarchical role lists

## Known issues

- `RoleChecker` returns `User(email=email, ...)` but the `User` model has no `email` field (it has `email_nonce` and `email_ciphertext`) -- would cause a Pydantic validation error at runtime

## When to use this skill

Use this when adding new protected routes, creating role-guarded endpoints, modifying role hierarchy, or debugging authorization issues (401/403 errors).
