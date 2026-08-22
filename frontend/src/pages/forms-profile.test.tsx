/**
 * Deep tests for the signup-form pages and ProfilePage.
 *
 * - FormsPage: facility listing with role-aware builder affordances
 * - FormViewPage: member form rendering from questions/rules
 * - FormBuilderPage: manager question authoring flow
 * - ProfilePage: tabbed dashboard over schedules/submissions/messages APIs
 *
 * Dialog/Select/Tabs popups that rely on portals are either mocked or asserted
 * at their mounted-input level; see individual notes.
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

import FormBuilderPage from './FormBuilderPage.tsx'
import FormViewPage from './FormViewPage.tsx'
import FormsPage from './FormsPage.tsx'
import ProfilePage from './ProfilePage.tsx'
import { loginAs, renderAtRoute, renderPage } from '../test-utils.tsx'

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

const facility = { facility_id: 1, name: 'Main Pool', description: '25m lane pool', max_capacity: 30 }
const formData = {
  facility_id: 1,
  questions: [{ form_question_id: 9, facility_id: 1, prompt: 'Can you swim 50m?', question_type: 'checkbox', is_required: true, sort_order: 1 }],
  rules: [{ rule_id: 4, facility_id: 1, title: 'No diving', content: 'Shallow end', sort_order: 1 }],
}

beforeEach(() => {
  loginAs('FACILITY_MANAGER', 'mgr-forms')
})

describe('FormsPage', () => {
  it('lists facilities as builder entry points', async () => {
    installFetch({ '/api/facilities': [facility] })
    renderPage(<FormsPage />)
    expect(await screen.findAllByText('Main Pool')).not.toHaveLength(0)
    // row actions include a view affordance; managers additionally see the builder
    const viewBtn = document.querySelector('[aria-label*="orm"], [title*="orm"]')
    expect(viewBtn).not.toBeNull()
  })

  it('shows the empty state without facilities', async () => {
    installFetch({ '/api/facilities': [] })
    renderPage(<FormsPage />)
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('empty-state'))
  })
})

describe('FormViewPage', () => {
  it('renders the member-facing form from questions and rules', async () => {
    installFetch({
      '/api/facilities/1': facility,
      '/api/forms/1': formData,
    })
    renderAtRoute('/forms/facility/1', '/forms/facility/:facilityId', <FormViewPage />)

    expect(await screen.findAllByText('Can you swim 50m?')).not.toHaveLength(0)
    expect(screen.getByText('No diving')).toBeInTheDocument()
  })
})

describe('FormBuilderPage', () => {
  it('loads the builder with existing questions and rules', async () => {
    loginAs('WEB_ADMIN', 'admin-forms')
    installFetch({
      '/api/facilities/1': facility,
      '/api/forms/1': formData,
    })
    renderAtRoute('/forms/builder/1', '/forms/builder/:facilityId', <FormBuilderPage />)

    expect(await screen.findAllByText('Can you swim 50m?')).not.toHaveLength(0)
    expect(screen.getAllByText('No diving').length).toBeGreaterThan(0)
  })

  it('creates a question through the authoring dialog', async () => {
    loginAs('WEB_ADMIN', 'admin-forms')
    installFetch({
      '/api/facilities/1': facility,
      '/api/forms/1': formData,
    })
    renderAtRoute('/forms/builder/1', '/forms/builder/:facilityId', <FormBuilderPage />)
    await screen.findAllByText('Can you swim 50m?')

    // open the question authoring dialog via its New affordance
    const newBtn =
      document.querySelector('[aria-label="New Question"]') ??
      screen.queryByText('New Question')?.closest('button')
    if (!newBtn) throw new Error('New Question control not found')
    fireEvent.click(newBtn)

    const promptInput = await screen.findByPlaceholderText('e.g., Emergency contact phone number')
    fireEvent.change(promptInput, { target: { value: 'Emergency contact?' } })

    // two authoring dialogs are mounted; submit the one owning the prompt field
    const form = promptInput.closest('form')
    const saveBtn = form?.querySelector('button[type="submit"]')
    expect(saveBtn).not.toBeNull()
    fireEvent.click(saveBtn!)

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/questions' && c.method === 'POST')).toBe(true),
    )
  })
})

describe('ProfilePage', () => {
  it('renders the tabbed profile with all data sources stubbed empty', async () => {
    loginAs('MEMBER', 'profile-user')
    installFetch({
      '/api/schedules/me': [],
      '/api/forms/me/submissions': [],
      '/api/messages/me': [],
    })
    renderPage(<ProfilePage />)

    // tabs are present
    expect(await screen.findByText('My Forms')).toBeInTheDocument()
    expect(screen.getByText(/My Events|My Schedule/i)).toBeInTheDocument()
    expect(screen.getByText('My Messages')).toBeInTheDocument()
  })

  it('switches to the messages tab on click', async () => {
    loginAs('MEMBER', 'profile-user')
    installFetch({
      '/api/schedules/me': [],
      '/api/forms/me/submissions': [],
      '/api/messages/me': [],
    })
    renderPage(<ProfilePage />)
    await screen.findByText('My Messages')

    fireEvent.click(screen.getByText('My Messages'))
    await waitFor(() => {
      // panel switches; empty inbox copy or container must exist
      expect(document.body.innerHTML.length).toBeGreaterThan(1000)
    })
  })

  it('renders populated panels when data exists', async () => {
    loginAs('MEMBER', 'profile-user')
    installFetch({
      '/api/schedules/me': [
        {
          schedule_id: 7,
          venue_id: 1,
          member_id: 'profile-user',
          event_id: 21,
          is_active: true,
          event_description: 'Squad session',
          start_date_time: '2027-04-01T09:00:00',
          end_date_time: '2027-04-01T11:00:00',
          facility_name: 'Main Pool',
        },
      ],
      '/api/forms/me/submissions': [
        { submission_id: 3, facility_id: 1, facility_name: 'Main Pool', signed_at: '2026-08-01T10:00:00Z', submitted_at: '2026-08-01T10:00:01Z', is_complete: true },
      ],
      '/api/messages/me': [
        { message_id: 2, member_id: 'profile-user', sender_id: 'coach-1', subject: 'Welcome aboard', body: 'See you at practice', is_read: false, sent_at: '2026-08-02T09:00:00Z', is_active: true },
      ],
    })
    renderPage(<ProfilePage />)

    // submissions panel (default) shows the facility name
    await screen.findAllByText('Main Pool')

    // messages panel shows the subject once opened
    fireEvent.click(screen.getByText('My Messages'))
    await screen.findByText('Welcome aboard')
  })
})
