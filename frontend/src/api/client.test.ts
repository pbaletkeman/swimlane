/**
 * Tests for src/api/client.ts — fetch wrapper: URL resolution, auth header,
 * response normalization (json/text/blob/204), error mapping, and the 401
 * single-refresh-retry flow with sign-out fallback.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api, AUTH_UNAUTHORIZED_EVENT, ApiError } from './client.ts'
import { clearTokens, setAccessToken, setRefreshToken } from '../auth/tokens.ts'

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  clearTokens()
  vi.unstubAllGlobals()
})

describe('request basics', () => {
  it('prefixes paths with the /api base and normalizes missing slashes', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('events')
    expect(fetchMock).toHaveBeenCalledWith('/api/events', expect.anything())
    await api.get('/facilities')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/facilities', expect.anything())
  })

  it('attaches the Bearer token when one is stored, none otherwise', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    setAccessToken('tok-1')
    await api.get('/me')
    const [, init1] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init1.headers as Record<string, string>).Authorization).toBe('Bearer tok-1')

    clearTokens()
    await api.get('/public/venues')
    const [, init2] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init2.headers as Record<string, string>).not.toHaveProperty('Authorization')
  })

  it('serializes JSON bodies with the json content-type on POST/PUT/DELETE', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.post('/events', { description: 'x' })
    let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/events')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ description: 'x' }))
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')

    await api.put('/events/1', { description: 'y' })
    ;[url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init.method).toBe('PUT')

    await api.delete('/events/1')
    ;[, init] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(init.method).toBe('DELETE')
  })

  it('returns undefined for 204 No Content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    )
    expect(await api.delete('/schedules/1')).toBeUndefined()
  })

  it("honors responseType 'blob' and 'text' overrides", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (path: string) => {
        if (path.endsWith('/pdf')) {
          return new Response(new Blob(['%PDF'], { type: 'application/pdf' }), { status: 200 })
        }
        return new Response('plain text', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }),
    )

    const blob = await api.get<Blob>('/forms/submissions/1/pdf', { responseType: 'blob' })
    expect(blob).toBeInstanceOf(Blob)

    // non-JSON content type falls back to text even without the override
    await expect(api.get('/misc')).resolves.toBe('plain text')
  })
})

describe('error normalization', () => {
  it('maps JSON error bodies into ApiError with the backend detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Event not found' }, 404)))
    const err = await api.get('/events/999').catch((e: ApiError) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(404)
    expect(err.message).toBe('Event not found')
  })

  it('falls back to statusText when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html/>', { status: 502, statusText: 'Bad Gateway' })),
    )
    const err = await api.get('/x').catch((e: ApiError) => e)
    expect(err.status).toBe(502)
    expect(err.message).toBe('Bad Gateway')
  })

  it('converts network failures into ApiError(0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')))
    const err = await api.get('/x').catch((e: ApiError) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
  })
})

describe('401 refresh-and-retry', () => {
  it('refreshes once and retries with the new access token', async () => {
    setAccessToken('stale')
    setRefreshToken('good-refresh')

    const fetchMock = vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      if (path === '/api/refresh') {
        expect(headers['Content-Type']).toBe('application/json')
        return jsonResponse({ access_token: 'fresh' })
      }
      if (headers.Authorization === 'Bearer fresh') {
        return jsonResponse({ role: 'member' })
      }
      return jsonResponse({ detail: 'expired' }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/me')).resolves.toEqual({ role: 'member' })
    expect(fetchMock.mock.calls.filter(([p]) => p === '/api/refresh')).toHaveLength(1)
  })

  it('signs out (clears tokens + event) when there is no refresh token', async () => {
    setAccessToken('stale-only')
    const handler = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handler)

    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'expired' }, 401)))
      const err = await api.get('/me').catch((e: ApiError) => e)
      expect(err.status).toBe(401)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(getAccessTokenAfterSignout()).toBeNull()
    } finally {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handler)
    }
  })

  it('signs out when the refresh endpoint itself fails', async () => {
    setAccessToken('stale')
    setRefreshToken('bad-refresh')
    const handler = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handler)

    try {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string) =>
        path === '/api/refresh' ? jsonResponse({}, 500) : jsonResponse({ detail: 'expired' }, 401),
      ))
      const err = await api.get('/me').catch((e: ApiError) => e)
      expect(err.status).toBe(401)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(getAccessTokenAfterSignout()).toBeNull()
    } finally {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handler)
    }
  })
})

function getAccessTokenAfterSignout(): string | null {
  return localStorage.getItem('swimlane.accessToken')
}
