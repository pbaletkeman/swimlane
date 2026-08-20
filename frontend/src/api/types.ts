/**
 * TypeScript mirrors of the Swimlane FastAPI models.
 *
 * Field names/optionality follow the backend Pydantic models in `src/data/`.
 * Datetime fields serialize over JSON as ISO-8601 strings (or null).
 */

export type Role = 'WEB_ADMIN' | 'FACILITY_MANAGER' | 'COACH' | 'MEMBER'

export interface Frequency {
  frequency_id?: number
  name: string
  day_interval: string
  is_active: boolean
}

export interface Facility {
  facility_id?: number
  name: string
  description?: string | null
  max_capacity?: number | null
  min_capacity?: number | null
  is_active: boolean
}

export interface Event {
  event_id?: number
  start_date_time: string
  end_date_time: string
  frequency_id?: number | null
  description?: string | null
  coach_id?: string | null
  venue_id?: number | null
  is_active: boolean
}

/** Capacity summary for an event from `GET /events/{id}/capacity`. */
export interface EventCapacity {
  event_id: number
  registered_count: number
  /** `null` = unlimited (no capacity limit). */
  max_capacity: number | null
}

/**
 * Response body for `POST /events/{id}/register`: the created `Schedule` row
 * (backend returns a full schedule object).
 */
export interface RegisterResponse {
  schedule_id: number
  venue_id: number
  member_id: string
  event_id: number
  is_active: boolean
}

/** Scope filter for a coach's own events (`GET /coach/events`). */
export type CoachEventScope = 'upcoming' | 'past' | 'all'

/**
 * A member registered for an event from `GET /events/{id}/members`: the
 * schedule joined with a server-decrypted display name and email.
 */
export interface EventMember {
  schedule_id: number
  venue_id: number
  member_id: string
  member_name: string
  email: string | null
  event_id: number
  is_active: boolean
}

/** Request body for `POST /events/{id}/members` (coach adds a member). */
export interface EventMemberAddInput {
  member_id: string
}

/** Request body for `PUT /events/{id}/members/{schedule_id}`. */
export interface EventMemberEditInput {
  venue_id?: number | null
  event_id?: number | null
}

/** Request body for `POST /schedules/{id}/reschedule`. */
export interface RescheduleInput {
  event_id: number
}

export interface Venue {
  venue_id?: number
  facility_id: number
  street: string
  city: string
  state: string
  postal_code: string
  cost: number
  is_active: boolean
}

export interface Schedule {
  schedule_id?: number
  venue_id: number
  member_id: string
  event_id: number
  is_active: boolean
}

/**
 * A member's own schedule entry from `GET /schedules/me`: the schedule joined
 * with its event times, event description, facility name, and venue address.
 */
export interface MyScheduleItem {
  schedule_id: number
  venue_id: number
  member_id: string
  event_id: number
  is_active: boolean
  event_start_date_time: string
  event_end_date_time: string
  event_description: string | null
  facility_name: string
  street: string
  city: string
  state: string
  postal_code: string
}

/**
 * Public venue representation from the unauthenticated `/public/venues`
 * endpoints: venue fields plus its facility name.
 */
export interface PublicVenue {
  venue_id: number
  facility_id: number
  facility_name: string
  street: string
  city: string
  state: string
  postal_code: string
  cost: number
  is_active: boolean
}

/** Public event representation from the unauthenticated `/public` endpoints. */
export interface PublicEvent {
  event_id: number
  start_date_time: string
  end_date_time: string
  frequency_id: number | null
  description: string | null
  coach_id: string | null
  venue_id: number | null
  is_active: boolean
}

/**
 * Public single-event detail from `GET /public/events/{id}`: event fields plus
 * its venue summary and live capacity.
 */
export interface PublicEventDetail extends PublicEvent {
  venue: PublicVenue | null
  registered_count: number
  max_capacity: number | null
}

/**
 * Legacy per-booking row (schedule joined with its event times) returned by the
 * Phase A `/public/venues/{id}/schedules` endpoint. Superseded by `PublicEvent`
 * after B.1–B.4 switched that endpoint to distinct events; retained for Phase C
 * per-booking data (register/reschedule, member's own schedules).
 */
export interface VenueScheduleRow {
  schedule_id: number
  venue_id: number
  event_id: number
  is_active: boolean
  event_start_date_time: string
  event_end_date_time: string
}

export type QuestionType = 'text' | 'checkbox'

export interface FormQuestion {
  form_question_id?: number
  facility_id: number
  prompt: string
  question_type: QuestionType
  is_required: boolean
  sort_order: number
  is_active: boolean
}

