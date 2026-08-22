/**
 * Deep interaction tests for MySchedulePage: registration cards (upcoming vs
 * past), empty state, iCal download, cancel flow, reschedule guard, and the
 * load-failure toast path.
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

import MySchedulePage from './MySchedulePage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string }>
let failMe: string | null

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const upcomingItem = {
  schedule_id: 7,
  venue_id: 1,
  member_id: 'test-user',
  event_id: 21,
  is_active: true,
  event_start_date_time: '2027-04-01T09:00:00',
  event_end_date_time: '2027-04-01T11:00:00',
  event_description: 'Squad session',
  facility_name: 'Main Pool',
  street: '1 Pool St',
  city: 'Springfield',
  state: 'IL',
  postal_code: '62701',
}
const pastItem = {
  ...upcomingItem,
  schedule_id: 8,
  event_id: 22,
  event_start_date_time: '2020-01-01T09:00:00',
  event_end_date_time: '2020-01-01T11:00:00',
  event_description: null,
}

function installFetch(items: unknown[], alternates: unknown[] = []): void {
  calls = []
  failMe = null
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (failMe && url === failMe) return jsonResponse({ detail: 'boom' }, 500)
      if (method === 'GET' && url === '/api/schedules/me') return jsonResponse(items)
      if (method === 'GET' && url === '/api/public/events') return jsonResponse(alternates)
      if (method === 'GET' && url === '/api/schedules/me/ical')
        return jsonResponse('BEGIN:VCALENDAR', 200, { 'Content-Type': 'text/calendar' })
      if (method === 'POST' && url.endsWith('/cancel')) return jsonResponse({ message: 'cancelled' })
      return jsonResponse({ message: 'ok' })
    }),
  )
}

beforeEach(() => {
  loginAs('MEMBER', 'test-user')
})

describe('MySchedulePage', () => {
  it('renders upcoming card with facility, address and description', async () => {
    installFetch([upcomingItem], [{ event_id: 99, start_date_time: '2027-05-01T10:00:00' }])
    renderPage(<MySchedulePage />)

    expect(await screen.findByText('Main Pool')).toBeInTheDocument()
    expect(screen.getByText(/1 Pool St/)).toBeInTheDocument()
    expect(screen.getByText('Squad session')).toBeInTheDocument()
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
    // an alternate event exists, so reschedule controls mount
    expect(screen.getByText('Move')).toBeInTheDocument()
  })

  it('shows the past tag without reschedule controls for old events', async () => {
    installFetch([pastItem])
    renderPage(<MySchedulePage />)

    expect(await screen.findByText('Past')).toBeInTheDocument()
    expect(screen.queryByText('Move')).toBeNull()
  })

  it('shows the empty state without registrations', async () => {
    installFetch([])
    renderPage(<MySchedulePage />)

    expect(await screen.findByText('No upcoming registrations.')).toBeInTheDocument()
  })

  it('downloads the iCal file', async () => {
    installFetch([upcomingItem])
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL

    renderPage(<MySchedulePage />)
    fireEvent.click(await screen.findByText('Add to calendar (iCal)'))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/me/ical' && c.method === 'GET')).toBe(true),
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('cancels a registration through ConfirmDelete', async () => {
    installFetch([upcomingItem])
    renderPage(<MySchedulePage />)
    await screen.findByText('Main Pool')

    fireEvent.click(document.querySelector('[aria-label^="Cancel this registration"]')!)
    fireEvent.click(await screen.findByText('Delete'))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/7/cancel' && c.method === 'POST')).toBe(true),
    )
  })

  it('keeps Move disabled until a reschedule target is chosen', async () => {
    installFetch([upcomingItem], [{ event_id: 99, start_date_time: '2027-05-01T10:00:00' }])
    renderPage(<MySchedulePage />)

    const moveBtn = (await screen.findByText('Move')).closest('button') as HTMLButtonElement
    await waitFor(() => expect(moveBtn.disabled).toBe(true))
  })

  it('survives a load failure with the toolbar still rendered', async () => {
    installFetch([])
    failMe = '/api/schedules/me'
    renderPage(<MySchedulePage />)

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/me' && c.method === 'GET')).toBe(true),
    )
    // failed load -> zero items -> download affordance disabled
    await vi.waitFor(() => {
      const btn = screen.queryByText('Add to calendar (iCal)')?.closest('button') as HTMLButtonElement | null
      expect(btn && btn.disabled).toBe(true)
    })
  })
})
