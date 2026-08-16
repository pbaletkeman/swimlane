import { createCrudApi } from './crud.ts'
import type { Venue, VenueInput } from './types.ts'

/**
 * Venue endpoint wrappers (`/venues`).
 */
export const venues = createCrudApi<Venue, VenueInput>('venues')

export default venues