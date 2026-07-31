"""
Frequency API routes for managing event frequency types.

Provides CRUD endpoints for frequency entities following the same class-based
router pattern as AuthRoutes.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.data.frequency.frequency import Frequency
from src.data.frequency.sqlite import SQLite as FrequencySQLite
from src.roles.roles import admin_role, all_users, facility_manager_role

logger = logging.getLogger(__name__)


class FrequencyRequest(BaseModel):
    """Request body for creating/updating a frequency."""

    name: str
    day_interval: str
    is_active: bool = True


class FrequencyRoutes:
    """Defines all frequency-related routes."""

    def __init__(self):
        self.router = APIRouter(prefix="/frequencies", tags=["frequencies"])
        self.router.add_api_route(
            "",
            self.list_frequencies,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "/{frequency_id}",
            self.get_frequency,
            methods=["GET"],
            dependencies=[Depends(all_users)],
        )
        self.router.add_api_route(
            "",
            self.create_frequency,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{frequency_id}",
            self.update_frequency,
            methods=["PUT"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{frequency_id}",
            self.delete_frequency,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/{frequency_id}/hard",
            self.hard_delete_frequency,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.create_frequencies_bulk,
            methods=["POST"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk",
            self.delete_frequencies_bulk,
            methods=["DELETE"],
            dependencies=[Depends(facility_manager_role)],
        )
        self.router.add_api_route(
            "/bulk/hard",
            self.hard_delete_frequencies_bulk,
            methods=["DELETE"],
            dependencies=[Depends(admin_role)],
        )

    # ------------------------------------------------------------------
    def _get_db(self) -> FrequencySQLite:
        return FrequencySQLite()

    # ------------------------------------------------------------------
    async def list_frequencies(self) -> list[Frequency]:
        """List all frequencies."""
        try:
            db = self._get_db()
            frequencies = db.list_frequencies()
            return frequencies if frequencies else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list frequencies")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def get_frequency(self, frequency_id: int) -> Frequency:
        """Get a frequency by ID."""
        try:
            db = self._get_db()
            frequency = db.get_frequency_by_id(frequency_id)
            if not frequency:
                raise HTTPException(status_code=404, detail="Frequency not found")
            return frequency
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to get frequency")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_frequency(self, body: FrequencyRequest) -> Frequency:
        """Create a new frequency."""
        try:
            db = self._get_db()
            frequency = Frequency(**body.model_dump())
            existing = db.get_frequency_by_name(frequency.name)
            if existing:
                raise HTTPException(status_code=409, detail="Frequency with this name already exists")
            created = db.create_frequency(frequency)
            if not created:
                raise HTTPException(status_code=500, detail="Failed to create frequency")
            return created
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create frequency")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def update_frequency(self, frequency_id: int, body: FrequencyRequest) -> Frequency:
        """Update an existing frequency."""
        try:
            db = self._get_db()
            existing = db.get_frequency_by_id(frequency_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Frequency not found")
            frequency = Frequency(frequency_id=frequency_id, **body.model_dump())
            updated = db.update_frequency(frequency)
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update frequency")
            return updated
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to update frequency")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_frequency(self, frequency_id: int) -> dict[str, str]:
        """Soft-delete a frequency."""
        try:
            db = self._get_db()
            existing = db.get_frequency_by_id(frequency_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Frequency not found")
            db.delete_frequency_by_id(frequency_id)
            return {"message": "Frequency deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete frequency")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_frequency(self, frequency_id: int) -> dict[str, str]:
        """Hard-delete a frequency."""
        try:
            db = self._get_db()
            existing = db.get_frequency_by_id(frequency_id)
            if not existing:
                raise HTTPException(status_code=404, detail="Frequency not found")
            db.hard_delete_frequency_by_id(frequency_id)
            return {"message": "Frequency permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete frequency")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def create_frequencies_bulk(self, bodies: list[FrequencyRequest]) -> list[Frequency]:
        """Create multiple frequencies in bulk."""
        try:
            db = self._get_db()
            frequencies = [Frequency(**b.model_dump()) for b in bodies]
            created = db.create_frequencies_bulk(frequencies)
            return created if created else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create frequencies in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def delete_frequencies_bulk(self, bodies: list[FrequencyRequest]) -> dict[str, str]:
        """Soft-delete multiple frequencies by name."""
        try:
            db = self._get_db()
            frequencies = []
            for b in bodies:
                existing = db.get_frequency_by_name(b.name)
                if existing:
                    frequencies.append(existing)
            if not frequencies:
                raise HTTPException(status_code=404, detail="No frequencies found")
            db.delete_frequencies_bulk(frequencies)
            return {"message": f"{len(frequencies)} frequency(ies) deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to delete frequencies in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc

    # ------------------------------------------------------------------
    async def hard_delete_frequencies_bulk(self, bodies: list[FrequencyRequest]) -> dict[str, str]:
        """Hard-delete multiple frequencies by name."""
        try:
            db = self._get_db()
            frequencies = []
            for b in bodies:
                existing = db.get_frequency_by_name(b.name)
                if existing:
                    frequencies.append(existing)
            if not frequencies:
                raise HTTPException(status_code=404, detail="No frequencies found")
            db.hard_delete_frequencies_bulk(frequencies)
            return {"message": f"{len(frequencies)} frequency(ies) permanently deleted"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to hard delete frequencies in bulk")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
