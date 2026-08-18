"""
Public API routes for unauthenticated read-only browsing.

Provides the no-login endpoints behind ``docs/layout.txt`` lines 1-5: find venues
by address, find events, browse venues, and view a venue's schedule. Read-only by
design — all write/admin CRUD stays on the auth-gated routers.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.data.event.event import Event
from src.data.event.sqlite import SQLite as EventSQLite
from src.data.facility.sqlite import SQLite as FacilitySQLite
from src.data.schedule.sqlite import SQLite as ScheduleSQLite
from src.data.venue.sqlite import SQLite as VenueSQLite
from src.data.venue.venue import Venue
from src.routes.event_routes import resolve_max_capacity
from src.util.dates import day_end_iso, day_start_iso, month_range, parse_date, week_range

logger = logging.getLogger(__name__)


class PublicVenue(BaseModel):
    """Public venue representation: venue fields plus its facility name."""

    venue_id: int
    facility_id: int
    facility_name: str
    street: str
    city: str
    state: str
    postal_code: str
    cost: float
    is_active: bool


class PublicEvent(BaseModel):
    """Public event representation for the no-login event listing."""

    event_id: int
    start_date_time: str
    end_date_time: str
    frequency_id: int | None
    description: str | None = None
    coach_id: str | None = None
    venue_id: int | None = None
    is_active: bool


class PublicEventDetail(PublicEvent):
    """Public single-event detail: event fields plus its venue and capacity."""

    venue: PublicVenue | None = None
    registered_count: int = 0
    max_capacity: int | None = None


class PublicRoutes:
    """Defines all public (unauthenticated) read-only routes."""

    def __init__(self) -> None:
        self.router = APIRouter(prefix="/public", tags=["public"])
        self.router.add_api_route("/venues", self.list_venues, methods=["GET"])
        self.router.add_api_route("/venues/{venue_id}", self.get_venue, methods=["GET"])
        self.router.add_api_route("/venues/{venue_id}/schedules", self.get_venue_schedules, methods=["GET"])
        self.router.add_api_route("/events", self.list_events, methods=["GET"])
        self.router.add_api_route("/events/{event_id}", self.get_event_detail, methods=["GET"])

    # ------------------------------------------------------------------
    def _with_facility_name(self, venues: list[Venue]) -> list[PublicVenue]:
        """Enrich venue rows with their facility name for public responses."""
        facility_db = FacilitySQLite()
        result: list[PublicVenue] = []
        for v in venues:
            facility = facility_db.get_facility_by_id(v.facility_id)
            result.append(
                PublicVenue(
                    venue_id=v.venue_id or 0,
                    facility_id=v.facility_id,
                    facility_name=facility.name if facility else "Unknown",
                    street=v.street,
                    city=v.city,
                    state=v.state,
                    postal_code=v.postal_code,
                    cost=v.cost,
                    is_active=v.is_active,
                )
            )
        return result

    # ------------------------------------------------------------------
    async def list_venues(self, q: Optional[str] = None) -> list[PublicVenue]:
        """Public venue list/browse. Pass ``q`` to search by address substring."""
        try:
            db = VenueSQLite()
            if q:
                venues = db.search_venues(q)
            else:
                venues = db.list_active_venues()
            return self._with_facility_name(venues or [])
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list public venues")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def get_venue(self, venue_id: int) -> PublicVenue:
        """Public venue detail. 404 for unknown or inactive venues."""
        try:
            db = VenueSQLite()
            venue = db.get_venue_by_id(venue_id)
            if not venue or not venue.is_active:
                raise HTTPException(status_code=404, detail="Venue not found")
            return self._with_facility_name([venue])[0]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get public venue")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    def _to_public_events(self, events: list[Event]) -> list[PublicEvent]:
        """Transform ``Event`` rows into ``PublicEvent`` responses."""
        return [
            PublicEvent(
                event_id=e.event_id or 0,
                start_date_time=e.start_date_time,
                end_date_time=e.end_date_time,
                frequency_id=e.frequency_id,
                description=e.description,
                coach_id=e.coach_id,
                venue_id=e.venue_id,
                is_active=e.is_active,
            )
            for e in events
        ]

    # ------------------------------------------------------------------
    async def get_venue_schedules(
        self,
        venue_id: int,
        view: Literal["week", "month", "list"] = "week",
        date: Optional[str] = None,
    ) -> list[PublicEvent]:
        """Public schedule for one venue: ``week`` (default) / ``month`` / ``list`` views.

        ``date`` anchors the view (ISO ``YYYY-MM-DD``); defaults to today. ``week``
        and ``month`` return distinct active events at the venue overlapping the
        range; ``list`` returns upcoming active events at the venue.
        """
        try:
            venue_db = VenueSQLite()
            venue = venue_db.get_venue_by_id(venue_id)
            if not venue or not venue.is_active:
                raise HTTPException(status_code=404, detail="Venue not found")

            anchor = parse_date(date)
            db = EventSQLite()
            if view == "month":
                first, last = month_range(anchor)
                events = db.list_events_in_range(day_start_iso(first), day_end_iso(last), venue_id=venue_id)
            elif view == "list":
                events = db.list_public_events(venue_id=venue_id)
            else:  # week (default)
                monday, sunday = week_range(anchor)
                events = db.list_events_in_range(day_start_iso(monday), day_end_iso(sunday), venue_id=venue_id)

            return self._to_public_events(events or [])
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get public venue schedules")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def list_events(
        self,
        from_dt: Optional[str] = None,
        to_dt: Optional[str] = None,
        venue_id: Optional[int] = None,
    ) -> list[PublicEvent]:
        """Public event listing, defaulting to upcoming active events.

        Free-text search (``?q=``) is deferred until ``event.description`` exists
        (Phase C); date filtering is available via ``from_dt``/``to_dt`` and the
        listing can be scoped to one venue via ``venue_id``.
        """
        try:
            db = EventSQLite()
            events: Optional[list[Event]] = db.list_public_events(
                start_from=from_dt,
                start_to=to_dt,
                venue_id=venue_id,
            )
            return self._to_public_events(events or [])
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list public events")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def get_event_detail(self, event_id: int) -> PublicEventDetail:
        """Public single-event detail. 404 for unknown or inactive events."""
        try:
            db = EventSQLite()
            event = db.get_event_by_id(event_id)
            if not event or not event.is_active:
                raise HTTPException(status_code=404, detail="Event not found")

            venue: PublicVenue | None = None
            if event.venue_id is not None:
                v = VenueSQLite().get_venue_by_id(event.venue_id)
                if v and v.is_active:
                    venue = self._with_facility_name([v])[0]

            return PublicEventDetail(
                event_id=event.event_id or 0,
                start_date_time=event.start_date_time,
                end_date_time=event.end_date_time,
                frequency_id=event.frequency_id,
                description=event.description,
                coach_id=event.coach_id,
                venue_id=event.venue_id,
                is_active=event.is_active,
                venue=venue,
                registered_count=ScheduleSQLite().count_active_for_event(event_id),
                max_capacity=resolve_max_capacity(event),
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get public event detail")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
