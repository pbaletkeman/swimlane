# Roles

Role-based access control (RBAC) for the Swimlane application.

## Files

| File | Description |
|------|-------------|
| `user_role.py` | `UserRole` StrEnum — `WEB_ADMIN`, `FACILITY_MANAGER`, `COACH`, `MEMBER` |
| `roles.py` | Pre-configured `RoleChecker` instances — `admin_role`, `facility_manager_role`, `coach_role`, `member_role`, `all_users` |
| `roles_checker.py` | `RoleChecker` class — FastAPI dependency that decodes JWT tokens and enforces role hierarchy |

## Role Hierarchy

```
WEB_ADMIN > FACILITY_MANAGER > COACH > MEMBER
```

Higher roles inherit access to lower-role endpoints.
