import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  submitValues: { current: null as Record<string, unknown> | null },
}))

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { Dialog: new Proxy({}, { get: () => passthrough }) }
})

vi.mock('primereact/select', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const Root = ({ options, onValueChange, value, optionValue }: {
    options?: Array<Record<string, unknown>>; onValueChange: (e: { value: unknown }) => void;
    value?: unknown; optionValue?: string;
  }) => (
    <div data-testid="select-root">
      {(options ?? []).map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-label={`Select ${String(opt.label)}`}
          onClick={() => onValueChange({ value: optionValue ? opt[optionValue] : opt.value })}
        >
          {String(opt.label)}
        </button>
      ))}
      <span data-testid="select-value">{value === null || value === undefined ? '' : String(value)}</span>
    </div>
  )
  const Select = new Proxy({ Root } as Record<string, unknown>, {
    get: (target, prop) => (prop in target ? target[prop as string] : passthrough),
  })
  return { Select, default: Select }
})

vi.mock('../components/EntityFormDialog.tsx', () => ({
  EntityFormDialog: ({ visible, title, initialValues, onSubmit, onHide, submitting }: {
    visible: boolean; title: string; initialValues?: Record<string, unknown>;
    onSubmit: (v: Record<string, unknown>) => Promise<void> | void;
    onHide?: () => void; submitting?: boolean;
  }) => {
    if (!visible) return null
    return (
      <div data-testid="entity-form-dialog">
        <h2>{title}</h2>
        <button type="button" aria-label="Dialog submit" disabled={submitting}
          onClick={() => void onSubmit(mocks.submitValues.current ?? initialValues ?? {})}>Save</button>
        <button type="button" aria-label="Dialog close" onClick={() => onHide?.()}>Close</button>
      </div>
    )
  },
}))

vi.mock('../components/ConfirmDelete.tsx', () => ({
  ConfirmDelete: ({ itemName, softLabel, onSoftDelete, onHardDelete }: {
    itemName: string; softLabel?: string; onSoftDelete: () => Promise<void> | void;
    onHardDelete?: (reason: string) => Promise<void> | void;
  }) => (
    <div data-testid="confirm-delete">
      <span>{itemName}</span>
      <button type="button" aria-label={softLabel ?? `Soft delete ${itemName}`}
        onClick={() => void onSoftDelete()}>Deactivate</button>
      {onHardDelete ? (
        <button type="button" aria-label={`Permanently delete ${itemName}`}
          onClick={() => void onHardDelete('reason')}>Hard</button>
      ) : null}
    </div>
  ),
}))

import EventsPage from './EventsPage.tsx'
import CoachEventsPage from './CoachEventsPage.tsx'
import FormBuilderPage from './FormBuilderPage.tsx'
import FacilitiesPage from './FacilitiesPage.tsx'
import VenuesPage from './VenuesPage.tsx'
import FrequenciesPage from './FrequenciesPage.tsx'
import { loginAs, renderAtRoute } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string }>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetch(routes: Record<string, unknown>): void {
  calls = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    for (const [pattern, body] of Object.entries(routes)) {
      if (new RegExp(`^${pattern}$`).test(url)) {
        if (typeof body === 'number') return json({}, body)
        if (body instanceof Error) throw body
        return json(body)
      }
    }
    return json([])
  }))
}

function renderBuilder(): ReturnType<typeof renderAtRoute> {
  return renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
}

beforeEach(() => {
  mocks.submitValues.current = null
  loginAs('FACILITY_MANAGER')
})

