import os
from typing import Any
from datetime import datetime, timedelta, timezone

from authlib.integrations.starlette_client import OAuth

from fastapi import Depends, Request, HTTPException, APIRouter
from fastapi.responses import RedirectResponse


from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()


from src.roles_checker import RoleChecker
from src.users import User

# Instantiate specific role dependencies
allow_admin = RoleChecker(["admin"])
allow_all_users = RoleChecker(["admin", "user"])

# ---------------------------
# ROUTES CLASS
# ---------------------------
from fastapi import Depends, Request, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

class Sample:
    def __init__(self):
        self.router = APIRouter()
        self.router.add_api_route("/open", self.open, methods=["GET"])
        self.router.add_api_route("/secure", self.secure, methods=["GET"])
        self.router.add_api_route("/admin", self.admin_only, methods=["GET"])

    async def open(self, request: Request):
        return {"message": "Open"}

    async def secure(
        self,
        request: Request,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        current_user: User = Depends(allow_all_users),
    ):
        token = credentials.credentials
        return {"token": token}

    async def admin_only(
        self,
        request: Request,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        current_user: User = Depends(allow_admin),
    ):
        return {"message": "Admin Only"}
