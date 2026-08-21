"""Shared fixtures: throwaway SQLite DB + TestClient with forged JWTs.

The DB override must happen before `main` is imported, which conftest guarantees
(pytest loads conftest.py before any test module). Tests never touch the dev
`swimlane.db`.
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Generator

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from src.util.configs import Config

_tmp = Path(tempfile.mkdtemp(prefix="swimlane_tests_"))
Config._sqlite_file_cache = str(_tmp / "tests.db")
Config._yaml_cache = None

from main import app  # noqa: E402
from src.data.event.event import Event  # noqa: E402
from src.data.event.sqlite import SQLite as EventSQLite  # noqa: E402
from src.data.facility.facility import Facility  # noqa: E402
from src.data.facility.sqlite import SQLite as FacilitySQLite  # noqa: E402
from src.data.frequency.frequency import Frequency  # noqa: E402
from src.data.frequency.sqlite import SQLite as FrequencySQLite  # noqa: E402
from src.data.users.sqlite import SQLite as UsersSQLite  # noqa: E402
from src.data.users.user import User  # noqa: E402
from src.data.venue.sqlite import SQLite as VenueSQLite  # noqa: E402
from src.data.venue.venue import Venue  # noqa: E402
from src.encryption import encrypt_field, hash_field  # noqa: E402
from src.env import TOKEN_SECRET_KEY  # noqa: E402
from src.roles.user_role import UserRole  # noqa: E402


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


def _make_user(sub: str, role: str, email: str) -> User:
    fe = encrypt_field("First")
    le = encrypt_field("Last")
    ee = encrypt_field(email)
    return User(
        sub=sub,
        role=role,
        first_name_nonce=fe["nonce"],
        first_name_ciphertext=fe["ciphertext"],
        last_name_nonce=le["nonce"],
        last_name_ciphertext=le["ciphertext"],
        email_nonce=ee["nonce"],
        email_ciphertext=ee["ciphertext"],
        email_hash=hash_field(email),
    )


def token(sub: str, role: str) -> str:
    return jwt.encode({"sub": sub, "role": role, "exp": 4102444800}, TOKEN_SECRET_KEY, algorithm="HS256")


def headers(sub: str, role: UserRole) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(sub, role.value)}"}


@pytest.fixture(scope="session")
def seed() -> dict[str, Any]:
    """Seed users and a capacity-2 facility/venue/frequency plus two events."""
    users = UsersSQLite()
    users.init()
    users.create_users_bulk(
        [
            _make_user("t-admin", UserRole.WEB_ADMIN.value, "t-admin@example.com"),
            _make_user("t-mgr", UserRole.FACILITY_MANAGER.value, "t-mgr@example.com"),
            _make_user("t-coach1", UserRole.COACH.value, "t-coach1@example.com"),
            _make_user("t-coach2", UserRole.COACH.value, "t-coach2@example.com"),
            _make_user("t-m1", UserRole.MEMBER.value, "t-m1@example.com"),
            _make_user("t-m2", UserRole.MEMBER.value, "t-m2@example.com"),
            _make_user("t-m3", UserRole.MEMBER.value, "t-m3@example.com"),
        ]
    )

    fac = FacilitySQLite().create_facility(Facility(name="Test Pool", max_capacity=2))
    assert fac and fac.facility_id
    ven = VenueSQLite().create_venue(
        Venue(facility_id=fac.facility_id, street="1 Test St", city="Springfield", state="IL", postal_code="62701")
    )
    assert ven and ven.venue_id
    frq = FrequencySQLite().create_frequency(Frequency(name="Weekly", day_interval="7"))
    assert frq and frq.frequency_id

    now = datetime.now()

    def event(days_ahead: int, description: str, coach_id: str | None) -> Event:
        created = EventSQLite().create_event(
            Event(
                start_date_time=(now + timedelta(days=days_ahead)).isoformat(timespec="seconds"),
                end_date_time=(now + timedelta(days=days_ahead, hours=2)).isoformat(timespec="seconds"),
                frequency_id=frq.frequency_id,
                description=description,
                coach_id=coach_id,
                venue_id=ven.venue_id,
            )
        )
        assert created and created.event_id
        return created

    ev_full = event(1, "Morning practice", "t-coach1")  # capped at 2 by the facility
    ev_open = event(2, "Evening practice", "t-coach1")
    return {
        "facility_id": fac.facility_id,
        "venue_id": ven.venue_id,
        "ev_full": ev_full.event_id,
        "ev_open": ev_open.event_id,
        "admin": headers("t-admin", UserRole.WEB_ADMIN),
        "mgr": headers("t-mgr", UserRole.FACILITY_MANAGER),
        "coach1": headers("t-coach1", UserRole.COACH),
        "coach2": headers("t-coach2", UserRole.COACH),
        "m1": headers("t-m1", UserRole.MEMBER),
        "m2": headers("t-m2", UserRole.MEMBER),
        "m3": headers("t-m3", UserRole.MEMBER),
    }
