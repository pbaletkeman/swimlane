# Swimlane - Project Overview

## What It Is

Swimlane is a full-stack web application for managing swimming team operations — events, venues, facilities, member schedules, and signup forms. Designed for swimming clubs/teams that need to coordinate coaches, members, facilities, and event scheduling.

## Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.14+)
- **Database:** SQLite via raw `sqlite3` (PostgreSQL scaffolded but not active)
- **Authentication:** Google OAuth2 → local JWT (access + refresh tokens)
- **Encryption:** AES-256-GCM for PII fields (name, email)
- **PDF Generation:** ReportLab
- **Config:** YAML-based configuration

### Frontend
- **Framework:** React 19 + TypeScript 6 + Vite 8
- **UI Library:** PrimeReact 11 with Aura theme
- **Routing:** react-router-dom v7 (lazy-loaded)
- **Testing:** Vitest + Testing Library

## Core Features

### Authentication & Authorization
- Google OAuth2 login with CSRF protection (signed state tokens)
- Auto-registration of new users
- Email-keyed invite system with pre-assigned roles
- Local JWT access tokens (15-min) + refresh tokens (7-day)
- Hierarchical role-based access control (RBAC)

### Role Hierarchy
| Role | Capabilities |
|------|--------------|
| **MEMBER** | View dashboard, submit forms, register for events, view/cancel schedule, receive messages |
| **COACH** | All member features + create/update/delete own events, send messages, manage event members |
| **FACILITY_MANAGER** | All coach features + full CRUD on all entities, form builder, user management |
| **WEB_ADMIN** | All facility manager features + manage senior roles |

### Public Browsing (No Login Required)
- Browse venues (search, list, detail)
- Browse events (search, filter by date/venue)
- View venue schedules (week/month/list views)
- View event details with live capacity

### Entity CRUD (Authenticated)
Full CRUD + bulk operations for:
- Frequencies (event recurrence)
- Facilities (physical locations)
- Events (swim sessions)
- Venues (locations containing facilities)
- Schedules (member-event registrations)

### Member Self-Service
- Register for events
- View personal schedule
- Reschedule or cancel registrations
- iCal export of personal schedule
- Submit signup forms
- View form submission history

### Coach Features
- View own events (upcoming/past/all)
- Manage event members (list/add/edit/remove)
- Event ownership guard (coaches only modify their own events)

### Signup Forms
- Form question and rule management (facility managers)
- Facility form view
- Member form submission
- PDF export of submissions

### Messaging
- Staff-to-member inbox system
- Members: list inbox, mark read, soft delete
- Coaches+: send messages
- Admins: hard delete

### User Management
- List users by role, view detail
- Email-keyed invite system
- Role change (senior roles restricted to web admin)
- Soft/hard delete

### DevTools
- Self-contained API test page at `/devtools`
- Quick-endpoint buttons + custom request form

### Logging & Observability
- Request logging with UUID correlation IDs
- Configurable log level/format/output
- Performance timing for every request

## Frontend Pages

| Route | Page | Access |
|-------|------|--------|
| `/` | HomePage (explore + login) | Public |
| `/login` | Google OAuth login | Public |
| `/auth/callback` | Token capture | Public |
| `/explore/*` | Venue/event browsing | Public |
| `/dashboard` | Dashboard | MEMBER+ |
| `/profile` | User profile | MEMBER+ |
| `/my-schedule` | Personal schedule + iCal | MEMBER+ |
| `/manage-events` | Coach event management | COACH+ |
| `/frequencies` | Frequency CRUD | FACILITY_MANAGER+ |
| `/facilities` | Facility CRUD | FACILITY_MANAGER+ |
| `/events` | Event CRUD | FACILITY_MANAGER+ |
| `/venues` | Venue CRUD | FACILITY_MANAGER+ |
| `/schedules` | Schedule CRUD | FACILITY_MANAGER+ |
| `/manage-users` | User management | FACILITY_MANAGER+ |
| `/forms` | Form view/builder | MEMBER+ / FACILITY_MANAGER+ |

## Data Layer Pattern

Each entity follows a strict 3-file convention:

```
src/data/<entity>/
├── <entity>.py          # Pydantic BaseModel (row shape)
├── <entity>_interface.py # ABC with abstract CRUD methods
└── sqlite.py            # Concrete SQLite implementation
```

**11 entities implemented:** users, frequency, facility, event, venue, schedule, form_question, facility_rule, form_submission, message, user_invite

## Key Design Decisions

1. **No ORM** — raw `sqlite3` for full SQL control; interface pattern keeps door open for PostgreSQL
2. **Encrypted PII** — AES-256-GCM nonce + ciphertext; SHA-256 hashes for lookups
3. **Hierarchical roles** — single rank check determines access
4. **Hybrid auth** — Google OAuth for identity, local JWT for authorization
5. **Public + authenticated split** — browsing is open, writes require auth
6. **No separate migrations** — schema evolution handled inline in entity `init()` methods

## Testing

- **Backend:** 22 test files, 90% code coverage (pytest)
- **Frontend:** Vitest + Testing Library (jsdom)
- Tests use throwaway SQLite DB (never touches dev database)

## Project Structure

```
swimlane/
├── main.py                    # FastAPI entrypoint
├── config.yaml                # App configuration
├── pyproject.toml             # Python deps + tool config
├── src/
│   ├── encryption.py          # AES-256-GCM + SHA-256
│   ├── data/                  # 11 entity data layers
│   ├── routes/                # 13 route modules
│   ├── roles/                 # RBAC system
│   ├── middleware/             # Request logging
│   └── util/                  # Config, logging, date utils
├── frontend/                  # React SPA
│   └── src/
│       ├── api/               # Typed API client
│       ├── auth/              # Auth context + guards
│       ├── components/        # Reusable UI components
│       ├── layout/            # AppLayout + nav
│       ├── pages/             # 18+ page components
│       ├── router/            # Route definitions
│       └── theme/             # Theme switching
├── tests/                     # Backend tests
└── docs/                      # Documentation + diagrams
```
