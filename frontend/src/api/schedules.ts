import { createCrudApi } from './crud.ts'
import type { Schedule, ScheduleInput } from './types.ts'

/**
 * Schedule endpoint wrappers (`/schedules`).
 */
export const schedules = createCrudApi<Schedule, ScheduleInput>('schedules')

export default schedules