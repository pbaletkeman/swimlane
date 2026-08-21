"""Schedule route tests — cancel, CRUD, hard delete, bulk ops, list/get."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_list_schedules(client: TestClient, seed: dict) -> None:
    r = client.get("/schedules", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_get_schedule(client: TestClient, seed: dict) -> None:
    schedules = client.get("/schedules/me", headers=seed["m1"]).json()
    sid = schedules[0]["schedule_id"]
    r = client.get(f"/schedules/{sid}", headers=seed["m1"])
    assert r.status_code == 200
    assert r.json()["schedule_id"] == sid


def test_get_schedule_404(client: TestClient, seed: dict) -> None:
    r = client.get("/schedules/99999", headers=seed["m1"])
    assert r.status_code == 404


def test_my_schedule(client: TestClient, seed: dict) -> None:
    r = client.get("/schedules/me", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_my_schedule_events_alias(client: TestClient, seed: dict) -> None:
    r = client.get("/schedules/me/events", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_cancel_registration(client: TestClient, seed: dict) -> None:
    schedules = client.get("/schedules/me", headers=seed["m1"]).json()
    sid = schedules[0]["schedule_id"]
    r = client.post(f"/schedules/{sid}/cancel", headers=seed["m1"])
    assert r.status_code == 200
    active = client.get("/schedules/me", headers=seed["m1"]).json()
    assert not any(s["schedule_id"] == sid for s in active)


def test_cancel_other_member_forbidden(client: TestClient, seed: dict) -> None:
    # Create a schedule for m3, then m2 tries to cancel it
    created = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    ).json()
    sid = created["schedule_id"]
    r = client.post(f"/schedules/{sid}/cancel", headers=seed["m2"])
    assert r.status_code == 403


def test_create_schedule_manager(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    )
    assert r.status_code == 200


def test_create_schedule_coach_forbidden(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/schedules",
        headers=seed["coach1"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    )
    assert r.status_code == 403


def test_update_schedule_manager(client: TestClient, seed: dict) -> None:
    # Create a fresh schedule for this test
    created = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    ).json()
    sid = created["schedule_id"]
    r = client.put(
        f"/schedules/{sid}",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    )
    assert r.status_code == 200


def test_soft_delete_schedule_manager(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    ).json()
    sid = created["schedule_id"]
    r = client.delete(f"/schedules/{sid}", headers=seed["mgr"])
    assert r.status_code == 200


def test_hard_delete_schedule_admin(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    ).json()
    sid = created["schedule_id"]
    r = client.delete(f"/schedules/{sid}/hard", headers=seed["admin"])
    assert r.status_code == 200


def test_hard_delete_non_admin_forbidden(client: TestClient, seed: dict) -> None:
    # Create a fresh schedule for this test
    created = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    ).json()
    sid = created["schedule_id"]
    r = client.delete(f"/schedules/{sid}/hard", headers=seed["m1"])
    assert r.status_code == 403


def test_bulk_create_schedules(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/schedules/bulk",
        headers=seed["mgr"],
        json=[
            {"venue_id": seed["venue_id"], "member_id": "t-m3", "event_id": seed["ev_open"]},
        ],
    )
    assert r.status_code == 200
