import api, { apiBaseUrl } from './client.ts'
import type { MessageResponse, User } from './types.ts'

/** Response from the token refresh endpoint. */
export interface RefreshResponse {
  access_token: string
  token_type: string
}

/**
 * Auth endpoint wrappers.
 *
 * `login()` returns the Google OAuth consent URL — callers should assign it to
 * `window.location.href` (the backend redirects back to `/auth/callback`).
 */
export const auth = {
  login: (): string => `${apiBaseUrl}/login`,
  logout: (): Promise<MessageResponse> => api.get<MessageResponse>('/logout'),
  refresh: (refreshToken: string): Promise<RefreshResponse> =>
    api.post<RefreshResponse>('/refresh', { refresh_token: refreshToken }),
  me: (): Promise<User> => api.get<User>('/me'),
}

export default auth