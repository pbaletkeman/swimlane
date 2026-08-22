/**
 * Tests for the per-entity API wrappers (crud/events/public/auth/schedules/
 * forms/messages/users): each wrapper hits the right URL with the right
 * method/body against a recording fetch mock.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import auth from './auth.ts'
import events, {
  addMember,
  editMember,
  getEventCapacity,
  listMembers,
  listMine,
  registerForEvent,
  removeMember,
} from './events.ts'
import formsApi from './forms.ts'
import messagesApi from './messages.ts'
import publicApi, { getVenueSchedules, searchEvents } from './public.ts'
import schedulesApi, { cancelRegistration, getMyCalendarIcs, listMine as listMySchedules, reschedule } from './schedules.ts'
import { createUser as createUserApi, getUser, hardDeleteUser, listUsers, softDeleteUser, updateUserRole } from './users.ts'
import crudFactory from './crud.ts'

let fetchMock: ReturnType<typeof vi.fn>

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)
})

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
  return { url, init }
}

describe('createCrudApi (frequencies/facilities/venues/schedules/events)', () => {
  it('maps every CRUD verb onto the documented paths', async () => {
    const api2 = crudFactory('frequencies')
    await api2.list()
    expect(lastCall()).toMatchObject({ url: '/api/frequencies', init: expect.objectContaining({ method: 'GET' }) })

    await api2.get(7)
    expect(lastCall().url).toBe('/api/frequencies/7')

    await api2.create({ name: 'x' })
    expect(lastCall()).toMatchObject({
      url: '/api/frequencies',
      init: expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'x' }) }),
    })

    await api2.update(7, { name: 'y' })
    expect(lastCall()).toMatchObject({
      url: '/api/frequencies/7',
      init: expect.objectContaining({ method: 'PUT' }),
    })

    await api2.delete(7)
    expect(lastCall().url).toBe('/api/frequencies/7')

    await api2.hardDelete(7)
    expect(lastCall().url).toBe('/api/frequencies/7/hard')

    await api2.createBulk([{ name: 'z' }])
    expect(lastCall().url).toBe('/api/frequencies/bulk')

    await api2.deleteBulk([{ name: 'z' }])
    expect(lastCall().url).toBe('/api/frequencies/bulk')

    await api2.hardDeleteBulk([{ name: 'z' }])
    expect(lastCall().url).toBe('/api/frequencies/bulk/hard')

    // events uses the same factory
    await events.get(3)
    expect(lastCall().url).toBe('/api/events/3')
  })
})

describe('events extras', () => {
  it('capacity/register/coach/member endpoints hit their paths', async () => {
    await getEventCapacity(1)
    expect(lastCall().url).toBe('/api/events/1/capacity')

    await registerForEvent(1)
    expect(lastCall()).toMatchObject({ url: '/api/events/1/register', init: expect.objectContaining({ method: 'POST' }) })

    await listMine()
    expect(lastCall().url).toBe('/api/coach/events?scope=upcoming')
    await listMine('past')
    expect(lastCall().url).toBe('/api/coach/events?scope=past')

    await listMembers(5)
    expect(lastCall().url).toBe('/api/events/5/members')

    await addMember(5, 'sub-9')
    expect(lastCall()).toMatchObject({
      url: '/api/events/5/members',
      init: expect.objectContaining({ body: JSON.stringify({ member_id: 'sub-9' }) }),
    })

    await removeMember(5, 12)
    expect(lastCall().url).toBe('/api/events/5/members/12')

    await editMember(5, 12, { venue_id: 2 })
    expect(lastCall()).toMatchObject({
      url: '/api/events/5/members/12',
      init: expect.objectContaining({ method: 'PUT' }),
    })
  })
})

describe('public wrappers', () => {
  it('build clean query strings and paths', async () => {
    await publicApi.listVenues()
    expect(lastCall().url).toBe('/api/public/venues')

    await publicApi.searchVenues('springfield')
    expect(lastCall().url).toBe('/api/public/venues?q=springfield')

    await publicApi.getVenue(4)
    expect(lastCall().url).toBe('/api/public/venues/4')

    await getVenueSchedules(4)
    expect(lastCall().url).toBe('/api/public/venues/4/schedules')
    await getVenueSchedules(4, { view: 'month', date: '2026-08-21' })
    expect(lastCall().url).toBe('/api/public/venues/4/schedules?view=month&date=2026-08-21')

    await searchEvents({})
    expect(lastCall().url).toBe('/api/public/events')
    await searchEvents({ venueId: 2, q: 'swim', from: '2026-01-01', to: '' })
    const { url } = lastCall()
    expect(url).toContain('venue_id=2')
    expect(url).toContain('q=swim')
    expect(url).toContain('from_dt=2026-01-01')
    expect(url).not.toContain('to_dt')

    await publicApi.getEventDetail(9)
    expect(lastCall().url).toBe('/api/public/events/9')
  })
})

describe('auth wrappers', () => {
  it('login returns the consent URL; logout/refresh/me call their endpoints', async () => {
    expect(auth.login()).toBe('/api/login')

    await auth.logout()
    expect(lastCall()).toMatchObject({ url: '/api/logout', init: expect.objectContaining({ method: 'GET' }) })

    await auth.refresh('r-token')
    expect(lastCall()).toMatchObject({
      url: '/api/refresh',
      init: expect.objectContaining({ method: 'POST', body: JSON.stringify({ refresh_token: 'r-token' }) }),
    })

    await auth.me()
    expect(lastCall().url).toBe('/api/me')
  })
})

describe('schedules extras', () => {
  it('me/iCal/reschedule/cancel endpoints', async () => {
    await listMySchedules()
    expect(lastCall().url).toBe('/api/schedules/me')

    await getMyCalendarIcs()
    expect(lastCall().url).toBe('/api/schedules/me/ical')

    await reschedule(3, { event_id: 8 })
    expect(lastCall()).toMatchObject({
      url: '/api/schedules/3/reschedule',
      init: expect.objectContaining({ body: JSON.stringify({ event_id: 8 }) }),
    })

    await cancelRegistration(3)
    expect(lastCall().url).toBe('/api/schedules/3/cancel')

    await schedulesApi.deleteBulk([{ venue_id: 1, member_id: 'm', event_id: 1 }])
    expect(lastCall().url).toBe('/api/schedules/bulk')
  })
})

describe('forms + messages + users', () => {
  it('forms question/rule/submission endpoints', async () => {
    await formsApi.getFacilityForm(1)
    expect(lastCall().url).toBe('/api/forms/1')

    await formsApi.getSubmissionPdf(6)
    expect(lastCall().url).toBe('/api/forms/submissions/6/pdf')

    await formsApi.createQuestion({ facility_id: 1 } as never)
    expect(lastCall().url).toBe('/api/forms/questions')

    await formsApi.hardDeleteQuestion(2)
    expect(lastCall().url).toBe('/api/forms/questions/2/hard')

    await formsApi.createRulesBulk([])
    expect(lastCall().url).toBe('/api/forms/rules/bulk')

    await formsApi.listMySubmissions()
    expect(lastCall().url).toBe('/api/forms/me/submissions')
  })

  it('messages inbox endpoints', async () => {
    await messagesApi.listMine()
    expect(lastCall().url).toBe('/api/messages/me')

    await messagesApi.send({ member_id: 'm', subject: 's', body: 'b' })
    expect(lastCall()).toMatchObject({ url: '/api/messages', init: expect.objectContaining({ method: 'POST' }) })

    await messagesApi.markRead(4)
    expect(lastCall().url).toBe('/api/messages/4/read')

  })

  it('users management endpoints incl role query filter', async () => {
    await listUsers()
    expect(lastCall().url).toBe('/api/users')

    await listUsers('coach')
    expect(lastCall().url).toBe('/api/users?role=coach')

    await getUser('sub-1')
    expect(lastCall().url).toBe('/api/users/sub-1')

    await createUserApi({ email: 'a@b.com', role: 'coach' } as never)
    expect(lastCall()).toMatchObject({ url: '/api/users', init: expect.objectContaining({ method: 'POST' }) })

    await updateUserRole('sub-1', 'coach')
    expect(lastCall()).toMatchObject({
      url: '/api/users/sub-1',
      init: expect.objectContaining({ body: JSON.stringify({ role: 'coach' }) }),
    })

    await softDeleteUser('sub-1')
    expect(lastCall().url).toBe('/api/users/sub-1')

    await hardDeleteUser('sub-1')
    expect(lastCall().url).toBe('/api/users/sub-1/hard')
  })
})
