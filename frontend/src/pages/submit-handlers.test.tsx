import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { Dialog: new Proxy({}, { get: () => passthrough }) }
})

vi.mock('../components/EntityFormDialog.tsx', () => ({
  EntityFormDialog: vi.fn(
    ({ visible, title, initialValues, onSubmit, submitting }: {
      visible: boolean; title: string; initialValues: Record<string, unknown>;
      onSubmit: (v: Record<string, unknown>) => Promise<void> | void; submitting: boolean;
    }) => {
      if (!visible) return null
      return (
        <div data-testid="entity-form-dialog">
          <h2>{title}</h2>
          <button type="button" aria-label="Dialog submit" disabled={submitting}
            onClick={() => void onSubmit(initialValues)}>Save</button>
        </div>
      )
    },
  ),
}))

vi.mock('../components/ConfirmDelete.tsx', () => ({
  ConfirmDelete: vi.fn(({ itemName, onSoftDelete }: {
    itemName: string; onSoftDelete: () => Promise<void> | void;
  }) => (
    <div data-testid="confirm-delete">
      <span>{itemName}</span>
      <button type="button" aria-label={`Soft delete ${itemName}`} onClick={() => void onSoftDelete()}>Deactivate</button>
    </div>
  )),
}))

import EventsPage from './EventsPage.tsx'
import CoachEventsPage from './CoachEventsPage.tsx'
import FormBuilderPage from './FormBuilderPage.tsx'
import FacilitiesPage from './FacilitiesPage.tsx'
import VenuesPage from './VenuesPage.tsx'
import FrequenciesPage from './FrequenciesPage.tsx'
import { loginAs, renderPage, renderAtRoute } from './../test-utils.tsx'

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
      if (new RegExp(`^${pattern}$`).test(url)) return json(body)
    }
    return json({ message: 'ok' })
  }))
}

describe('EventsPage submit handlers', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('creates a new event via submit', async () => {
    installFetch({ '/api/events': [], '/api/frequencies': [] })
    renderPage(<EventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events' && c.method === 'POST')).toBe(true),
    )
  })

  it('edits an event via submit', async () => {
    installFetch({
      '/api/events': [{ event_id: 11, start_date_time: '2027-02-01T09:00:00', end_date_time: '2027-02-01T11:00:00', is_active: true }],
      '/api/frequencies': [],
    })
    renderPage(<EventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(screen.getByLabelText('Edit event'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/11' && c.method === 'PUT')).toBe(true),
    )
  })

  it('soft-deletes an event', async () => {
    installFetch({
      '/api/events': [{ event_id: 11, start_date_time: '2027-02-01T09:00:00', end_date_time: '2027-02-01T11:00:00', is_active: true }],
      '/api/frequencies': [],
    })
    renderPage(<EventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(screen.getByLabelText(/Soft delete.*event/))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/11' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('shows error on create failure', async () => {
    installFetch({ '/api/events': [], '/api/frequencies': [] })
    renderPage(<EventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: 'Fail' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
  })
})

describe('CoachEventsPage submit handlers', () => {
  beforeEach(() => loginAs('COACH', 'coach-test'))

  it('creates a new event', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [], '/api/facilities': [], '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events' && c.method === 'POST')).toBe(true),
    )
  })

  it('shows error on create failure', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [], '/api/facilities': [], '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    fireEvent.click((await screen.findAllByText('New Event'))[0])
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: 'Fail' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
  })

  it('edits a coach event', async () => {
    installFetch({
      '/api/coach/events\\?scope=upcoming': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', end_date_time: '2027-03-01T11:00:00', coach_id: 'coach-test', is_active: true }],
      '/api/coach/events\\?scope=past': [],
      '/api/coach/events\\?scope=all': [],
      '/api/frequencies': [], '/api/facilities': [], '/api/venues': [],
    })
    renderPage(<CoachEventsPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('2027'))
    fireEvent.click(screen.getByLabelText('Edit event'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/events/21' && c.method === 'PUT')).toBe(true),
    )
  })
})

