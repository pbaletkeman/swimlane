import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

vi.mock('primereact/button', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

vi.mock('primereact/datepicker', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { DatePicker: new Proxy({}, { get: () => passthrough }) }
})

vi.mock('primereact/select', () => {
  const SelectMock = ({ options, optionLabel, optionValue, value }: {
    options?: Array<Record<string, unknown>>; optionLabel?: string; optionValue?: string; value?: string;
  }) => (
    <div data-testid="select-mock">
      {options?.map((opt) => (
        <span key={String(opt[optionValue ?? 'value'])}>{String(opt[optionLabel ?? 'label'])}</span>
      ))}
      <span>selected: {value}</span>
    </div>
  )
  return { Select: Object.assign(SelectMock, {
    Root: SelectMock,
    Trigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Value: () => null,
    Indicator: () => null,
    Portal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Positioner: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    List: () => null,
  }) }
})

vi.mock('primereact/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton">loading...</div>,
}))

import VenueSchedulePage from './VenueSchedulePage.tsx'
import { renderAtRoute } from '../../test-utils.tsx'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const venue = { venue_id: 42, facility_name: 'Pool Miami', street: '123 Main', city: 'Miami', state: 'FL', postal_code: '33101' }
const events = [{ event_id: 1, start_date_time: '2099-01-01T09:00:00', end_date_time: '2099-01-01T11:00:00', description: 'Lap swim' }]

function renderVenue(scheduleData: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL) => {
    const url = String(input)
    if (url.startsWith('/api/public/venues/42/schedules')) return json(scheduleData)
    if (url === '/api/public/venues/42') return json(venue)
    return json([])
  }))
  return renderAtRoute('/explore/venues/42', '/explore/venues/:venueId', <VenueSchedulePage />)
}

describe('VenueSchedulePage', () => {
  it('shows loading skeleton while fetching', async () => {
    renderVenue(events)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.queryByTestId('skeleton')).toBeNull())
  })

  it('renders venue name and schedule controls', async () => {
    renderVenue(events)
    expect(await screen.findByText('Pool Miami')).toBeInTheDocument()
    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Event list')).toBeInTheDocument()
  })

  it('renders events with view details link', async () => {
    renderVenue(events)
    await waitFor(() => expect(screen.getAllByText('View details').length).toBeGreaterThan(0))
  })

  it('shows empty state when no events', async () => {
    renderVenue([])
    expect(await screen.findByText('No events in this view')).toBeInTheDocument()
  })

  it('shows 404 state for unknown venue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/999')) return new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 })
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    renderAtRoute('/explore/venues/999', '/explore/venues/:venueId', <VenueSchedulePage />)
    expect(await screen.findByText('Venue not found')).toBeInTheDocument()
  })

  it('displays back to venues link', async () => {
    renderVenue(events)
    expect(await screen.findByText('Back to venues')).toBeInTheDocument()
  })
})
