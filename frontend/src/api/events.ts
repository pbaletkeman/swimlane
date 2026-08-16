import { createCrudApi } from './crud.ts'
import type { Event, EventInput } from './types.ts'

/**
 * Event endpoint wrappers (`/events`).
 */
export const events = createCrudApi<Event, EventInput>('events')

export default events