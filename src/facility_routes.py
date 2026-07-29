"""
Facility API routes for managing facility entities.

Provides CRUD endpoints for facility entities following the same class-based
router pattern as AuthRoutes and FrequencyRoutes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.facility.facility import Facility
from src.roles.roles import admin_role, all_users, facility_manager_role
from src.util.configs import Config

db_connect = Config().db


class FacilityRequest(BaseModel):
    """Request body for creating/updating a facility."""

    name: str
    description: str | None = None
    max_capacity: int | None = None
    min_capacity: int | None = None
    is_active: bool = True


class FacilityRoutes:
    """Defines all facility-related routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/facilities", tags=["facilities"])
        self.router.add_api_route(
            "",
            self.list_facilities,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "/{facility_id}",
            self.get_facility,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "",
            self.create_facility,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{facility_id}",
            self.update_facility,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{facility_id}",
            self.delete_facility,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{facility_id}/hard",
            self.hard_delete_facility,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.create_facilities_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.delete_facilities_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk/hard",
            self.hard_delete_facilities_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_db(self):
        if not db_connect:
            raise HTTPException(status_code=500, detail="Database not configured")
        return db_connect()

    # ------------------------------------------------------------------
    async def list_facilities(self) -> list[Facility]:
        """List all facilities."""
        db = self._get_db()
        facilities = db.list_facilities()
        return facilities if facilities else []

    # ------------------------------------------------------------------
    async def get_facility(self, facility_id: int) -> Facility:
        """Get a facility by ID."""
        db = self._get_db()
        facility = db.get_facility_by_id(facility_id)
        if not facility:
            raise HTTPException(status_code=404, detail="Facility not found")
        return facility

    # ------------------------------------------------------------------
    async def create_facility(self, body: FacilityRequest) -> Facility:
        """Create a new facility."""
        db = self._get_db()
        facility = Facility(**body.model_dump())
        existing = db.get_facility_by_name(facility.name)
        if existing:
            raise HTTPException(status_code=409, detail="Facility with this name already exists")
        created = db.create_facility(facility)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create facility")
        return created

    # ------------------------------------------------------------------
    async def update_facility(self, facility_id: int, body: FacilityRequest) -> Facility:
        """Update an existing facility."""
        db = self._get_db()
        existing = db.get_facility_by_id(facility_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Facility not found")
        facility = Facility(facility_id=facility_id, **body.model_dump())
        updated = db.update_facility(facility)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update facility")
        return updated

    # ------------------------------------------------------------------
    async def delete_facility(self, facility_id: int) -> dict[str, str]:
        """Soft-delete a facility."""
        db = self._get_db()
        existing = db.get_facility_by_id(facility_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Facility not found")
        db.delete_facility_by_id(facility_id)
        return {"message": "Facility deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_facility(self, facility_id: int) -> dict[str, str]:
        """Hard-delete a facility."""
        db = self._get_db()
        existing = db.get_facility_by_id(facility_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Facility not found")
        db.hard_delete_facility_by_id(facility_id)
        return {"message": "Facility permanently deleted"}

    # ------------------------------------------------------------------
    async def create_facilities_bulk(self, bodies: list[FacilityRequest]) -> list[Facility]:
        """Create multiple facilities in bulk."""
        db = self._get_db()
        facilities = [Facility(**b.model_dump()) for b in bodies]
        created = db.create_facilities_bulk(facilities)
        return created if created else []

    # ------------------------------------------------------------------
    async def delete_facilities_bulk(self, bodies: list[FacilityRequest]) -> dict[str, str]:
        """Soft-delete multiple facilities by name."""
        db = self._get_db()
        facilities = []
        for b in bodies:
            existing = db.get_facility_by_name(b.name)
            if existing:
                facilities.append(existing)
        if not facilities:
            raise HTTPException(status_code=404, detail="No facilities found")
        db.delete_facilities_bulk(facilities)
        return {"message": f"{len(facilities)} facility(ies) deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_facilities_bulk(self, bodies: list[FacilityRequest]) -> dict[str, str]:
        """Hard-delete multiple facilities by name."""
        db = self._get_db()
        facilities = []
        for b in bodies:
            existing = db.get_facility_by_name(b.name)
            if existing:
                facilities.append(existing)
        if not facilities:
            raise HTTPException(status_code=404, detail="No facilities found")
        db.hard_delete_facilities_bulk(facilities)
        return {"message": f"{len(facilities)} facility(ies) permanently deleted"}
