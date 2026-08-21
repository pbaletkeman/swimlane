"""Error-path sweep: trigger every route handler's exception guards with an exploding DB.

Monkeypatches each router's DB access (helpers + module-level SQLite symbols) to
raise, then calls every handler directly. Each handler's ``except Exception ->
logger.exception -> HTTPException(500)`` block gets executed, which plain HTTP
tests can't reach without fault injection. Also covers AuthRoutes.login and the
OAuth callback paths with stubbed authlib calls (no network).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any, cast

import pytest
from conftest import _make_user
from fastapi import HTTPException

from src.data.users.user import User
from src.encryption import hash_field
from src.routes.auth_routes import AuthRoutes


def _boom(*args: Any, **kwargs: Any) -> Any:
    raise RuntimeError("db exploded")


@pytest.fixture
def exploding_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make every DB touchpoint inside every route module raise."""
    import src.routes.event_routes as er
    import src.routes.facility_routes as facr
    import src.routes.form_routes as frm
    import src.routes.frequency_routes as fr
    import src.routes.message_routes as mr
    import src.routes.public_routes as pr
    import src.routes.schedule_routes as sr
    import src.routes.user_routes as ur
    import src.routes.venue_routes as vr

    sqlite_names = [
        "EventSQLite", "ScheduleSQLite", "VenueSQLite", "FacilitySQLite", "FrequencySQLite",
        "FormQuestionSQLite", "FacilityRuleSQLite", "FormSubmissionSQLite", "UsersSQLite",
    ]
    for mod in (er, sr, frm, pr, fr, facr, vr):
        for name in sqlite_names:
            if hasattr(mod, name):
                monkeypatch.setattr(mod, name, _boom)

    helpers: list[tuple[type, str]] = [
        (er.EventRoutes, "_get_db"),
        (sr.ScheduleRoutes, "_get_db"),
        (fr.FrequencyRoutes, "_get_db"),
        (facr.FacilityRoutes, "_get_db"),
        (vr.VenueRoutes, "_get_db"),
        (frm.FormRoutes, "_get_question_db"),
        (frm.FormRoutes, "_get_rule_db"),
        (frm.FormRoutes, "_get_form_db"),
        (frm.FormRoutes, "_get_facility_db"),
        (mr.MessageRoutes, "_get_db"),
        (mr.MessageRoutes, "_get_users_db"),
        (ur.UserRoutes, "_get_users_db"),
        (ur.UserRoutes, "_get_invite_db"),
    ]
    for cls, name in helpers:
        monkeypatch.setattr(cls, name, lambda self: _boom())


def _admin() -> User:
    return _make_user("err-admin", "web_admin", "err-admin@example.com")


def expect_500(fn: Any, /, *args: Any, **kwargs: Any) -> None:
    """Call an async handler (directly, not via HTTP) and require HTTPException(500)."""
    with pytest.raises(HTTPException) as exc:
        asyncio.run(fn(*args, **kwargs))
    assert exc.value.status_code == 500


# --- CRUD trio ----------------------------------------------------------


def test_frequency_handlers_500(exploding_db: None) -> None:
    from src.routes.frequency_routes import FrequencyRequest, FrequencyRoutes

    r = FrequencyRoutes()
    req = FrequencyRequest(name="x", day_interval="1")
    expect_500(r.list_frequencies)
    expect_500(r.get_frequency, 1)
    expect_500(r.create_frequency, req)
    expect_500(r.update_frequency, 1, req)
    expect_500(r.delete_frequency, 1)
    expect_500(r.hard_delete_frequency, 1)
    expect_500(r.create_frequencies_bulk, [req])
    expect_500(r.delete_frequencies_bulk, [req])
    expect_500(r.hard_delete_frequencies_bulk, [req])


