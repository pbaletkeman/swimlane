"""Form submission flow (submit, list, detail, PDF) + coach event scoping."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _make_question(client: TestClient, seed: dict) -> int:
    created = client.post(
        "/forms/questions",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": "Can you swim 50m?",
            "question_type": "checkbox",
            "is_required": True,
            "sort_order": 1,
        },
    ).json()
    return created["form_question_id"]


def _submit(client: TestClient, seed: dict, headers: dict, qid: int | None = None, signed: bool = True) -> dict:
    responses = []
    if qid is not None:
        responses.append({"question_id": qid, "answer_text": None, "answer_bool": True})
    r = client.post(
        f"/forms/{seed['facility_id']}/submit",
        headers=headers,
        json={"signed": signed, "responses": responses},
    )
    assert r.status_code == 200
    return r.json()


def test_form_display_shows_questions(client: TestClient, seed: dict) -> None:
    qid = _make_question(client, seed)
    form = client.get(f"/forms/{seed['facility_id']}", headers=seed["m1"]).json()
    assert any(q["form_question_id"] == qid for q in form["questions"])
    client.delete(f"/forms/questions/{qid}", headers=seed["mgr"])


def test_submit_requires_signature(client: TestClient, seed: dict) -> None:
    r = client.post(
        f"/forms/{seed['facility_id']}/submit",
        headers=seed["m1"],
        json={"signed": False, "responses": []},
    )
    assert r.status_code == 400


def test_submit_and_list_own_submissions(client: TestClient, seed: dict) -> None:
    qid = _make_question(client, seed)
    sub = _submit(client, seed, seed["m1"], qid)
    sid = sub["submission_id"]
    assert sid > 0

    mine = client.get("/forms/me/submissions", headers=seed["m1"]).json()
    assert any(s["submission_id"] == sid for s in mine)

    detail = client.get(f"/forms/submissions/{sid}", headers=seed["m1"])
    assert detail.status_code == 200

    # cleanup
    client.delete(f"/forms/questions/{qid}", headers=seed["mgr"])


def test_submission_detail_other_member_forbidden(client: TestClient, seed: dict) -> None:
    qid = _make_question(client, seed)
    sub = _submit(client, seed, seed["m1"], qid)
    sid = sub["submission_id"]

    r = client.get(f"/forms/submissions/{sid}", headers=seed["m2"])
    assert r.status_code == 403

    # managers can read any
    assert client.get(f"/forms/submissions/{sid}", headers=seed["mgr"]).status_code == 200
    client.delete(f"/forms/questions/{qid}", headers=seed["mgr"])


def test_pdf_export_own(client: TestClient, seed: dict) -> None:
    qid = _make_question(client, seed)
    sub = _submit(client, seed, seed["m1"], qid)
    sid = sub["submission_id"]

    r = client.get(f"/forms/submissions/{sid}/pdf", headers=seed["m1"])
    assert r.status_code == 200
    assert "application/pdf" in r.headers["content-type"]
    assert r.content[:4] == b"%PDF"
    client.delete(f"/forms/questions/{qid}", headers=seed["mgr"])


def test_pdf_export_other_member_forbidden(client: TestClient, seed: dict) -> None:
    qid = _make_question(client, seed)
    sub = _submit(client, seed, seed["m1"], qid)
    sid = sub["submission_id"]

    assert client.get(f"/forms/submissions/{sid}/pdf", headers=seed["m2"]).status_code == 403
    assert client.get(f"/forms/submissions/{sid}/pdf", headers=seed["coach1"]).status_code == 200
    client.delete(f"/forms/questions/{qid}", headers=seed["mgr"])


def test_submit_unknown_facility_404(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/forms/99999/submit",
        headers=seed["m1"],
        json={"signed": True, "responses": []},
    )
    assert r.status_code == 404


# --- Coach scoping -----------------------------------------------------


def test_coach_events_upcoming(client: TestClient, seed: dict) -> None:
    r = client.get("/coach/events", params={"scope": "upcoming"}, headers=seed["coach1"])
    assert r.status_code == 200
    events = r.json()
    assert len(events) >= 2
    assert all(e["coach_id"] == "t-coach1" for e in events)


def test_coach_events_all_scoped_to_owner(client: TestClient, seed: dict) -> None:
    r = client.get("/coach/events", params={"scope": "all"}, headers=seed["coach2"])
    assert r.status_code == 200
    assert all(e["coach_id"] == "t-coach2" for e in r.json())


def test_coach_events_past(client: TestClient, seed: dict) -> None:
    r = client.get("/coach/events", params={"scope": "past"}, headers=seed["coach1"])
    assert r.status_code == 200


def test_coach_events_member_forbidden(client: TestClient, seed: dict) -> None:
    r = client.get("/coach/events", headers=seed["m1"])
    assert r.status_code == 403


def test_coach_events_requires_auth(client: TestClient, seed: dict) -> None:
    assert client.get("/coach/events").status_code == 401
