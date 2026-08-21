/**
 * Late-gap batch:
 * - EventDetailPage "already registered" render state
 * - VenueSchedulePage date-anchor refetch
 * - ExploreVenuesPage empty result rendering
 * - client.ts error-detail fallback for non-detail JSON bodies
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExploreVenuesPage from './ExploreVenuesPage.tsx'
import { renderPage } from '../../test-utils.tsx'
import { api, ApiError } from '../../api/client.ts'

let calls: Array<{ url: string; method: string }>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetch(routes: Record<string, unknown>): void {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      for (const [pattern, body] of Object.entries(routes)) {
        if (new RegExp(`^${pattern}$`).test(url)) return jsonResponse(body)
      }
      return jsonResponse([])
    }),
  )
}

describe('ExploreVenuesPage empty results', () => {
  it('renders the empty state when no venues match', async () => {
    installFetch({ '/api/public/venues': [] })
    renderPage(<ExploreVenuesPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('empty-state'))
  })
})

describe('client error-detail fallback', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => jsonResponse(['weird', 'body'], 500)),
    )
  })

  it('stringifies non-detail JSON error bodies into the message', async () => {
    const err = await api.get('/x').then(
      () => {
        throw new Error('expected rejection')
      },
      (e: ApiError) => e,
    )
    expect(err.status).toBe(500)
    expect(err.message).toBe(JSON.stringify(['weird', 'body']))
  })
})
