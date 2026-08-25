# Swimlane - Feature Ideas

## High Priority

### 1. PostgreSQL Migration
- **Status:** Scaffolded but not active
- **What:** Complete the PostgreSQL implementation for production use
- **Why:** SQLite is great for development but doesn't scale for concurrent writes in production
- **Effort:** Medium (interface already defined, need to implement `postgresql.py` for each entity)

### 2. Email Notifications
- **Status:** Not implemented
- **What:** Send emails for:
  - Event registration confirmations
  - Schedule changes/cancellations
  - New message notifications
  - Form submission confirmations
  - Invite emails (currently just creates record)
- **Why:** Users need to know about important events without checking the app
- **Effort:** Medium (need email service integration, templates)

### 3. Push Notifications
- **Status:** Not implemented
- **What:** Real-time notifications for:
  - Event reminders (1 hour before, day before)
  - Message received
  - Schedule changes
- **Why:** Improve engagement and reduce missed events
- **Effort:** High (need WebSocket or push service)

### 4. Calendar Sync (Two-Way)
- **Status:** One-way iCal export only
- **What:** 
  - Import from Google Calendar / Outlook
  - Auto-sync event changes to external calendars
  - Show external calendar events in app
- **Why:** Users live in their calendars; two-way sync reduces friction
- **Effort:** High (OAuth for calendar APIs, sync logic)

### 5. Waitlist System
- **Status:** Not implemented
- **What:** 
  - When event is full, allow waitlist registration
  - Auto-promote from waitlist when spot opens
  - Notify waitlisted users
- **Why:** Popular events fill up; waitlists capture demand
- **Effort:** Medium (new entity, notification integration)

## Medium Priority

### 6. Payment Integration
- **Status:** Not implemented
- **What:** 
  - Accept payments for event registrations
  - Track payment status
  - Generate receipts
  - Refund handling
- **Why:** Many swimming teams charge for events/lessons
- **Effort:** High (Stripe/payment gateway integration, PCI considerations)

### 7. Recurring Events
- **Status:** Frequency entity exists but limited usage
- **What:** 
  - Create events that repeat daily/weekly/monthly
  - Auto-generate future instances
  - Bulk edit recurring series
  - Exception handling (skip specific dates)
- **Why:** Most swim practices are recurring; manual creation is tedious
- **Effort:** Medium (cron-like generation, series management)

### 8. Attendance Tracking
- **Status:** Not implemented
- **What:** 
  - Check-in system for events
  - Attendance history per member
  - Attendance reports per coach/facility
  - Export attendance data
- **Why:** Coaches need to track who shows up; teams need attendance stats
- **Effort:** Medium (new entity, check-in UI, reports)

### 9. Team/Group Management
- **Status:** Flat role hierarchy only
- **What:** 
  - Create teams/groups (e.g., "Varsity", "Junior", "Masters")
  - Assign members to teams
  - Filter views by team
  - Team-specific events/schedules
- **Why:** Swimming teams have sub-groups; need to filter/manage by group
- **Effort:** Medium (new entity, filter logic)

### 10. Coach Availability
- **Status:** Not implemented
- **What:** 
  - Coaches set available times
  - Auto-suggest available coaches when creating events
  - Prevent double-booking
- **Why:** Scheduling is easier when you know who's available
- **Effort:** Medium (availability entity, conflict detection)

### 11. Member Profiles
- **Status:** Basic user info only
- **What:** 
  - Swimming stats (best times, events)
  - Profile photo
  - Bio/notes
  - Emergency contact
  - Medical info (encrypted)
- **Why:** Coaches need member info; members want to showcase achievements
- **Effort:** Medium (new fields, photo upload, privacy controls)

### 12. Facility Booking
- **Status:** Facilities are static entities
- **What:** 
  - Book facilities for specific times
  - Check facility availability
  - Prevent double-booking
  - Booking calendar view
- **Why:** Facilities have limited capacity; need scheduling
- **Effort:** Medium (availability logic, calendar UI)

## Low Priority

### 13. Reporting & Analytics
- **Status:** Not implemented
- **What:** 
  - Attendance reports
  - Event popularity metrics
  - Member engagement stats
  - Financial reports (if payments added)
  - Export to CSV/Excel
