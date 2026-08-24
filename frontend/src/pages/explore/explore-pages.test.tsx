/**
 * Deep interaction tests for the public explore pages:
 * - ExploreHomePage: event search
 * - ExploreVenuesPage: venue list + address search
 * - VenueSchedulePage: week/month/list views
 * - EventDetailPage: detail rendering + member registration
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import EventDetailPage from './EventDetailPage.tsx'
import ExploreHomePage from './ExploreHomePage.tsx'
import ExploreVenuesPage from './ExploreVenuesPage.tsx'
import VenueSchedulePage from './VenueSchedulePage.tsx'
import { loginAs, renderAtRoute, renderPage } from '../../test-utils.tsx'

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

const venue = {
  venue_id: 1,
  facility_id: 1,
  facility_name: 'Main Pool',
  street: '1 Pool St',
  city: 'Springfield',
  state: 'IL',
  postal_code: '62701',
  cost: 10,
  is_active: true,
}

const eventDetail = {
  event_id: 21,
  start_date_time: '2027-04-01T09:00:00',
  end_date_time: '2027-04-01T11:00:00',
  description: 'Open swim finals',
  venue_id: 1,
  is_active: true,
  venue,
  registered_count: 3,
  max_capacity: 20,
}

describe('ExploreHomePage', () => {
  it('searches events by free text', async () => {
    installFetch({ '/api/public/events': [eventDetail] })
    renderPage(<ExploreHomePage />)
    await screen.findByPlaceholderText('Search upcoming events by description')

    const input = await screen.findByPlaceholderText('Search upcoming events by description')
    fireEvent.change(input, { target: { value: 'finals' } })
    // PrimeReact buttons render type="button", so drive the form directly
    ;(input as HTMLInputElement).form?.requestSubmit()
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('q=finals'))).toBe(true),
    )
  })
})

describe('ExploreVenuesPage', () => {
  it('lists venues then searches by substring', async () => {
    installFetch({
      '/api/public/venues\\?q=springfield': [venue],
      '/api/public/venues': [venue],
    })
    renderPage(<ExploreVenuesPage />)

    const input = await screen.findByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'springfield' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('q=springfield'))).toBe(true),
    )
  })
})

describe('VenueSchedulePage', () => {
  it('loads the venue and its schedule views', async () => {
    installFetch({
      '/api/public/venues/1': venue,
      '/api/public/venues/1/schedules': [
        { event_id: 5, start_date_time: '2027-05-01T09:00:00', end_date_time: '2027-05-01T10:00:00', description: 'Lane swim', is_active: true },
      ],
    })
    renderAtRoute('/explore/venues/1', '/explore/venues/:venueId', <VenueSchedulePage />)

    expect(await screen.findAllByText('Main Pool')).not.toHaveLength(0)
    expect(calls.some((c) => c.url.includes('/schedules'))).toBe(true)
  })
})

describe('EventDetailPage', () => {
  function setup(): void {
    installFetch({
      '/api/public/events/21': eventDetail,
      '/api/schedules/me': [],
    })
  }

  it('renders detail with venue and capacity', async () => {
    setup()
    loginAs('MEMBER', 'detail-user')
    renderAtRoute('/explore/events/21', '/explore/events/:eventId', <EventDetailPage />)

    await screen.findAllByText(/Open swim finals/)
    expect(screen.getAllByText(/Springfield/).length).toBeGreaterThan(0)
    // live capacity visible somewhere ("3 / 20" style)
    expect(document.body.innerHTML).toMatch(/3\s*\/\s*20/)
  })

  it('registers the signed-in member from the detail page', async () => {
    setup()
    loginAs('MEMBER', 'detail-user')
    renderAtRoute('/explore/events/21', '/explore/events/:eventId', <EventDetailPage />)
    await screen.findAllByText(/Open swim finals/)

    const registerButton = document.querySelector('[aria-label*="Register"]') ?? document.querySelector('button[type="button"]:not([aria-label])')
    if (!registerButton) throw new Error('Register control not found')
    fireEvent.click(registerButton)

    // Confirm in the modal
    const confirm = await screen.findByText('Confirm')
    fireEvent.click(confirm.closest('button')!)

    await waitFor(() =>
      expect(
        calls.some((c) => c.url === '/api/events/21/register' && c.method === 'POST'),
      ).toBe(true),
    )
  })
})
