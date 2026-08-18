import { createCrudApi } from './crud.ts'
import api from './client.ts'
import type { RescheduleInput, Schedule, ScheduleInput } from './types.ts'

/**
 * Schedule endpoint wrappers (`/schedules`).
 */
export const schedules = createCrudApi<Schedule, ScheduleInput>('schedules')

/** Move the signed-in member's own registration to another event. */
export const reschedule = (id: number, input: RescheduleInput): Promise<Schedule> =>
  api.post<Schedule>(`/schedules/${id}/reschedule`, input)

export default schedules