import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const shell = new Proxy({}, { get: () => passthrough })
  return { Dialog: shell }
})

vi.mock('primereact/tabs', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const shell = new Proxy({}, { get: () => passthrough })
  return { Tabs: shell }
})

vi.mock('primereact/avatar', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const shell = new Proxy({}, { get: () => passthrough })
  return { Avatar: shell }
})

import ProfilePage from './ProfilePage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'

let calls: string[]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(fixture: Record<string, unknown>): void {
  calls = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url in fixture) return json(fixture[url])
    return json([])
  }))
}

const submissions = [{ submission_id: 77, facility_name: 'Pool A', submitted_at: '2027-01-01T10:00:00', is_complete: true, signed_at: '2027-01-01T10:00:00' }]
const events = [{ schedule_id: 5, facility_name: 'Pool A', event_start_date_time: '2099-01-01T09:00:00', event_end_date_time: '2099-01-01T11:00:00', venue_street: '123 Main', venue_city: 'Miami' }]
const messages = [{ message_id: 1, subject: 'Welcome', body: 'Hello!', sender_name: 'Coach Pete', sent_at: '2027-01-01T10:00:00', is_read: false }]

describe('ProfilePage', () => {
  beforeEach(() => loginAs('MEMBER'))

  it('renders the profile header with user name', async () => {
    stubFetch({ '/api/forms/me/submissions': [], '/api/schedules/me': [], '/api/messages/me': [] })
    renderPage(<ProfilePage />)
    expect(await screen.findByText('Profile')).toBeInTheDocument()
  })

  it('shows empty states on all tabs', async () => {
    stubFetch({ '/api/forms/me/submissions': [], '/api/schedules/me': [], '/api/messages/me': [] })
    renderPage(<ProfilePage />)
    expect(await screen.findByText('No form submissions yet.')).toBeInTheDocument()
  })

  it('renders submissions with View and PDF buttons', async () => {
    stubFetch({
      '/api/forms/me/submissions': submissions,
      '/api/schedules/me': [],
      '/api/messages/me': [],
    })
    renderPage(<ProfilePage />)
    expect(await screen.findByText('Pool A')).toBeInTheDocument()
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('opens submission detail dialog on View click', async () => {
    stubFetch({
      '/api/forms/me/submissions': submissions,
      '/api/forms/submissions/77': { submission_id: 77, facility_name: 'Pool A', submitted_at: '2027-01-01T10:00:00', signed_at: '2027-01-01T10:00:00', responses: [{ question_id: 1, answer_text: 'Yes' }] },
      '/api/schedules/me': [],
      '/api/messages/me': [],
    })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('View'))
    await waitFor(() => expect(calls.some((c) => c.includes('/api/forms/submissions/77'))).toBe(true))
  })

  it('downloads PDF for a submission', async () => {
    const createObjectURL = vi.fn(() => 'blob:pdf')
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    stubFetch({
      '/api/forms/me/submissions': submissions,
      '/api/forms/submissions/77/pdf': new Blob(['pdf']),
      '/api/schedules/me': [],
      '/api/messages/me': [],
    })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('PDF'))
    await waitFor(() => expect(calls.some((c) => c.includes('/api/forms/submissions/77/pdf'))).toBe(true))
  })

  it('renders events tab with upcoming events', async () => {
    stubFetch({
      '/api/forms/me/submissions': [],
      '/api/schedules/me': events,
      '/api/messages/me': [],
    })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('My Events'))
    expect(await screen.findByText('Pool A')).toBeInTheDocument()
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
  })

  it('shows empty events state', async () => {
    stubFetch({ '/api/forms/me/submissions': [], '/api/schedules/me': [], '/api/messages/me': [] })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('My Events'))
    expect(await screen.findByText('No registered events yet.')).toBeInTheDocument()
  })

  it('renders messages tab with unread indicator', async () => {
    stubFetch({
      '/api/forms/me/submissions': [],
      '/api/schedules/me': [],
      '/api/messages/me': messages,
    })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('My Messages'))
    expect(await screen.findByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Unread')).toBeInTheDocument()
  })

  it('opens message dialog and marks it read', async () => {
    stubFetch({
      '/api/forms/me/submissions': [],
      '/api/schedules/me': [],
      '/api/messages/me': messages,
      '/api/messages/1/read': { message_id: 1, subject: 'Welcome', body: 'Hello!', sender_name: 'Coach Pete', sent_at: '2027-01-01T10:00:00', is_read: true },
    })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('My Messages'))
    fireEvent.click(await screen.findByText('Welcome'))
    await waitFor(() => expect(calls.some((c) => c.includes('/api/messages/1/read'))).toBe(true))
  })

  it('shows empty messages state', async () => {
    stubFetch({ '/api/forms/me/submissions': [], '/api/schedules/me': [], '/api/messages/me': [] })
    renderPage(<ProfilePage />)
    fireEvent.click(await screen.findByText('My Messages'))
    expect(await screen.findByText('No messages yet.')).toBeInTheDocument()
  })
})
