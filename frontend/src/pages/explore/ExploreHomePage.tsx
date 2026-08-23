/**
 * Public explore home page with address search leading to venues and inline event search results.
 */
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
 * Public landing page for browsing venues/schedules without logging in.
 *
 * Address search leads to the venue grid (`/explore/venues`); event search runs
 * the public `/public/events?q=` free-text search inline and links each result
 * to its detail page (`/explore/events/:id`, Phase C).
 */
export default function ExploreHomePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [addressQuery, setAddressQuery] = useState('')
  const [eventQuery, setEventQuery] = useState('')
  const [eventResults, setEventResults] = useState<PublicEvent[]>([])
  const [eventSearched, setEventSearched] = useState(false)
  const [eventLoading, setEventLoading] = useState(false)

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = addressQuery.trim()
    navigate(q ? `/explore/venues?q=${encodeURIComponent(q)}` : '/explore/venues')
  }

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = eventQuery.trim()
    setEventLoading(true)
    setEventSearched(true)
    try {
      const results = await searchEvents({ q: q || undefined })
      setEventResults(results)
    } catch (error) {
      setEventResults([])
      const message = error instanceof ApiError ? error.message : 'Could not search events'
      toast.error('Event search failed', message)
    } finally {
      setEventLoading(false)
    }
  }

  const renderEventResult = (result: PublicEvent) => (
    <Card.Root key={result.event_id}>
      <Card.Content>
        <div className="explore-event-row">
          <div className="explore-event-info">
            <span className="explore-event-time">{formatDateTime(result.start_date_time)}</span>
            {result.description ? <small className="explore-event-description">{result.description}</small> : null}
            <small className="explore-event-ends">ends {formatDateTime(result.end_date_time)}</small>
          </div>
          <Link to={`/explore/events/${result.event_id}`}>
            <Button type="button" variant="outlined" size="small">
              <span className="p-button-label">View details</span>
            </Button>
          </Link>
        </div>
      </Card.Content>
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
          </nav>
        </header>

        <p className="explore-intro">
          Find a pool by address, browse its schedule, or look up an upcoming event — no sign-in needed.
        </p>

        <Card.Root>
          <Card.Header>
            <Card.Title>Find a venue or event</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="explore-search-form">
              <form className="explore-search-block" onSubmit={submitAddress}>
                <label htmlFor="explore-address" className="explore-search-label">
                  Find by address
                </label>
                <div className="explore-search-row">
                  <InputText
                    id="explore-address"
                    value={addressQuery}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setAddressQuery(event.target.value)}
                    placeholder="Search by street, city, or postal code"
                    className="w-full"
                  />
                  <Button type="submit">
                    <i className="pi pi-search" />
                    <span className="p-button-label">Search</span>
                  </Button>
                </div>
              </form>

              <form className="explore-search-block" onSubmit={submitEvent}>
                <label htmlFor="explore-event" className="explore-search-label">
                  Find by event
                </label>
                <div className="explore-search-row">
                  <InputText
                    id="explore-event"
                    value={eventQuery}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setEventQuery(event.target.value)}
                    placeholder="Search upcoming events by description"
                    className="w-full"
                  />
                  <Button type="submit">
                    <i className="pi pi-search" />
                    <span className="p-button-label">Search</span>
                  </Button>
                </div>
                <small className="explore-hint">
                  Leave blank to list all upcoming events.
                </small>
              </form>
            </div>
          </Card.Content>
        </Card.Root>

        {eventSearched ? (
          <div className="explore-event-list">
            {eventLoading ? (
              <>
                <Skeleton height="4rem" className="w-full" />
                <Skeleton height="4rem" className="w-full" />
              </>
            ) : eventResults.length > 0 ? (
              eventResults.map(renderEventResult)
            ) : (
              <EmptyState
                message="No events found"
                hint="Try a different search term."
                icon="pi-calendar-times"
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}