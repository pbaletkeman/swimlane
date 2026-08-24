"""
Authentication and Role-Based Access Control (RBAC) Dependencies.

This module provides the `RoleChecker` class, which serves as a FastAPI
dependency for decoding JWT tokens, authenticating users, and enforcing
role-based permissions on endpoint routes.
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

from src.data.users.user import User
from src.env import TOKEN_SECRET_KEY
from src.util.configs import Config

bearer_scheme = HTTPBearer()

config: dict = Config.yaml_config()  # type: ignore

algorithm: str = config["security"]["algorithm"]  # type: ignore


class RoleChecker:
    """
    FastAPI dependency for enforcing role-based permissions.

    Validates incoming JWT access tokens and checks if the user's role
    matches the allowed roles for a specific route.

    Attributes:
        allowed_roles: A list of strings representing roles authorized
            to access the route.
    """

    def __init__(self, allowed_roles: list[str]):  # type: ignore
        """
        Initializes the RoleChecker with authorized roles.

        Args:
            allowed_roles: List of user role names permitted for the route.
        """

        self.allowed_roles = allowed_roles  # type: ignore

    def __call__(
        self, credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
    ) -> User:
        """
        Validates the JWT token and authorizes the user role.

        Decodes the incoming Bearer token, extracts user identity and role
        claims, and ensures the user role exists within the allowed scope.

        Args:
            credentials: The HTTP Bearer credentials extracted from the request headers.

        Returns:
            User: An instantiated user object containing email and role details.

        Raises:
            HTTPException: 401 error if token is invalid or claims are missing.
            HTTPException: 403 error if the user lacks the required role.
        """
        token = credentials.credentials
        try:
            # Decode the token issued by your backend
            payload = jwt.decode(token, TOKEN_SECRET_KEY, algorithms=[algorithm])
            sub: str = payload.get("sub")  # type: ignore
            role: str = payload.get("role")  # type: ignore

            if not sub or not role:
                raise HTTPException(status_code=401, detail="Invalid token claims")

        except JWTError as exc:
            raise HTTPException(status_code=401, detail="Could not validate credentials") from exc

        # Enforce role matching
        if role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission to access this resource")

        return User(sub=sub, role=role)
