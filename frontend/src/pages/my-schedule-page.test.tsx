import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { loginAs, renderPage } from '../test-utils.tsx'
import MySchedulePage from './MySchedulePage.tsx'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { default: passthrough, Dialog: passthrough }
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
          aria-label={`Pick ${String(opt.label)}`}
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

vi.mock('../components/ConfirmDelete.tsx', () => ({
  ConfirmDelete: ({ itemName, softLabel, onSoftDelete }: { itemName: string; softLabel?: string; onSoftDelete: () => void }) => (
    <div>
      <button type="button" aria-label={softLabel || `Delete ${itemName}`} onClick={() => void onSoftDelete()}>Del</button>
    </div>
  ),
}))

const mockListMine = vi.fn()
const mockGetMyCalendarIcs = vi.fn()
const mockSearchEvents = vi.fn()
const mockReschedule = vi.fn()
const mockCancelRegistration = vi.fn()

vi.mock('../api/schedules.ts', () => ({
  listMine: (...args: unknown[]) => mockListMine(...args),
  getMyCalendarIcs: (...args: unknown[]) => mockGetMyCalendarIcs(...args),
  reschedule: (...args: unknown[]) => mockReschedule(...args),
  cancelRegistration: (...args: unknown[]) => mockCancelRegistration(...args),
}))

vi.mock('../api/public.ts', () => ({
  searchEvents: (...args: unknown[]) => mockSearchEvents(...args),
}))

const upcomingItem = {
  schedule_id: 10,
  event_id: 5,
  event_start_date_time: '2099-01-01T09:00:00',
  event_end_date_time: '2099-01-01T11:00:00',
  event_description: 'Sprint meet',
  facility_name: 'Aquatic Center',
  street: '100 Swim Ln',
  city: 'Austin',
  state: 'TX',
  postal_code: '73301',
  is_active: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListMine.mockResolvedValue([upcomingItem])
  mockSearchEvents.mockResolvedValue([])
})

describe('MySchedulePage', () => {
  it('shows loading skeleton', () => {
    mockListMine.mockReturnValue(new Promise(() => {}))
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    expect(document.body.innerHTML).toContain('skeleton')
  })

  it('renders schedule items', async () => {
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('Aquatic Center')).toBeTruthy())
    expect(document.body.innerHTML).toContain('Sprint meet')
  })

  it('shows empty state when no registrations', async () => {
    mockListMine.mockResolvedValue([])
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('No upcoming registrations.')).toBeTruthy())
  })

  it('downloads iCal', async () => {
    mockGetMyCalendarIcs.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR')
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText(/Add to calendar/)).toBeTruthy())
    screen.getByText(/Add to calendar/).click()
    await waitFor(() => expect(mockGetMyCalendarIcs).toHaveBeenCalled())
  })

  it('handles iCal download failure', async () => {
    mockGetMyCalendarIcs.mockRejectedValue(new Error('Network error'))
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText(/Add to calendar/)).toBeTruthy())
    screen.getByText(/Add to calendar/).click()
    await waitFor(() => expect(mockGetMyCalendarIcs).toHaveBeenCalled())
  })

  it('shows cancel button for upcoming items', async () => {
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByLabelText('Cancel this registration')).toBeTruthy())
  })

  it('cancels registration', async () => {
    mockCancelRegistration.mockResolvedValue({ message: 'Cancelled' })
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByLabelText('Cancel this registration')).toBeTruthy())
    screen.getByLabelText('Cancel this registration').click()
    await waitFor(() => expect(mockCancelRegistration).toHaveBeenCalledWith(10))
  })

  it('shows past tag for past events', async () => {
    mockListMine.mockResolvedValue([{ ...upcomingItem, event_start_date_time: '2020-01-01T09:00:00', event_end_date_time: '2020-01-01T11:00:00' }])
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('Past')).toBeTruthy())
  })

  it('shows no-alternates hint when no other events', async () => {
    mockSearchEvents.mockResolvedValue([])
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('No other upcoming events are available right now.')).toBeTruthy())
  })

  it('disables Move when no target selected', async () => {
    const otherEvent = { event_id: 99, start_date_time: '2099-06-01T10:00:00' }
    mockSearchEvents.mockResolvedValue([otherEvent])
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('Aquatic Center')).toBeTruthy())
    const moveBtn = screen.getByText('Move')
    expect(moveBtn.closest('button')).toHaveAttribute('disabled')
  })

  it('reschedules to a picked alternate event', async () => {
    mockSearchEvents.mockResolvedValue([{ event_id: 99, start_date_time: '2099-06-01T10:00:00' }])
    mockReschedule.mockResolvedValue({ schedule_id: 10 })
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('Aquatic Center')).toBeTruthy())
    fireEvent.click(screen.getByLabelText(/Pick .*2099/))
    fireEvent.click(screen.getByText('Move'))
    await waitFor(() => expect(mockReschedule).toHaveBeenCalledWith(10, { event_id: 99 }))
  })

  it('reschedule failure shows toast', async () => {
    mockSearchEvents.mockResolvedValue([{ event_id: 99, start_date_time: '2099-06-01T10:00:00' }])
    mockReschedule.mockRejectedValue(new Error('nope'))
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(screen.getByText('Aquatic Center')).toBeTruthy())
    fireEvent.click(screen.getByLabelText(/Pick .*2099/))
    fireEvent.click(screen.getByText('Move'))
    await waitFor(() => expect(mockReschedule).toHaveBeenCalled())
  })

  it('load failure shows toast', async () => {
    mockListMine.mockRejectedValue(new Error('boom'))
    loginAs('MEMBER')
    renderPage(<MySchedulePage />)
    await waitFor(() => expect(mockListMine).toHaveBeenCalled())
  })
})
