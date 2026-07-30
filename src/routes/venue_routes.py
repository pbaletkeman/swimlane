"""
Venue API routes for managing venue entities.

Provides CRUD endpoints for venue entities following the same class-based
router pattern as AuthRoutes and FrequencyRoutes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.venue.sqlite import SQLite as VenueSQLite
from src.data.venue.venue import Venue
from src.roles.roles import admin_role, all_users, facility_manager_role


class VenueRequest(BaseModel):
    """Request body for creating/updating a venue."""

    facility_id: int
    street: str
    city: str
    state: str
    postal_code: str
    cost: float = 0.0
    is_active: bool = True


class VenueRoutes:
    """Defines all venue-related routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/venues", tags=["venues"])
        self.router.add_api_route(
            "",
            self.list_venues,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "/{venue_id}",
            self.get_venue,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "",
            self.create_venue,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{venue_id}",
            self.update_venue,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{venue_id}",
            self.delete_venue,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{venue_id}/hard",
            self.hard_delete_venue,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.create_venues_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.delete_venues_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk/hard",
            self.hard_delete_venues_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_db(self) -> VenueSQLite:
        return VenueSQLite()

    # ------------------------------------------------------------------
    async def list_venues(self) -> list[Venue]:
        """List all venues."""
        db = self._get_db()
        venues = db.list_venues()
        return venues if venues else []

    # ------------------------------------------------------------------
    async def get_venue(self, venue_id: int) -> Venue:
        """Get a venue by ID."""
        db = self._get_db()
        venue = db.get_venue_by_id(venue_id)
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        return venue

    # ------------------------------------------------------------------
    async def create_venue(self, body: VenueRequest) -> Venue:
        """Create a new venue."""
        db = self._get_db()
        venue = Venue(**body.model_dump())
        created = db.create_venue(venue)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create venue")
        return created

    # ------------------------------------------------------------------
    async def update_venue(self, venue_id: int, body: VenueRequest) -> Venue:
        """Update an existing venue."""
        db = self._get_db()
        existing = db.get_venue_by_id(venue_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Venue not found")
        venue = Venue(venue_id=venue_id, **body.model_dump())
        updated = db.update_venue(venue)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update venue")
        return updated

    # ------------------------------------------------------------------
    async def delete_venue(self, venue_id: int) -> dict[str, str]:
        """Soft-delete a venue."""
        db = self._get_db()
        existing = db.get_venue_by_id(venue_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Venue not found")
        db.delete_venue_by_id(venue_id)
        return {"message": "Venue deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_venue(self, venue_id: int) -> dict[str, str]:
        """Hard-delete a venue."""
        db = self._get_db()
        existing = db.get_venue_by_id(venue_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Venue not found")
        db.hard_delete_venue_by_id(venue_id)
        return {"message": "Venue permanently deleted"}

    # ------------------------------------------------------------------
    async def create_venues_bulk(self, bodies: list[VenueRequest]) -> list[Venue]:
        """Create multiple venues in bulk."""
        db = self._get_db()
        venues = [Venue(**b.model_dump()) for b in bodies]
        created = db.create_venues_bulk(venues)
        return created if created else []

    # ------------------------------------------------------------------
    async def delete_venues_bulk(self, bodies: list[VenueRequest]) -> dict[str, str]:
        """Soft-delete multiple venues by facility_id and street."""
        db = self._get_db()
        all_venues = db.list_venues() or []
        venues = [v for v in all_venues for b in bodies if v.facility_id == b.facility_id and v.street == b.street]
        if not venues:
            raise HTTPException(status_code=404, detail="No venues found")
        db.delete_venues_bulk(venues)
        return {"message": f"{len(venues)} venue(s) deleted"}

    # ------------------------------------------------------------------
    async def hard_delete_venues_bulk(self, bodies: list[VenueRequest]) -> dict[str, str]:
        """Hard-delete multiple venues by facility_id and street."""
        db = self._get_db()
        all_venues = db.list_venues() or []
        venues = [v for v in all_venues for b in bodies if v.facility_id == b.facility_id and v.street == b.street]
        if not venues:
            raise HTTPException(status_code=404, detail="No venues found")
        db.hard_delete_venues_bulk(venues)
        return {"message": f"{len(venues)} venue(s) permanently deleted"}
