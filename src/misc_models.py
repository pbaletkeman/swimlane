"""Shared Pydantic models used across the application."""

from pydantic import BaseModel


class TokenData(BaseModel):
    """Data model for decoded JWT token payload."""

    sub: str
    type: str  # Expected token type (e.g., "access", "refresh")
    role: str | None = None
