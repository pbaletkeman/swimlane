# Relationships

> **Note**: This file describes the business domain relationships. For the full
> schema with field-level detail, see the [ERD](erd.mmd).

## Business Rules

- 1 user can be a member of 1 or more schedules (registrations)
- 1 venue can have 1 or more facilities
- 1 facility can have 1 or more venues
- 1 user can have 1 role (web_admin, facility_manager, coach, member)
- 1 venue can host 1 or more events
- 1 event must have 1 frequency type
- 1 facility can have 1 or more signup form questions
- 1 facility can have 1 or more signup form rules
- 1 user can submit 1 or more signup form submissions per facility
- 1 staff user can send 1 or more messages to members

## Entity Summaries

### frequency

- frequency_id (PK, auto-increment)
- name — one_time, weekly, monthly, annually, etc.
- day_interval — interval description

### event

- event_id (PK, auto-increment)
- start_date_time, end_date_time
- frequency_id (FK → frequency)
- description
- coach_id (FK → user.sub) — the assigned coach
- venue_id (FK → venue) — where the event takes place

### venue

- venue_id (PK, auto-increment)
- facility_id (FK → facility) — the physical facility
- street, city, state, postal_code
- cost

### facility

- facility_id (PK, auto-increment)
- name, description
- max_capacity, min_capacity

### schedule (member registration)

- schedule_id (PK, auto-increment)
- venue_id (FK → venue)
- member_id (FK → user.sub)
- event_id (FK → event)

### form_question

- form_question_id (PK, auto-increment)
- facility_id (FK → facility)
- prompt, question_type (text|checkbox), is_required, sort_order

### facility_rule

- rule_id (PK, auto-increment)
- facility_id (FK → facility)
- title, content, sort_order

### form_submission

- submission_id (PK, auto-increment)
- facility_id (FK → facility)
- sub (FK → user.sub) — the member who submitted
- signed_at, submitted_at, is_complete

### form_response

- form_response_id (PK, auto-increment)
- submission_id (FK → form_submission)
- form_question_id (FK → form_question)
- answer

### message

- message_id (PK, auto-increment)
- member_id (FK → user.sub) — recipient
- sender_id (FK → user.sub) — staff sender
- subject, body, is_read, sent_at

### user_invite

- email_hash (PK) — SHA-256 of email
- role — intended role for the not-yet-registered user

---

[Back to README](../readme.md) | [Documentation Index](index.md)
