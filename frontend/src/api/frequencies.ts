/**
 * Frequency CRUD API bindings.
 */
import { createCrudApi } from './crud.ts'
import type { Frequency, FrequencyInput } from './types.ts'

/**
 * Frequency endpoint wrappers (`/frequencies`).
 */
export const frequencies = createCrudApi<Frequency, FrequencyInput>('frequencies')

export default frequencies