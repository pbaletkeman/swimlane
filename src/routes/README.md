# API Routes

Class-based FastAPI routers for each entity, registered in `main.py`.

## Files

| File | Prefix | Description |
|------|--------|-------------|
| `auth_routes.py` | `/login`, `/auth/callback`, `/refresh`, `/me`, `/profile`, `/logout` | Google OAuth2 login/callback, JWT issuance, session management |
| `frequency_routes.py` | `/frequencies` | Frequency CRUD — list, get, create, update, soft/hard delete, bulk |
| `facility_routes.py` | `/facilities` | Facility CRUD — list, get, create, update, soft/hard delete, bulk |
| `event_routes.py` | `/events` | Event CRUD — list, get, create, update, soft/hard delete, bulk |
| `venue_routes.py` | `/venues` | Venue CRUD — list, get, create, update, soft/hard delete, bulk |

## Pattern

Each route file exports a `<Entity>Routes` class with `self.router = APIRouter(...)`. Routes use role-based dependencies:
- `all_users` — authenticated users (GET endpoints)
- `facility_manager_role` — facility managers and admins (POST, PUT, DELETE)
- `admin_role` — web admins only (hard delete)
