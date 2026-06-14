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
from typing import Any
from datetime import datetime, timedelta, timezone

from authlib.integrations.starlette_client import OAuth

from fastapi import Request, HTTPException, APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse

from jose import jwt

from src.users import USER_DB, User
from src.config import SECRET_KEY, ALGORITHM
from src.roles import member_role, UserRole

def create_local_access_token(data: dict[Any, Any]) -> str:
    """
    Create a short‑lived JWT used internally by the application.

    This token embeds the user's identity and role, and is separate from
    the Google OAuth token. It is used for authorizing access to protected
    backend routes.

    Args:
        data: A dictionary containing user claims such as `sub` and `role`.

    Returns:
        A signed JWT string with a 60‑minute expiration.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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
        self.router.add_api_route("/me", self.me, methods=["GET"]) # type: ignore
        self.router.add_api_route("/profile", self.me, methods=["GET"]) # type: ignore
        self.router.add_api_route("/logout", self.logout, methods=["GET"])

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
        email: str | None = user_info.get("email")  # type: ignore
        if not email:
            raise HTTPException(status_code=400, detail="Email not found in user info")
        user_record = USER_DB.get(email)

        if not user_record:
            # Register them automatically with a default role if not found
            user_record = {"email": email, "role": UserRole.MEMBER.value} # type: ignore
            USER_DB[email] = user_record

        # 3. Bake the role directly into your own app's JWT token
        token_payload = {"sub": user_record["email"], "role": user_record["role"]}
        token = create_local_access_token(data=token_payload)
        print(f"Generated token for {email}: {token}")

        request.session["user"] = dict(user_info)  # type: ignore
        return {"message": "Login successful", "token": token, "user": user_info}

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