export interface FacilityRule {
  rule_id?: number
  facility_id: number
  title: string
  content: string
  sort_order: number
  is_active: boolean
}

export interface FormSubmission {
  submission_id?: number
  facility_id: number
  sub: string
  signed_at?: string | null
  submitted_at?: string | null
  is_complete: boolean
}

/**
 * A member's own form submission from `GET /forms/me/submissions`: submission
 * fields joined with the facility name.
 */
export interface MySubmission {
  submission_id: number
  facility_id: number
  facility_name: string
  signed_at: string | null
  submitted_at: string | null
  is_complete: boolean
}

/**
 * A single form submission with its answers from `GET /forms/submissions/{id}`.
 */
export interface SubmissionDetail {
  submission_id: number
  facility_id: number
  facility_name: string
  sub: string
  signed_at: string | null
  submitted_at: string | null
  is_complete: boolean
  responses: FormResponse[]
}

/**
 * A message in a member's inbox from the `/messages` endpoints, with the
 * sender's display name resolved server-side.
 */
export interface Message {
  message_id: number
  member_id: string
  sender_id: string
  sender_name: string
  subject: string
  body: string
  is_read: boolean
  sent_at: string | null
  is_active: boolean
}

/** Request body for `POST /messages` (staff -> member inbox). */
export interface MessageInput {
  member_id: string
  subject: string
  body?: string
}

export interface FormResponse {
  response_id?: number
  submission_id?: number | null
  question_id: number
  answer_text?: string | null
  answer_bool?: boolean | null
}

/** GET /forms/{facility_id} response: a facility's signup form for display. */
export interface FacilityForm {
  facility_id: number
  questions: FormQuestion[]
  rules: FacilityRule[]
}

export interface MessageResponse {
  message: string
}

/**
 * A managed user from the `/users` endpoints (list/detail/role-change). PII is
 * decrypted server-side and masked (first char + asterisks) — never plaintext
 * or ciphertext.
 */
export interface ManagedUser {
  sub: string
  role: string
  name: string | null
  email: string | null
  is_active: boolean
  is_deleted: boolean
}

/** Request body for `POST /users` (email-keyed invite; role is coach or member). */
export interface ManagedUserInput {
  email: string
  role: 'coach' | 'member'
}

/** Response body for `POST /users` — an invite created or an existing user's role updated. */
export interface UserInviteResult {
  email: string
  role: string
  status: 'invited' | 'updated'
}

/** Request body for `PUT /users/{sub}` — the new role to assign. */
export interface UserRoleUpdateInput {
  role: string
}

/** Lowercase backend role values accepted by `GET /users?role=`. */
export type ManagedUserRoleFilter = 'member' | 'coach' | 'facility_manager' | 'web_admin'

/**
 * Request bodies for creating/updating entities. Optional fields default
 * server-side (matching the backend `*Request` Pydantic models).
 */
export interface FrequencyInput {
  name: string
  day_interval: string
  is_active?: boolean
}

export interface FacilityInput {
  name: string
  description?: string | null
  max_capacity?: number | null
  min_capacity?: number | null
  is_active?: boolean
}

export interface EventInput {
  start_date_time: string
  end_date_time: string
  frequency_id?: number | null
  description?: string | null
  coach_id?: string | null
  venue_id?: number | null
  is_active?: boolean
}

export interface VenueInput {
  facility_id: number
  street: string
  city: string
  state: string
  postal_code: string
  cost?: number
  is_active?: boolean
}

export interface ScheduleInput {
  venue_id: number
  member_id: string
  event_id: number
  is_active?: boolean
}

export interface QuestionInput {
  facility_id: number
  prompt: string
  question_type?: QuestionType
  is_required?: boolean
  sort_order?: number
  is_active?: boolean
}

export interface RuleInput {
  facility_id: number
  title: string
  content: string
  sort_order?: number
  is_active?: boolean
}

export interface FormResponseInput {
  question_id: number
  answer_text?: string | null
  answer_bool?: boolean | null
}

export interface FormSubmissionInput {
  signed: boolean
  responses: FormResponseInput[]
}

/**
 * Backend user row (from `/me` / user management endpoints).
 *
 * Note: PII fields are AES-256-GCM ciphertext columns — never plaintext. The
 * Google OIDC profile (see `src/auth/types.ts`) is preferred for display.
 */
export interface User {
  sub: string
  role: Role | null
  first_name_nonce?: string | null
  first_name_ciphertext?: string | null
  last_name_nonce?: string | null
  last_name_ciphertext?: string | null
  email_nonce?: string | null
  email_ciphertext?: string | null
  email_hash?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
  is_active: boolean
  is_deleted: boolean
}