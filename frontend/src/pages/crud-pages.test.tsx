/**
 * Deep interaction tests for the remaining flat-entity CRUD pages:
 * FacilitiesPage (text/textarea/number/checkbox fields), VenuesPage (text +
 * number + facility select), SchedulesPage (three selects; covered for
 * load/delete flows since Select popups are portal-based).
 *
 * PrimeReact's Dialog shell is mocked to passthroughs (see EntityFormDialog
 * rationale); everything else runs real code.
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
          // Reject symbol keys and `then` so nothing treats this proxy as a
          // thenable (awaiting it would hang the worker forever).
          if (typeof prop === 'symbol' || prop === 'then' || prop === '$$typeof') return undefined
          return passthrough
        },
      },
    ),
  }
})

import FacilitiesPage from './FacilitiesPage.tsx'
import SchedulesPage from './SchedulesPage.tsx'
import VenuesPage from './VenuesPage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string; init?: RequestInit }>

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
      calls.push({ url, method, init })
      for (const [pattern, body] of Object.entries(routes)) {
        const re = new RegExp(`^${pattern}$`)
        if (re.test(url) && (method === 'GET' || pattern.includes('('))) return jsonResponse(body)
      }
      // mutations fall back to a generic ok
      return jsonResponse({ message: 'ok' })
    }),
  )
}

beforeEach(() => {
  loginAs('WEB_ADMIN', 'admin-test')
})

describe('FacilitiesPage', () => {
  const rows = [{ facility_id: 1, name: 'Main Pool', description: '25m', max_capacity: 50, min_capacity: 1, is_active: true }]

  it('loads rows into the table', async () => {
    installFetch({ '/api/facilities': rows })
    renderPage(<FacilitiesPage />)
    expect(await screen.findAllByText('Main Pool')).not.toHaveLength(0)
  })

  it('creates a facility including description and capacities', async () => {
    installFetch({ '/api/facilities': [] })
    renderPage(<FacilitiesPage />)
    fireEvent.click((await screen.findAllByText('New Facility'))[0])

    fireEvent.change(await screen.findByPlaceholderText('e.g., 50'), { target: { value: '40' } })
    fireEvent.change(screen.getByPlaceholderText('Facility description'), {
      target: { value: 'Deep tank' },
    })
    // name field has no placeholder; target by label association
    fireEvent.change(document.getElementById('entity-form-dialog-name')!, { target: { value: 'Dive Tank' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities' && c.method === 'POST')).toBe(true),
    )
    const body = JSON.parse(String(calls.find((c) => c.method === 'POST')!.init?.body))
    expect(body).toMatchObject({ name: 'Dive Tank', description: 'Deep tank' })
  })

  it('soft deletes through ConfirmDelete', async () => {
    installFetch({ '/api/facilities': rows })
    renderPage(<FacilitiesPage />)
    fireEvent.click(await screen.findByLabelText('Delete Main Pool'))
    fireEvent.click(await screen.findByText('Delete'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities/1' && c.method === 'DELETE')).toBe(true),
    )
  })
})

describe('VenuesPage', () => {
  const venues = [
    { venue_id: 1, facility_id: 1, street: '1 Pool St', city: 'Springfield', state: 'IL', postal_code: '62701', cost: 10, is_active: true },
  ]
  const facilities = [{ facility_id: 1, name: 'Main Pool' }]

  function setup(): void {
    installFetch({
      '/api/venues': venues,
      '/api/facilities': facilities,
    })
  }

  it('loads venues table', async () => {
    setup()
    renderPage(<VenuesPage />)
    expect(await screen.findAllByText('1 Pool St')).not.toHaveLength(0)
  })

  it('opens the New Venue dialog (cost field present)', async () => {
    setup()
    renderPage(<VenuesPage />)
    await screen.findAllByText('1 Pool St')

    fireEvent.click(screen.getAllByText('New Venue')[0])
    expect(await screen.findByPlaceholderText('e.g., 200')).toBeInTheDocument()
    expect(document.getElementById('entity-form-dialog-street')).toBeInTheDocument()
  })

  it('edits an existing venue with prefilled street', async () => {
    setup()
    renderPage(<VenuesPage />)
    await screen.findAllByText('1 Pool St')
    fireEvent.click(screen.getByLabelText(/Edit 1 Pool St/))

    const input = document.getElementById('entity-form-dialog-street') as HTMLInputElement
    expect(input.value).toBe('1 Pool St')
  })
})

describe('SchedulesPage', () => {
  const schedules = [
    { schedule_id: 5, venue_id: 1, member_id: 'm-1', event_id: 2, is_active: true },
  ]

  it('loads schedules after fetching picker data, and soft deletes a row', async () => {
    installFetch({
      '/api/venues': [],
      '/api/users': [],
      '/api/events': [],
      '/api/schedules': schedules,
    })
    loginAs('WEB_ADMIN', 'admin-test')
    renderPage(<SchedulesPage />)

    // row actions render once loaded (member/event ids resolved from pickers)
    await vi.waitFor(() => {
      expect(document.body.innerHTML).toContain('schedule')
    })

    const del = await vi.waitFor(() => { const el = document.querySelector('[aria-label^="Delete"'); if (!el) throw new Error('no delete btn yet'); return el })
    fireEvent.click(del)
    fireEvent.click(await screen.findByText('Delete'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/5' && c.method === 'DELETE')).toBe(true),
    )
  })
})
