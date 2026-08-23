/**
 * Public event calendar view showing events in a monthly calendar grid.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Skeleton } from 'primereact/skeleton'
import { ApiError } from '../../api/client.ts'
import { searchEvents } from '../../api/public.ts'
import type { PublicEvent } from '../../api/types.ts'
import { useToast } from '../../toast/toast-context.ts'

/** Format a naive ISO datetime like `2026-08-19T09:00:00` for local display. */
function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Group events by date (YYYY-MM-DD) */
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

/** Get all days in a month including padding days from prev/next month */
function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay() // 0 = Sunday
  const endDay = lastDay.getDay()

  const days: Date[] = []

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthLastDay - i))
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // Next month padding
  for (let d = 1; d < 7 - endDay; d++) {
    days.push(new Date(year, month + 1, d))
  }

  return days
}

function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Public event calendar page showing a monthly grid of events.
 */
export default function EventCalendarPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const urlMonth = searchParams.get('month')
    if (urlMonth) {
      const [y, m] = urlMonth.split('-').map(Number)
      return new Date(y, m, 1)
    }
    return new Date()
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const result = await searchEvents()
        if (!cancelled) {
          setEvents(result)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : 'Could not load events'
          toast.error('Failed to load events', message)
          setEvents([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [toast])

  const navigateMonth = (delta: number) => {
    const next = new Date(currentMonth)
    next.setMonth(currentMonth.getMonth() + delta)
    setCurrentMonth(next)
    const monthStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    setSearchParams({ month: monthStr }, { replace: true })
  }

  const monthName = currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })
  const calendarDays = getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth())
  const eventsByDate = groupEventsByDate(events)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
            <Link to="/explore/calendar" className="explore-nav-link active">
              Calendar
            </Link>
          </nav>
        </header>

        <div className="calendar-header">
          <h1>Event Calendar</h1>
          <div className="calendar-nav">
            <Button type="button" icon="pi pi-chevron-left" variant="outlined" onClick={() => navigateMonth(-1)} />
            <span className="calendar-month">{monthName}</span>
            <Button type="button" icon="pi pi-chevron-right" variant="outlined" onClick={() => navigateMonth(1)} />
          </div>
        </div>

        {loading ? (
          <div className="calendar-grid">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="calendar-day skeleton">
                <Skeleton height="8rem" className="w-full" />
              </div>
            ))}
          </div>
        ) : (
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
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
              const isToday = day.getTime() === today.getTime()

              return (
                <div
                  key={index}
                  className={`calendar-day ${isCurrentMonth ? '' : 'calendar-day-other'} ${isToday ? 'calendar-day-today' : ''}`}
                >
                  <div className="calendar-day-number">{day.getDate()}</div>
                  {dayEvents.length > 0 && (
                    <div className="calendar-day-events">
                      {dayEvents.slice(0, 3).map((event) => (
                        <Link key={event.event_id} to={`/explore/events/${event.event_id}`} className="calendar-event">
                          <span className="calendar-event-time">{formatTime(event.start_date_time)}</span>
                          <span className="calendar-event-title">{event.description || 'Event'}</span>
                        </Link>
                      ))}
                      {dayEvents.length > 3 && (
                        <Link to={`/explore/events?from=${isoDate}&to=${isoDate}`} className="calendar-event-more">
                          +{dayEvents.length - 3} more
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}