"""
RFC 5545 iCalendar generation for member schedules (no external dependencies).

Produces a ``text/calendar`` VCALENDAR with one VEVENT per schedule item, using
UTC timestamps converted from the naive local datetimes stored in ``event``.
"""

from datetime import datetime, timezone
from typing import Any


def _utc_stamp(iso: str) -> str:
    """Convert an ISO datetime to an iCal UTC stamp (``YYYYMMDDTHHMMSSZ``).

    Naive datetimes are interpreted as local (system) time and converted to UTC.
    """
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.astimezone()
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _escape(text: str) -> str:
    """Escape iCal TEXT-property reserved characters."""
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def build_member_calendar(items: list[dict[str, Any]]) -> str:
    """Build a VCALENDAR with one VEVENT per schedule item.

    Each ``item`` is a row from ``ScheduleSQLite.list_active_schedules_by_member_id_with_details``.
    """
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Swimlane//Member Schedule//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    for item in items:
        location = ", ".join(
            part for part in (item.get("street"), item.get("city"), item.get("state"), item.get("postal_code")) if part
        )
        lines += [
            "BEGIN:VEVENT",
            f"UID:swimlane-{item['schedule_id']}@swimlane",
            f"DTSTAMP:{_utc_stamp(item['event_start_date_time'])}",
            f"DTSTART:{_utc_stamp(item['event_start_date_time'])}",
            f"DTEND:{_utc_stamp(item['event_end_date_time'])}",
            f"SUMMARY:{_escape('Swimlane \u2014 ' + item['facility_name'])}",
            f"LOCATION:{_escape(location)}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