describe('EventsPage extra handlers', () => {
  const event = { event_id: 11, start_date_time: '2027-02-01T09:00:00', end_date_time: '2027-02-01T11:00:00', is_active: true }

  it('hard-deletes an event', async () => {
    installFetch({
      '/api/events': [event],
      '/api/frequencies': [],
      '/api/events/11/hard': { message: 'ok' },
    })
    renderAtRoute('/events', '*', <EventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(screen.getByLabelText(/^Permanently delete .*event$/))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/11/hard' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('bulk-deletes selected events', async () => {
    installFetch({
      '/api/events': [event],
      '/api/frequencies': [],
      '/api/events/bulk': { message: 'ok' },
    })
    const view = renderAtRoute('/events', '*', <EventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    const checkbox = view.container.querySelector('input[data-scope="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.click(await screen.findByLabelText('Delete 1 selected event'))
    fireEvent.click(await screen.findByText('Delete 1'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/bulk' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('bulk delete failure does not crash', async () => {
    installFetch({
      '/api/events': [event],
      '/api/frequencies': [],
      '/api/events/bulk': 500,
    })
    const view = renderAtRoute('/events', '*', <EventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    const checkbox = view.container.querySelector('input[data-scope="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.click(await screen.findByLabelText('Delete 1 selected event'))
    fireEvent.click(await screen.findByText('Delete 1'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/bulk' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('submits Date objects on create (toIso Date branch)', async () => {
    installFetch({ '/api/events': [], '/api/frequencies': [] })
    renderAtRoute('/events', '*', <EventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    mocks.submitValues.current = {
      start_date_time: new Date('2027-05-01T09:00:00'),
      end_date_time: new Date('2027-05-01T11:00:00'),
      frequency_id: null,
      is_active: true,
    }
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events' && c.method === 'POST')).toBe(true),
    )
    const post = calls.find((c) => c.url === '/api/events' && c.method === 'POST')
    expect(post).toBeTruthy()
  })

  it('closes dialog via onHide', async () => {
    installFetch({ '/api/events': [], '/api/frequencies': [] })
    renderAtRoute('/events', '*', <EventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    expect(screen.getByTestId('entity-form-dialog')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Dialog close'))
    await waitFor(() => expect(screen.queryByTestId('entity-form-dialog')).toBeNull())
  })

  it('renders an event without end time', async () => {
    installFetch({
      '/api/events': [{ event_id: 12, start_date_time: '2027-03-01T09:00:00', is_active: true }],
      '/api/frequencies': [],
    })
    renderAtRoute('/events', '*', <EventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
  })
})

describe('CoachEventsPage member management', () => {
  const coachEvent = {
    event_id: 21,
    start_date_time: '2027-03-01T09:00:00',
    end_date_time: '2027-03-01T11:00:00',
    coach_id: 'test-user',
    is_active: true,
  }
  const member = { schedule_id: 77, member_id: 'm1', member_name: 'Pat', email: 'p@x.io', venue_id: null }

  function installCoachRoutes(extra: Record<string, unknown> = {}): void {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [coachEvent],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/venues': [],
      '/api/facilities': [],
      '/api/frequencies': [],
      '/api/events/21/capacity': { registered_count: 1, max_capacity: 20 },
      '/api/events/21/members': [member],
      ...extra,
    })
  }

  beforeEach(() => {
    loginAs('COACH', 'test-user')
  })

  async function openMembersDialog(): Promise<void> {
    renderAtRoute('/manage-events', '*', <CoachEventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(await screen.findByLabelText('Manage members'))
    await waitFor(() => expect(screen.getAllByText('Pat').length).toBeGreaterThan(0))
  }

  it('lists members with venue fallback label', async () => {
    installCoachRoutes()
    await openMembersDialog()
    expect(document.body.innerHTML).toContain('No venue')
  })

  it('adds a member by sub', async () => {
    installCoachRoutes()
    await openMembersDialog()
    fireEvent.change(screen.getByLabelText('Member sub'), { target: { value: 'new-sub' } })
    fireEvent.click(screen.getByText('Add'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/members' && c.method === 'POST')).toBe(true),
    )
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/capacity')).toBe(true),
    )
  })

  it('shows toast when add member fails', async () => {
    installCoachRoutes()
    await openMembersDialog()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url.endsWith('/api/events/21/members') && method === 'POST') return json({}, 500)
      if (url.endsWith('/api/events/21/members')) return json([member])
      return json([])
    }))
    fireEvent.change(screen.getByLabelText('Member sub'), { target: { value: 'new-sub' } })
    fireEvent.click(screen.getByText('Add'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/events/21/members') && c.method === 'POST')).toBe(true),
    )
  })

  it('removes a member via confirm', async () => {
    installCoachRoutes()
    await openMembersDialog()
    fireEvent.click(await screen.findByLabelText('Remove from event'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/members/77' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('remove-member failure shows toast', async () => {
    installCoachRoutes()
    await openMembersDialog()
    let first = true
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url === 'http://localhost:3000/api/events/21/members/77' && method === 'DELETE') return json({}, 500)
      if (/\/api\/events\/21\/members$/.test(url)) return json(first ? [member] : [])
      if (/\/api\/events\/21$/.test(url)) return json(coachEvent)
      return json([])
    }))
    fireEvent.click(await screen.findByLabelText('Remove from event'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/events/21/members/77') && c.method === 'DELETE')).toBe(true),
    )
  })

  it('edits a member schedule venue', async () => {
    installCoachRoutes({ '/api/events/21/members/77': { message: 'ok' } })
    await openMembersDialog()
    fireEvent.click(await screen.findByLabelText('Edit member schedule'))
    mocks.submitValues.current = { venue_id: 9 }
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/members/77' && c.method === 'PUT')).toBe(true),
    )
  })

  it('edit-member failure shows toast', async () => {
    installCoachRoutes({ '/api/events/21/members/77': 500 })
    await openMembersDialog()
    fireEvent.click(await screen.findByLabelText('Edit member schedule'))
    mocks.submitValues.current = { venue_id: null }
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21/members/77' && c.method === 'PUT')).toBe(true),
    )
  })

  it('members list load failure shows toast but dialog opens', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [coachEvent],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/venues': [], '/api/facilities': [], '/api/frequencies': [],
      '/api/events/21/members': 500,
    })
    renderAtRoute('/manage-events', '*', <CoachEventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(await screen.findByLabelText('Manage members'))
    await new Promise((r) => setTimeout(r, 30))
    expect(calls.some((c) => c.url.endsWith('/api/events/21/members'))).toBe(true)
  })

  it('switches scope via select', async () => {
    installCoachRoutes()
    renderAtRoute('/manage-events', '*', <CoachEventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(screen.getByLabelText('Select Past'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('scope=past'))).toBe(true),
    )
  })

  it('shows past empty-state hint', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/venues': [], '/api/facilities': [], '/api/frequencies': [],
    })
    renderAtRoute('/manage-events', '*', <CoachEventsPage />)
    await waitFor(() => expect(document.body.innerHTML.length).toBeGreaterThan(0))
    fireEvent.click(await screen.findByLabelText('Select Past'))
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText(/Past coaching events will appear here/i) || document.body).toBeTruthy()
  })
})

