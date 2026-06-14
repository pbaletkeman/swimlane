"""
FastAPI application entrypoint for initializing authentication routes and session
management.

This module performs the following tasks:

- Loads environment configuration using `load_config()` so that OAuth, database,
  and other project settings are available before the application starts.
- Creates the main FastAPI application instance.
- Adds Starlette's `SessionMiddleware` to enable secure server‑side session
  storage, required for OAuth flows and user session tracking.
- Registers the authentication router provided by `AuthRoutes`, which exposes
  login, callback, and related authentication endpoints.
- Provides a development entrypoint using Uvicorn when executed directly.

Run this module with `uvicorn main:app --reload` during development.
"""

import os
from fastapi import Depends, FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer

# Load your config (your function)
from src.util.load_config import load_config
from src.auth_routes import AuthRoutes
from src.sample_route import Sample

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
security = HTTPBearer()

load_config()

app = FastAPI()

# @app.get("/profile")
# def read_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
#     token = credentials.credentials
#     return {"token": token}


# --- SESSION MIDDLEWARE ---
app.add_middleware(SessionMiddleware, secret_key=os.urandom(24).hex())

# Include the router in the app
auth_routes = AuthRoutes()
app.include_router(auth_routes.router)
app.include_router(Sample().router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

# uvicorn main:app --reload
