/**
 * Deep interaction tests for the public EventDetailPage: sign-in gating,
 * register flow, already-registered state with reschedule card, capacity
 * limits (full/unlimited), and the 404 state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import EventDetailPage from './explore/EventDetailPage.tsx'
import { loginAs, renderAtRoute } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string }>
let detailStatus: number
let registeredCount: number
let maxCapacity: number | null

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const detailBase = {
  event_id: 21,
  start_date_time: '2027-03-01T09:00:00',
  end_date_time: '2027-03-01T11:00:00',
  frequency_id: null,
  description: 'Community splash',
  coach_id: null,
  venue_id: null,
  is_active: true,
  venue: null,
}

function installFetch(): void {
  calls = []
  detailStatus = 200
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url === '/api/public/events/21') {
        if (detailStatus !== 200) return jsonResponse({ detail: 'missing' }, detailStatus)
        return jsonResponse({
          ...detailBase,
          registered_count: registeredCount,
          max_capacity: maxCapacity,
        })
      }
      if (url === '/api/schedules') {
        return jsonResponse(
          registeredCount >= 1
            ? [{ schedule_id: 5, venue_id: 1, member_id: 'test-user', event_id: 21, is_active: true }]
            : [],
        )
      }
      if (url === '/api/public/events')
        return jsonResponse([
          { event_id: 30, start_date_time: '2027-04-01T10:00:00', end_date_time: '2027-04-01T12:00:00', frequency_id: null, description: null, coach_id: null, venue_id: null, is_active: true },
        ])
      if (method === 'POST' && url === '/api/events/21/register')
        return jsonResponse({ schedule_id: 5, venue_id: 1, member_id: 'test-user', event_id: 21, is_active: true })
      return jsonResponse({ message: 'ok' })
    }),
  )
}

function mount(): ReturnType<typeof renderAtRoute> {
  return renderAtRoute('/explore/events/21', '/explore/events/:eventId', <EventDetailPage />)
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    installFetch()
    registeredCount = 0
    maxCapacity = 10
  })

  it('prompts anonymous visitors to sign in before registering', async () => {
    mount()
    expect(await screen.findByText('Sign in to register')).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/api/schedules')).toBe(false)
  })

  it('registers a signed-in member and refreshes the detail', async () => {
    loginAs('MEMBER', 'test-user')
    mount()

    const btn = await screen.findByText('Register')
    fireEvent.click(btn.closest('button')!)

    // Confirm in the modal
    const confirm = await screen.findByText('Confirm')
    fireEvent.click(confirm.closest('button')!)

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/register' && c.method === 'POST')).toBe(true),
    )
    // refreshDetail refetches after a successful registration
    await waitFor(() => {
      const detailLoads = calls.filter((c) => c.url === '/api/public/events/21' && c.method === 'GET')
      expect(detailLoads.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows the registered note and reschedule card for existing registrations', async () => {
    loginAs('MEMBER', 'test-user')
    registeredCount = 3
    mount()

    expect(await screen.findByText('You are registered for this event.')).toBeInTheDocument()
    expect(await screen.findByText('Move registration')).toBeInTheDocument()

    // target not chosen yet -> move disabled
    const moveBtn = screen.getByText('Move registration').closest('button') as HTMLButtonElement
    await waitFor(() => expect(moveBtn.disabled).toBe(true))
  })

  it('labels the button as full when capacity is exhausted', async () => {
    loginAs('MEMBER', 'test-user')
    registeredCount = 10
    maxCapacity = 10
    // /me returns empty (not yet registered), so the register affordance shows
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        calls.push({ url, method })
        if (url === '/api/public/events/21')
          return jsonResponse({ ...detailBase, registered_count: 10, max_capacity: 10 })
        if (url === '/api/schedules/me') return jsonResponse([])
        return jsonResponse([])
      }),
    )
    mount()
    expect(await screen.findByText('Event full')).toBeInTheDocument()
    expect(screen.queryByText(/^Register$/)).toBeNull()
  })

  it('renders unlimited capacity without a progress bar', async () => {
    loginAs('MEMBER', 'test-user')
    maxCapacity = null
    mount()
    expect(await screen.findByText(/unlimited/)).toBeInTheDocument()
  })

  it('renders the not-found state on 404', async () => {
    detailStatus = 404
    loginAs('MEMBER', 'test-user')
    mount()
    expect(await screen.findByText('Event not found')).toBeInTheDocument()
  })
})
