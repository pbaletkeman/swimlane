"""Tests for src/util/ical.py — iCal builder, escaping, CRLF, edge cases."""

from src.util.ical import build_member_calendar


def _item(**overrides):
    base = {
        "schedule_id": 1,
        "event_start_date_time": "2026-08-19T10:00:00",
        "event_end_date_time": "2026-08-19T12:00:00",
        "facility_name": "Test Pool",
        "street": "1 Test St",
        "city": "Springfield",
        "state": "IL",
        "postal_code": "62701",
    }
    base.update(overrides)
    return base


def test_build_single_event():
    cal = build_member_calendar([_item()])
    assert "BEGIN:VCALENDAR" in cal
    assert "END:VCALENDAR" in cal
    assert "BEGIN:VEVENT" in cal
    assert "END:VEVENT" in cal
    assert "swimlane-1@swimlane" in cal
    assert "Test Pool" in cal


def test_crlf_line_endings():
    cal = build_member_calendar([_item()])
    assert "\r\n" in cal
    # Every line ends with \r\n
    for line in cal.split("\r\n"):
        if line:  # last line before final \r\n may be empty
            assert not line.endswith("\n") or line.endswith("\r\n")


def test_multiple_events():
    items = [_item(schedule_id=1), _item(schedule_id=2)]
    cal = build_member_calendar(items)
    assert cal.count("BEGIN:VEVENT") == 2
    assert cal.count("END:VEVENT") == 2
    assert "swimlane-1@swimlane" in cal
    assert "swimlane-2@swimlane" in cal


def test_escape_semicolon():
    cal = build_member_calendar([_item(facility_name="Pool; East")])
    assert "Pool\\; East" in cal


def test_escape_comma():
    cal = build_member_calendar([_item(facility_name="Pool, Main")])
    assert "Pool\\, Main" in cal


def test_escape_newline():
    cal = build_member_calendar([_item(facility_name="Pool\nEast")])
    assert "Pool\\nEast" in cal


def test_escape_backslash():
    cal = build_member_calendar([_item(facility_name="Pool\\East")])
    assert "Pool\\\\East" in cal


def test_missing_optional_fields():
    item = {
        "schedule_id": 3,
        "event_start_date_time": "2026-08-19T10:00:00",
        "event_end_date_time": "2026-08-19T12:00:00",
        "facility_name": "Pool",
    }
    cal = build_member_calendar([item])
    assert "BEGIN:VEVENT" in cal
    assert "LOCATION:" in cal  # empty location


def test_empty_items():
    cal = build_member_calendar([])
    assert "BEGIN:VCALENDAR" in cal
    assert "END:VCALENDAR" in cal
    assert "VEVENT" not in cal


def test_version_prodid():
    cal = build_member_calendar([_item()])
    assert "VERSION:2.0" in cal
    assert "PRODID:" in cal
