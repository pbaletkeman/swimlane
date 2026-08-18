"""Shared date/range helpers for schedule views (ISO week, Monday-start)."""

from datetime import date, datetime, timedelta


def parse_date(value: str | None) -> date:
    """Parse an ISO date (``YYYY-MM-DD``); default to today when missing/invalid."""
    if value:
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    return date.today()


def start_of_week(day: date) -> date:
    """Return the Monday (ISO week start) for the week containing ``day``."""
    return day - timedelta(days=day.weekday())


def week_range(day: date) -> tuple[date, date]:
    """Return ``(monday, sunday)`` for the ISO week containing ``day``."""
    monday = start_of_week(day)
    return monday, monday + timedelta(days=6)


def month_range(day: date) -> tuple[date, date]:
    """Return ``(first, last)`` day of the calendar month containing ``day``."""
    first = day.replace(day=1)
    if first.month == 12:
        next_month = first.replace(year=first.year + 1, month=1)
    else:
        next_month = first.replace(month=first.month + 1)
    return first, next_month - timedelta(days=1)


def day_start_iso(day: date) -> str:
    """ISO-8601 datetime string for the start of ``day`` (00:00:00)."""
    return datetime.combine(day, datetime.min.time()).isoformat(timespec="seconds")


def day_end_iso(day: date) -> str:
    """ISO-8601 datetime string for the end of ``day`` (23:59:59)."""
    return datetime.combine(day, datetime.max.time()).isoformat(timespec="seconds")
