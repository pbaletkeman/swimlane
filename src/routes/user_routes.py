"""
User management API routes for facility managers and web admins.

Provides coach account management: listing users (optionally filtered by role)
and inviting new members/coaches by email so their first Google login applies
the invited role. Follows the class-based router pattern used across the app.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from src.data.user_invite.sqlite import SQLite as UserInviteSQLite
from src.data.user_invite.user_invite import UserInvite
from src.data.users.sqlite import SQLite as UsersSQLite
from src.data.users.user import User
from src.encryption import decrypt_field, hash_field
from src.roles.roles import admin_role, facility_manager_role

logger = logging.getLogger(__name__)

RoleChoice = Literal["member", "coach", "facility_manager", "web_admin"]


def _mask(value: str | None) -> str | None:
    """Mask a value by keeping its first character and replacing the rest with asterisks."""
    if not value:
        return None
    if len(value) <= 1:
        return value
    return f"{value[0]}{'*' * (len(value) - 1)}"


def _mask_email(value: str | None) -> str | None:
    """Mask the local part of an email, keeping the domain visible."""
    if not value or "@" not in value:
        return _mask(value)
    local, _, domain = value.partition("@")
    return f"{_mask(local)}@{domain}"


class ManagedUser(BaseModel):
    """A user record suitable for coach management.

    PII is decrypted server-side and masked before serialization — raw
    ciphertext never leaves the API (see G.3).
    """

    sub: str
    role: str
    name: str | None = None
    email: str | None = None
    is_active: bool
    is_deleted: bool


class UserInviteInput(BaseModel):
    """Request body for inviting a new user by email (coach or member only)."""

    email: EmailStr
    role: Literal["coach", "member"]


class UserInviteOut(BaseModel):
    """Result of creating a pre-registration invite keyed by email hash."""

    email: str
    role: str
    status: str


class UserRoleInput(BaseModel):
    """Request body for changing a user's role."""

    role: RoleChoice


class UserRoutes:
    """Defines all user-management routes."""

    def __init__(self):
        """Register the user routes on a new APIRouter."""
        self.router = APIRouter(prefix="/users", tags=["users"])

        self.router.add_api_route(
            "",
            self.list_users,
            methods=["GET"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{sub}",
            self.get_user,
            methods=["GET"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "",
            self.create_user,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{sub}",
            self.change_user_role,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{sub}",
            self.delete_user,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{sub}/hard",
            self.hard_delete_user,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_users_db(self) -> UsersSQLite:
        """Return a fresh SQLite user store."""
        return UsersSQLite()

    # ------------------------------------------------------------------
    def _get_invite_db(self) -> UserInviteSQLite:
        """Return a fresh SQLite user invite store."""
        return UserInviteSQLite()

    # ------------------------------------------------------------------
    def _display_name(self, user: User) -> str | None:
        """Decrypt and combine first/last name, then mask it."""
        try:
            if not user.first_name_nonce or not user.first_name_ciphertext:
                return None
            first = decrypt_field(user.first_name_nonce, user.first_name_ciphertext)
            last = ""
            if user.last_name_nonce and user.last_name_ciphertext:
                last = decrypt_field(user.last_name_nonce, user.last_name_ciphertext)
            return _mask(f"{first} {last}".strip()) or None
        except Exception:
            return None

    # ------------------------------------------------------------------
    def _display_email(self, user: User) -> str | None:
        """Decrypt the user's email and mask the local part."""
        try:
            if user.email_nonce and user.email_ciphertext:
                return _mask_email(decrypt_field(user.email_nonce, user.email_ciphertext))
        except Exception:
            pass
        return None

    # ------------------------------------------------------------------
    def _to_managed(self, user: User) -> ManagedUser:
        """Convert a user into a masked ManagedUser response."""
        return ManagedUser(
            sub=user.sub,
            role=user.role or "member",
            name=self._display_name(user),
            email=self._display_email(user),
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

    # ------------------------------------------------------------------
    async def get_user(self, sub: str) -> ManagedUser:
        """Get a single user by their subject identifier."""
        try:
            user = self._get_users_db().get_user_by_sub(sub)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return self._to_managed(user)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get user")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_user(self, body: UserInviteInput) -> UserInviteOut:
        """Invite a new user by email so their first Google login applies the invited role.

        Role is limited to coach or member (privilege bound); senior-role
        invites are out of scope for this phase. Existing users are rejected
        here — change their role via the role-change endpoint instead.
        """
        try:
            email = str(body.email).lower()
            if self._get_users_db().get_user_by_email(email):
                raise HTTPException(status_code=409, detail="User already registered")

            email_hash = hash_field(email)
            invite = self._get_invite_db().create_invite(UserInvite(email_hash=email_hash, role=body.role))
            if not invite:
                raise HTTPException(status_code=500, detail="Failed to create invite")
            return UserInviteOut(email=email, role=invite.role, status="invited")
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create user invite")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def change_user_role(
        self,
        sub: str,
        body: UserRoleInput,
        current_user: User = Depends(facility_manager_role),
    ) -> ManagedUser:
        """Change a user's role. Facility managers may only assign coach/member."""
        try:
            if body.role in ("facility_manager", "web_admin") and current_user.role != "web_admin":
                raise HTTPException(
                    status_code=403,
                    detail="Only web admins may assign facility_manager or web_admin roles",
                )
            user = self._get_users_db().get_user_by_sub(sub)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            user.role = body.role
            updated = self._get_users_db().update_user(user)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update user role")
            return self._to_managed(updated)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to change user role")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_user(self, sub: str, current_user: User = Depends(facility_manager_role)) -> dict[str, str]:
        """Soft-delete a user (facility manager+). Senior-role users are admin-only."""
        try:
            user = self._get_users_db().get_user_by_sub(sub)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if user.role in ("facility_manager", "web_admin") and current_user.role != "web_admin":
                raise HTTPException(
                    status_code=403,
                    detail="Only web admins may delete users with facility_manager or web_admin roles",
                )
            self._get_users_db().delete_user_by_sub(sub)
            return {"message": "User soft-deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to soft-delete user")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_user(self, sub: str) -> dict[str, str]:
        """Permanently delete a user (admin only)."""
        try:
            user = self._get_users_db().get_user_by_sub(sub)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            self._get_users_db().hard_delete_user_by_sub(sub)
            return {"message": "User permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard-delete user")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
