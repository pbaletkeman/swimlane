"""Public (unauthenticated) browse routes + auth /me /refresh /logout basics."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_public_venues_no_auth(client: TestClient, seed: dict) -> None:
    r = client.get("/public/venues")
    assert r.status_code == 200
    venues = r.json()
    assert len(venues) >= 1
    assert "facility_name" in venues[0]


def test_public_venues_search(client: TestClient, seed: dict) -> None:
    r = client.get("/public/venues", params={"q": "Springfield"})
    assert r.status_code == 200


def test_public_venue_detail(client: TestClient, seed: dict) -> None:
    r = client.get(f"/public/venues/{seed['venue_id']}")
    assert r.status_code == 200
    assert r.json()["venue_id"] == seed["venue_id"]


def test_public_venue_detail_404(client: TestClient, seed: dict) -> None:
    assert client.get("/public/venues/99999").status_code == 404


def test_public_venue_schedules_week(client: TestClient, seed: dict) -> None:
    r = client.get(f"/public/venues/{seed['venue_id']}/schedules", params={"view": "week"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_public_venue_schedules_month(client: TestClient, seed: dict) -> None:
    r = client.get(f"/public/venues/{seed['venue_id']}/schedules", params={"view": "month"})
    assert r.status_code == 200


def test_public_venue_schedules_list(client: TestClient, seed: dict) -> None:
    # Venue-scoped views require an active schedule at the venue; create one
    client.post(f"/events/{seed['ev_open']}/register", headers=seed["m1"])
    r = client.get(f"/public/venues/{seed['venue_id']}/schedules", params={"view": "list"})
    assert r.status_code == 200
    events = r.json()
    assert any(e["event_id"] == seed["ev_open"] for e in events)


def test_public_venue_schedules_unknown_venue(client: TestClient, seed: dict) -> None:
    assert client.get("/public/venues/99999/schedules").status_code == 404


def test_public_events_listing(client: TestClient, seed: dict) -> None:
    r = client.get("/public/events")
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_public_events_search(client: TestClient, seed: dict) -> None:
    r = client.get("/public/events", params={"q": "Morning practice"})
    assert r.status_code == 200
    events = r.json()
    assert any(e["description"] == "Morning practice" for e in events)


def test_public_events_filter_venue(client: TestClient, seed: dict) -> None:
    r = client.get("/public/events", params={"venue_id": seed["venue_id"]})
    assert r.status_code == 200
    assert all(e["venue_id"] == seed["venue_id"] for e in r.json())


def test_public_event_detail(client: TestClient, seed: dict) -> None:
    r = client.get(f"/public/events/{seed['ev_open']}")
    assert r.status_code == 200
    body = r.json()
    assert body["event_id"] == seed["ev_open"]
    assert "registered_count" in body and "max_capacity" in body
    assert body["venue"] is not None


def test_public_event_detail_404(client: TestClient, seed: dict) -> None:
    assert client.get("/public/events/99999").status_code == 404


# --- Auth basics -------------------------------------------------------


def test_me_returns_profile(client: TestClient, seed: dict) -> None:
    r = client.get("/me", headers=seed["m1"])
    assert r.status_code == 200
    body = r.json()
    assert body["sub"] == "t-m1"
    assert body["role"] == "member"


def test_me_requires_token(client: TestClient, seed: dict) -> None:
    assert client.get("/me").status_code == 401


def test_refresh_missing_body(client: TestClient, seed: dict) -> None:
    assert client.post("/refresh", json={}).status_code == 400


def test_refresh_invalid_token(client: TestClient, seed: dict) -> None:
    r = client.post("/refresh", json={"refresh_token": "not-a-token"})
    assert r.status_code == 401


def test_logout_redirects(client: TestClient, seed: dict) -> None:
    r = client.get("/logout", follow_redirects=False)
    assert r.status_code in (302, 307)