- **Why:** Data-driven decisions for coaches/managers
- **Effort:** Medium (query aggregation, chart components)

### 14. Mobile App (PWA or Native)
- **Status:** Responsive web only
- **What:** 
  - Progressive Web App for installability
  - Offline support for schedule viewing
  - Push notifications (native)
  - Camera for profile photos
- **Why:** Mobile-first experience for on-the-go users
- **Effort:** High (PWA setup or React Native)

### 15. Multi-Language Support (i18n)
- **Status:** English only
- **What:** 
  - Internationalization framework
  - translations for UI strings
  - Date/time localization
  - RTL support
- **Why:** Serve international teams
- **Effort:** Medium (i18n library, translation files)

### 16. Dark Mode Improvements
- **Status:** Basic theme switching
- **What:** 
  - System preference detection
  - Manual toggle persistence
  - Better dark mode colors
- **Why:** User preference and accessibility
- **Effort:** Low (theme refinement)

### 17. Audit Logging
- **Status:** Request logging only
- **What:** 
  - Track who changed what
  - Version history for entities
  - Change diff viewer
  - Admin audit log
- **Why:** Accountability and debugging
- **Effort:** Medium (audit entity, change tracking middleware)

### 18. API Rate Limiting
- **Status:** Not implemented
- **What:** 
  - Limit requests per user/IP
  - Different limits for different endpoints
  - Rate limit headers
  - Graceful degradation
- **Why:** Prevent abuse, ensure availability
- **Effort:** Low (middleware + Redis/memory store)

### 19. Webhook Support
- **Status:** Not implemented
- **What:** 
  - Allow users to register webhooks for events
  - Fire webhooks on event create/update/delete
  - Webhook delivery logs
  - Retry logic
- **Why:** Integrate with external systems
- **Effort:** Medium (webhook entity, delivery queue)

### 20. Import/Export
- **Status:** Not implemented
- **What:** 
  - Import members from CSV
  - Import events from CSV
  - Export data to CSV/Excel
  - Bulk operations via import
- **Why:** Migrate from other systems, bulk data management
- **Effort:** Medium (CSV parsing, validation, bulk insert)

## Technical Debt / Improvements

### 21. Database Migrations
- **Current:** Inline `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE`
- **Improvement:** 
  - Add proper migration system (Alembic or custom)
  - Version tracking
  - Rollback support
  - Down migrations
- **Why:** Safer schema changes in production
- **Effort:** Medium

### 22. API Documentation
- **Current:** Auto-generated OpenAPI
- **Improvement:** 
  - Better endpoint descriptions
  - Request/response examples
  - Authentication guides
  - Error code documentation
- **Why:** Developer experience for API consumers
- **Effort:** Low

### 23. Frontend Testing
- **Current:** Vitest setup, limited tests
- **Improvement:** 
  - Component unit tests
  - Integration tests
  - E2E tests (Playwright/Cypress)
  - Visual regression tests
- **Why:** Confidence in UI changes
- **Effort:** High

### 24. CI/CD Pipeline
- **Current:** Not implemented
- **Improvement:** 
  - GitHub Actions / Azure DevOps
  - Automated testing
  - Linting on PR
  - Deployment automation
  - Environment promotion (dev → staging → prod)
- **Why:** Reliable releases, fast feedback
- **Effort:** Medium

### 25. Error Handling & Monitoring
- **Current:** Basic logging
- **Improvement:** 
  - Structured error responses
  - Error tracking (Sentry)
  - Performance monitoring
  - Health checks
  - Alerting
- **Why:** Production visibility and debugging
- **Effort:** Medium

## Quick Wins (< 1 day each)

- **Keyboard shortcuts** - Common actions via hotkeys
- **Bulk actions** - Select multiple items, bulk delete/edit
- **Search improvements** - Fuzzy search, search history
- **Loading states** - Skeleton loaders, progress indicators
- **Empty states** - Helpful messages when no data
- **Confirmation dialogs** - Before destructive actions
- **Form validation** - Better error messages
- **Responsive improvements** - Mobile sidebar, touch gestures
- **Accessibility** - ARIA labels, keyboard navigation
- **Performance** - Virtual scrolling for large lists

---

*Generated: 2026-08-24*
