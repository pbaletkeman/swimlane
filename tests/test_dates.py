"""Tests for src/util/dates.py — parse_date, start_of_week, week/month ranges."""

from datetime import date, timedelta

from src.util.dates import (
    day_end_iso,
    day_start_iso,
    month_range,
    parse_date,
    start_of_week,
    week_range,
)


def test_parse_date_valid():
    assert parse_date("2026-01-15") == date(2026, 1, 15)


def test_parse_date_none_defaults_today():
    result = parse_date(None)
    assert result == date.today()


def test_parse_date_invalid_defaults_today():
    result = parse_date("not-a-date")
    assert result == date.today()


def test_parse_date_empty_string():
    result = parse_date("")
    assert result == date.today()


def test_start_of_week_monday():
    # 2026-08-17 is a Monday
    d = date(2026, 8, 17)
    assert start_of_week(d) == d


def test_start_of_week_wednesday():
    # 2026-08-19 is a Wednesday → Monday is 2026-08-17
    d = date(2026, 8, 19)
    assert start_of_week(d) == date(2026, 8, 17)


def test_start_of_week_sunday():
    # 2026-08-23 is a Sunday → Monday is 2026-08-17
    d = date(2026, 8, 23)
    assert start_of_week(d) == date(2026, 8, 17)


def test_week_range():
    # Wednesday 2026-08-19 → Monday 2026-08-17 to Sunday 2026-08-23
    monday, sunday = week_range(date(2026, 8, 19))
    assert monday == date(2026, 8, 17)
    assert sunday == date(2026, 8, 23)
    assert (sunday - monday).days == 6


def test_week_range_monday():
    monday, sunday = week_range(date(2026, 8, 17))
    assert monday == date(2026, 8, 17)
    assert sunday == date(2026, 8, 23)


def test_month_range_january():
    first, last = month_range(date(2026, 1, 15))
    assert first == date(2026, 1, 1)
    assert last == date(2026, 1, 31)


def test_month_range_february_leap():
    first, last = month_range(date(2028, 2, 15))
    assert first == date(2028, 2, 1)
    assert last == date(2028, 2, 29)


def test_month_range_december():
    first, last = month_range(date(2026, 12, 25))
    assert first == date(2026, 12, 1)
    assert last == date(2026, 12, 31)


def test_month_range_single_day():
    first, last = month_range(date(2026, 3, 1))
    assert first == date(2026, 3, 1)
    assert last == date(2026, 3, 31)


def test_day_start_iso():
    result = day_start_iso(date(2026, 8, 19))
    assert result == "2026-08-19T00:00:00"


def test_day_end_iso():
    result = day_end_iso(date(2026, 8, 19))
    assert "2026-08-19" in result
    assert "T23:59:59" in result


def test_week_range_crosses_month_boundary():
    # 2026-09-02 is a Wednesday → Monday is 2026-08-31
    monday, sunday = week_range(date(2026, 9, 2))
    assert monday == date(2026, 8, 31)
    assert sunday == date(2026, 9, 6)
