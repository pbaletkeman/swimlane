/**
 * Public venue schedule page with week, month, and event-list view modes.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { DatePicker } from 'primereact/datepicker'
import { Skeleton } from 'primereact/skeleton'
import { Select } from 'primereact/select'
import type { DatePickerRootValueChangeEvent } from '@primereact/types/primitive/datepicker'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'
import { ApiError } from '../../api/client.ts'
import { getVenue, getVenueSchedules } from '../../api/public.ts'
import type { ScheduleView } from '../../api/public.ts'
import type { PublicEvent, PublicVenue } from '../../api/types.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { useToast } from '../../toast/toast-context.ts'

const VIEW_OPTIONS: { label: string; value: ScheduleView }[] = [
  { label: 'Month', value: 'month' },
  { label: 'Week', value: 'week' },
  { label: 'Event list', value: 'list' },
]

/** Format a naive ISO datetime like `2026-08-19T09:00:00` for local display. */
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Format a naive ISO datetime for time-only display in calendar cells. */
function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Format a `Date` as a local `YYYY-MM-DD` string (API date anchor). */
function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

/** Format a `Date` as `YYYY-MM-DD` for grouping events by day. */
function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Group events by date (YYYY-MM-DD). */
function groupEventsByDate(events: PublicEvent[]): Map<string, PublicEvent[]> {
  const map = new Map<string, PublicEvent[]>()
  for (const event of events) {
    const date = event.start_date_time.split('T')[0]
    if (!map.has(date)) {
      map.set(date, [])
    }
    map.get(date)!.push(event)
  }
  return map
}

/** Get all days in a month including padding days from prev/next month. */
function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay()
  const endDay = lastDay.getDay()

  const days: Date[] = []
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthLastDay - i))
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  for (let d = 1; d < 7 - endDay; d++) {
    days.push(new Date(year, month + 1, d))
  }
  return days
}

/**
 * Public venue schedule page. Month (default) / Week / Event-list views backed
 * by a date anchor; each event row links to its detail page.
 */
