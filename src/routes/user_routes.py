"""
User management API routes for facility managers and web admins.

Provides coach account management: listing users (optionally filtered by role)
and inviting new members/coaches by email so their first Google login applies
the invited role. Follows the class-based router pattern used across the app.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.users.sqlite import SQLite as UsersSQLite
from src.data.users.user import User
from src.roles.roles import facility_manager_role

logger = logging.getLogger(__name__)

RoleChoice = Literal["member", "coach", "facility_manager", "web_admin"]


class ManagedUser(BaseModel):
    """A user record suitable for coach management (no ciphertext fields)."""

    sub: str
    role: str
    is_active: bool
    is_deleted: bool


class UserRoutes:
    """Defines all user-management routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/users", tags=["users"])

        self.router.add_api_route(
            "",
            self.list_users,
            methods=["GET"],
            dependencies=[Depends(facility_manager_role)],
        )

    # ------------------------------------------------------------------
    def _get_users_db(self) -> UsersSQLite:
        return UsersSQLite()

    # ------------------------------------------------------------------
    def _to_managed(self, user: User) -> ManagedUser:
        return ManagedUser(
            sub=user.sub,
            role=user.role or "member",
            is_active=user.is_active,
            is_deleted=user.is_deleted,
        )

    # ------------------------------------------------------------------
    async def list_users(
        self,
        current_user: User = Depends(facility_manager_role),
        role: RoleChoice | None = None,
    ) -> list[ManagedUser]:
        """List users, optionally filtered by role. Senior-role lookups are admin-only."""
        try:
            if role in ("facility_manager", "web_admin") and current_user.role != "web_admin":
                raise HTTPException(
                    status_code=403,
                    detail="Only web admins may list users with facility_manager or web_admin roles",
                )
            users = self._get_users_db().list_users_by_role(role) if role else self._get_users_db().list_users()
            return [self._to_managed(user) for user in (users or [])]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list users")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
