import api from './client.ts'
import type { MessageResponse } from './types.ts'

/** Generic CRUD endpoint bundle for an entity type. */
export interface CrudApi<Entity, Input> {
  list: () => Promise<Entity[]>
  get: (id: number) => Promise<Entity>
  create: (input: Input) => Promise<Entity>
  update: (id: number, input: Input) => Promise<Entity>
  delete: (id: number) => Promise<MessageResponse>
  hardDelete: (id: number) => Promise<MessageResponse>
  createBulk: (inputs: Input[]) => Promise<Entity[]>
  deleteBulk: (inputs: Input[]) => Promise<MessageResponse>
  hardDeleteBulk: (inputs: Input[]) => Promise<MessageResponse>
}

/**
 * Build the standard per-entity CRUD wrapper for the flat `/entity` routers
 * (`list`, `/{id}`, `/{id}/hard`, `/bulk`, `/bulk/hard`). `basePath` is the
 * entity name without a leading slash, e.g. `createCrudApi('frequencies')`.
 */
export function createCrudApi<Entity, Input>(basePath: string): CrudApi<Entity, Input> {
  return {
    list: () => api.get<Entity[]>(`/${basePath}`),
    get: (id) => api.get<Entity>(`/${basePath}/${id}`),
    create: (input) => api.post<Entity>(`/${basePath}`, input),
    update: (id, input) => api.put<Entity>(`/${basePath}/${id}`, input),
    delete: (id) => api.delete<MessageResponse>(`/${basePath}/${id}`),
    hardDelete: (id) => api.delete<MessageResponse>(`/${basePath}/${id}/hard`),
    createBulk: (inputs) => api.post<Entity[]>(`/${basePath}/bulk`, inputs),
    deleteBulk: (inputs) => api.delete<MessageResponse>(`/${basePath}/bulk`, inputs),
    hardDeleteBulk: (inputs) => api.delete<MessageResponse>(`/${basePath}/bulk/hard`, inputs),
  }
}

export default createCrudApi