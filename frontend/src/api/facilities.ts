import { createCrudApi } from './crud.ts'
import type { Facility, FacilityInput } from './types.ts'

/**
 * Facility endpoint wrappers (`/facilities`).
 */
export const facilities = createCrudApi<Facility, FacilityInput>('facilities')

export default facilities