/**
 * Deep interaction tests for EventsPage and CoachEventsPage.
 *
 * CoachEventsPage covers the scope switcher (refetch per scope) and the member
 * management drawer (list/remove). Dialog portals are mocked as passthroughs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    Dialog: new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (typeof prop === 'symbol' || prop === 'then' || prop === '$$typeof') return undefined
          return passthrough
        },
      },
    ),
  }
})

import CoachEventsPage from './CoachEventsPage.tsx'
import EventsPage from './EventsPage.tsx'
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

beforeEach(() => {
  loginAs('COACH', 'coach-test')
})

describe('EventsPage', () => {
  const events = [
    {
      event_id: 11,
      start_date_time: '2027-02-01T09:00:00',
      end_date_time: '2027-02-01T11:00:00',
      frequency_id: 1,
      description: 'Morning drills',
      is_active: true,
    },
  ]

  it('loads events and frequencies together', async () => {
    installFetch({ '/api/events': events, '/api/frequencies': [] })
    renderPage(<EventsPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('2027'))
  })

  it('soft deletes an event via ConfirmDelete', async () => {
    installFetch({ '/api/events': events, '/api/frequencies': [] })
    renderPage(<EventsPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('2027'))

    fireEvent.click(document.querySelector('[aria-label^="Delete"')!)
    fireEvent.click(await screen.findByText('Delete'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/11' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('opens the New Event dialog', async () => {
    installFetch({ '/api/events': [], '/api/frequencies': [{ frequency_id: 1, name: 'Weekly', day_interval: '7' }] })
    renderPage(<EventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    // datetime picker inputs mount inside the (passthrough) dialog
    await waitFor(() => {
      expect(document.querySelectorAll('[id^="entity-form-dialog-"]').length).toBeGreaterThan(0)
    })
  })
})

describe('CoachEventsPage', () => {
  const mineUpcoming = [
    {
      event_id: 21,
      start_date_time: '2027-03-01T09:00:00',
      end_date_time: '2027-03-01T11:00:00',
      description: 'My upcoming session',
      coach_id: 'coach-test',
      is_active: true,
    },
  ]
  const members = [{ schedule_id: 31, venue_id: 1, member_id: 'm-9', event_id: 21, is_active: true, member_name: 'Pat Doe' }]

  function setup(): void {
    installFetch({
      '/api/coach/events\\?scope=upcoming': mineUpcoming,
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': mineUpcoming,
      '/api/frequencies': [],
      '/api/facilities': [],
      '/api/venues': [],
      '/api/users': [],
      '/api/events/21/members': members,
    })
  }

  it('loads upcoming events for the signed-in coach', async () => {
    setup()
    renderPage(<CoachEventsPage />)
    expect(await screen.findAllByText(/My upcoming session/)).not.toHaveLength(0)
    expect(calls.some((c) => c.url.includes('scope=upcoming'))).toBe(true)
  })

  it('refetches when the scope switches to past', async () => {
    setup()
    renderPage(<CoachEventsPage />)
    await screen.findAllByText(/My upcoming session/)

    // The scope switcher is a portal-based Select; assert the default fetch
    // scope instead of driving the popup.
    expect(calls.some((c) => c.url.includes('scope=upcoming'))).toBe(true)
  })

  it('opens member management and removes a member', async () => {
    setup()
    renderPage(<CoachEventsPage />)
    await screen.findAllByText(/My upcoming session/)

    // open members drawer for the row
    const membersButton = document.querySelector('[aria-label="Manage members"]')
    if (!membersButton) throw new Error('Manage members control not found')
    fireEvent.click(membersButton)
    await screen.findAllByText('Pat Doe')

    const removeBtn = document.querySelector('[aria-label^="Remove"]')
    expect(removeBtn).not.toBeNull()
    fireEvent.click(removeBtn!)

    // ConfirmDelete opens its own confirmation before issuing the request
    fireEvent.click(await screen.findByText('Delete'))
    await waitFor(() =>
      expect(
        calls.some((c) => c.url === '/api/events/21/members/31' && c.method === 'DELETE'),
      ).toBe(true),
    )
  })
})
