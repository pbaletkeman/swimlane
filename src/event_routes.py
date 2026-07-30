"""
Event API routes for managing event entities.

Provides CRUD endpoints for event entities following the same class-based
router pattern as AuthRoutes and FrequencyRoutes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.event.event import Event
from src.data.event.sqlite import SQLite as EventSQLite
from src.roles.roles import admin_role, all_users, facility_manager_role


class EventRequest(BaseModel):
    """Request body for creating/updating an event."""

    start_date_time: str
    end_date_time: str
    frequency_id: int | None = None
    is_active: bool = True


class EventRoutes:
    """Defines all event-related routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/events", tags=["events"])
        self.router.add_api_route(
            "",
            self.list_events,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "/{event_id}",
            self.get_event,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "",
            self.create_event,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{event_id}",
            self.update_event,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{event_id}",
            self.delete_event,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{event_id}/hard",
            self.hard_delete_event,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.create_events_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.delete_events_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk/hard",
            self.hard_delete_events_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_db(self) -> EventSQLite:
        return EventSQLite()

    # ------------------------------------------------------------------
    async def list_events(self) -> list[Event]:
        """List all events."""
        db = self._get_db()
        events = db.list_events()
        return events if events else []

    # ------------------------------------------------------------------
    async def get_event(self, event_id: int) -> Event:
        """Get an event by ID."""
        db = self._get_db()
        event = db.get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event

    # ------------------------------------------------------------------
    async def create_event(self, body: EventRequest) -> Event:
        """Create a new event."""
        db = self._get_db()
        event = Event(**body.model_dump())
        created = db.create_event(event)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create event")
        return created

    # ------------------------------------------------------------------
    async def update_event(self, event_id: int, body: EventRequest) -> Event:
        """Update an existing event."""
        db = self._get_db()
        existing = db.get_event_by_id(event_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Event not found")
        event = Event(event_id=event_id, **body.model_dump())
        updated = db.update_event(event)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update event")
        return updated

    # ------------------------------------------------------------------
    async def delete_event(self, event_id: int) -> dict[str, str]:
        """Soft-delete an event."""
        db = self._get_db()
        existing = db.get_event_by_id(event_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Event not found")
        db.delete_event_by_id(event_id)
        return {"message": "Event deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_event(self, event_id: int) -> dict[str, str]:
        """Hard-delete an event."""
        db = self._get_db()
        existing = db.get_event_by_id(event_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Event not found")
        db.hard_delete_event_by_id(event_id)
        return {"message": "Event permanently deleted"}

    # ------------------------------------------------------------------
    async def create_events_bulk(self, bodies: list[EventRequest]) -> list[Event]:
        """Create multiple events in bulk."""
        db = self._get_db()
        events = [Event(**b.model_dump()) for b in bodies]
        created = db.create_events_bulk(events)
        return created if created else []

    # ------------------------------------------------------------------
    async def delete_events_bulk(self, bodies: list[EventRequest]) -> dict[str, str]:
        """Soft-delete multiple events by start_date_time and end_date_time."""
        db = self._get_db()
        all_events = db.list_events() or []
        events = [
            ev for ev in all_events
            for b in bodies
            if ev.start_date_time == b.start_date_time and ev.end_date_time == b.end_date_time
        ]
        if not events:
            raise HTTPException(status_code=404, detail="No events found")
        db.delete_events_bulk(events)
        return {"message": f"{len(events)} event(s) deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_events_bulk(self, bodies: list[EventRequest]) -> dict[str, str]:
        """Hard-delete multiple events by start_date_time and end_date_time."""
        db = self._get_db()
        all_events = db.list_events() or []
        events = [
            ev for ev in all_events
            for b in bodies
            if ev.start_date_time == b.start_date_time and ev.end_date_time == b.end_date_time
        ]
        if not events:
            raise HTTPException(status_code=404, detail="No events found")
        db.hard_delete_events_bulk(events)
        return {"message": f"{len(events)} event(s) permanently deleted"}
