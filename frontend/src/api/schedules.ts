import { createCrudApi } from './crud.ts'
import api from './client.ts'
import type { MessageResponse, MyScheduleItem, RescheduleInput, Schedule, ScheduleInput } from './types.ts'

/**
 * Schedule endpoint wrappers (`/schedules`).
 */
export const schedules = createCrudApi<Schedule, ScheduleInput>('schedules')

/** List the signed-in member's active schedules with event/venue/facility detail. */
export const listMine = (): Promise<MyScheduleItem[]> => api.get<MyScheduleItem[]>('/schedules/me')

/** Download the signed-in member's schedules as RFC 5545 iCalendar text. */
export const getMyCalendarIcs = (): Promise<string> =>
  api.get<string>('/schedules/me/ical', { responseType: 'text' })

/** Move the signed-in member's own registration to another event. */
export const reschedule = (id: number, input: RescheduleInput): Promise<Schedule> =>
  api.post<Schedule>(`/schedules/${id}/reschedule`, input)

/** Soft-cancel the signed-in member's own registration. */
export const cancelRegistration = (id: number): Promise<MessageResponse> =>
  api.post<MessageResponse>(`/schedules/${id}/cancel`)

export default schedules