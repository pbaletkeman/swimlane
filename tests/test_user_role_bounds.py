"""User-management role bounds (Phases G/H): senior roles are web_admin-only."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_users_requires_auth(client: TestClient) -> None:
    assert client.get("/users").status_code == 401


def test_member_blocked_from_user_management(client: TestClient, seed: dict) -> None:
    assert client.get("/users", headers=seed["m1"]).status_code == 403
    assert client.put("/users/t-admin", headers=seed["m1"], json={"role": "coach"}).status_code == 403


def test_manager_cannot_assign_senior_roles(client: TestClient, seed: dict) -> None:
    for target, role in (("t-admin", "web_admin"), ("t-coach1", "web_admin"), ("t-coach2", "facility_manager")):
        r = client.put(f"/users/{target}", headers=seed["mgr"], json={"role": role})
        assert r.status_code == 403, (target, role, r.text)


def test_manager_cannot_list_or_escalate_self(client: TestClient, seed: dict) -> None:
    assert client.get("/users?role=facility_manager", headers=seed["mgr"]).status_code == 403
    assert client.put("/users/t-mgr", headers=seed["mgr"], json={"role": "web_admin"}).status_code == 403


def test_admin_can_assign_and_roles_persist(client: TestClient, seed: dict) -> None:
    assert client.put("/users/t-coach2", headers=seed["admin"], json={"role": "coach"}).status_code == 200
    admins = {u["sub"] for u in client.get("/users?role=web_admin", headers=seed["admin"]).json()}
    assert admins == {"t-admin"}
