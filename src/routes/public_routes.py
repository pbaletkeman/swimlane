"""
Public API routes for unauthenticated read-only browsing.

Provides the no-login endpoints behind ``docs/layout.txt`` lines 1-5: find venues
by address, find events, browse venues, and view a venue's schedule. Read-only by
design — all write/admin CRUD stays on the auth-gated routers.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.data.event.event import Event
from src.data.event.sqlite import SQLite as EventSQLite
from src.data.facility.sqlite import SQLite as FacilitySQLite
from src.data.schedule.sqlite import SQLite as ScheduleSQLite
from src.data.venue.sqlite import SQLite as VenueSQLite
from src.data.venue.venue import Venue

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


class PublicVenueSchedule(BaseModel):
    """A schedule row for a venue joined with its event times."""

    schedule_id: int
    venue_id: int
    event_id: int
    is_active: bool
    event_start_date_time: str
    event_end_date_time: str


class PublicEvent(BaseModel):
    """Public event representation for the no-login event listing."""

    event_id: int
    start_date_time: str
    end_date_time: str
    frequency_id: int | None
    is_active: bool


class PublicRoutes:
    """Defines all public (unauthenticated) read-only routes."""

    def __init__(self) -> None:
        self.router = APIRouter(prefix="/public", tags=["public"])
        self.router.add_api_route("/venues", self.list_venues, methods=["GET"])
        self.router.add_api_route("/venues/{venue_id}", self.get_venue, methods=["GET"])
        self.router.add_api_route("/venues/{venue_id}/schedules", self.get_venue_schedules, methods=["GET"])
        self.router.add_api_route("/events", self.list_events, methods=["GET"])

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
    async def get_venue_schedules(self, venue_id: int) -> list[PublicVenueSchedule]:
        """Public schedule listing for one venue (active schedules joined to their events)."""
        try:
            venue_db = VenueSQLite()
            venue = venue_db.get_venue_by_id(venue_id)
            if not venue or not venue.is_active:
                raise HTTPException(status_code=404, detail="Venue not found")

            schedule_db = ScheduleSQLite()
            rows = schedule_db.list_schedules_by_venue_id_with_events(venue_id) or []
            return [PublicVenueSchedule(**row) for row in rows]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get public venue schedules")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def list_events(self, from_dt: Optional[str] = None, to_dt: Optional[str] = None) -> list[PublicEvent]:
        """Public event listing, defaulting to upcoming active events.

        Free-text search (``?q=``) is deferred until ``event.description`` exists
        (Phase C); date filtering is available now via ``from_dt``/``to_dt``.
        """
        try:
            db = EventSQLite()
            events: Optional[list[Event]] = db.list_public_events(start_from=from_dt, start_to=to_dt)
            if not events:
                return []
            return [
                PublicEvent(
                    event_id=e.event_id or 0,
                    start_date_time=e.start_date_time,
                    end_date_time=e.end_date_time,
                    frequency_id=e.frequency_id,
                    is_active=e.is_active,
                )
                for e in events
            ]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list public events")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