def test_facility_handlers_500(exploding_db: None) -> None:
    from src.routes.facility_routes import FacilityRequest, FacilityRoutes

    r = FacilityRoutes()
    req = FacilityRequest(name="x")
    expect_500(r.list_facilities)
    expect_500(r.get_facility, 1)
    expect_500(r.create_facility, req)
    expect_500(r.update_facility, 1, req)
    expect_500(r.delete_facility, 1)
    expect_500(r.hard_delete_facility, 1)
    expect_500(r.create_facilities_bulk, [req])
    expect_500(r.delete_facilities_bulk, [req])
    expect_500(r.hard_delete_facilities_bulk, [req])


def test_venue_handlers_500(exploding_db: None) -> None:
    from src.routes.venue_routes import VenueRequest, VenueRoutes

    r = VenueRoutes()
    req = VenueRequest(facility_id=1, street="s", city="c", state="ST", postal_code="1")
    expect_500(r.list_venues)
    expect_500(r.get_venue, 1)
    expect_500(r.create_venue, req)
    expect_500(r.update_venue, 1, req)
    expect_500(r.delete_venue, 1)
    expect_500(r.hard_delete_venue, 1)
    expect_500(r.create_venues_bulk, [req])
    expect_500(r.delete_venues_bulk, [req])
    expect_500(r.hard_delete_venues_bulk, [req])


# --- Events -------------------------------------------------------------


def test_event_handlers_500(exploding_db: None) -> None:
    from src.routes.event_routes import (
        EventMemberAdd,
        EventMemberEdit,
        EventRequest,
        EventRoutes,
    )

    r = EventRoutes()
    admin = _admin()
    req = EventRequest(
        start_date_time=(datetime.now() + timedelta(days=400)).isoformat(timespec="seconds"),
        end_date_time=(datetime.now() + timedelta(days=400, hours=2)).isoformat(timespec="seconds"),
    )
    expect_500(r.list_events)
    expect_500(r.get_event, 1)
    expect_500(r.create_event, req, admin)
    expect_500(r.update_event, 1, req, admin)
    expect_500(r.delete_event, 1, admin)
    expect_500(r.hard_delete_event, 1)
    expect_500(r.create_events_bulk, [req])
    expect_500(r.delete_events_bulk, [req])
    expect_500(r.hard_delete_events_bulk, [req])
    expect_500(r.get_event_capacity, 1)
    expect_500(r.register_for_event, 1, admin)
    expect_500(r.list_event_members, 1, admin)
    expect_500(r.add_event_member, 1, EventMemberAdd(member_id="m"), admin)
    expect_500(r.remove_event_member, 1, 1, admin)
    expect_500(r.edit_event_member, 1, 1, EventMemberEdit(), admin)


# --- Schedules ----------------------------------------------------------


def test_schedule_handlers_500(exploding_db: None) -> None:
    from src.routes.schedule_routes import RescheduleRequest, ScheduleRequest, ScheduleRoutes

    r = ScheduleRoutes()
    admin = _admin()
    req = ScheduleRequest(venue_id=1, member_id="m", event_id=1)
    expect_500(r.my_schedule, admin)
    expect_500(r.my_calendar, admin)
    expect_500(r.cancel_registration, 1, admin)
    expect_500(r.list_schedules)
    expect_500(r.get_schedule, 1)
    expect_500(r.create_schedule, req)
    expect_500(r.update_schedule, 1, req)
    expect_500(r.delete_schedule, 1)
    expect_500(r.hard_delete_schedule, 1)
    expect_500(r.create_schedules_bulk, [req])
    expect_500(r.delete_schedules_bulk, [req])
    expect_500(r.hard_delete_schedules_bulk, [req])
    expect_500(r.reschedule, 1, RescheduleRequest(event_id=2), admin)


# --- Forms --------------------------------------------------------------


