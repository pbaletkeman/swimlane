"""CRUD route tests for frequency, facility, venue — full lifecycle per entity.

NOTE: ``DELETE /<entity>/bulk`` is unreachable over HTTP — the
``DELETE /<entity>/{id}`` route registers first and captures ``bulk`` as an id
(422 int-parsing). Bulk-delete handlers are exercised directly until that
routing order is fixed.
"""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

# --- Frequencies -------------------------------------------------------


def _freq(name: str = "Biweekly", interval: str = "14") -> dict:
    return {"name": name, "day_interval": interval}


def test_list_frequencies(client: TestClient, seed: dict) -> None:
    r = client.get("/frequencies", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_frequency_404(client: TestClient, seed: dict) -> None:
    assert client.get("/frequencies/99999", headers=seed["m1"]).status_code == 404


def test_frequency_crud_lifecycle(client: TestClient, seed: dict) -> None:
    created = client.post("/frequencies", headers=seed["mgr"], json=_freq()).json()
    fid = created["frequency_id"]

    updated = client.put(f"/frequencies/{fid}", headers=seed["mgr"], json=_freq("Biweekly+", "15"))
    assert updated.status_code == 200 and updated.json()["name"] == "Biweekly+"

    assert client.delete(f"/frequencies/{fid}", headers=seed["mgr"]).status_code == 200


def test_create_frequency_forbidden_for_member(client: TestClient, seed: dict) -> None:
    assert client.post("/frequencies", headers=seed["m1"], json=_freq()).status_code == 403


def test_hard_delete_frequency(client: TestClient, seed: dict) -> None:
    fid = client.post("/frequencies", headers=seed["mgr"], json=_freq("Temp F", "3")).json()["frequency_id"]
    assert client.delete(f"/frequencies/{fid}/hard", headers=seed["m1"]).status_code == 403
    assert client.delete(f"/frequencies/{fid}/hard", headers=seed["admin"]).status_code == 200


def test_frequency_bulk(client: TestClient, seed: dict) -> None:
    created = client.post("/frequencies/bulk", headers=seed["mgr"], json=[_freq("BulkF1", "5"), _freq("BulkF2", "6")])
    assert created.status_code == 200
    # DELETE /bulk is shadowed by /{id}; verify the shadowing then call handlers directly
    assert client.delete("/frequencies/bulk", headers=seed["mgr"]).status_code == 422

    from src.routes.frequency_routes import FrequencyRequest, FrequencyRoutes

    bodies = [FrequencyRequest(name="BulkF1", day_interval="5")]
    soft = asyncio.run(FrequencyRoutes().delete_frequencies_bulk(bodies))
    assert "deleted" in soft["message"]
    hard = asyncio.run(FrequencyRoutes().hard_delete_frequencies_bulk(bodies))
    assert "permanently deleted" in hard["message"]


# --- Facilities --------------------------------------------------------


def _facility(name: str = "Annex Pool") -> dict:
    return {"name": name, "description": "Test facility", "max_capacity": 10, "min_capacity": 1}


def test_list_facilities(client: TestClient, seed: dict) -> None:
    r = client.get("/facilities", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_facility_404(client: TestClient, seed: dict) -> None:
    assert client.get("/facilities/99999", headers=seed["m1"]).status_code == 404


def test_facility_crud_lifecycle(client: TestClient, seed: dict) -> None:
    created = client.post("/facilities", headers=seed["mgr"], json=_facility()).json()
    fid = created["facility_id"]

    got = client.get(f"/facilities/{fid}", headers=seed["m1"])
    assert got.status_code == 200 and got.json()["name"] == "Annex Pool"

    updated = client.put(f"/facilities/{fid}", headers=seed["mgr"], json=_facility("Annex Pool West"))
    assert updated.status_code == 200 and updated.json()["name"] == "Annex Pool West"

    assert client.delete(f"/facilities/{fid}", headers=seed["mgr"]).status_code == 200


def test_create_facility_coach_forbidden(client: TestClient, seed: dict) -> None:
    assert client.post("/facilities", headers=seed["coach1"], json=_facility()).status_code == 403


def test_hard_delete_facility(client: TestClient, seed: dict) -> None:
    fid = client.post("/facilities", headers=seed["mgr"], json=_facility("Doomed Pool")).json()["facility_id"]
    assert client.delete(f"/facilities/{fid}/hard", headers=seed["mgr"]).status_code == 403
    assert client.delete(f"/facilities/{fid}/hard", headers=seed["admin"]).status_code == 200


def test_facility_bulk(client: TestClient, seed: dict) -> None:
    created = client.post("/facilities/bulk", headers=seed["mgr"], json=[_facility("B1"), _facility("B2")])
    assert created.status_code == 200
    assert client.delete("/facilities/bulk", headers=seed["mgr"]).status_code == 422

    from src.routes.facility_routes import FacilityRequest, FacilityRoutes

    bodies = [FacilityRequest(**_facility("B1"))]
    soft = asyncio.run(FacilityRoutes().delete_facilities_bulk(bodies))
    assert "deleted" in soft["message"]
    hard = asyncio.run(FacilityRoutes().hard_delete_facilities_bulk(bodies))
    assert "permanently deleted" in hard["message"]


# --- Venues ------------------------------------------------------------


def _venue(facility_id: int) -> dict:
    return {
        "facility_id": facility_id,
        "street": "9 Bulk St",
        "city": "Springfield",
        "state": "IL",
        "postal_code": "62701",
        "cost": 25.0,
    }


def test_list_venues(client: TestClient, seed: dict) -> None:
    r = client.get("/venues", headers=seed["m1"])
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_venue_404(client: TestClient, seed: dict) -> None:
    assert client.get("/venues/99999", headers=seed["m1"]).status_code == 404


def test_venue_crud_lifecycle(client: TestClient, seed: dict) -> None:
    payload = _venue(seed["facility_id"])
    created = client.post("/venues", headers=seed["mgr"], json=payload).json()
    vid = created["venue_id"]

    got = client.get(f"/venues/{vid}", headers=seed["m1"])
    assert got.status_code == 200 and got.json()["city"] == "Springfield"

    payload["city"] = "Shelbyville"
    updated = client.put(f"/venues/{vid}", headers=seed["mgr"], json=payload)
    assert updated.status_code == 200 and updated.json()["city"] == "Shelbyville"

    assert client.delete(f"/venues/{vid}", headers=seed["mgr"]).status_code == 200


def test_create_venue_member_forbidden(client: TestClient, seed: dict) -> None:
    assert client.post("/venues", headers=seed["m1"], json=_venue(seed["facility_id"])).status_code == 403


def test_hard_delete_venue(client: TestClient, seed: dict) -> None:
    vid = client.post("/venues", headers=seed["mgr"], json=_venue(seed["facility_id"])).json()["venue_id"]
    assert client.delete(f"/venues/{vid}/hard", headers=seed["m1"]).status_code == 403
    assert client.delete(f"/venues/{vid}/hard", headers=seed["admin"]).status_code == 200


def test_venue_bulk(client: TestClient, seed: dict) -> None:
    payload = _venue(seed["facility_id"])
    created = client.post("/venues/bulk", headers=seed["mgr"], json=[payload, {**payload, "street": "10 Bulk St"}])
    assert created.status_code == 200
    assert client.delete("/venues/bulk", headers=seed["mgr"]).status_code == 422

    from src.routes.venue_routes import VenueRequest, VenueRoutes

    bodies = [VenueRequest(**payload)]
    soft = asyncio.run(VenueRoutes().delete_venues_bulk(bodies))
    assert "deleted" in soft["message"]
    hard = asyncio.run(VenueRoutes().hard_delete_venues_bulk(bodies))
    assert "permanently deleted" in hard["message"]
