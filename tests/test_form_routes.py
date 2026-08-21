"""Form route tests — question CRUD, rule CRUD, submission list, PDF export."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_get_facility_form(client: TestClient, seed: dict) -> None:
    r = client.get(f"/forms/{seed['facility_id']}", headers=seed["m1"])
    assert r.status_code == 200
    body = r.json()
    assert "facility_id" in body


def test_get_facility_form_404(client: TestClient, seed: dict) -> None:
    r = client.get("/forms/99999", headers=seed["m1"])
    assert r.status_code == 404


def test_create_question(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/forms/questions",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "Do you have insurance?",
            "question_type": "checkbox",
            "is_required": True,
            "sort_order": 1,
        },
    )
    assert r.status_code == 200
    assert r.json()["form_question_id"] > 0


def test_create_question_member_forbidden(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/forms/questions",
        headers=seed["m1"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "X",
            "question_type": "text",
            "is_required": False,
            "sort_order": 1,
        },
    )
    assert r.status_code == 403


def test_update_question(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/forms/questions",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "Original",
            "question_type": "text",
            "is_required": False,
            "sort_order": 1,
        },
    ).json()
    qid = created["form_question_id"]
    r = client.put(
        f"/forms/questions/{qid}",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "Updated",
            "question_type": "text",
            "is_required": False,
            "sort_order": 1,
        },
    )
    assert r.status_code == 200


def test_delete_question(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/forms/questions",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "Delete me",
            "question_type": "text",
            "is_required": False,
            "sort_order": 1,
        },
    ).json()
    qid = created["form_question_id"]
    r = client.delete(f"/forms/questions/{qid}", headers=seed["mgr"])
    assert r.status_code == 200


def test_hard_delete_question_admin(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/forms/questions",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "Hard delete",
            "question_type": "text",
            "is_required": False,
            "sort_order": 1,
        },
    ).json()
    qid = created["form_question_id"]
    r = client.delete(f"/forms/questions/{qid}/hard", headers=seed["admin"])
    assert r.status_code == 200


def test_create_rule(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/forms/rules",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "title": "Pool Rules",
            "content": "No diving",
            "sort_order": 1,
        },
    )
    assert r.status_code == 200
    assert r.json()["rule_id"] > 0


def test_update_rule(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/forms/rules",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "title": "Original",
            "content": "Content",
            "sort_order": 1,
        },
    ).json()
    rid = created["rule_id"]
    r = client.put(
        f"/forms/rules/{rid}",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "title": "Updated",
            "content": "Updated content",
            "sort_order": 1,
        },
    )
    assert r.status_code == 200


def test_delete_rule(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/forms/rules",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "title": "Delete me",
            "content": "X",
            "sort_order": 1,
        },
    ).json()
    rid = created["rule_id"]
    r = client.delete(f"/forms/rules/{rid}", headers=seed["mgr"])
    assert r.status_code == 200


def test_hard_delete_rule_admin(client: TestClient, seed: dict) -> None:
    created = client.post(
        "/forms/rules",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "title": "Hard delete",
            "content": "X",
            "sort_order": 1,
        },
    ).json()
    rid = created["rule_id"]
    r = client.delete(f"/forms/rules/{rid}/hard", headers=seed["admin"])
    assert r.status_code == 200


def test_my_submissions(client: TestClient, seed: dict) -> None:
    r = client.get("/forms/me/submissions", headers=seed["m1"])
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_bulk_create_questions(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/forms/questions/bulk",
        headers=seed["mgr"],
        json=[
            {
                "facility_id": seed["facility_id"],
                "prompt": "Bulk Q1",
                "question_type": "text",
                "is_required": False,
                "sort_order": 1,
            },
        ],
    )
    assert r.status_code == 200


def test_bulk_create_rules(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/forms/rules/bulk",
        headers=seed["mgr"],
        json=[
            {
                "facility_id": seed["facility_id"],
                "title": "Bulk Rule",
                "content": "Content",
                "sort_order": 1,
            },
        ],
    )
    assert r.status_code == 200
