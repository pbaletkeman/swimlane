from users import BaseModel


class TokenData(BaseModel):
    """Data model for decoded JWT token payload."""
    sub: str
    type: str  # Expected token type (e.g., "access", "refresh")
