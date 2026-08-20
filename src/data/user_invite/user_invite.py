"""User invite data model for email-keyed pre-registration role assignment."""

from pydantic import BaseModel


class UserInvite(BaseModel):
    """An intended role for a not-yet-registered user, keyed by email hash.

    Created by facility managers/admins via POST /users with an email address.
    `auth_callback` resolves the invite by email hash before auto-registering,
    so the user's first Google login applies the invited role.
    """

    email_hash: str
    role: str
    is_active: bool = True
