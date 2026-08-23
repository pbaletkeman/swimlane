"""
Schedule API routes for managing schedule entities.

Provides CRUD endpoints for schedule entities following the same class-based
router pattern as AuthRoutes and FrequencyRoutes.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from src.data.event.sqlite import SQLite as EventSQLite
from src.data.schedule.schedule import Schedule
from src.data.schedule.sqlite import SQLite as ScheduleSQLite
from src.data.users.user import User
from src.data.venue.sqlite import SQLite as VenueSQLite
from src.roles.roles import admin_role, all_users, facility_manager_role, member_role
from src.routes.event_routes import resolve_max_capacity
from src.util.ical import build_member_calendar

logger = logging.getLogger(__name__)


class ScheduleRequest(BaseModel):
    """Request body for creating/updating a schedule."""

    venue_id: int
    member_id: str
    event_id: int
    is_active: bool = True


class RescheduleRequest(BaseModel):
    """Request body for moving a member's registration to another event."""

    event_id: int


class MyScheduleItem(BaseModel):
    """A member's schedule joined with its event, venue, and facility detail."""

    schedule_id: int
    venue_id: int
    member_id: str
    event_id: int
    is_active: bool
    event_start_date_time: str
    event_end_date_time: str
    event_description: str | None = None
    facility_name: str
    street: str
    city: str
    state: str
    postal_code: str


