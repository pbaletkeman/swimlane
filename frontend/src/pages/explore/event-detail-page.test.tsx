import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { PrimeReactProvider } from '@primereact/core/config'
import { AuthProvider } from '../../auth/AuthContext.tsx'
import { loginAs } from '../../test-utils.tsx'
import EventDetailPage from './EventDetailPage.tsx'

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

const mockGetEventDetail = vi.fn()
const mockSearchEvents = vi.fn()
const mockRegisterForEvent = vi.fn()
const mockSchedulesList = vi.fn()
const mockReschedule = vi.fn()

vi.mock('../../api/public.ts', () => ({
  getEventDetail: (...args: unknown[]) => mockGetEventDetail(...args),
  searchEvents: (...args: unknown[]) => mockSearchEvents(...args),
}))

vi.mock('../../api/events.ts', () => ({
  registerForEvent: (...args: unknown[]) => mockRegisterForEvent(...args),
}))

vi.mock('../../api/schedules.ts', () => ({
  schedules: { list: (...args: unknown[]) => mockSchedulesList(...args) },
  reschedule: (...args: unknown[]) => mockReschedule(...args),
}))

function renderDetail(eventId = '1') {
  return render(
    <PrimeReactProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/explore/events/${eventId}`]}>
          <Routes>
            <Route path="/explore/events/:eventId" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </PrimeReactProvider>,
  )
}

const detail = {
  event_id: 1,
  description: 'Freestyle Sprint',
  start_date_time: '2027-03-01T09:00:00',
  end_date_time: '2027-03-01T11:00:00',
  max_capacity: 20,
  registered_count: 5,
  venue: {
    facility_name: 'Aquatic Center',
    street: '100 Swim Ln',
    city: 'Austin',
    state: 'TX',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetEventDetail.mockResolvedValue(detail)
  mockSearchEvents.mockResolvedValue([])
  mockSchedulesList.mockResolvedValue([])
})

describe('EventDetailPage', () => {
  it('shows loading skeleton', () => {
    mockGetEventDetail.mockReturnValue(new Promise(() => {}))
    renderDetail()
    expect(document.body.innerHTML).toContain('skeleton')
  })

  it('renders event detail with capacity', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Freestyle Sprint')).toBeTruthy())
    expect(document.body.innerHTML).toContain('Aquatic Center')
    expect(document.body.innerHTML).toContain('5 / 20 registered')
  })

  it('stays on skeleton for invalid event id', async () => {
    renderDetail('0')
    await new Promise((r) => setTimeout(r, 50))
    expect(document.body.innerHTML).toContain('skeleton')
  })

  it('shows 404 when API returns 404', async () => {
    const err = new Error('Not found') as Error & { status: number }
    err.status = 404
    mockGetEventDetail.mockRejectedValue(err)
    renderDetail()
    await waitFor(() => expect(screen.getByText('Event not found')).toBeTruthy())
  })

  it('shows generic error toast on non-404 failure', async () => {
    mockGetEventDetail.mockRejectedValue(new Error('Network down'))
    renderDetail()
    await waitFor(() => expect(document.body.innerHTML).toContain('Event not found'))
  })

  it('shows sign-in link for unauthenticated users', async () => {
    renderDetail()
    await waitFor(() => expect(screen.getByText('Sign in to register')).toBeTruthy())
  })

  it('shows Register button for authenticated users', async () => {
    loginAs('MEMBER')
    renderDetail()
    await waitFor(() => expect(screen.getByText('Register')).toBeTruthy())
  })

  it('registers for event', async () => {
    loginAs('MEMBER')
    const schedule = { schedule_id: 42, event_id: 1, member_id: 'test-user', is_active: true }
    mockRegisterForEvent.mockResolvedValue(schedule)
    mockSchedulesList.mockResolvedValue([])
    mockGetEventDetail.mockResolvedValue(detail)
    renderDetail()
    await waitFor(() => expect(screen.getByText('Register')).toBeTruthy())
    screen.getByText('Register').click()
    // Confirm in the modal
    const confirm = await screen.findByText('Confirm')
    fireEvent.click(confirm.closest('button')!)
    await waitFor(() => expect(mockRegisterForEvent).toHaveBeenCalledWith(1))
  })

  it('shows "You are registered" when already registered', async () => {
    loginAs('MEMBER')
    mockSchedulesList.mockResolvedValue([{ schedule_id: 10, event_id: 1, member_id: 'test-user', is_active: true }])
    renderDetail()
    await waitFor(() => expect(screen.getByText('You are registered for this event.')).toBeTruthy())
  })

  it('shows unlimited capacity when max is null', async () => {
    mockGetEventDetail.mockResolvedValue({ ...detail, max_capacity: null })
    renderDetail()
    await waitFor(() => expect(document.body.innerHTML).toContain('unlimited'))
  })

  it('shows full when registered >= max', async () => {
    mockGetEventDetail.mockResolvedValue({ ...detail, registered_count: 20 })
    loginAs('MEMBER')
    renderDetail()
    await waitFor(() => expect(document.body.innerHTML).toContain('Event full'))
  })

  it('shows no-venue fallback', async () => {
    mockGetEventDetail.mockResolvedValue({ ...detail, venue: null })
    renderDetail()
    await waitFor(() => expect(screen.getByText('To be announced')).toBeTruthy())
  })

  it('shows reschedule section when registered', async () => {
    loginAs('MEMBER')
    mockSchedulesList.mockResolvedValue([{ schedule_id: 10, event_id: 1, member_id: 'test-user', is_active: true }])
    mockSearchEvents.mockResolvedValue([{ event_id: 2, start_date_time: '2027-04-01T09:00:00' }])
    renderDetail()
    await waitFor(() => expect(screen.getByText('Reschedule')).toBeTruthy())
  })

  it('shows no-alternates message when registered but no other events', async () => {
    loginAs('MEMBER')
    mockSchedulesList.mockResolvedValue([{ schedule_id: 10, event_id: 1, member_id: 'test-user', is_active: true }])
    mockSearchEvents.mockResolvedValue([])
    renderDetail()
    await waitFor(() =>
      expect(screen.getByText('No other upcoming events are available right now.')).toBeTruthy(),
    )
  })

  it('register failure shows error and keeps button', async () => {
    loginAs('MEMBER')
    mockRegisterForEvent.mockRejectedValue(new Error('Event is full'))
    renderDetail()
    await waitFor(() => expect(screen.getByText('Register')).toBeTruthy())
    fireEvent.click(screen.getByText('Register'))
    // Confirm in the modal
    const confirm = await screen.findByText('Confirm')
    fireEvent.click(confirm.closest('button')!)
    await waitFor(() => expect(mockRegisterForEvent).toHaveBeenCalledWith(1))
  })

  it('shows toast when schedules list fails', async () => {
    loginAs('MEMBER')
    mockSchedulesList.mockRejectedValue(new Error('boom'))
    renderDetail()
    await waitFor(() => expect(mockSchedulesList).toHaveBeenCalled())
  })

  it('shows toast when alternates search fails', async () => {
    loginAs('MEMBER')
    mockSearchEvents.mockRejectedValue(new Error('boom'))
    renderDetail()
    await waitFor(() => expect(mockSearchEvents).toHaveBeenCalled())
  })

  it('refresh failure after register shows toast', async () => {
    loginAs('MEMBER')
    mockRegisterForEvent.mockResolvedValue({ schedule_id: 42, event_id: 1, member_id: 'test-user', is_active: true })
    mockGetEventDetail.mockResolvedValueOnce(detail).mockRejectedValueOnce(new Error('refresh boom'))
    renderDetail()
    await waitFor(() => expect(screen.getByText('Register')).toBeTruthy())
    fireEvent.click(screen.getByText('Register'))
    // Confirm in the modal
    const confirm = await screen.findByText('Confirm')
    fireEvent.click(confirm.closest('button')!)
    await waitFor(() => expect(mockGetEventDetail).toHaveBeenCalledTimes(2))
  })

  it('reschedules to a selected alternate event', async () => {
    loginAs('MEMBER')
    mockGetEventDetail.mockResolvedValue(detail)
    mockSchedulesList.mockResolvedValue([{ schedule_id: 10, event_id: 1, member_id: 'test-user', is_active: true }])
    mockSearchEvents.mockResolvedValue([
      { event_id: 2, start_date_time: '2027-04-01T09:00:00' },
      { event_id: 3, start_date_time: 'garbage' },
    ])
    mockReschedule.mockResolvedValue({ schedule_id: 10 })
    renderDetail()
    await waitFor(() => expect(screen.getByText('Reschedule')).toBeTruthy())
    fireEvent.click(await screen.findByLabelText(/Select Apr/))
    fireEvent.click(await screen.findByText('Move registration'))
    await waitFor(() => expect(mockReschedule).toHaveBeenCalledWith(10, { event_id: 2 }))
  })

  it('reschedule failure shows error', async () => {
    loginAs('MEMBER')
    mockSchedulesList.mockResolvedValue([{ schedule_id: 10, event_id: 1, member_id: 'test-user', is_active: true }])
    mockSearchEvents.mockResolvedValue([{ event_id: 2, start_date_time: '2027-04-01T09:00:00' }])
    mockReschedule.mockRejectedValue(new Error('nope'))
    renderDetail()
    await waitFor(() => expect(screen.getByText('Reschedule')).toBeTruthy())
    fireEvent.click(await screen.findByLabelText(/Select Apr/))
    fireEvent.click(await screen.findByText('Move registration'))
    await waitFor(() => expect(mockReschedule).toHaveBeenCalled())
  })

  it('renders invalid dates as raw strings', async () => {
    mockGetEventDetail.mockResolvedValue({
      ...detail,
      start_date_time: 'not-a-date',
      end_date_time: 'also-bad',
    })
    renderDetail()
    await waitFor(() => expect(document.body.innerHTML).toContain('not-a-date'))
    expect(document.body.innerHTML).toContain('also-bad')
  })

  it('disables Register when event is full for signed-in user', async () => {
    loginAs('MEMBER')
    mockGetEventDetail.mockResolvedValue({ ...detail, registered_count: 20 })
    renderDetail()
    await waitFor(() => {
      const btn = screen.getByText('Event full').closest('button') as HTMLButtonElement
      expect(btn.hasAttribute('disabled')).toBe(true)
    })
  })

  it('shows registering state while request in flight', async () => {
    loginAs('MEMBER')
    let resolve!: (v: unknown) => void
    mockRegisterForEvent.mockReturnValue(new Promise((r) => { resolve = r }))
    renderDetail()
    await waitFor(() => expect(screen.getByText('Register')).toBeTruthy())
    fireEvent.click(screen.getByText('Register'))
    // Confirm in the modal
    const confirm = await screen.findByText('Confirm')
    fireEvent.click(confirm.closest('button')!)
    await waitFor(() => expect(screen.getByText('Registering…')).toBeTruthy())
    resolve({})
  })
})
