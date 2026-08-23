"""Coverage batch: user management, member edit, message 404s, bulk handlers, logging."""

from __future__ import annotations

import asyncio
import logging

from fastapi.testclient import TestClient

# --- User management ---------------------------------------------------


def test_list_users_mgr(client: TestClient, seed: dict) -> None:
    r = client.get("/users", headers=seed["mgr"])
    assert r.status_code == 200
    users = r.json()
    assert len(users) >= 7
    assert "email" in users[0] and "name" in users[0]


def test_list_users_by_role(client: TestClient, seed: dict) -> None:
    r = client.get("/users", headers=seed["mgr"], params={"role": "coach"})
    assert r.status_code == 200
    assert all(u["role"] == "coach" for u in r.json())


def test_get_user_detail(client: TestClient, seed: dict) -> None:
    r = client.get("/users/t-m1", headers=seed["mgr"])
    assert r.status_code == 200
    assert r.json()["sub"] == "t-m1"


def test_get_user_404(client: TestClient, seed: dict) -> None:
    assert client.get("/users/nobody-here", headers=seed["mgr"]).status_code == 404


def test_invite_new_member(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/users",
        headers=seed["mgr"],
        json={"email": "new-invite@example.com", "role": "member"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "invited" and body["role"] == "member"


def test_invite_existing_email_conflict(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/users",
        headers=seed["mgr"],
        json={"email": "t-m1@example.com", "role": "coach"},
    )
    assert r.status_code == 409


def test_change_role_unknown_user(client: TestClient, seed: dict) -> None:
    r = client.put("/users/nobody/role", headers=seed["mgr"], json={"role": "coach"})
    assert r.status_code == 404


def _mk_real_user(sub: str, email: str) -> None:
    """Insert an actual users row (invites don't create users until Google login)."""
    from conftest import _make_user

    from src.data.users.sqlite import SQLite as UsersSQLite

    db = UsersSQLite()
    db.create_users_bulk([_make_user(sub, "member", email)])


def test_soft_delete_member_by_mgr(client: TestClient, seed: dict) -> None:
    _mk_real_user("del-me", "del-me@example.com")
    r = client.delete("/users/del-me", headers=seed["mgr"])
    assert r.status_code == 200 and "soft-deleted" in r.json()["message"]


def test_soft_delete_unknown_user(client: TestClient, seed: dict) -> None:
    assert client.delete("/users/nobody", headers=seed["mgr"]).status_code == 404


def test_hard_delete_invited_user(client: TestClient, seed: dict) -> None:
    _mk_real_user("hard-del", "hard-del@example.com")
    assert client.delete("/users/hard-del/hard", headers=seed["mgr"]).status_code == 403
    r = client.delete("/users/hard-del/hard", headers=seed["admin"])
    assert r.status_code == 200 and "permanently deleted" in r.json()["message"]


def test_hard_delete_unknown_user(client: TestClient, seed: dict) -> None:
    assert client.delete("/users/nobody/hard", headers=seed["admin"]).status_code == 404


# --- Event member edit branches -----------------------------------------


def _fresh_event_with_member(client: TestClient, seed: dict, day: str) -> tuple[int, int]:
    eid = client.post(
        "/events",
        headers=seed["coach1"],
        json={
            "start_date_time": f"{day}T09:00:00",
            "end_date_time": f"{day}T11:00:00",
            "frequency_id": 1,
            "description": f"Edit test {day}",
            "venue_id": seed["venue_id"],
        },
    ).json()["event_id"]
    client.post(f"/events/{eid}/members", headers=seed["coach1"], json={"member_id": "t-m3"})
    sid = next(s["schedule_id"] for s in client.get("/schedules/me", headers=seed["m3"]).json() if s["event_id"] == eid)
    return eid, sid


def test_edit_event_member_move_venue(client: TestClient, seed: dict) -> None:
    eid, sid = _fresh_event_with_member(client, seed, "2027-12-01")
    new_vid = client.post(
        "/venues",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "street": "5 Edit St",
            "city": "Springfield",
            "state": "IL",
            "postal_code": "62701",
        },
    ).json()["venue_id"]
    r = client.put(f"/events/{eid}/members/{sid}", headers=seed["mgr"], json={"venue_id": new_vid})
    assert r.status_code == 200
    assert r.json()["venue_id"] == new_vid


def test_edit_event_member_other_coach_forbidden(client: TestClient, seed: dict) -> None:
    eid, sid = _fresh_event_with_member(client, seed, "2027-12-02")
    r = client.put(f"/events/{eid}/members/{sid}", headers=seed["coach2"], json={})
    assert r.status_code == 403


def test_edit_event_member_unknown_event(client: TestClient, seed: dict) -> None:
    r = client.put("/events/99999/members/1", headers=seed["mgr"], json={})
    assert r.status_code == 404


def test_edit_event_member_schedule_mismatch(client: TestClient, seed: dict) -> None:
    eid, sid = _fresh_event_with_member(client, seed, "2027-12-03")
    r = client.put(f"/events/{eid}/members/99999", headers=seed["mgr"], json={})
    assert r.status_code == 404


def test_edit_event_member_bad_target_venue(client: TestClient, seed: dict) -> None:
    eid, sid = _fresh_event_with_member(client, seed, "2027-12-04")
    r = client.put(f"/events/{eid}/members/{sid}", headers=seed["mgr"], json={"venue_id": 99999})
    assert r.status_code == 404


def test_edit_event_member_bad_target_event(client: TestClient, seed: dict) -> None:
    eid, sid = _fresh_event_with_member(client, seed, "2027-12-05")
    r = client.put(f"/events/{eid}/members/{sid}", headers=seed["mgr"], json={"event_id": 99999})
    assert r.status_code == 404


# --- Message edge cases --------------------------------------------------


def test_send_message_unknown_recipient(client: TestClient, seed: dict) -> None:
    r = client.post(
        "/messages",
        headers=seed["coach1"],
        json={"member_id": "ghost-user", "subject": "Hi", "body": "X"},
    )
    assert r.status_code == 404


def test_mark_read_unknown_message(client: TestClient, seed: dict) -> None:
    assert client.put("/messages/999999/read", headers=seed["m1"]).status_code == 404


def test_delete_unknown_message(client: TestClient, seed: dict) -> None:
    assert client.delete("/messages/999999", headers=seed["m1"]).status_code == 404


def test_hard_delete_unknown_message(client: TestClient, seed: dict) -> None:
    assert client.delete("/messages/999999/hard", headers=seed["admin"]).status_code == 404


# --- Bulk delete handlers (HTTP /bulk DELETE is shadowed by /{id}) -------


def test_form_bulk_delete_handlers(client: TestClient, seed: dict) -> None:
    from src.data.form_question.form_question import QuestionType
    from src.routes.form_routes import FormRoutes, QuestionIdRequest, QuestionRequest, RuleIdRequest, RuleRequest

    fr = FormRoutes()
    q = asyncio.run(
        fr.create_question(
            QuestionRequest(
                facility_id=seed["facility_id"],
                prompt="Bulk del Q",
                question_type=QuestionType.TEXT,
                is_required=False,
                sort_order=1,
            )
        )
    )
    r_rule = asyncio.run(
        fr.create_rule(
            RuleRequest(
                facility_id=seed["facility_id"],
                title="Bulk del R",
                content="C",
                sort_order=1,
            )
        )
    )

    qid = q.form_question_id
    rid = r_rule.rule_id
    assert qid is not None and rid is not None
    soft_q = asyncio.run(fr.delete_questions_bulk([QuestionIdRequest(form_question_id=qid)]))
    hard_q = asyncio.run(fr.hard_delete_questions_bulk([QuestionIdRequest(form_question_id=qid)]))
    soft_r = asyncio.run(fr.delete_rules_bulk([RuleIdRequest(rule_id=rid)]))
    hard_r = asyncio.run(fr.hard_delete_rules_bulk([RuleIdRequest(rule_id=rid)]))
    assert all("deleted" in x["message"] for x in (soft_q, hard_q, soft_r, hard_r))


def test_schedule_bulk_delete_handlers(client: TestClient, seed: dict) -> None:
    from src.routes.schedule_routes import ScheduleRequest, ScheduleRoutes

    sr = ScheduleRoutes()
    created = client.post(
        "/schedules",
        headers=seed["mgr"],
        json={
            "venue_id": seed["venue_id"],
            "member_id": "t-m3",
            "event_id": seed["ev_open"],
        },
    ).json()

    bodies = [
        ScheduleRequest(
            venue_id=created["venue_id"],
            member_id=created["member_id"],
            event_id=created["event_id"],
        )
    ]
    soft = asyncio.run(sr.delete_schedules_bulk(bodies))
    hard = asyncio.run(sr.hard_delete_schedules_bulk(bodies))
    assert "deleted" in soft["message"]
    assert "permanently deleted" in hard["message"]


# --- Logging setup -------------------------------------------------------


def test_setup_logging_text_and_levels(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.delenv("LOG_FORMAT", raising=False)
    monkeypatch.delenv("LOG_FILE", raising=False)
    from src.util.logging import setup_logging

    setup_logging()
    logging.getLogger("check").debug("debug works")


def test_setup_logging_json_and_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LOG_FORMAT", "json")
    monkeypatch.setenv("LOG_FILE", str(tmp_path / "logs" / "test.log"))
    from src.util.logging import JSONFormatter, setup_logging

    setup_logging()
    rec = logging.LogRecord("x", logging.ERROR, "p", 1, "boom %s", ("arg",), None)
    out = JSONFormatter().format(rec)
    assert '"level": "ERROR"' in out and "boom arg" in out

    err_rec = logging.LogRecord("x", logging.ERROR, "p", 1, "with exc", (), (ValueError, ValueError("v"), None))
    assert "exception" in JSONFormatter().format(err_rec)
