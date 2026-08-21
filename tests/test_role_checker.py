"""Tests for src/roles/roles_checker.py — JWT decode, role enforcement, hierarchy."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from src.env import TOKEN_SECRET_KEY
from src.roles.roles_checker import RoleChecker
from src.roles.user_role import UserRole


def _make_token(sub: str, role: str) -> str:
    return jwt.encode({"sub": sub, "role": role, "exp": 4102444800}, TOKEN_SECRET_KEY, algorithm="HS256")


app = FastAPI()
app.add_api_route("/admin", lambda: {"ok": True}, dependencies=[Depends(RoleChecker(["web_admin"]))])
app.add_api_route("/coach", lambda: {"ok": True}, dependencies=[Depends(RoleChecker(["coach", "web_admin"]))])
app.add_api_route("/member", lambda: {"ok": True}, dependencies=[Depends(RoleChecker(["member"]))])
app.add_api_route("/multi", lambda: {"ok": True}, dependencies=[Depends(RoleChecker(["member", "coach", "facility_manager"]))])


@pytest.fixture(scope="module")
def http():
    with TestClient(app) as c:
        yield c


def test_admin_access_granted(http):
    r = http.get("/admin", headers={"Authorization": f"Bearer {_make_token('u1', 'web_admin')}"})
    assert r.status_code == 200


def test_admin_access_denied_for_member(http):
    r = http.get("/admin", headers={"Authorization": f"Bearer {_make_token('u1', 'member')}"})
    assert r.status_code == 403


def test_coach_in_coach_route(http):
    r = http.get("/coach", headers={"Authorization": f"Bearer {_make_token('u1', 'coach')}"})
    assert r.status_code == 200


def test_admin_in_coach_route(http):
    r = http.get("/coach", headers={"Authorization": f"Bearer {_make_token('u1', 'web_admin')}"})
    assert r.status_code == 200


def test_member_denied_from_coach_route(http):
    r = http.get("/coach", headers={"Authorization": f"Bearer {_make_token('u1', 'member')}"})
    assert r.status_code == 403


def test_invalid_token(http):
    r = http.get("/admin", headers={"Authorization": "Bearer invalid.token.here"})
    assert r.status_code == 401


def test_missing_token(http):
    r = http.get("/admin")
    assert r.status_code == 401


def test_hierarchical_role_denied(http):
    r = http.get("/admin", headers={"Authorization": f"Bearer {_make_token('u1', 'coach')}"})
    assert r.status_code == 403


def test_multi_role_access(http):
    r = http.get("/multi", headers={"Authorization": f"Bearer {_make_token('u1', 'coach')}"})
    assert r.status_code == 200


def test_token_with_missing_claims(http):
    token = jwt.encode({"sub": "u1"}, TOKEN_SECRET_KEY, algorithm="HS256")
    r = http.get("/admin", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