class ScheduleRoutes:
    """Defines all schedule-related routes."""

    def __init__(self):
        """Register the schedule routes on a new APIRouter."""
        self.router = APIRouter(prefix="/schedules", tags=["schedules"])
        self.router.add_api_route(
            "",
            self.list_schedules,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "/me",
            self.my_schedule,
            methods=["GET"],
        )
        self.router.add_api_route(
            "/me/ical",
            self.my_calendar,
            methods=["GET"],
        )
        self.router.add_api_route(
            "/me/events",
            self.my_schedule,
            methods=["GET"],
        )
        self.router.add_api_route(
            "/{schedule_id}",
            self.get_schedule,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "",
            self.create_schedule,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{schedule_id}",
            self.update_schedule,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{schedule_id}",
            self.delete_schedule,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{schedule_id}/hard",
            self.hard_delete_schedule,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.create_schedules_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.delete_schedules_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk/hard",
            self.hard_delete_schedules_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/{schedule_id}/reschedule",
            self.reschedule,
            methods=["POST"],
        )
        self.router.add_api_route(
            "/{schedule_id}/cancel",
            self.cancel_registration,
            methods=["POST"],
        )

    # ------------------------------------------------------------------
    def _get_db(self) -> ScheduleSQLite:
        """Return a fresh SQLite schedule store."""
        return ScheduleSQLite()

    # ------------------------------------------------------------------
    async def my_schedule(self, user: User = Depends(member_role)) -> list[MyScheduleItem]:
        """List the caller's active schedules joined with event/venue/facility detail."""
        try:
            db = self._get_db()
            rows = db.list_active_schedules_by_member_id_with_details(user.sub) or []
            return [MyScheduleItem(**row) for row in rows]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to load my schedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def my_calendar(self, user: User = Depends(member_role)) -> Response:
        """RFC 5545 iCalendar export of the caller's active schedules."""
        try:
            db = self._get_db()
            rows = db.list_active_schedules_by_member_id_with_details(user.sub) or []
            body = build_member_calendar(rows)
            return Response(
                content=body,
                media_type="text/calendar",
                headers={"Content-Disposition": 'attachment; filename="swimlane-calendar.ics"'},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to export calendar")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def cancel_registration(self, schedule_id: int, user: User = Depends(member_role)) -> dict[str, str]:
        """Soft-cancel the caller's own registration (sets the schedule inactive)."""
        try:
            db = self._get_db()
            schedule = db.get_schedule_by_id(schedule_id)
            if not schedule:
                raise HTTPException(status_code=404, detail="Schedule not found")
            if schedule.member_id != user.sub:
                raise HTTPException(status_code=403, detail="You can only cancel your own registration")
            db.delete_schedule_by_id(schedule_id)
            return {"message": "Registration cancelled"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to cancel registration")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def list_schedules(self) -> list[Schedule]:
        """List all schedules."""
        try:
            db = self._get_db()
            schedules = db.list_schedules()
            return schedules if schedules else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list schedules")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def get_schedule(self, schedule_id: int) -> Schedule:
        """Get a schedule by ID."""
        try:
            db = self._get_db()
            schedule = db.get_schedule_by_id(schedule_id)
            if not schedule:
                raise HTTPException(status_code=404, detail="Schedule not found")
            return schedule
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get schedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_schedule(self, body: ScheduleRequest) -> Schedule:
        """Create a new schedule."""
        try:
            db = self._get_db()
            schedule = Schedule(**body.model_dump())
            created = db.create_schedule(schedule)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to create schedule")
            return created
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create schedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def update_schedule(self, schedule_id: int, body: ScheduleRequest) -> Schedule:
        """Update an existing schedule."""
        try:
            db = self._get_db()
            existing = db.get_schedule_by_id(schedule_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Schedule not found")
            schedule = Schedule(schedule_id=schedule_id, **body.model_dump())
            updated = db.update_schedule(schedule)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update schedule")
            return updated
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to update schedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_schedule(self, schedule_id: int) -> dict[str, str]:
        """Soft-delete a schedule."""
        try:
            db = self._get_db()
            existing = db.get_schedule_by_id(schedule_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Schedule not found")
            db.delete_schedule_by_id(schedule_id)
            return {"message": "Schedule deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete schedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_schedule(self, schedule_id: int) -> dict[str, str]:
        """Hard-delete a schedule."""
        try:
            db = self._get_db()
            existing = db.get_schedule_by_id(schedule_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Schedule not found")
            db.hard_delete_schedule_by_id(schedule_id)
            return {"message": "Schedule permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete schedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_schedules_bulk(self, bodies: list[ScheduleRequest]) -> list[Schedule]:
        """Create multiple schedules in bulk."""
        try:
            db = self._get_db()
            schedules = [Schedule(**b.model_dump()) for b in bodies]
            created = db.create_schedules_bulk(schedules)
            return created if created else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create schedules in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_schedules_bulk(self, bodies: list[ScheduleRequest]) -> dict[str, str]:
        """Soft-delete multiple schedules by member_id and event_id."""
        try:
            db = self._get_db()
            all_schedules = db.list_schedules() or []
            schedules = [
                s
                for s in all_schedules
                for b in bodies
                if s.member_id == b.member_id and s.event_id == b.event_id and s.venue_id == b.venue_id
            ]
            if not schedules:
                raise HTTPException(status_code=404, detail="No schedules found")
            db.delete_schedules_bulk(schedules)
            return {"message": f"{len(schedules)} schedule(s) deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete schedules in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_schedules_bulk(self, bodies: list[ScheduleRequest]) -> dict[str, str]:
        """Hard-delete multiple schedules by member_id and event_id."""
        try:
            db = self._get_db()
            all_schedules = db.list_schedules() or []
            schedules = [
                s
                for s in all_schedules
                for b in bodies
                if s.member_id == b.member_id and s.event_id == b.event_id and s.venue_id == b.venue_id
            ]
            if not schedules:
                raise HTTPException(status_code=404, detail="No schedules found")
            db.hard_delete_schedules_bulk(schedules)
            return {"message": f"{len(schedules)} schedule(s) permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete schedules in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def reschedule(
        self, schedule_id: int, body: RescheduleRequest, user: User = Depends(member_role)
    ) -> Schedule:
        """Move the caller's own registration to a different event."""
        try:
            db = self._get_db()
            schedule = db.get_schedule_by_id(schedule_id)
            if not schedule:
                raise HTTPException(status_code=404, detail="Schedule not found")
            if schedule.member_id != user.sub:
                raise HTTPException(status_code=403, detail="You can only reschedule your own registration")

            event_db = EventSQLite()
            target = event_db.get_event_by_id(body.event_id)
            if not target or not target.is_active:
                raise HTTPException(status_code=404, detail="Event not found")
            if target.venue_id is None:
                raise HTTPException(status_code=400, detail="Target event has no venue assigned")

            venue = VenueSQLite().get_venue_by_id(target.venue_id)
            if not venue or not venue.is_active:
                raise HTTPException(status_code=404, detail="Venue not found")

            if schedule.event_id == body.event_id:
                raise HTTPException(status_code=409, detail="You are already registered for this event")
            if db.get_schedule_for_member(body.event_id, user.sub) is not None:
                raise HTTPException(status_code=409, detail="You are already registered for this event")

            max_capacity = resolve_max_capacity(target)
            if max_capacity is not None and db.count_active_for_event(body.event_id) >= max_capacity:
                raise HTTPException(status_code=409, detail="Event is at capacity")

            updated = db.update_schedule(
                Schedule(
                    schedule_id=schedule.schedule_id,
                    venue_id=target.venue_id,
                    member_id=user.sub,
                    event_id=body.event_id,
                    is_active=True,
                )
            )
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to reschedule")
            return updated
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to reschedule")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
