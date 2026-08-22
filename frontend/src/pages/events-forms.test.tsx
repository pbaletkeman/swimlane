import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { Dialog: new Proxy({}, { get: () => passthrough }) }
})

import EventsPage from './EventsPage.tsx'
import CoachEventsPage from './CoachEventsPage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'

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
      return jsonResponse({ message: 'ok' })
    }),
  )
}

function installFailingFetch(): void {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: 'Server error' }), { status: 500 })
    }),
  )
}

describe('EventsPage error handling', () => {
  beforeEach(() => loginAs('COACH'))

  it('shows error toast when load fails', async () => {
    installFailingFetch()
    renderPage(<EventsPage />)
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('pi-bolt')
    })
  })

  it('shows error toast when soft delete fails', async () => {
    const events = [{ event_id: 11, start_date_time: '2027-02-01T09:00:00', end_date_time: '2027-02-01T11:00:00', frequency_id: 1, is_active: true }]
    let deleteCalled = false
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url === '/api/events' && method === 'GET') return jsonResponse(events)
      if (url === '/api/frequencies') return jsonResponse([])
      if (url === '/api/events/11' && method === 'DELETE') {
        deleteCalled = true
        return jsonResponse({ detail: 'Fail' }, 500)
      }
      return jsonResponse([])
    }))
    renderPage(<EventsPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(document.querySelector('[aria-label^="Delete"')!)
    fireEvent.click(await screen.findByText('Delete'))
    await waitFor(() => expect(deleteCalled).toBe(true))
  })

  it('shows error toast when load of events fails (but frequencies ok)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input)
      if (url === '/api/frequencies') return jsonResponse([])
      return jsonResponse({ detail: 'Fail' }, 500)
    }))
    renderPage(<EventsPage />)
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('pi-bolt')
    })
  })

  it('formats frequency name in table', async () => {
    installFetch({
      '/api/events': [{ event_id: 11, start_date_time: '2027-02-01T09:00:00', end_date_time: '2027-02-01T11:00:00', frequency_id: 1, is_active: true }],
      '/api/frequencies': [{ frequency_id: 1, name: 'Weekly', day_interval: '7' }],
    })
    renderPage(<EventsPage />)
    await vi.waitFor(() => expect(screen.getByText('Weekly')).toBeInTheDocument())
  })
})

describe('CoachEventsPage error handling', () => {
  beforeEach(() => loginAs('COACH', 'coach-test'))

  it('shows error toast when load fails', async () => {
    installFailingFetch()
    renderPage(<CoachEventsPage />)
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('pi-bolt')
    })
  })

  it('loads with venue and facility data', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true, venue_id: 5 }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [{ frequency_id: 1, name: 'Weekly' }],
      '/api/facilities': [{ facility_id: 3, name: 'Aquatic Center' }],
      '/api/venues': [{ venue_id: 5, facility_id: 3, street: '100 Swim Ln', city: 'Austin', state: 'TX', postal_code: '73301' }],
      '/api/events/21/capacity': { event_id: 21, registered_count: 3, max_capacity: 10 },
    })
    renderPage(<CoachEventsPage />)
    await waitFor(() => {
      expect(screen.getByText('3 / 10')).toBeInTheDocument()
    })
  })

  it('handles venue with unknown venue_id', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true, venue_id: 99 }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [],
      '/api/facilities': [],
      '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('Venue 99'))
  })

  it('handles event with no venue', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true, venue_id: null }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [],
      '/api/facilities': [],
      '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('No venue'))
  })

  it('renders frequency name for events', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true, frequency_id: 1 }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [{ frequency_id: 1, name: 'Bi-weekly' }],
      '/api/facilities': [],
      '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    await vi.waitFor(() => expect(screen.getByText('Bi-weekly')).toBeInTheDocument())
  })

  it('renders events with no capacity data', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [],
      '/api/facilities': [],
      '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('scope=upcoming'))).toBe(true)
    })
    await waitFor(() => {
      expect(calls.some((c) => c.url === '/api/events/21/capacity')).toBe(true)
    })
  })

  it('renders events with unlimited capacity', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [],
      '/api/facilities': [],
      '/api/venues': [],
      '/api/events/21/capacity': { event_id: 21, registered_count: 5, max_capacity: null },
    })
    renderPage(<CoachEventsPage />)
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('5 /')
    })
  })

})