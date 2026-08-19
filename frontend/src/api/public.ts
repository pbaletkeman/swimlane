import api from './client.ts'
import type { PublicEvent, PublicEventDetail, PublicVenue } from './types.ts'

/**
 * Public (unauthenticated) API wrappers for the `/public` router.
 *
 * These endpoints are read-only and require no auth token; the shared client
 * still attaches a Bearer header when a token happens to be present.
 */

export type ScheduleView = 'week' | 'month' | 'list'

export interface VenueScheduleOptions {
  /** Which view to render; defaults to `week` (current week anchored on `date`). */
  view?: ScheduleView
  /** ISO `YYYY-MM-DD` anchor for the view; defaults to today server-side. */
  date?: string
}

export interface EventSearchOptions {
  /** Scope the listing to events with an active schedule at this venue. */
  venueId?: number
  /** ISO start filter on `start_date_time`. */
  from?: string
  /** ISO end filter on `start_date_time`. */
  to?: string
}

/** Build a `?a=1&b=2` query string from defined, non-empty values. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

/** Search public venues by address substring. */
export const searchVenues = (q: string): Promise<PublicVenue[]> =>
  api.get<PublicVenue[]>(`/public/venues${buildQuery({ q })}`)

/** List all active public venues. */
export const listVenues = (): Promise<PublicVenue[]> => api.get<PublicVenue[]>('/public/venues')

/** Fetch a single public venue; 404 for unknown or inactive venues. */
export const getVenue = (id: number): Promise<PublicVenue> => api.get<PublicVenue>(`/public/venues/${id}`)

/** Fetch a venue's schedule for a view (`week`/`month`/`list`), anchored on a date. */
export const getVenueSchedules = (id: number, options: VenueScheduleOptions = {}): Promise<PublicEvent[]> =>
  api.get<PublicEvent[]>(`/public/venues/${id}/schedules${buildQuery({ view: options.view, date: options.date })}`)

/** Search public events; defaults to upcoming active events. */
export const searchEvents = (options: EventSearchOptions = {}): Promise<PublicEvent[]> =>
  api.get<PublicEvent[]>(
    `/public/events${buildQuery({ venue_id: options.venueId, from_dt: options.from, to_dt: options.to })}`,
  )

/** Fetch a single public event with its venue and capacity; 404 for unknown/inactive. */
export const getEventDetail = (id: number): Promise<PublicEventDetail> =>
  api.get<PublicEventDetail>(`/public/events/${id}`)

const publicApi = {
  searchVenues,
  listVenues,
  getVenue,
  getVenueSchedules,
  searchEvents,
  getEventDetail,
}

export default publicApi