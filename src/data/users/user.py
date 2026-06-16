import datetime

from pydantic import BaseModel

from src.roles import UserRole

class User(BaseModel):
    """Data model representing a user with role information."""
    sub: str  # Unique identifier for the user (e.g., subject claim from JWT)
    role: UserRole  # User's assigned role (e.g., "admin", "user")

    first_name_nonce: str
    first_name_ciphertext: str
    last_name_nonce: str
    last_name_ciphertext: str
    email_nonce: str
    email_ciphertext: str

    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None
    deleted_at: datetime.datetime | None = None

    is_active: bool = True
    is_deleted: bool = False
