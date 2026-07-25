---
name: swimlane-domain
description: Swimming team management business domain, entity model, and workflow documentation
---

## What this skill covers

The business domain: swimming team management, entity relationships, workflows, and policies.

## Entity model (6 core entities)

From `docs/erd.mmd`:

- **frequency** -- `frequency_id`, `name`, `day_interval`, `is_active`
- **event** -- `event_id`, `start_date_time`, `end_date_time`, `is_active`, `frequency_id`
- **user** -- `sub`, `role`, encrypted PII fields, timestamps, soft-delete flags
- **venue** -- `venue_id`, `facility_id`, `street`, `city`, `state`, `postal_code`, `cost`, `is_active`
- **facility** -- `facility_id`, `name`, `description`, `max_capacity`, `min_capacity`, `is_active`
- **schedule** -- `schedule_id`, `venue_id`, `member_id`, `event_id`, `is_active`

Relationships: frequency-to-event (1:many), event-to-user (1:many), event-to-schedule (1:many), user-to-schedule (1:many), venue-to-schedule (1:many), facility-to-schedule (1:many).

## Role hierarchy

Admin -> Facility Manager -> Coach -> Member (configurable, see rbac skill).

## Workflows (documented in `docs/flow/`)

**Current signup** (manual, admin-driven):
Request -> approve -> check if swum before -> invoice -> payment -> register -> welcome email

**New signup** (self-service, planned):
Browse programs -> filter sessions -> request to join -> invoice -> payment -> welcome email -> admin notification

**Current reschedule** (manual admin loop):
Request makeup -> check capacity -> confirm or offer alternatives -> book -> confirm

**New reschedule** (self-service, planned):
Cancel -> select makeup session with capacity shown -> update DB -> confirm

## Business policies (`docs/policy-amendment.md`)

Real-world policy for "Team Atomica" masters swimming team:
- 7-day makeup swim policy
- Admin-processed make-up requests (Mon-Fri business hours)
- Weather/cancellation credit/refund rules

## Key files

- `docs/erd.mmd` -- Entity-Relationship diagram
- `docs/flow/` -- Mermaid flowcharts (current and new signup/reschedule)
- `docs/sequence/` -- Mermaid sequence diagrams
- `docs/relationships.md` -- Business domain relationships
- `docs/plan.md` -- Development plan
- `docs/policy-amendment.md` -- Team Atomica swim policy
- `docs/other-notes.md` -- Business notes (invoicing, missed swim tracking)

## When to use this skill

Use this when working on business logic, adding new entities, modifying workflows, understanding entity relationships, or implementing features that depend on domain rules (signup, reschedule, invoicing).
