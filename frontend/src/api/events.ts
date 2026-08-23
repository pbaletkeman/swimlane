/**
 * Event API: capacity, registration, coach member management.
 */
import { createCrudApi } from './crud.ts'
import api from './client.ts'
import type {
  CoachEventScope,
  Event,
  EventCapacity,
  EventInput,
  EventMember,
  EventMemberAddInput,
  EventMemberEditInput,
  MessageResponse,
  RegisterResponse,
} from './types.ts'

/**
 * Event endpoint wrappers (`/events`).
 */
export const events = createCrudApi<Event, EventInput>('events')

/** Fetch an event's capacity summary. Public endpoint — no auth required. */
export const getEventCapacity = (id: number): Promise<EventCapacity> =>
  api.get<EventCapacity>(`/events/${id}/capacity`)

/** Register the signed-in member for an event (creates a `Schedule`). */
export const registerForEvent = (id: number): Promise<RegisterResponse> =>
  api.post<RegisterResponse>(`/events/${id}/register`)

/** List the coach's own events (`GET /coach/events?scope=...`). */
export const listMine = (scope: CoachEventScope = 'upcoming'): Promise<Event[]> =>
  api.get<Event[]>(`/coach/events?scope=${scope}`)

/** List members registered for an event (coach of the event or manager+). */
export const listMembers = (eventId: number): Promise<EventMember[]> =>
  api.get<EventMember[]>(`/events/${eventId}/members`)

/** Add a member to an event, creating their schedule (coach of the event or manager+). */
export const addMember = (eventId: number, memberId: string): Promise<EventMember> =>
  api.post<EventMember>(`/events/${eventId}/members`, { member_id: memberId } satisfies EventMemberAddInput)

/** Remove a member from an event by soft-deleting their schedule. */
export const removeMember = (eventId: number, scheduleId: number): Promise<MessageResponse> =>
  api.delete<MessageResponse>(`/events/${eventId}/members/${scheduleId}`)

/** Edit a member's schedule on an event (venue and/or event). */
export const editMember = (
  eventId: number,
  scheduleId: number,
  input: EventMemberEditInput,
): Promise<EventMember> => api.put<EventMember>(`/events/${eventId}/members/${scheduleId}`, input)

export default events