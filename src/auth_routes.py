"""
Defaults all signed in users to a "user" role, and looks up their permissions in the local database
to bake those permissions into the JWT token issued by the app after Google OAuth completes.

Authentication subsystem providing Google OAuth2 login, session management, and
local JWT issuance for role‑based authorization.

This module integrates Authlib's Starlette client with FastAPI to support a
hybrid authentication model:

1. **Google OAuth2 Login**
   Users authenticate through Google's OpenID Connect flow. After successful
   authorization, Google returns an ID token and user profile information
   including email, name, and avatar.

2. **Session-Based Identity Tracking**
   The authenticated Google profile is stored in the server-side session,
   enabling lightweight identity checks for routes that only require verifying
   whether a user is logged in.

3. **Local JWT Generation**
   After OAuth completes, the application issues its own short‑lived JWT
   embedding the user's email and role. This token is used for backend API
   authorization, allowing the system to enforce role‑based access control
   independently of Google.

4. **Local User Registry**
   The module looks up the authenticated email in the application's user
   database. Unknown users are automatically registered with a default role,
   enabling seamless onboarding.

5. **Route Handlers**
   - `/login` redirects users to Google's OAuth consent screen.
   - `/auth/callback` processes the OAuth response, stores the session, and returns the local JWT.
   - `/me` and `/profile` expose the authenticated user's Google profile.
   - `/logout` clears the session and returns the user to the homepage.

Overall, this subsystem provides a secure, minimal, and extensible foundation
for authentication and authorization, combining third‑party identity with
first‑party role enforcement.
"""

import os
from typing import Any, Optional
from datetime import datetime, timedelta, timezone

from authlib.integrations.starlette_client import OAuth

from fastapi import Request, HTTPException, APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
from fastapi.responses import RedirectResponse

from jose import JWTError, exceptions, jwt
from starlette import status

from src.users import USER_DB, User
from src.config import ALGORITHM
from src.env import TOKEN_SECRET_KEY
from src.roles import member_role, UserRole
from src.misc_models import TokenData
from src.encryption import encrypt_field

# OAuth2 scheme for protected endpoints
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def create_local_access_token(data: dict[Any, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a short‑lived JWT access token used internally by the application.

    This token embeds the user's identity and role, and is separate from
    the Google OAuth token. It is used for authorizing access to protected
    backend routes.

    Args:
        data: A dictionary containing user claims such as `sub` and `role`.
        expires_delta: Optional custom expiration time. Defaults to 15 minutes.

    Returns:
        A signed JWT string with expiration embedded.
    """
    to_encode = data.copy()
    to_encode["type"] = "access"
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict[Any, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a long‑lived JWT refresh token.

    Refresh tokens are used to obtain new access tokens without re‑authenticating.
    They have a longer expiration time (default 7 days) and should be stored securely
    on the client side (e.g., in an HTTP-only cookie).

    Args:
        data: A dictionary containing user claims such as `sub` and `role`.
        expires_delta: Optional custom expiration time. Defaults to 7 days.

    Returns:
        A signed JWT string with expiration embedded.
    """
    to_encode = data.copy()
    to_encode["type"] = "refresh"
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, expected_type: str) -> TokenData:
    """Decodes and validates a token structure and type."""

    # Generate a token
    # token_data = {"sub": "user1", "type": "access"}
    # access_token = create_access_token(token_data)

    # Verify the token
    # try:
    #     decoded_token = verify_token(access_token, "access")
    #     print(decoded_token)
    # except HTTPException as e:
    #     print(e.detail)

    try:
        payload = jwt.decode(token, TOKEN_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {expected_type} token.",
            )
        return TokenData(**payload)
    except exceptions.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{expected_type.capitalize()} token expired"
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {expected_type} token"
        ) from exc


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """Validates the short-lived access token on generic endpoints."""
    payload = verify_token(token, expected_type="access")
    username: str = payload.sub
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return username


async def refresh_access_token(refresh_token: str) -> dict[str, str]:
    """
    Exchange a valid refresh token for a new access token.

    Args:
        refresh_token: The refresh token from the client.

    Returns:
        A dictionary containing the new access token.

    Raises:
        HTTPException: If the refresh token is invalid or expired.
    """
    payload = verify_token(refresh_token, expected_type="refresh")
    email: str = payload.sub

    # Fetch user data to include in the new access token
    user_record = USER_DB.get(email)
    if not user_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Create new access token with user's current role
    token_payload: dict[Any, Any] = {"sub": email, "role": user_record.get("role")}
    new_access_token = create_local_access_token(data=token_payload)

    return {"access_token": new_access_token, "token_type": "bearer"}

# ---------------------------
# ROUTES CLASS
# ---------------------------
security = HTTPBearer()

