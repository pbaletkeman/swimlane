# API Routes

Class-based FastAPI routers for each entity, registered in `main.py`.

## Files

| File | Prefix | Description |
|------|--------|-------------|
| `auth_routes.py` | `/login`, `/auth/callback`, `/refresh`, `/me`, `/profile`, `/logout` | Google OAuth2 login/callback, JWT issuance, session management |
| `frequency_routes.py` | `/frequencies` | Frequency CRUD — list, get, create, update, soft/hard delete, bulk |
| `facility_routes.py` | `/facilities` | Facility CRUD — list, get, create, update, soft/hard delete, bulk |
| `event_routes.py` | `/events` | Event CRUD — list, get, create, update, soft/hard delete, bulk. Create/update/delete use `coach_role` with an inline ownership guard: managers/admins may touch any event, coaches only their own (`coach_id` forced to caller on create, reassignment blocked); bulk stays `facility_manager_role`. Public (no auth) `GET /events/{id}/capacity`; member `POST /events/{id}/register`. Member management by the event's coach or managers+: `GET/POST /events/{id}/members`, `PUT/DELETE /events/{id}/members/{schedule_id}` |
| `venue_routes.py` | `/venues` | Venue CRUD — list, get, create, update, soft/hard delete, bulk |
| `schedule_routes.py` | `/schedules` | Schedule CRUD — list, get, create, update, soft/hard delete, bulk; member self-service `GET /me`, `GET /me/ical`, `GET /me/events`, `POST /{id}/reschedule`, `POST /{id}/cancel` |
| `form_routes.py` | `/forms` | Form question/rule CRUD (bulk, soft/hard delete), GET facility form, POST submit, PDF export; member `GET /me/submissions`, `GET /submissions/{id}` |
| `message_routes.py` | `/messages` | Staff→member inbox — `GET /me`, `POST /` (coach+), `PUT /{id}/read`, `DELETE /{id}` (soft, own), `DELETE /{id}/hard` (admin) |
| `coach_routes.py` | `/coach` | Coach-scoped endpoints — `GET /events?scope=upcoming\|past\|all` (own events) |
| `user_routes.py` | `/users` | User management (facility manager+) — `GET /` (list by role), `GET /{sub}` (detail), `POST /` (email-keyed invite), `PUT /{sub}` (role change), `DELETE /{sub}` (soft), `DELETE /{sub}/hard` (admin). Senior-role bounds: listing/assigning/removing `facility_manager`/`web_admin` is `web_admin`-only (403 otherwise) |
| `public_routes.py` | `/public` | Unauthenticated read-only browsing — venues search/list/detail, venue schedules (`view=week\|month\|list`, `date=YYYY-MM-DD`), events search/list/detail (live capacity + venue on detail). Inactive/missing rows 404 (soft-deleted rows never leak) |

## Pattern

Each route file exports a `<Entity>Routes` class with `self.router = APIRouter(...)`. Routes use role-based dependencies:
- `all_users` — authenticated users (GET endpoints, own soft delete)
- `member_role` — members and above (register, reschedule, cancel, own schedule/calendar, form submit, own submission list/detail, own inbox read)
- `coach_role` — coaches and above (send messages; event create/update/delete with the ownership guard)
- `facility_manager_role` — facility managers and admins (bulk ops, entity CRUD where not relaxed to coach)
- `admin_role` — web admins only (hard delete; senior-role user management)
