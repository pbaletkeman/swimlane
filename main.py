"""
FastAPI application entrypoint for initializing authentication routes and session
management.

This module performs the following tasks:

- Loads environment configuration using `load_config()` so that OAuth, database,
  and other project settings are available before the application starts.
- Creates the main FastAPI application instance.
- Adds Starlette's `SessionMiddleware` to enable secure server‑side session
  storage, required for OAuth flows and user session tracking.
- Registers the authentication router provided by `AuthRoutes`, which exposes
  login, callback, and related authentication endpoints.
- Provides a development entrypoint using Uvicorn when executed directly.

Run this module with `uvicorn main:app --reload` during development.
"""

import os

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from src.routes.auth_routes import AuthRoutes
from src.routes.event_routes import EventRoutes
from src.routes.facility_routes import FacilityRoutes
from src.routes.frequency_routes import FrequencyRoutes
from src.routes.schedule_routes import ScheduleRoutes
from src.routes.venue_routes import VenueRoutes

app = FastAPI()

# --- SESSION MIDDLEWARE ---
app.add_middleware(SessionMiddleware, secret_key=os.urandom(24).hex())

# Include the router in the app
auth_routes = AuthRoutes()
app.include_router(auth_routes.router)

frequency_routes = FrequencyRoutes()
app.include_router(frequency_routes.router)

facility_routes = FacilityRoutes()
app.include_router(facility_routes.router)

event_routes = EventRoutes()
app.include_router(event_routes.router)

venue_routes = VenueRoutes()
app.include_router(venue_routes.router)

schedule_routes = ScheduleRoutes()
app.include_router(schedule_routes.router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

# uvicorn main:app --reload
