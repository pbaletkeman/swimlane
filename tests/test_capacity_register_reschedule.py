"""Capacity, register, and reschedule behavior (Phase C endpoints)."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_capacity_is_public(client: TestClient, seed: dict) -> None:
    r = client.get(f"/events/{seed['ev_open']}/capacity")
    assert r.status_code == 200
    body = r.json()
    assert body["registered_count"] == 0 and body["max_capacity"] == 2


def test_register_requires_auth(client: TestClient, seed: dict) -> None:
    assert client.post(f"/events/{seed['ev_open']}/register").status_code == 401


def test_register_and_duplicate_guard(client: TestClient, seed: dict) -> None:
    r = client.post(f"/events/{seed['ev_open']}/register", headers=seed["m1"])
    assert r.status_code == 200
    assert client.post(f"/events/{seed['ev_open']}/register", headers=seed["m1"]).status_code == 409
    assert client.get(f"/events/{seed['ev_open']}/capacity").json()["registered_count"] == 1


def test_capacity_409_when_full(client: TestClient, seed: dict) -> None:
    for h in (seed["m2"], seed["m3"]):
        assert client.post(f"/events/{seed['ev_full']}/register", headers=h).status_code == 200
    assert client.post(f"/events/{seed['ev_full']}/register", headers=seed["m1"]).status_code == 409


def test_reschedule_moves_schedule_and_venue(client: TestClient, seed: dict) -> None:
    mine = client.get("/schedules/me", headers=seed["m2"]).json()
    sid = next(s["schedule_id"] for s in mine if s["event_id"] == seed["ev_full"])

    # target (ev_open) currently holds m1; moving m2 in keeps it under cap
    r = client.post(f"/schedules/{sid}/reschedule", headers=seed["m2"], json={"event_id": seed["ev_open"]})
    assert r.status_code == 200

    counts = {
        eid: client.get(f"/events/{eid}/capacity").json()["registered_count"]
        for eid in (seed["ev_full"], seed["ev_open"])
    }
    assert counts == {seed["ev_full"]: 1, seed["ev_open"]: 2}

    moved = next(s for s in client.get("/schedules/me", headers=seed["m2"]).json() if s["schedule_id"] == sid)
    assert moved["event_id"] == seed["ev_open"]


def test_reschedule_guards(client: TestClient, seed: dict) -> None:
    # someone else's schedule -> 403
    others_sid = next(
        s["schedule_id"]
        for s in client.get("/schedules/me", headers=seed["m3"]).json()
        if s["event_id"] == seed["ev_full"]
    )
    assert (
        client.post(
            f"/schedules/{others_sid}/reschedule", headers=seed["m2"], json={"event_id": seed["ev_full"]}
        ).status_code
        == 403
    )
    # full target (ev_open holds m1+m2 = 2/2) -> 409
    assert (
        client.post(
            f"/schedules/{others_sid}/reschedule", headers=seed["m3"], json={"event_id": seed["ev_open"]}
        ).status_code
        == 409
    )
    # missing target event -> 404
    mine = next(
        s["schedule_id"]
        for s in client.get("/schedules/me", headers=seed["m1"]).json()
        if s["event_id"] == seed["ev_open"]
    )
    assert client.post(f"/schedules/{mine}/reschedule", headers=seed["m1"], json={"event_id": 99999}).status_code == 404


def test_my_schedule_and_ical_content_type(client: TestClient, seed: dict) -> None:
    r = client.get("/schedules/me", headers=seed["m1"])
    assert r.status_code == 200 and len(r.json()) >= 1
    ical = client.get("/schedules/me/ical", headers=seed["m1"])
    assert ical.status_code == 200 and "text/calendar" in ical.headers["content-type"]
    assert ical.text.startswith("BEGIN:VCALENDAR") and "BEGIN:VEVENT" in ical.text
