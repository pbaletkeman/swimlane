import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const shell = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '$$typeof') return undefined
        return passthrough
      },
    },
  )
  return { Dialog: shell }
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
  ConfirmDelete: vi.fn(({ itemName, onSoftDelete, onHardDelete }: {
    itemName: string; onSoftDelete: () => Promise<void> | void;
    onHardDelete?: () => Promise<void> | void;
  }) => (
    <div data-testid="confirm-delete">
      <span>{itemName}</span>
      <button type="button" aria-label={`Soft delete ${itemName}`} onClick={() => void onSoftDelete()}>Deactivate</button>
      {onHardDelete && (
        <button type="button" aria-label={`Hard delete ${itemName}`} onClick={() => void onHardDelete()!}>Permanently delete</button>
      )}
    </div>
  )),
}))

import SchedulesPage from './SchedulesPage.tsx'
import FacilitiesPage from './FacilitiesPage.tsx'
import VenuesPage from './VenuesPage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'

let calls: Array<{ url: string; init?: RequestInit }>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(fixture: Record<string, unknown>): void {
  calls = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url in fixture) return json(fixture[url])
    return json([])
  }))
}

const schedRows = [{ schedule_id: 5, venue_id: 1, member_id: 'u1', event_id: 21, is_active: true }]

describe('SchedulesPage', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('submits a new schedule', async () => {
    stubFetch({ '/api/schedules': [], '/api/venues': [], '/api/events': [], '/api/users': [] })
    renderPage(<SchedulesPage />)
    fireEvent.click(screen.getByText('New Schedule'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST' && c.url === '/api/schedules')).toBe(true))
  })

  it('edits an existing schedule', async () => {
    stubFetch({
      '/api/schedules': schedRows,
      '/api/venues': [{ venue_id: 1, street: '123 Main', city: 'Miami', is_active: true }],
      '/api/events': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', is_active: true }],
      '/api/users': [{ sub: 'u1', name: 'Alice', is_active: true }],
    })
    renderPage(<SchedulesPage />)
    fireEvent.click(await screen.findByLabelText('Edit schedule'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PUT')).toBe(true))
    expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe('/api/schedules/5')
  })

  it('soft-deletes a schedule', async () => {
    stubFetch({
      '/api/schedules': schedRows,
      '/api/venues': [{ venue_id: 1, street: '123 Main', city: 'Miami', is_active: true }],
      '/api/events': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', is_active: true }],
      '/api/users': [{ sub: 'u1', name: 'Alice', is_active: true }],
    })
    renderPage(<SchedulesPage />)
    fireEvent.click(await screen.findByLabelText(/^Soft delete/))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/5' && c.init?.method === 'DELETE')).toBe(true),
    )
  })

  it('hard-deletes a schedule (web_admin)', async () => {
    loginAs('WEB_ADMIN')
    stubFetch({
      '/api/schedules': schedRows,
      '/api/venues': [{ venue_id: 1, street: '123 Main', city: 'Miami', is_active: true }],
      '/api/events': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', is_active: true }],
      '/api/users': [{ sub: 'u1', name: 'Alice', is_active: true }],
    })
    renderPage(<SchedulesPage />)
    fireEvent.click(await screen.findByLabelText(/^Hard delete/))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/5/hard' && c.init?.method === 'DELETE')).toBe(true),
    )
  })

  it('bulk-deletes selected schedules', async () => {
    stubFetch({
      '/api/schedules': [
        { schedule_id: 1, venue_id: 1, member_id: 'u1', event_id: 21, is_active: true },
        { schedule_id: 2, venue_id: 1, member_id: 'u2', event_id: 21, is_active: true },
      ],
      '/api/venues': [{ venue_id: 1, street: '123 Main', city: 'Miami', is_active: true }],
      '/api/events': [{ event_id: 21, start_date_time: '2027-03-01T09:00:00', is_active: true }],
      '/api/users': [{ sub: 'u1', name: 'Alice', is_active: true }, { sub: 'u2', name: 'Bob', is_active: true }],
    })
    renderPage(<SchedulesPage />)

    await screen.findByText('Alice')
    const checkboxes = document.querySelectorAll('input[data-scope="checkbox"]')
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])

    fireEvent.click(await screen.findByLabelText(/^Delete \d+ selected/))
    const deleteBtn = screen.getByRole('button', { name: /^Delete \d+$/ })
    fireEvent.click(deleteBtn)
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/schedules/bulk' && c.init?.method === 'DELETE')).toBe(true),
    )
  })
})

describe('FacilitiesPage', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('submits a new facility', async () => {
    stubFetch({ '/api/facilities': [] })
    renderPage(<FacilitiesPage />)
    fireEvent.click(screen.getByText('New Facility'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST' && c.url === '/api/facilities')).toBe(true))
  })

  it('soft-deletes a facility', async () => {
    stubFetch({ '/api/facilities': [{ facility_id: 1, name: 'Pool A', is_active: true }] })
    renderPage(<FacilitiesPage />)
    fireEvent.click(await screen.findByLabelText('Soft delete Pool A'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities/1' && c.init?.method === 'DELETE')).toBe(true),
    )
  })

  it('hard-deletes a facility (web_admin)', async () => {
    loginAs('WEB_ADMIN')
    stubFetch({ '/api/facilities': [{ facility_id: 1, name: 'Pool A', is_active: true }] })
    renderPage(<FacilitiesPage />)
    fireEvent.click(await screen.findByLabelText('Hard delete Pool A'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/facilities/1/hard' && c.init?.method === 'DELETE')).toBe(true),
    )
  })
})

describe('VenuesPage', () => {
  beforeEach(() => loginAs('FACILITY_MANAGER'))

  it('submits a new venue', async () => {
    stubFetch({ '/api/venues': [], '/api/facilities': [] })
    renderPage(<VenuesPage />)
    fireEvent.click(screen.getByText('New Venue'))
    fireEvent.click(await screen.findByLabelText('Dialog submit'))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST' && c.url === '/api/venues')).toBe(true))
  })

  it('soft-deletes a venue', async () => {
    stubFetch({
      '/api/venues': [{ venue_id: 1, street: '123 Main', city: 'Miami', facility_id: 1, is_active: true }],
      '/api/facilities': [{ facility_id: 1, name: 'Pool A', is_active: true }],
    })
    renderPage(<VenuesPage />)
    fireEvent.click(await screen.findByLabelText('Soft delete 123 Main, Miami'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/venues/1' && c.init?.method === 'DELETE')).toBe(true),
    )
  })

  it('hard-deletes a venue (web_admin)', async () => {
    loginAs('WEB_ADMIN')
    stubFetch({
      '/api/venues': [{ venue_id: 1, street: '123 Main', city: 'Miami', facility_id: 1, is_active: true }],
      '/api/facilities': [{ facility_id: 1, name: 'Pool A', is_active: true }],
    })
    renderPage(<VenuesPage />)
    fireEvent.click(await screen.findByLabelText('Hard delete 123 Main, Miami'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/venues/1/hard' && c.init?.method === 'DELETE')).toBe(true),
    )
  })
})
