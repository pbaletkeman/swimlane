"""Event route tests — CRUD, ownership guard, hard delete, bulk ops, capacity edge."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_events(client: TestClient, seed: dict) -> None:
    r = client.get("/events", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_get_event(client: TestClient, seed: dict) -> None:
    r = client.get(f"/events/{seed['ev_open']}", headers=seed["m1"])
    assert r.status_code == 200
    assert r.json()["event_id"] == seed["ev_open"]


def test_get_event_404(client: TestClient, seed: dict) -> None:
    r = client.get("/events/99999", headers=seed["m1"])
    assert r.status_code == 404


def test_create_event_coach(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/events",
        headers=seed["coach1"],
        json={
            "start_date_time": "2027-01-01T09:00:00",
            "end_date_time": "2027-01-01T11:00:00",
            "frequency_id": 1,
            "description": "New event",
            "venue_id": seed["venue_id"],
        },
    )
    assert r.status_code == 200
    assert r.json()["event_id"] > 0


def test_create_event_member_forbidden(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/events",
        headers=seed["m1"],
        json={
            "start_date_time": "2027-01-01T09:00:00",
            "end_date_time": "2027-01-01T11:00:00",
            "frequency_id": 1,
            "description": "X",
            "venue_id": seed["venue_id"],
        },
    )
    assert r.status_code == 403


def test_update_event_own(client: TestClient, seed: dict) -> None:
    r = client.put(
        f"/events/{seed['ev_open']}",
        headers=seed["coach1"],
        json={
            "start_date_time": "2027-01-01T09:00:00",
            "end_date_time": "2027-01-01T11:00:00",
            "frequency_id": 1,
            "description": "Updated",
            "venue_id": seed["venue_id"],
        },
    )
    assert r.status_code == 200
    assert r.json()["description"] == "Updated"


def test_update_event_other_coach_forbidden(client: TestClient, seed: dict) -> None:
    r = client.put(
        f"/events/{seed['ev_open']}",
        headers=seed["coach2"],
        json={
            "start_date_time": "2027-01-01T09:00:00",
            "end_date_time": "2027-01-01T11:00:00",
            "frequency_id": 1,
            "description": "Hijack",
            "venue_id": seed["venue_id"],
        },
    )
    assert r.status_code == 403


def test_update_event_manager_allowed(client: TestClient, seed: dict) -> None:
    r = client.put(
        f"/events/{seed['ev_open']}",
        headers=seed["mgr"],
        json={
            "start_date_time": "2027-01-01T09:00:00",
            "end_date_time": "2027-01-01T11:00:00",
            "frequency_id": 1,
            "description": "Mgr update",
            "venue_id": seed["venue_id"],
        },
    )
    assert r.status_code == 200


def test_soft_delete_event_own(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/events",
        headers=seed["coach1"],
        json={
            "start_date_time": "2027-06-01T09:00:00",
            "end_date_time": "2027-06-01T11:00:00",
            "frequency_id": 1,
            "description": "Delete me",
            "venue_id": seed["venue_id"],
        },
    ).json()
    eid = created["event_id"]
    r = client.delete(f"/events/{eid}", headers=seed["coach1"])
    assert r.status_code == 200


def test_soft_delete_event_other_coach_forbidden(client: TestClient, seed: dict) -> None:
    r = client.delete(f"/events/{seed['ev_open']}", headers=seed["coach2"])
    assert r.status_code == 403


def test_hard_delete_event_admin(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/events",
        headers=seed["admin"],
        json={
            "start_date_time": "2027-07-01T09:00:00",
            "end_date_time": "2027-07-01T11:00:00",
            "frequency_id": 1,
            "description": "Hard delete me",
            "venue_id": seed["venue_id"],
        },
    ).json()
    eid = created["event_id"]
    r = client.delete(f"/events/{eid}/hard", headers=seed["admin"])
    assert r.status_code == 200
    assert client.get(f"/events/{eid}", headers=seed["m1"]).status_code == 404


def test_hard_delete_event_non_admin_forbidden(client: TestClient, seed: dict) -> None:
    r = client.delete(f"/events/{seed['ev_open']}/hard", headers=seed["coach1"])
    assert r.status_code == 403


def test_event_capacity(client: TestClient, seed: dict) -> None:
    r = client.get(f"/events/{seed['ev_open']}/capacity")
    assert r.status_code == 200
    body = r.json()
    assert "registered_count" in body
    assert "max_capacity" in body


def test_bulk_create_events(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/events/bulk",
        headers=seed["mgr"],
        json=[
            {
                "start_date_time": "2027-08-01T09:00:00",
                "end_date_time": "2027-08-01T11:00:00",
                "frequency_id": 1,
                "description": "Bulk A",
                "venue_id": seed["venue_id"],
            },
            {
                "start_date_time": "2027-08-02T09:00:00",
                "end_date_time": "2027-08-02T11:00:00",
                "frequency_id": 1,
                "description": "Bulk B",
                "venue_id": seed["venue_id"],
            },
        ],
    )
    assert r.status_code == 200


def test_bulk_create_coach_forbidden(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/events/bulk",
        headers=seed["coach1"],
        json=[
            {
                "start_date_time": "2027-09-01T09:00:00",
                "end_date_time": "2027-09-01T11:00:00",
                "frequency_id": 1,
                "description": "X",
                "venue_id": seed["venue_id"],
            }
        ],
    )
    assert r.status_code == 403


def test_event_members_list(client: TestClient, seed: dict) -> None:
    # Use ev_full which starts empty (m2 and m3 register via capacity test, but that's a different test)
    r = client.get(f"/events/{seed['ev_full']}/members", headers=seed["coach1"])
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_event_members_other_coach_forbidden(client: TestClient, seed: dict) -> None:
    r = client.get(f"/events/{seed['ev_open']}/members", headers=seed["coach2"])
    assert r.status_code == 403


def test_add_event_member(client: TestClient, seed: dict) -> None:
    # Create a fresh event for this test
    created = client.post(
        "/events",
        headers=seed["coach1"],
        json={
            "start_date_time": "2027-10-01T09:00:00",
            "end_date_time": "2027-10-01T11:00:00",
            "frequency_id": 1,
            "description": "Add member test",
            "venue_id": seed["venue_id"],
        },
    ).json()
    eid = created["event_id"]
    r = client.post(
        f"/events/{eid}/members",
        headers=seed["coach1"],
        json={"member_id": "t-m3"},
    )
    assert r.status_code == 200


def test_remove_event_member(client: TestClient, seed: dict) -> None:
    # Create a fresh event, add member, then remove
    created = client.post(
        "/events",
        headers=seed["coach1"],
        json={
            "start_date_time": "2027-11-01T09:00:00",
            "end_date_time": "2027-11-01T11:00:00",
            "frequency_id": 1,
            "description": "Remove member test",
            "venue_id": seed["venue_id"],
        },
    ).json()
    eid = created["event_id"]
    client.post(
        f"/events/{eid}/members",
        headers=seed["coach1"],
        json={"member_id": "t-m3"},
    )
    schedules = client.get("/schedules/me", headers=seed["m3"]).json()
    sid = next(s["schedule_id"] for s in schedules if s["event_id"] == eid)
    r = client.delete(f"/events/{eid}/members/{sid}", headers=seed["coach1"])
    assert r.status_code == 200
