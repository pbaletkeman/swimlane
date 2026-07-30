"""
Schedule API routes for managing schedule entities.

Provides CRUD endpoints for schedule entities following the same class-based
router pattern as AuthRoutes and FrequencyRoutes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.schedule.schedule import Schedule
from src.data.schedule.sqlite import SQLite as ScheduleSQLite
from src.roles.roles import admin_role, all_users, facility_manager_role


class ScheduleRequest(BaseModel):
    """Request body for creating/updating a schedule."""

    venue_id: int
    member_id: str
    event_id: int
    is_active: bool = True


class ScheduleRoutes:
    """Defines all schedule-related routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/schedules", tags=["schedules"])
        self.router.add_api_route(
            "",
            self.list_schedules,
            methods=["GET"],
            dependencies=[Depends(all_users)],
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

    # ------------------------------------------------------------------
    def _get_db(self) -> ScheduleSQLite:
        return ScheduleSQLite()

    # ------------------------------------------------------------------
    async def list_schedules(self) -> list[Schedule]:
        """List all schedules."""
        db = self._get_db()
        schedules = db.list_schedules()
        return schedules if schedules else []

    # ------------------------------------------------------------------
    async def get_schedule(self, schedule_id: int) -> Schedule:
        """Get a schedule by ID."""
        db = self._get_db()
        schedule = db.get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return schedule

    # ------------------------------------------------------------------
    async def create_schedule(self, body: ScheduleRequest) -> Schedule:
        """Create a new schedule."""
        db = self._get_db()
        schedule = Schedule(**body.model_dump())
        created = db.create_schedule(schedule)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create schedule")
        return created

    # ------------------------------------------------------------------
    async def update_schedule(self, schedule_id: int, body: ScheduleRequest) -> Schedule:
        """Update an existing schedule."""
        db = self._get_db()
        existing = db.get_schedule_by_id(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")
        schedule = Schedule(schedule_id=schedule_id, **body.model_dump())
        updated = db.update_schedule(schedule)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update schedule")
        return updated

    # ------------------------------------------------------------------
    async def delete_schedule(self, schedule_id: int) -> dict[str, str]:
        """Soft-delete a schedule."""
        db = self._get_db()
        existing = db.get_schedule_by_id(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")
        db.delete_schedule_by_id(schedule_id)
        return {"message": "Schedule deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_schedule(self, schedule_id: int) -> dict[str, str]:
        """Hard-delete a schedule."""
        db = self._get_db()
        existing = db.get_schedule_by_id(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")
        db.hard_delete_schedule_by_id(schedule_id)
        return {"message": "Schedule permanently deleted"}

    # ------------------------------------------------------------------
    async def create_schedules_bulk(self, bodies: list[ScheduleRequest]) -> list[Schedule]:
        """Create multiple schedules in bulk."""
        db = self._get_db()
        schedules = [Schedule(**b.model_dump()) for b in bodies]
        created = db.create_schedules_bulk(schedules)
        return created if created else []

    # ------------------------------------------------------------------
    async def delete_schedules_bulk(self, bodies: list[ScheduleRequest]) -> dict[str, str]:
        """Soft-delete multiple schedules by member_id and event_id."""
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

    # ------------------------------------------------------------------
    async def hard_delete_schedules_bulk(self, bodies: list[ScheduleRequest]) -> dict[str, str]:
        """Hard-delete multiple schedules by member_id and event_id."""
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
