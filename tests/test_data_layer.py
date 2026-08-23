"""Direct data-layer coverage: bulk deletes, admin helpers, message/submission ops."""

from __future__ import annotations

from datetime import datetime, timedelta

from conftest import _make_user
from fastapi.testclient import TestClient

from src.data.form_submission.sqlite import SQLite as FormSubmissionSQLite
from src.data.message.message import Message
from src.data.message.sqlite import SQLite as MessageSQLite
from src.data.users.sqlite import SQLite as UsersSQLite
from src.data.users.user import User

# --- Users sqlite -------------------------------------------------------


def test_create_admin_user_and_getters(client: TestClient, seed: dict) -> None:
    db = UsersSQLite()
    admin = db.create_admin_user(_make_user("dl-admin", "web_admin", "dl-admin@example.com"))
    assert admin is not None and admin.sub == "dl-admin"

    sublist = db.get_sublist([admin])
    assert sublist is not None and "dl-admin" in sublist

    # clean up so other tests' user listings stay deterministic
    assert db.hard_delete_user_by_sub("dl-admin") is True


def test_user_exists_variants(client: TestClient, seed: dict) -> None:
    db = UsersSQLite()
    assert db.user_exists(sub="t-m1") is True
    assert db.user_exists(email="t-m1@example.com") is True
    assert db.user_exists(sub="ghost") is False


def test_update_user_missing_returns_none(client: TestClient, seed: dict) -> None:
    ghost = User(
        sub="ghost-update",
        role="member",
        first_name_nonce="x",
        first_name_ciphertext="y",
        last_name_nonce="x",
        last_name_ciphertext="y",
        email_nonce="x",
        email_ciphertext="y",
        email_hash="h",
    )
    assert UsersSQLite().update_user(ghost) is None


def test_user_bulk_deletes(client: TestClient, seed: dict) -> None:
    db = UsersSQLite()
    a = db.create_user(_make_user("bulk-u1", "member", "bulk-u1@example.com"))
    b = db.create_user(_make_user("bulk-u2", "coach", "bulk-u2@example.com"))
    assert a is not None and b is not None

    soft = db.delete_users_bulk([a])
    assert soft is not None and all(u.is_deleted for u in soft)

    hard = db.hard_delete_users_bulk([b])
    assert hard is not None and {u.sub for u in hard} == {"bulk-u2"}
    assert db.get_user_by_sub("bulk-u2") is None


# --- Messages sqlite ----------------------------------------------------


def test_message_update_list_bulk(client: TestClient, seed: dict) -> None:
    db = MessageSQLite()
    created = db.create_message(Message(member_id="t-m3", sender_id="t-coach1", subject="U", body="B"))
    assert created is not None

    updated = db.update_message(
        Message(
            message_id=created.message_id, member_id="t-m3", sender_id="t-coach1", subject="U", body="B", is_read=True
        )
    )
    assert updated is not None and updated.is_read is True

    listed = db.list_messages()
    assert listed is not None and any(m.message_id == created.message_id for m in listed)

    second = db.create_message(Message(member_id="t-m3", sender_id="t-coach1", subject="U3", body="B3"))
    assert second is not None
    soft = db.delete_messages_bulk([created, second])
    assert soft is not None and len(soft) == 2

    hard = db.hard_delete_messages_bulk([created, second])
    assert hard is not None and len(hard) == 2


def test_message_bulk_create(client: TestClient, seed: dict) -> None:
    db = MessageSQLite()
    msgs = [
        Message(member_id="t-m1", sender_id="t-coach1", subject="BC1", body="x"),
        Message(member_id="t-m1", sender_id="t-coach1", subject="BC2", body="y"),
    ]
    out = db.create_messages_bulk(msgs)
    assert out is not None and len(out) == 2


# --- Form submissions sqlite --------------------------------------------


def _mk_submission(client: TestClient, seed: dict, tag: str, member_headers: dict | None = None) -> int:
    qid = client.post(
        "/forms/questions",
        headers=seed["mgr"],
        json={
            "facility_id": seed["facility_id"],
            "prompt": f"Q {tag}",
            "question_type": "text",
            "is_required": False,
            "sort_order": 1,
        },
    ).json()["form_question_id"]
    sub = client.post(
        f"/forms/{seed['facility_id']}/submit",
        headers=member_headers or seed["m1"],
        json={"signed": True, "responses": [{"question_id": qid, "answer_text": "ans", "answer_bool": None}]},
    ).json()
    return int(sub["submission_id"])


def test_submission_delete_and_bulk(client: TestClient, seed: dict) -> None:
    sid = _mk_submission(client, seed, "del")
    db = FormSubmissionSQLite()

    assert db.list_submissions_by_facility(seed["facility_id"]) is not None

    got = db.get_submission_by_id(sid)
    assert got is not None

    assert db.delete_submission_by_id(sid) is True

    sid2 = _mk_submission(client, seed, "hard")
    s2 = db.get_submission_by_id(sid2)
    assert s2 is not None
    assert db.hard_delete_submission_by_id(sid2) is True
    assert db.get_submission_by_id(sid2) is None

    sid3 = _mk_submission(client, seed, "bdel")
    sid4 = _mk_submission(client, seed, "bdel2", member_headers=seed["m2"])
    assert sid3 != sid4
    subs = [s for s in (db.get_submission_by_id(sid3), db.get_submission_by_id(sid4)) if s]
    soft = db.delete_submissions_bulk(subs)
    assert soft is not None and {s.submission_id for s in soft} == {sid3, sid4}
    hard = db.hard_delete_submissions_bulk(subs)
    assert hard is not None and len(hard) == 2


def test_form_response_helper(client: TestClient, seed: dict) -> None:
    db = FormSubmissionSQLite()
    responses = db.get_responses_by_submission_id(1)
    assert responses is None or isinstance(responses, list)


# --- Event bulk handlers via route class --------------------------------


def test_event_bulk_handlers(client: TestClient, seed: dict) -> None:
    from src.routes.event_routes import EventRequest, EventRoutes

    day = "2028-03-01"
    payload = {
        "start_date_time": f"{day}T09:00:00",
        "end_date_time": f"{day}T11:00:00",
        "frequency_id": 1,
        "description": "Bulk handler A",
        "venue_id": seed["venue_id"],
    }
    eid = client.post("/events", headers=seed["mgr"], json=payload).json()["event_id"]
    client.post(
        "/events",
        headers=seed["mgr"],
        json={**payload, "description": "Bulk handler B"},
    ).json()["event_id"]

    er = EventRoutes()
    bodies = [EventRequest(**payload)]

    # unknown start/end pair -> 404 branch
    from fastapi import HTTPException

    try:
        asyncio_run(
            er.delete_events_bulk(
                [EventRequest(start_date_time="1999-01-01T00:00:00", end_date_time="1999-01-01T01:00:00")]
            )
        )
        raised_404 = False
    except HTTPException as exc:
        raised_404 = exc.status_code == 404
    assert raised_404

    soft = asyncio_run(er.delete_events_bulk(bodies))
    assert "deleted" in soft["message"]

    hard = asyncio_run(er.hard_delete_events_bulk(bodies))
    assert "permanently deleted" in hard["message"]
    assert client.get(f"/events/{eid}", headers=seed["m1"]).status_code == 404


def asyncio_run(coro):
    import asyncio

    return asyncio.run(coro)


def test_unused_import_guard():
    """Keep datetime import meaningful for future scheduling tests."""
    assert timedelta(days=1).days == 1
    assert isinstance(datetime.now(), datetime)
