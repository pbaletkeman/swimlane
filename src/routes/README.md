# API Routes

Class-based FastAPI routers for each entity, registered in `main.py`.

## Files

| File | Prefix | Description |
|------|--------|-------------|
| `auth_routes.py` | `/login`, `/auth/callback`, `/refresh`, `/me`, `/profile`, `/logout` | Google OAuth2 login/callback, JWT issuance, session management |
| `frequency_routes.py` | `/frequencies` | Frequency CRUD — list, get, create, update, soft/hard delete, bulk |
| `facility_routes.py` | `/facilities` | Facility CRUD — list, get, create, update, soft/hard delete, bulk |
| `event_routes.py` | `/events` | Event CRUD — list, get, create, update, soft/hard delete, bulk; public `GET /events/{id}/capacity`; member `POST /events/{id}/register` |
| `venue_routes.py` | `/venues` | Venue CRUD — list, get, create, update, soft/hard delete, bulk |
| `schedule_routes.py` | `/schedules` | Schedule CRUD — list, get, create, update, soft/hard delete, bulk; member self-service `GET /me`, `GET /me/ical`, `GET /me/events`, `POST /{id}/reschedule`, `POST /{id}/cancel` |
| `form_routes.py` | `/forms` | Form question/rule CRUD (bulk, soft/hard delete), GET facility form, POST submit, PDF export; member `GET /me/submissions`, `GET /submissions/{id}` |
| `message_routes.py` | `/messages` | Staff→member inbox — `GET /me`, `POST /` (coach+), `PUT /{id}/read`, `DELETE /{id}` (soft, own), `DELETE /{id}/hard` (admin) |
| `public_routes.py` | `/public` | Unauthenticated read-only browsing — venues search/list/detail, venue schedules (week/month/list), events search/list/detail |

## Pattern

Each route file exports a `<Entity>Routes` class with `self.router = APIRouter(...)`. Routes use role-based dependencies:
- `all_users` — authenticated users (GET endpoints, own soft delete)
- `member_role` — members and above (register, reschedule, cancel, own schedule/calendar, form submit, own submission list/detail, own inbox read)
- `coach_role` — coaches and above (send messages)
- `facility_manager_role` — facility managers and admins (POST, PUT, DELETE)
- `admin_role` — web admins only (hard delete)
