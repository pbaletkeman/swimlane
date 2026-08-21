"""Coach scoping: coaches may only manage their own events (Phase F guard)."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_other_coach_blocked_from_delete_and_members(client: TestClient, seed: dict) -> None:
    assert client.delete(f"/events/{seed['ev_full']}", headers=seed["coach2"]).status_code == 403
    assert client.get(f"/events/{seed['ev_full']}/members", headers=seed["coach2"]).status_code == 403


def test_owning_coach_and_managers_can_list_members(client: TestClient, seed: dict) -> None:
    r = client.get(f"/events/{seed['ev_full']}/members", headers=seed["coach1"])
    assert r.status_code == 200 and len(r.json()) >= 1
    assert client.get(f"/events/{seed['ev_full']}/members", headers=seed["mgr"]).status_code == 200


def test_coach_events_scoped_to_owner(client: TestClient, seed: dict) -> None:
    mine = client.get("/coach/events?scope=all", headers=seed["coach1"]).json()
    assert {e["event_id"] for e in mine} >= {seed["ev_full"], seed["ev_open"]}
    assert client.get("/coach/events?scope=all", headers=seed["coach2"]).json() == []
