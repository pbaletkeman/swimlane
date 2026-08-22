/**
 * Deep interaction tests for the CoachEventsPage member drawer: adding a
 * member by sub, editing a member's venue through the EntityFormDialog, and
 * tolerating a capacity-endpoint failure.
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
import { loginAs, renderPage } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string; init?: RequestInit }>
let members: unknown[]
let capacityStatus: number

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const myEvent = [
  {
    event_id: 21,
    start_date_time: '2027-03-01T09:00:00',
    end_date_time: '2027-03-01T11:00:00',
    description: 'My upcoming session',
    coach_id: 'coach-test',
    venue_id: null,
    is_active: true,
  },
]
const venues = [
  { venue_id: 1, facility_id: 1, street: '1 Pool St', city: 'Springfield', state: 'IL', postal_code: '62701', cost: 10, is_active: true },
]
const facilities = [{ facility_id: 1, name: 'Main Pool', is_active: true }]
const frequencies = [{ frequency_id: 1, name: 'Weekly', day_interval: '7', is_active: true }]

function installFetch(): void {
  calls = []
  capacityStatus = 200
  members = [{ schedule_id: 31, venue_id: 1, member_id: 'm-9', event_id: 21, is_active: true, member_name: 'Pat Doe', email: 'p***@example.com' }]
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method, init })
      if (method === 'GET' && url === '/api/coach/events?scope=upcoming') return jsonResponse(myEvent)
      if (method === 'GET' && url === '/api/venues') return jsonResponse(venues)
      if (method === 'GET' && url === '/api/facilities') return jsonResponse(facilities)
      if (method === 'GET' && url === '/api/frequencies') return jsonResponse(frequencies)
      if (method === 'GET' && url === '/api/events/21/members') return jsonResponse(members)
      if (method === 'GET' && url === '/api/events/21/capacity')
        return capacityStatus === 200
          ? jsonResponse({ event_id: 21, registered_count: members.length, max_capacity: 20 })
          : jsonResponse({ detail: 'nope' }, capacityStatus)
      if (method === 'POST' && url === '/api/events/21/members') {
        const body = JSON.parse(String(init?.body)) as { member_id: string }
        members = [...members, { schedule_id: 99, venue_id: 1, member_id: body.member_id, event_id: 21, is_active: true, member_name: `New ${body.member_id}`, email: null }]
        return jsonResponse({ schedule_id: 99 })
      }
      if (method === 'PUT' && url === '/api/events/21/members/31') return jsonResponse({ message: 'ok' })
      return jsonResponse({ message: 'ok' })
    }),
  )
}

async function openDrawer(): Promise<void> {
  renderPage(<CoachEventsPage />)
  await screen.findAllByText(/My upcoming session/)
  fireEvent.click(document.querySelector('[aria-label="Manage members"]')!)
  // mocked Dialog shells render their children even when closed, so member
  // names appear in both the drawer list and the hidden confirm copy
  await screen.findAllByText('Pat Doe')
}

beforeEach(() => {
  loginAs('COACH', 'coach-test')
  installFetch()
})

describe('CoachEventsPage member drawer', () => {
  it('adds a member by sub and refreshes list + capacity', async () => {
    await openDrawer()

    fireEvent.change(screen.getByLabelText('Member sub'), { target: { value: 'new-sub' } })
    fireEvent.click(screen.getByText('Add').closest('button')!)

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/members' && c.method === 'POST')).toBe(true),
    )
    const body = JSON.parse(String(calls.find((c) => c.method === 'POST')!.init?.body))
    expect(body).toEqual({ member_id: 'new-sub' })
    // drawer reloads members after add (initial load + refresh)
    const memberLoads = calls.filter((c) => c.url === '/api/events/21/members' && c.method === 'GET')
    await waitFor(() => expect(memberLoads.length).toBeGreaterThanOrEqual(2))
    expect((await screen.findAllByText('New new-sub')).length).toBeGreaterThan(0)
  })

  it('edits a member schedule venue through the form dialog', async () => {
    await openDrawer()

    fireEvent.click(document.querySelector('[aria-label="Edit member schedule"]')!)
    // NOTE: dialog titles are not exactly queryable here — mocked Dialog.*
    // fragments leave title text nodes parented to the page container, so we
    // assert on the resulting request instead.
    await vi.waitFor(() => {
      const saves = screen.getAllByText('Save')
      if (saves.length === 0) throw new Error('member-edit form not mounted yet')
    })

    // the member-edit dialog is the last EntityFormDialog mounted; pick its Save
    const saves = screen.getAllByText('Save')
    fireEvent.click(saves[saves.length - 1])
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/members/31' && c.method === 'PUT')).toBe(true),
    )
    const body = JSON.parse(String(calls.find((c) => c.method === 'PUT')!.init?.body))
    expect(body).toMatchObject({ venue_id: 1 })
  })

  it('still lists events when the capacity endpoint fails', async () => {
    capacityStatus = 500
    renderPage(<CoachEventsPage />)

    expect(await screen.findAllByText(/My upcoming session/)).not.toHaveLength(0)
    expect(document.body.innerHTML).toContain('Manage Events')
  })
})
