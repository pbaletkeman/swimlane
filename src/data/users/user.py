import datetime

from pydantic import BaseModel

# from src.roles.roles import UserRole


class User(BaseModel):
    """Data model representing a user with role information."""

    sub: str  # Unique identifier for the user (e.g., subject claim from JWT)
    role: str | None = None  # UserRole  # User's assigned role (e.g., "admin", "user")

    first_name_nonce: str | None = None
    first_name_ciphertext: str | None = None
    last_name_nonce: str | None = None
    last_name_ciphertext: str | None = None
    email_nonce: str | None = None
    email_ciphertext: str | None = None
    email_hash: str | None = None

    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None
    deleted_at: datetime.datetime | None = None

    is_active: bool = True
    is_deleted: bool = False
