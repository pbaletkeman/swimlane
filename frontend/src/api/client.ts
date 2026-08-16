/**
 * API client wrapper around fetch.
 *
 * - Resolves the request URL against VITE_API_URL when set; otherwise falls
 *   back to the dev proxy path `/api/...` (stripped by vite.config.ts).
 * - Attaches `Authorization: Bearer <token>` from the auth token store.
 * - On 401, attempts a single token refresh via `POST /refresh` and retries the
 *   request once. If that fails (or no refresh token exists), clears tokens and
 *   dispatches `swimlane:auth-unauthorized` so the auth layer redirects to login.
 * - Normalizes non-2xx responses into an `ApiError` carrying the status code
 *   and the backend's `detail` message.
 */

import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from '../auth/tokens.ts'

/** Dispatched when the backend rejects a request with 401 (see client.ts). */
export const AUTH_UNAUTHORIZED_EVENT = 'swimlane:auth-unauthorized'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Base URL for API calls; `/api` in dev (Vite proxy) or the configured origin. */
export const apiBaseUrl: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '/api'

function resolve(path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${trimmed}`
}

let refreshInFlight: Promise<string> | null = null

/** Exchange the stored refresh token for a new access token (deduplicated). */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token available')
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      let response: Response
      try {
        response = await fetch(resolve('/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
      } catch {
        throw new ApiError(0, 'Network error — could not reach the server')
      }
      if (!response.ok) {
        throw new ApiError(response.status, 'Token refresh failed')
      }
      const data = (await response.json()) as { access_token?: string }
      if (!data.access_token) {
        throw new ApiError(response.status, 'Token refresh returned no access token')
      }
      setAccessToken(data.access_token)
      return data.access_token
    })().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

interface RequestOptions {
  /** True when this request is a retry after a successful token refresh. */
  retried?: boolean
  /** How to parse the response body; defaults to JSON-or-text. */
  responseType?: 'json' | 'text' | 'blob'
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let payload: BodyInit | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(resolve(path), {
      method,
      headers,
      body: payload,
    })
  } catch {
    // Network failure (backend down, CORS, etc.) — normalize into ApiError.
    throw new ApiError(0, 'Network error — could not reach the server')
  }

  if (!response.ok) {
    let detail: string = response.statusText
    try {
      const data: unknown = await response.json()
      if (data && typeof data === 'object' && 'detail' in data) {
        detail = String((data as { detail: unknown }).detail)
      } else {
        detail = JSON.stringify(data)
      }
    } catch {
      // Not JSON — keep statusText.
    }

    if (response.status === 401) {
      // The access token was rejected. Try refreshing once and retrying; if the
      // refresh fails (or there's no refresh token), sign the user out.
      if (!options.retried && getRefreshToken()) {
        try {
          await refreshAccessToken()
          return request<T>(method, path, body, { ...options, retried: true })
        } catch {
          // Fall through to sign-out.
        }
      }
      clearTokens()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
      throw new ApiError(response.status, detail)
    }

    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (options.responseType === 'blob') {
    return (await response.blob()) as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (options.responseType === 'text' || !contentType.includes('application/json')) {
    return (await response.text()) as unknown as T
  }

  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions): Promise<T> => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown): Promise<T> => request<T>('DELETE', path, body),
}

export default api