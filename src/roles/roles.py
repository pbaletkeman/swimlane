"""
User Role and Authorization Dependency Definitions.

This module defines the system's `UserRole` enumeration and instantiates
hierarchical `RoleChecker` dependency instances used for role-based access
control (RBAC) across application routes and services.
"""

from src.roles.roles_checker import RoleChecker
from src.roles.user_role import UserRole


# Instantiate specific role dependencies
admin_role = RoleChecker([
  UserRole.WEB_ADMIN.value
])
"""RoleChecker: Grants access to Web Administrators only."""


facility_manager_role = RoleChecker([
  UserRole.FACILITY_MANAGER.value,
  UserRole.WEB_ADMIN.value
])
"""RoleChecker: Grants access to Facility Managers and Web Administrators."""


coach_role = RoleChecker([
  UserRole.COACH.value,
  UserRole.FACILITY_MANAGER.value,
  UserRole.WEB_ADMIN.value
])
"""RoleChecker: Grants access to Coaches, Facility Managers, and Web Administrators."""


member_role = RoleChecker([
  UserRole.MEMBER.value,
  UserRole.COACH.value,
  UserRole.FACILITY_MANAGER.value,
  UserRole.WEB_ADMIN.value
])
"""RoleChecker: Grants access to Members, Coaches, Facility Managers, and Web Administrators."""


all_users = RoleChecker([x.value for x in UserRole])
"""RoleChecker: Grants access to all authenticated UserRole types."""
