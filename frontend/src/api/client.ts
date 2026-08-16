/**
 * API client wrapper around fetch.
 *
 * - Resolves the request URL against VITE_API_URL when set; otherwise falls
 *   back to the dev proxy path `/api/...` (stripped by vite.config.ts).
 * - Attaches `Authorization: Bearer <token>` from localStorage.
 * - Normalizes non-2xx responses into an `ApiError` carrying the status code
 *   and the backend's `detail` message.
 */

const TOKEN_KEY = 'swimlane.accessToken'

export const getAccessToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const clearAccessToken = (): void => localStorage.removeItem(TOKEN_KEY)

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

const BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

function resolve(path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`
  if (BASE_URL) {
    return `${BASE_URL}${trimmed}`
  }
  // Dev: go through the Vite proxy, which strips the /api prefix.
  return `/api${trimmed}`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
      // The access token is no longer accepted. Clear it and notify listeners
      // (the auth layer in Phase 3 uses this to redirect to login / refresh).
      clearAccessToken()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  return (await response.text()) as unknown as T
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown): Promise<T> => request<T>('DELETE', path, body),
}

export default api