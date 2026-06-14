import os
from typing import Any
from datetime import datetime, timedelta, timezone

from authlib.integrations.starlette_client import OAuth

from fastapi import Depends, Request, HTTPException, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.users import User
from src.roles import admin_role, facility_manager_role, coach_role, member_role, all_users


# ---------------------------
# ROUTES CLASS
# ---------------------------

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
        current_user: User = Depends(all_users),
    ):
        token = credentials.credentials
        return {"token": token}

    async def admin_only(
        self,
        request: Request,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        current_user: User = Depends(admin_role),
    ):
        return {"message": "Admin Only"}


    async def facility_manager_only(
        self,
        request: Request,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        current_user: User = Depends(facility_manager_role),
    ):
        return {"message": "Admin Only"}


    async def coach_role_only(
            self,
            request: Request,
            credentials: HTTPAuthorizationCredentials = Depends(security),
            current_user: User = Depends(coach_role),
        ):
            return {"message": "Admin Only"}

    async def member_role_only(
            self,
            request: Request,
            credentials: HTTPAuthorizationCredentials = Depends(security),
            current_user: User = Depends(member_role),
        ):
            return {"message": "Admin Only"}
