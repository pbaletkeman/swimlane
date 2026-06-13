import os
from typing import Any
from datetime import datetime, timedelta, timezone

from authlib.integrations.starlette_client import OAuth

from fastapi import Request, HTTPException, APIRouter
from fastapi.responses import RedirectResponse

from jose import jwt

from src.users import USER_DB

SECRET_KEY = "your-app-super-secret-key" # Keep this safe!
ALGORITHM = "HS256"

def create_local_access_token(data: dict[Any, Any]) -> str:
    """Generates a localized JWT containing the user's scope/role."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------
# ROUTES CLASS
# ---------------------------
class AuthRoutes:
    def __init__(self):

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
        redirect_uri = request.url_for("auth_callback")
        return await self.oauth.google.authorize_redirect(request, redirect_uri)  # type: ignore

    async def auth_callback(self, request: Request) -> dict[str, Any]:
        try:
            token: Any = await self.oauth.google.authorize_access_token(request)  # type: ignore
        except Exception as exc:
            raise HTTPException(status_code=400, detail="OAuth authorization failed") from exc

        user_info: dict = token.get("userinfo")  # type: ignore
        if not user_info:
            raise HTTPException(status_code=400, detail="No user info returned")

        #Look up user in local database to find their permissions
        email:str = user_info.get("email")
        user_record = USER_DB.get(email)

        if not user_record:
            # Register them automatically with a default role if not found
            user_record = {"email": email, "role": "user"}
            USER_DB[email] = user_record

        # 3. Bake the role directly into your own app's JWT token
        token_payload = {"sub": user_record["email"], "role": user_record["role"]}
        token = create_local_access_token(data=token_payload)
        print(f"Generated token for {email}: {token}")

        request.session["user"] = dict(user_info)  # type: ignore
        return {"message": "Login successful", "token": token, "user": user_info}

    async def me(self, request: Request) -> dict: # type: ignore
        user = request.session.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Not logged in")
        return user

    async def logout(self, request: Request) -> RedirectResponse:
        request.session.pop("user", None)
        return RedirectResponse(url="/")
