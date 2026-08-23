"""
Coach API routes for managing the coach's own events.

Provides the coach-scoped endpoints behind ``docs/layout.txt`` lines 27-33:
list the events assigned to the signed-in coach, scoped by time. Follows the
class-based router pattern used across the application.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from src.data.event.event import Event
from src.data.event.sqlite import SQLite as EventSQLite
from src.data.users.user import User
from src.roles.roles import coach_role

logger = logging.getLogger(__name__)

EventScope = Literal["upcoming", "past", "all"]


class CoachRoutes:
    """Defines all coach-scoped routes."""

    def __init__(self) -> None:
        """Register the coach routes on a new APIRouter."""
        self.router = APIRouter(prefix="/coach", tags=["coach"])
        self.router.add_api_route(
            "/events",
            self.list_my_events,
            methods=["GET"],
            dependencies=[Depends(coach_role)],
        )

    # ------------------------------------------------------------------
    def _get_event_db(self) -> EventSQLite:
        """Return a fresh SQLite event store."""
        return EventSQLite()

    # ------------------------------------------------------------------
    async def list_my_events(
        self,
        scope: EventScope = "all",
        current_user: User = Depends(coach_role),
    ) -> list[Event]:
        """List the events assigned to the signed-in coach, filtered by scope."""
        try:
            events = self._get_event_db().list_events_by_coach(current_user.sub, scope)
            return events if events else []
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list coach events")
            raise HTTPException(status_code=500, detail="Internal server error") from exc