def test_form_handlers_500(exploding_db: None) -> None:
    from src.routes.form_routes import (
        FormRoutes,
        QuestionIdRequest,
        QuestionRequest,
        ResponseItem,
        RuleIdRequest,
        RuleRequest,
        SubmissionRequest,
    )

    r = FormRoutes()
    admin = _admin()
    q_req = QuestionRequest(facility_id=1, prompt="p")
    r_req = RuleRequest(facility_id=1, title="t", content="c")
    expect_500(r.get_form, 1)
    expect_500(r.submit_form, 1, SubmissionRequest(signed=True, responses=[ResponseItem(question_id=1)]), admin)
    expect_500(r.export_submission_pdf, 1, admin)
    expect_500(r.get_submission_detail, 1, admin)
    expect_500(r.list_my_submissions, admin)
    expect_500(r.create_question, q_req)
    expect_500(r.update_question, 1, q_req)
    expect_500(r.delete_question, 1)
    expect_500(r.hard_delete_question, 1)
    expect_500(r.create_questions_bulk, [q_req])
    expect_500(r.delete_questions_bulk, [QuestionIdRequest(form_question_id=1)])
    expect_500(r.hard_delete_questions_bulk, [QuestionIdRequest(form_question_id=1)])
    expect_500(r.create_rule, r_req)
    expect_500(r.update_rule, 1, r_req)
    expect_500(r.delete_rule, 1)
    expect_500(r.hard_delete_rule, 1)
    expect_500(r.create_rules_bulk, [r_req])
    expect_500(r.delete_rules_bulk, [RuleIdRequest(rule_id=1)])
    expect_500(r.hard_delete_rules_bulk, [RuleIdRequest(rule_id=1)])


# --- Messages & users ---------------------------------------------------


def test_message_handlers_500(exploding_db: None) -> None:
    from src.routes.message_routes import MessageInput, MessageRoutes

    r = MessageRoutes()
    admin = _admin()
    expect_500(r.list_my_messages, admin)
    expect_500(r.send_message, MessageInput(member_id="m", subject="s", body="b"), admin)
    expect_500(r.mark_message_read, 1, admin)
    expect_500(r.delete_message, 1, admin)
    expect_500(r.hard_delete_message, 1)


def test_user_handlers_500(exploding_db: None) -> None:
    from src.routes.user_routes import UserInviteInput, UserRoleInput, UserRoutes

    r = UserRoutes()
    admin = _admin()
    expect_500(r.list_users, admin, None)
    expect_500(r.get_user, "sub")
    expect_500(r.create_user, UserInviteInput(email="a@b.com", role="member"))
    expect_500(r.change_user_role, "sub", UserRoleInput(role="coach"), admin)
    expect_500(r.delete_user, "sub", admin)
    expect_500(r.hard_delete_user, "sub")


# --- Public -------------------------------------------------------------


def test_public_handlers_500(exploding_db: None) -> None:
    from src.routes.public_routes import PublicRoutes

    r = PublicRoutes()
    expect_500(r.list_venues, None)
    expect_500(r.get_venue, 1)
    expect_500(r.get_venue_schedules, 1, "week", None)
    expect_500(r.list_events, None, None, None, None)
    expect_500(r.get_event_detail, 1)


# --- Auth flows (stubbed OAuth, no network) -----------------------------


class FakeRequest:
    """Duck-typed stand-in for starlette Request (only what auth handlers touch)."""

    def __init__(self, qp: dict | None = None, headers: dict | None = None) -> None:
        self.query_params = qp or {}
        self.headers = headers or {}
        self.session: dict[str, Any] = {}

    def url_for(self, name: str) -> str:
        return f"http://testserver/{name}"


def _login(ar: Any, req: Any) -> Any:
    return asyncio.run(ar.login(req))


def _callback(ar: Any, req: Any) -> Any:
    return asyncio.run(ar.auth_callback(req))


def _auth_routes() -> AuthRoutes:
    return AuthRoutes()