export default function VenueSchedulePage() {
  const toast = useToast()
  const { venueId } = useParams<{ venueId: string }>()
  const id = Number(venueId)

  const [venue, setVenue] = useState<PublicVenue | null>(null)
  const [venueMissing, setVenueMissing] = useState(false)
  const [view, setView] = useState<ScheduleView>('month')
  const [date, setDate] = useState<Date | null>(new Date())
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setVenueMissing(false)

    const load = async () => {
      try {
        const venueResult = await getVenue(id)
        if (!cancelled) {
          setVenue(venueResult)
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 404) {
            setVenueMissing(true)
          } else {
            const message = error instanceof ApiError ? error.message : 'Could not load venue'
            toast.error('Failed to load venue', message)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, toast])

  useEffect(() => {
    if (venueMissing) {
      return
    }
    let cancelled = false

    const load = async () => {
      try {
        const dateAnchor = date ? toIsoDate(date) : undefined
        const result = await getVenueSchedules(id, { view, date: dateAnchor })
        if (!cancelled) {
          setEvents(result)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : 'Could not load schedule'
          toast.error('Failed to load schedule', message)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, view, date, venueMissing, toast])

  const renderEvent = (event: PublicEvent) => (
    <Card.Root key={event.event_id}>
      <Card.Content>
        <div className="explore-event-row">
          <div className="explore-event-info">
            <span className="explore-event-time">{formatDateTime(event.start_date_time)}</span>
            <small className="explore-event-ends">ends {formatDateTime(event.end_date_time)}</small>
          </div>
          <Link to={`/explore/events/${event.event_id}`}>
            <Button type="button" variant="outlined" size="small">
              <span className="p-button-label">View details</span>
            </Button>
          </Link>
        </div>
      </Card.Content>
    </Card.Root>
  )

  const renderCalendar = () => {
    const anchor = date || new Date()
    const calendarDays = getCalendarDays(anchor.getFullYear(), anchor.getMonth())
    const eventsByDate = groupEventsByDate(events)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthName = anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' })

    return (
      <div className="venue-schedule-calendar">
        <div className="calendar-header">
          <span className="calendar-month">{monthName}</span>
        </div>
        <div className="calendar-grid">
          <div className="calendar-weekday">Sun</div>
          <div className="calendar-weekday">Mon</div>
          <div className="calendar-weekday">Tue</div>
          <div className="calendar-weekday">Wed</div>
          <div className="calendar-weekday">Thu</div>
          <div className="calendar-weekday">Fri</div>
          <div className="calendar-weekday">Sat</div>
          {calendarDays.map((day, index) => {
            const isoDate = formatISODate(day)
            const dayEvents = eventsByDate.get(isoDate) || []
            const isCurrentMonth = day.getMonth() === anchor.getMonth()
            const isToday = day.getTime() === today.getTime()

            return (
              <div
                key={index}
                className={`calendar-day ${isCurrentMonth ? '' : 'calendar-day-other'} ${isToday ? 'calendar-day-today' : ''}`}
              >
                <div className="calendar-day-number">{day.getDate()}</div>
                {dayEvents.length > 0 && (
                  <div className="calendar-day-events">
                    {dayEvents.map((event) => (
                      <Link key={event.event_id} to={`/explore/events/${event.event_id}`} className="calendar-event">
                        <span className="calendar-event-time">{formatTime(event.start_date_time)}</span>
                        <span className="calendar-event-title">{event.description || 'Event'}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="explore-page">
        <div className="explore-container">
          <Skeleton height="3rem" className="w-full" />
          <Skeleton height="8rem" className="w-full" />
          <Skeleton height="8rem" className="w-full" />
        </div>
      </div>
    )
  }

  if (venueMissing || !venue) {
    return (
      <div className="explore-page">
        <div className="explore-container">
          <header className="explore-header">
            <Link to="/explore/venues" className="explore-back-link">
              <i className="pi pi-arrow-left" />
              <span>Back to venues</span>
            </Link>
          </header>
          <EmptyState message="Venue not found" hint="It may have been removed or deactivated." icon="pi-map-marker" />
        </div>
      </div>
    )
  }

  return (
    <div className="explore-page">
      <div className="explore-container">
        <header className="explore-header">
          <Link to="/" className="explore-brand">
            <i className="pi pi-home" />
            <span>Swimlane</span>
          </Link>
          <nav className="explore-nav">
            <Link to="/explore" className="explore-nav-link">
              Explore
            </Link>
            <Link to="/explore/venues" className="explore-nav-link">
              Venues
            </Link>
            <Link to="/explore/events" className="explore-nav-link">
              Events
            </Link>
            <Link to="/explore/calendar" className="explore-nav-link">
              Calendar
            </Link>
          </nav>
        </header>

        <Link to="/explore/venues" className="explore-back-link">
          <i className="pi pi-arrow-left" />
          <span>Back to venues</span>
        </Link>

        <Card.Root>
          <Card.Header>
            <Card.Title>{venue.facility_name}</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="m-0">
              {venue.street}, {venue.city}, {venue.state} {venue.postal_code}
            </p>
          </Card.Content>
        </Card.Root>

        <div className="explore-schedule-controls">
          <Select.Root
            value={view}
            onValueChange={(event: SelectValueChangeEvent) => setView(event.value as ScheduleView)}
            options={VIEW_OPTIONS}
            optionLabel="label"
            optionValue="value"
            className="explore-view-select"
          >
            <Select.Trigger>
              <Select.Value placeholder="Select view" />
              <Select.Indicator>
                <i className="pi pi-chevron-down" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.List />
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>

          <DatePicker.Root
            value={date}
            onValueChange={(event: DatePickerRootValueChangeEvent) => {
              const next =
                event.value instanceof Date
                  ? event.value
                  : typeof event.value === 'string'
                    ? new Date(event.value)
                    : null
              setDate(next)
            }}
            selectionMode="single"
          >
            <DatePicker.Input placeholder="Pick a date" />
            <DatePicker.Trigger>
              <i className="pi pi-calendar" />
            </DatePicker.Trigger>
            <DatePicker.Portal>
              <DatePicker.Positioner>
                <DatePicker.Popup>
                  <DatePicker.Calendar>
                    <DatePicker.Header>
                      <DatePicker.Title />
                      <DatePicker.SelectMonth />
                      <DatePicker.SelectYear />
                      <DatePicker.Prev>
                        <i className="pi pi-chevron-left" />
                      </DatePicker.Prev>
                      <DatePicker.Next>
                        <i className="pi pi-chevron-right" />
                      </DatePicker.Next>
                    </DatePicker.Header>
                    <DatePicker.Table>
                      <DatePicker.TableHead />
                      <DatePicker.TableBody view="date" />
                    </DatePicker.Table>
                    <DatePicker.Footer>
                      <DatePicker.Buttonbar>
                        <DatePicker.Today />
                        <DatePicker.Clear />
                      </DatePicker.Buttonbar>
                    </DatePicker.Footer>
                  </DatePicker.Calendar>
                </DatePicker.Popup>
              </DatePicker.Positioner>
            </DatePicker.Portal>
          </DatePicker.Root>
        </div>

        {view === 'month' ? (
          events.length > 0 ? (
            renderCalendar()
          ) : (
            <EmptyState message="No events this month" hint="Try switching to a different month or view." icon="pi-calendar-times" />
          )
        ) : events.length > 0 ? (
          <div className="explore-event-list">{events.map(renderEvent)}</div>
        ) : (
          <EmptyState message="No events in this view" hint="Try switching to a different view or date." icon="pi-calendar-times" />
        )}
      </div>
    </div>
  )
}
