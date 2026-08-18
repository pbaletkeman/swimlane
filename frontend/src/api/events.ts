import { createCrudApi } from './crud.ts'
import api from './client.ts'
import type { Event, EventCapacity, EventInput, RegisterResponse } from './types.ts'

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

export default events