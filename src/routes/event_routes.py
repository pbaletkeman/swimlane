"""
Event API routes for managing event entities.

Provides CRUD endpoints for event entities following the same class-based
router pattern as AuthRoutes and FrequencyRoutes.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.event.event import Event
from src.data.event.sqlite import SQLite as EventSQLite
from src.data.facility.sqlite import SQLite as FacilitySQLite
from src.data.schedule.schedule import Schedule
from src.data.schedule.sqlite import SQLite as ScheduleSQLite
from src.data.users.user import User
from src.data.venue.sqlite import SQLite as VenueSQLite
from src.encryption import decrypt_field
from src.roles.roles import admin_role, all_users, coach_role, facility_manager_role, member_role
from src.roles.user_role import UserRole

logger = logging.getLogger(__name__)


class EventRequest(BaseModel):
    """Request body for creating/updating an event."""

    start_date_time: str
    end_date_time: str
    frequency_id: int | None = None
    is_active: bool = True


class EventCapacity(BaseModel):
    """Capacity summary for a single event."""

    event_id: int
    registered_count: int
    max_capacity: int | None = None


class EventMemberItem(BaseModel):
    """A member registered for an event, with a decrypted display name."""

    schedule_id: int
    venue_id: int
    member_id: str
    member_name: str
    email: str | None = None
    event_id: int
    is_active: bool


def resolve_max_capacity(event: Event) -> int | None:
    """Resolve an event's max capacity from its venue's facility.

    ``None`` means unlimited. A missing/inactive venue or facility yields
    ``None`` rather than an error so existing events without a venue still
    report capacity.
    """
    if event.venue_id is None:
        return None
    venue = VenueSQLite().get_venue_by_id(event.venue_id)
    if not venue or not venue.is_active:
        return None
    facility = FacilitySQLite().get_facility_by_id(venue.facility_id)
    if not facility:
        return None
    return facility.max_capacity


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
        self.router.add_api_route(
            "/{event_id}/capacity",
            self.get_event_capacity,
            methods=["GET"],
        )
        self.router.add_api_route(
            "/{event_id}/members",
            self.list_event_members,
            methods=["GET"],
        )
        self.router.add_api_route(
            "/{event_id}/register",
            self.register_for_event,
            methods=["POST"],
        )

    # ------------------------------------------------------------------
    def _get_db(self) -> EventSQLite:
        return EventSQLite()

    # ------------------------------------------------------------------
    async def list_events(self) -> list[Event]:
        """List all events."""
        try:
            db = self._get_db()
            events = db.list_events()
            return events if events else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list events")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def get_event(self, event_id: int) -> Event:
        """Get an event by ID."""
        try:
            db = self._get_db()
            event = db.get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            return event
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get event")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_event(self, body: EventRequest) -> Event:
        """Create a new event."""
        try:
            db = self._get_db()
            event = Event(**body.model_dump())
            created = db.create_event(event)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to create event")
            return created
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create event")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def update_event(self, event_id: int, body: EventRequest) -> Event:
        """Update an existing event."""
        try:
            db = self._get_db()
            existing = db.get_event_by_id(event_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Event not found")
            event = Event(event_id=event_id, **body.model_dump())
            updated = db.update_event(event)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update event")
            return updated
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to update event")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_event(self, event_id: int) -> dict[str, str]:
        """Soft-delete an event."""
        try:
            db = self._get_db()
            existing = db.get_event_by_id(event_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Event not found")
            db.delete_event_by_id(event_id)
            return {"message": "Event deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete event")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_event(self, event_id: int) -> dict[str, str]:
        """Hard-delete an event."""
        try:
            db = self._get_db()
            existing = db.get_event_by_id(event_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Event not found")
            db.hard_delete_event_by_id(event_id)
            return {"message": "Event permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete event")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_events_bulk(self, bodies: list[EventRequest]) -> list[Event]:
        """Create multiple events in bulk."""
        try:
            db = self._get_db()
            events = [Event(**b.model_dump()) for b in bodies]
            created = db.create_events_bulk(events)
            return created if created else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create events in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_events_bulk(self, bodies: list[EventRequest]) -> dict[str, str]:
        """Soft-delete multiple events by start_date_time and end_date_time."""
        try:
            db = self._get_db()
            all_events = db.list_events() or []
            events = [
                ev
                for ev in all_events
                for b in bodies
                if ev.start_date_time == b.start_date_time and ev.end_date_time == b.end_date_time
            ]
            if not events:
                raise HTTPException(status_code=404, detail="No events found")
            db.delete_events_bulk(events)
            return {"message": f"{len(events)} event(s) deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete events in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_events_bulk(self, bodies: list[EventRequest]) -> dict[str, str]:
        """Hard-delete multiple events by start_date_time and end_date_time."""
        try:
            db = self._get_db()
            all_events = db.list_events() or []
            events = [
                ev
                for ev in all_events
                for b in bodies
                if ev.start_date_time == b.start_date_time and ev.end_date_time == b.end_date_time
            ]
            if not events:
                raise HTTPException(status_code=404, detail="No events found")
            db.hard_delete_events_bulk(events)
            return {"message": f"{len(events)} event(s) permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete events in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def get_event_capacity(self, event_id: int) -> EventCapacity:
        """Return how many members are registered and the event's max capacity."""
        try:
            db = self._get_db()
            event = db.get_event_by_id(event_id)
            if not event or not event.is_active:
                raise HTTPException(status_code=404, detail="Event not found")
            return EventCapacity(
                event_id=event_id,
                registered_count=ScheduleSQLite().count_active_for_event(event_id),
                max_capacity=resolve_max_capacity(event),
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get event capacity")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def register_for_event(self, event_id: int, user: User = Depends(member_role)) -> Schedule:
        """Register the current member for an event (creates a Schedule row)."""
        try:
            db = self._get_db()
            event = db.get_event_by_id(event_id)
            if not event or not event.is_active:
                raise HTTPException(status_code=404, detail="Event not found")

            if event.venue_id is None:
                raise HTTPException(status_code=400, detail="Event has no venue assigned")

            venue = VenueSQLite().get_venue_by_id(event.venue_id)
            if not venue or not venue.is_active:
                raise HTTPException(status_code=404, detail="Venue not found")

            schedule_db = ScheduleSQLite()
            if schedule_db.get_schedule_for_member(event_id, user.sub) is not None:
                raise HTTPException(status_code=409, detail="Already registered for this event")

            max_capacity = resolve_max_capacity(event)
            if max_capacity is not None and schedule_db.count_active_for_event(event_id) >= max_capacity:
                raise HTTPException(status_code=409, detail="Event is at capacity")

            schedule = schedule_db.create_schedule(
                Schedule(venue_id=event.venue_id, member_id=user.sub, event_id=event_id, is_active=True)
            )
            if not schedule:
                raise HTTPException(status_code=500, detail="Failed to register for event")
            return schedule
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to register for event")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    def _member_display_name(self, row: dict) -> str:
        """Decrypt a member row's name/email, falling back to the sub when missing."""
        try:
            if not row.get("first_name_ciphertext"):
                return row["member_id"]
            first = decrypt_field(row["first_name_nonce"], row["first_name_ciphertext"])
            last = ""
            if row.get("last_name_ciphertext"):
                last = decrypt_field(row["last_name_nonce"], row["last_name_ciphertext"])
            return f"{first} {last}".strip() or row["member_id"]
        except Exception:
            return row["member_id"]

    # ------------------------------------------------------------------
    def _member_email(self, row: dict) -> str | None:
        """Decrypt a member row's email, or return None when unavailable."""
        try:
            if not row.get("email_ciphertext"):
                return None
            return decrypt_field(row["email_nonce"], row["email_ciphertext"])
        except Exception:
            return None

    # ------------------------------------------------------------------
    async def list_event_members(
        self,
        event_id: int,
        current_user: User = Depends(coach_role),
    ) -> list[EventMemberItem]:
        """List the members registered for an event (coach of the event or manager+)."""
        try:
            event = self._get_db().get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")

            is_manager = current_user.role in (
                UserRole.FACILITY_MANAGER.value,
                UserRole.WEB_ADMIN.value,
            )
            if not is_manager and event.coach_id != current_user.sub:
                raise HTTPException(status_code=403, detail="Not the coach of this event")

            rows = ScheduleSQLite().list_schedules_by_event_id_with_members(event_id) or []
            return [
                EventMemberItem(
                    schedule_id=row["schedule_id"],
                    venue_id=row["venue_id"],
                    member_id=row["member_id"],
                    member_name=self._member_display_name(row),
                    email=self._member_email(row),
                    event_id=row["event_id"],
                    is_active=bool(row["is_active"]),
                )
                for row in rows
            ]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list event members")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