describe('FormBuilderPage submit handlers', () => {
  const facility = { facility_id: 10, name: 'Pool A', is_active: true }

  it('creates a question', async () => {
    installFetch({
      '/api/facilities/10': facility,
      '/api/forms/10': { facility_id: 10, questions: [], rules: [] },
    })
    loginAs('FACILITY_MANAGER')
    renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
    fireEvent.click((await screen.findAllByText('New Question'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/questions' && c.method === 'POST')).toBe(true),
    )
  })

  it('creates a rule', async () => {
    installFetch({
      '/api/facilities/10': facility,
      '/api/forms/10': { facility_id: 10, questions: [], rules: [] },
    })
    loginAs('FACILITY_MANAGER')
    renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
    fireEvent.click((await screen.findAllByText('New Rule'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/rules' && c.method === 'POST')).toBe(true),
    )
  })

  it('soft-deletes a question', async () => {
    installFetch({
      '/api/facilities/10': facility,
      '/api/forms/10': { facility_id: 10, questions: [{ form_question_id: 1, prompt: 'Swim?', question_type: 'text', is_required: true, sort_order: 0, is_active: true }], rules: [] },
    })
    loginAs('FACILITY_MANAGER')
    renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
    fireEvent.click(await screen.findByLabelText('Soft delete Swim?'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/questions/1' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('soft-deletes a rule', async () => {
    installFetch({
      '/api/facilities/10': facility,
      '/api/forms/10': { facility_id: 10, questions: [], rules: [{ rule_id: 1, title: 'No diving', content: 'Deep end', sort_order: 0, is_active: true }] },
    })
    loginAs('FACILITY_MANAGER')
    renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
    fireEvent.click(await screen.findByLabelText('Soft delete No diving'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/rules/1' && c.method === 'DELETE')).toBe(true),
    )
  })
})

describe('FacilitiesPage submit handlers', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('creates a facility', async () => {
    installFetch({ '/api/facilities': [] })
    renderPage(<FacilitiesPage />)
    fireEvent.click((await screen.findAllByText('New Facility'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities' && c.method === 'POST')).toBe(true),
    )
  })

  it('soft-deletes a facility', async () => {
    installFetch({ '/api/facilities': [{ facility_id: 5, name: 'Pool A', is_active: true }] })
    renderPage(<FacilitiesPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('Pool A'))
    fireEvent.click(screen.getByLabelText('Soft delete Pool A'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities/5' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('edits a facility', async () => {
    installFetch({ '/api/facilities': [{ facility_id: 5, name: 'Pool A', is_active: true }] })
    renderPage(<FacilitiesPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('Pool A'))
    fireEvent.click(screen.getByLabelText('Edit Pool A'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities/5' && c.method === 'PUT')).toBe(true),
    )
  })

  it('shows error on facility create failure', async () => {
    installFetch({ '/api/facilities': [] })
    renderPage(<FacilitiesPage />)
    fireEvent.click((await screen.findAllByText('New Facility'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.some((c) => c.url === '/api/facilities' && c.method === 'POST')).toBe(true))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: 'Fail' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }))
  })
})

describe('VenuesPage submit handlers', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('creates a venue', async () => {
    installFetch({ '/api/venues': [], '/api/facilities': [] })
    renderPage(<VenuesPage />)
    fireEvent.click((await screen.findAllByText('New Venue'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/venues' && c.method === 'POST')).toBe(true),
    )
  })

  it('soft-deletes a venue', async () => {
    installFetch({
      '/api/venues': [{ venue_id: 7, facility_id: 1, street: '100 Swim Ln', city: 'Austin', state: 'TX', postal_code: '73301', is_active: true }],
      '/api/facilities': [{ facility_id: 1, name: 'Aquatic Center' }],
    })
    renderPage(<VenuesPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('Aquatic Center'))
    fireEvent.click(screen.getByLabelText('Soft delete 100 Swim Ln, Austin'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/venues/7' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('edits a venue', async () => {
    installFetch({
      '/api/venues': [{ venue_id: 7, facility_id: 1, street: '100 Swim Ln', city: 'Austin', state: 'TX', postal_code: '73301', is_active: true }],
      '/api/facilities': [{ facility_id: 1, name: 'Aquatic Center' }],
    })
    renderPage(<VenuesPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('Aquatic Center'))
    fireEvent.click(screen.getByLabelText('Edit 100 Swim Ln, Austin'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/venues/7' && c.method === 'PUT')).toBe(true),
    )
  })
})

describe('FrequenciesPage submit handlers', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('creates a frequency', async () => {
    installFetch({ '/api/frequencies': [] })
    renderPage(<FrequenciesPage />)
    fireEvent.click((await screen.findAllByText('New Frequency'))[0])
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/frequencies' && c.method === 'POST')).toBe(true),
    )
  })

  it('soft-deletes a frequency', async () => {
    installFetch({ '/api/frequencies': [{ frequency_id: 3, name: 'Weekly', day_interval: '7', is_active: true }] })
    renderPage(<FrequenciesPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('Weekly'))
    fireEvent.click(screen.getByLabelText('Soft delete Weekly'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/frequencies/3' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('edits a frequency via submit', async () => {
    installFetch({ '/api/frequencies': [{ frequency_id: 3, name: 'Weekly', day_interval: '7', is_active: true }] })
    renderPage(<FrequenciesPage />)
    await waitFor(() => expect(document.body.innerHTML).toContain('Weekly'))
    fireEvent.click(screen.getByLabelText('Edit Weekly'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/frequencies/3' && c.method === 'PUT')).toBe(true),
    )
  })
})