def test_login_stores_origin_and_redirects(client, monkeypatch: pytest.MonkeyPatch) -> None:
    ar = _auth_routes()

    async def fake_redirect(request: Any, uri: str) -> tuple[str, str]:
        return ("redirected", uri)

    monkeypatch.setattr(ar.oauth.google, "authorize_redirect", fake_redirect)

    # explicit frontend_url wins
    req = FakeRequest(qp={"frontend_url": "http://localhost:5174"})
    out = _login(ar, req)
    assert out[0] == "redirected" and "auth_callback" in out[1]
    assert req.session["frontend_url"] == "http://localhost:5174"

    # Origin header fallback
    req2 = FakeRequest(headers={"origin": "http://127.0.0.1:4173"})
    _login(ar, req2)
    assert req2.session["frontend_url"] == "http://127.0.0.1:4173"

    # no origin anywhere -> nothing stored
    req3 = FakeRequest()
    _login(ar, req3)
    assert "frontend_url" not in req3.session


def test_auth_callback_existing_user(client, seed, monkeypatch: pytest.MonkeyPatch) -> None:
    ar = _auth_routes()
    userinfo = {"sub": "t-m1", "given_name": "First", "family_name": "Last", "email": "t-m1@example.com"}

    async def fake_token(request: Any) -> dict[str, Any]:
        return {"userinfo": userinfo}

    monkeypatch.setattr(ar.oauth.google, "authorize_access_token", fake_token)
    req = FakeRequest(qp={"code": "abc"})
    req.session["frontend_url"] = "http://localhost:9999"

    resp = _callback(ar, req)
    loc = resp.headers["location"]
    assert loc.startswith("http://localhost:9999/auth/callback?")
    assert "access_token=" in loc and "refresh_token=" in loc and "user=" in loc
    assert req.session["user"]["sub"] == "t-m1"


def test_auth_callback_new_user_applies_invite(client, seed, monkeypatch: pytest.MonkeyPatch) -> None:
    from src.data.user_invite.sqlite import SQLite as InviteDB
    from src.data.user_invite.user_invite import UserInvite

    email = "oauth-new@example.com"
    InviteDB().create_invite(UserInvite(email_hash=hash_field(email), role="coach"))

    ar = _auth_routes()
    userinfo = {"sub": "oauth-new", "given_name": "New", "family_name": "User", "email": email}

    async def fake_token(request: Any) -> dict[str, Any]:
        return {"userinfo": userinfo}

    monkeypatch.setattr(ar.oauth.google, "authorize_access_token", fake_token)
    req = FakeRequest(qp={"code": "abc"})  # no stored origin -> falls back to configured frontend_url

    resp = _callback(ar, req)
    assert "/auth/callback?" in resp.headers["location"]

    # invite consumed and role applied
    from src.util.configs import Config

    users = cast(Any, Config().db)()
    created = users.get_user_by_sub("oauth-new")
    assert created is not None and created.role == "coach"
    assert InviteDB().get_invite_by_email_hash(hash_field(email)) is None

    # cleanup so other suites' user listings stay deterministic
    users.hard_delete_user_by_sub("oauth-new")


def test_auth_callback_bad_oauth_raises_400(client, monkeypatch: pytest.MonkeyPatch) -> None:
    ar = _auth_routes()

    async def boom(request: Any) -> dict[str, Any]:
        raise RuntimeError("google down")

    monkeypatch.setattr(ar.oauth.google, "authorize_access_token", boom)
    req = FakeRequest(qp={"code": "abc"})
    with pytest.raises(HTTPException) as exc:
        _callback(ar, req)
    assert exc.value.status_code == 400


def test_jwt_round_trip_via_helpers(client) -> None:
    """Sanity: tokens minted by auth helpers validate against RoleChecker deps."""
    from src.routes.auth_routes import create_local_access_token

    tok = create_local_access_token({"sub": "t-m1", "role": "member"})
    client.headers = {}  # ensure we control headers explicitly
    r = client.get("/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200 and r.json()["sub"] == "t-m1"
