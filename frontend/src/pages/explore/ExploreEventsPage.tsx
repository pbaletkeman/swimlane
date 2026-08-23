/**
 * Public event listing page with search/filter and event card grid.
 */
import { useEffect, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { InputText } from 'primereact/inputtext'
import { Skeleton } from 'primereact/skeleton'
import { ApiError } from '../../api/client.ts'
import { searchEvents } from '../../api/public.ts'
import type { PublicEvent } from '../../api/types.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { useToast } from '../../toast/toast-context.ts'

/** Format a naive ISO datetime like `2026-08-19T09:00:00` for local display. */
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Public event grid. Reads `?q=`, `?from=`, `?to=` from the URL and searches
 * upcoming active events; shows all upcoming active events when no query is present.
 */
export default function ExploreEventsPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const urlFrom = searchParams.get('from') ?? ''
  const urlTo = searchParams.get('to') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [from, setFrom] = useState(urlFrom)
  const [to, setTo] = useState(urlTo)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const q = urlQuery.trim()
        const result = await searchEvents({
          q: q || undefined,
          from: urlFrom || undefined,
          to: urlTo || undefined,
        })
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
    return () => {
      cancelled = true
    }
  }, [urlQuery, urlFrom, urlTo, toast])

  const applyQuery = (q: string, f: string, t: string) => {
    const next = new URLSearchParams(searchParams)
    if (q.trim()) {
      next.set('q', q.trim())
    } else {
      next.delete('q')
    }
    if (f.trim()) {
      next.set('from', f.trim())
    } else {
      next.delete('from')
    }
    if (t.trim()) {
      next.set('to', t.trim())
    } else {
      next.delete('to')
    }
    setSearchParams(next, { replace: true })
  }

  const renderEvent = (event: PublicEvent) => (
    <Card.Root key={event.event_id} className="explore-event-card">
      <Card.Header>
        <Card.Title>{event.description || 'Event details'}</Card.Title>
      </Card.Header>
      <Card.Content>
        <dl className="explore-event-meta">
          <div>
            <dt>Starts</dt>
            <dd>{formatDateTime(event.start_date_time)}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{formatDateTime(event.end_date_time)}</dd>
          </div>
        </dl>
      </Card.Content>
      <Card.Footer>
        <div className="explore-event-card-actions">
          <Link to={`/explore/events/${event.event_id}`}>
            <Button type="button" variant="outlined">
              <i className="pi pi-calendar" />
              <span className="p-button-label">View details</span>
            </Button>
          </Link>
        </div>
      </Card.Footer>
    </Card.Root>
  )

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

        <div className="explore-search-row">
          <InputText
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                applyQuery(query, from, to)
              }
            }}
            placeholder="Search by event description"
            className="w-full"
          />
          <InputText
            type="date"
            value={from}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setFrom(event.target.value)}
            className="explore-date-input"
          />
          <InputText
            type="date"
            value={to}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTo(event.target.value)}
            className="explore-date-input"
          />
          <Button type="button" onClick={() => applyQuery(query, from, to)}>
            <i className="pi pi-search" />
            <span className="p-button-label">Search</span>
          </Button>
        </div>

        {loading ? (
          <div className="explore-event-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="explore-event-card">
                <Skeleton height="8rem" className="w-full" />
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="explore-event-grid">{events.map(renderEvent)}</div>
        ) : (
          <EmptyState
            message="No events found"
            hint="Try a different search term or date range."
            icon="pi-calendar-times"
          />
        )}
      </div>
    </div>
  )
}