class AuthRoutes:
    """
    Defines all authentication‑related routes for Google OAuth and local JWT issuance.

    This class encapsulates:
    - Google OAuth login and callback handling
    - Session‑based user tracking
    - Local JWT generation for role‑based authorization
    - Basic profile and logout endpoints
    """
    # ------------------------------------------------------------------
    def __init__(self):
        """
        Initialize the OAuth client, load environment variables, and register routes.

        Raises:
            ValueError: If required Google OAuth environment variables are missing.
        """
        # --- ENV VARS ---
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if not google_client_id or not google_client_secret:
            raise ValueError("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")

        # --- OAUTH SETUP ---
        self.oauth: Any = OAuth()

        self.oauth.register(  # type: ignore
            name="google",
            client_id=google_client_id,
            client_secret=google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

        self.router = APIRouter()
        self.router.add_api_route("/login", self.login, methods=["GET"])
        self.router.add_api_route("/auth/callback", self.auth_callback, methods=["GET"])
        self.router.add_api_route("/refresh", self.refresh, methods=["POST"])
        self.router.add_api_route("/me", self.me, methods=["GET"]) # type: ignore
        self.router.add_api_route("/profile", self.me, methods=["GET"]) # type: ignore
        self.router.add_api_route("/logout", self.logout, methods=["GET"])

    # ------------------------------------------------------------------
    async def login(self, request: Request) -> Any:
        """
        Redirect the user to Google's OAuth login page.

        Args:
            request: The incoming FastAPI request.

        Returns:
            A redirect response sending the user to Google's OAuth consent screen.
        """
        redirect_uri = request.url_for("auth_callback")
        return await self.oauth.google.authorize_redirect(request, redirect_uri)  # type: ignore

    # ------------------------------------------------------------------
    async def auth_callback(self, request: Request) -> dict[str, Any]:
        """
        Handle Google's OAuth callback, extract user info, and issue a local JWT.

        Defaults all users to a "user" role, looks up their permissions in the local database,
        and bakes those permissions into the JWT token issued by the app after Google OAuth completes.

        Steps:
        1. Exchange the authorization code for a Google token.
        2. Extract the user's Google profile.
        3. Look up or auto‑register the user in the local database.
        4. Generate a local JWT embedding the user's role.
        5. Store the Google profile in the session.

        Args:
            request: The incoming FastAPI request.

        Returns:
            A dictionary containing:
            - A success message
            - The local JWT
            - The Google user profile

        Raises:
            HTTPException: If OAuth fails or user info is missing.
        """
        try:
            token: Any = await self.oauth.google.authorize_access_token(request)  # type: ignore
        except Exception as exc:
            raise HTTPException(status_code=400, detail="OAuth authorization failed") from exc

        user_info: dict[str, Any] = token.get("userinfo")  # type: ignore
        if not user_info:
            raise HTTPException(status_code=400, detail="No user info returned")

        #Look up user in local database to find their permissions
        sub: str | None = user_info.get("sub")  # type: ignore
        if not sub:
            raise HTTPException(status_code=400, detail="Email not found in user info")
        user_record = USER_DB.get(sub)

        if not user_record:
            # Register them automatically with a default role if not found
            user_record = {"sub": sub, "role": UserRole.MEMBER.value} # type: ignore
            USER_DB[sub] = user_record

        # 3. Bake the role directly into your own app's JWT token
        token_payload = {"sub": user_record["sub"], "role": user_record["role"]}
        access_token = create_local_access_token(data=token_payload)
        refresh_token = create_refresh_token(data=token_payload)
        print(f"Generated tokens for {sub}")

        request.session["user"] = dict(user_info)  # type: ignore
        return {
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user_info
        }

    # ------------------------------------------------------------------
    async def me( # type: ignore
            self,
            request: Request,  # injected value
            credentials: HTTPAuthorizationCredentials = Depends(security),  # injected value
            current_user: User = Depends(member_role)  # injected value
        ) -> dict: # type: ignore
        """
        Return the currently authenticated user's Google profile.

        Args:
            request: The incoming FastAPI request.

        Returns:
            The user dictionary stored in the session.

        Raises:
            HTTPException: If the user is not logged in.
        """
        assert credentials.credentials is not None  # make the linter happy that we are using the token
        assert request is not None  # make the linter happy that we are using the token

        if not current_user:
            raise HTTPException(status_code=401, detail="Not logged in")
        return current_user.dict() # type: ignore

    # ------------------------------------------------------------------
    async def refresh(self, request: Request) -> dict[str, str]:
        """
        Refresh an access token using a valid refresh token.

        Expects the refresh token in the request body as JSON:
        {
            "refresh_token": "<token_string>"
        }

        Args:
            request: The incoming FastAPI request.

        Returns:
            A dictionary containing the new access token.

        Raises:
            HTTPException: If the refresh token is missing, invalid, or expired.
        """
        try:
            body = await request.json()
            refresh_token: str | None = body.get("refresh_token")
            if not refresh_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="refresh_token is required"
                )
            return await refresh_access_token(refresh_token)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request body"
            ) from exc

    # ------------------------------------------------------------------
    async def logout(self, request: Request) -> RedirectResponse:
        """
        Log the user out by clearing their session and redirecting to the homepage.

        Args:
            request: The incoming FastAPI request.

        Returns:
            A redirect response to the root URL.
        """
        request.session.pop("user", None)
        return RedirectResponse(url="/")
