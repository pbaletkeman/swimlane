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
  is_active: boolean
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
  is_active: boolean
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