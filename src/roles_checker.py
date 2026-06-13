from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from jose import jwt
from jose.exceptions import JWTError

from src.users import User
from src.auth_routes import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class RoleChecker:
    def __init__(self, allowed_roles: list[str]): # type: ignore
        self.allowed_roles = allowed_roles # type: ignore

    def __call__(self, token: str = Depends(oauth2_scheme)) -> User:
        try:
            # Decode the token issued by your backend
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email: str = payload.get("sub") # type: ignore
            role: str = payload.get("role") # type: ignore

            if not email  or  not role:
                raise HTTPException(status_code=401, detail="Invalid token claims")

        except JWTError:
            raise HTTPException(status_code=401, detail="Could not validate credentials")

        # Enforce role matching
        if role not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource"
            )

        return User(email=email, role=role)