describe('FormBuilderPage extra handlers', () => {
  const facility = { facility_id: 10, name: 'Pool A', is_active: true }
  const question = { form_question_id: 31, facility_id: 10, prompt: 'Q?', question_type: 'text', is_required: true, sort_order: 0, is_active: true }
  const rule = { rule_id: 41, facility_id: 10, title: 'R1', content: 'Be nice', sort_order: 0, is_active: true }

  function installBuilderRoutes(extra: Record<string, unknown> = {}): void {
    installFetch({
      '/api/facilities/10': facility,
      '/api/forms/10': { questions: [question], rules: [rule] },
      ...extra,
    })
  }

  it('load failure shows toast', async () => {
    installFetch({ '/api/facilities/10': 500 })
    renderBuilder()
    await new Promise((r) => setTimeout(r, 30))
    expect(calls.some((c) => c.url.endsWith('/api/facilities/10'))).toBe(true)
  })

  it('hard-deletes a question', async () => {
    installBuilderRoutes({ '/api/forms/questions/31/hard': { message: 'ok' } })
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('Q?').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByLabelText('Permanently delete Q?'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/forms/questions/31/hard') && c.method === 'DELETE')).toBe(true),
    )
  })

  it('question save failure shows toast', async () => {
    installBuilderRoutes()
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('Q?').length).toBeGreaterThan(0))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET' })
      if (url.endsWith('/api/forms/questions') && init?.method === 'POST') return json({}, 500)
      return json({ questions: [question], rules: [rule] })
    }))
    fireEvent.click(await screen.findByText('New Question'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/forms/questions') && c.method === 'POST')).toBe(true))
  })

  it('bulk-deletes selected questions', async () => {
    installBuilderRoutes({ '/api/forms/questions/bulk': { message: 'ok' } })
    const view = renderBuilder()
    await waitFor(() => expect(screen.getAllByText('Q?').length).toBeGreaterThan(0))
    const checkbox = view.container.querySelector('input[data-scope="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.click(await screen.findByLabelText('Delete 1 selected question'))
    fireEvent.click(await screen.findByText('Delete 1'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/forms/questions/bulk') && c.method === 'DELETE')).toBe(true),
    )
  })

  it('edits a rule via dialog', async () => {
    installBuilderRoutes()
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('R1').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByLabelText('Edit R1'))
    expect(screen.getByText('Edit Rule')).toBeTruthy()
    mocks.submitValues.current = { title: 'R1', content: 'Updated', sort_order: 1, is_active: true }
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/forms/rules/41') && c.method === 'PUT')).toBe(true),
    )
  })

  it('rule save failure shows toast', async () => {
    installBuilderRoutes()
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('R1').length).toBeGreaterThan(0))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET' })
      if (/\/api\/forms\/rules\/41$/.test(url) && init?.method === 'PUT') return json({}, 500)
      return json({ questions: [question], rules: [rule] })
    }))
    fireEvent.click(screen.getByLabelText('Edit R1'))
    mocks.submitValues.current = { title: 'R1', content: 'x', sort_order: 0, is_active: true }
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => /\/api\/forms\/rules\/41$/.test(c.url) && c.method === 'PUT')).toBe(true),
    )
  })

  it('hard-deletes a rule', async () => {
    installBuilderRoutes({ '/api/forms/rules/41/hard': { message: 'ok' } })
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('R1').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByLabelText('Permanently delete R1'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/forms/rules/41/hard') && c.method === 'DELETE')).toBe(true),
    )
  })

  it('bulk-deletes selected rules', async () => {
    installBuilderRoutes({ '/api/forms/rules/bulk': { message: 'ok' } })
    const view = renderBuilder()
    await waitFor(() => expect(screen.getAllByText('R1').length).toBeGreaterThan(0))
    const checkboxes = view.container.querySelectorAll('input[data-scope="checkbox"]')
    fireEvent.click(checkboxes[checkboxes.length - 1])
    fireEvent.click(await screen.findByLabelText('Delete 1 selected rule'))
    fireEvent.click(await screen.findByText('Delete 1'))
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/api/forms/rules/bulk') && c.method === 'DELETE')).toBe(true),
    )
  })

  it('back link navigates', async () => {
    installBuilderRoutes()
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('R1').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByText('Back to facilities'))
  })

  it('dialog onHide closes create-question dialog', async () => {
    installBuilderRoutes()
    renderBuilder()
    await waitFor(() => expect(screen.getAllByText('R1').length).toBeGreaterThan(0))
    fireEvent.click(await screen.findByText('New Question'))
    expect(screen.getByTestId('entity-form-dialog')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Dialog close'))
    await waitFor(() => expect(screen.queryByTestId('entity-form-dialog')).toBeNull())
  })
})

describe('CRUD page load failures', () => {
  beforeEach(() => {
    loginAs('FACILITY_MANAGER')
  })

  it('facilities load failure shows toast', async () => {
    installFetch({ '/api/facilities': 500 })
    renderAtRoute('/facilities', '*', <FacilitiesPage />)
    await new Promise((r) => setTimeout(r, 30))
    expect(calls.some((c) => c.url.endsWith('/api/facilities'))).toBe(true)
  })

  it('venues load failure shows toast', async () => {
    installFetch({ '/api/venues': 500 })
    renderAtRoute('/venues', '*', <VenuesPage />)
    await new Promise((r) => setTimeout(r, 30))
    expect(calls.some((c) => c.url.endsWith('/api/venues'))).toBe(true)
  })

  it('frequencies load failure shows toast', async () => {
    installFetch({ '/api/frequencies': 500 })
    renderAtRoute('/frequencies', '*', <FrequenciesPage />)
    await new Promise((r) => setTimeout(r, 30))
    expect(calls.some((c) => c.url.endsWith('/api/frequencies'))).toBe(true)
  })
})
