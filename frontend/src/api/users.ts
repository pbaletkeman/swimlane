import api from './client.ts'
import type {
  ManagedUser,
  ManagedUserInput,
  ManagedUserRoleFilter,
  MessageResponse,
  UserInviteResult,
  UserRoleUpdateInput,
} from './types.ts'

/**
 * User management endpoint wrappers (`/users`). All responses carry masked PII
 * only — never plaintext or ciphertext.
 */
export const listUsers = (role?: ManagedUserRoleFilter): Promise<ManagedUser[]> => {
  const query = role ? `?role=${encodeURIComponent(role)}` : ''
  return api.get<ManagedUser[]>(`/users${query}`)
}

/** Fetch a single managed user by Google `sub` (404 when unknown). */
export const getUser = (sub: string): Promise<ManagedUser> => api.get<ManagedUser>(`/users/${sub}`)

/** Invite a coach or member by email (creates the account on first login). */
export const createUser = (input: ManagedUserInput): Promise<UserInviteResult> =>
  api.post<UserInviteResult>('/users', input)

/** Change a user's role (`PUT /users/{sub}`). */
export const updateUserRole = (sub: string, role: string): Promise<ManagedUser> =>
  api.put<ManagedUser>(`/users/${sub}`, { role } satisfies UserRoleUpdateInput)

/** Soft-delete a user (`DELETE /users/{sub}`). */
export const softDeleteUser = (sub: string): Promise<MessageResponse> =>
  api.delete<MessageResponse>(`/users/${sub}`)

/** Hard-delete a user (admin only — `DELETE /users/{sub}/hard`). */
export const hardDeleteUser = (sub: string): Promise<MessageResponse> =>
  api.delete<MessageResponse>(`/users/${sub}/hard`)

export default {
  list: listUsers,
  get: getUser,
  create: createUser,
  updateRole: updateUserRole,
  softDelete: softDeleteUser,
  hardDelete: hardDeleteUser,
}