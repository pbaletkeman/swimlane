/**
 * Public venue listing page with address/facility name search and venue card grid.
 */
import { useEffect, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { InputText } from 'primereact/inputtext'
import { Skeleton } from 'primereact/skeleton'
import { ApiError } from '../../api/client.ts'
import { listVenues, searchVenues } from '../../api/public.ts'
import type { PublicVenue } from '../../api/types.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { useToast } from '../../toast/toast-context.ts'

/**
 * Public venue grid. Reads `?q=` from the URL and searches by address substring
 * (or facility name); shows all active venues when no query is present.
 */
export default function ExploreVenuesPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const [venues, setVenues] = useState<PublicVenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const q = urlQuery.trim()
        const result = q ? await searchVenues(q) : await listVenues()
        if (!cancelled) {
          setVenues(result)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : 'Could not load venues'
          toast.error('Failed to load venues', message)
          setVenues([])
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
  }, [urlQuery, toast])

  const applyQuery = (value: string) => {
    const trimmed = value.trim()
    const next = new URLSearchParams(searchParams)
    if (trimmed) {
      next.set('q', trimmed)
    } else {
      next.delete('q')
    }
    setSearchParams(next, { replace: true })
  }

  const renderVenue = (venue: PublicVenue) => (
    <Card.Root key={venue.venue_id} className="explore-venue-card">
      <Card.Header>
        <Card.Title>{venue.facility_name}</Card.Title>
      </Card.Header>
      <Card.Content>
        <p className="explore-venue-card-address">
          {venue.street}
          <br />
          {venue.city}, {venue.state} {venue.postal_code}
        </p>
      </Card.Content>
      <Card.Footer>
        <div className="explore-venue-card-actions">
          <Link to={`/explore/venues/${venue.venue_id}`}>
            <Button type="button" variant="outlined">
              <i className="pi pi-calendar" />
              <span className="p-button-label">View schedule</span>
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
                applyQuery(query)
              }
            }}
            placeholder="Search by address or facility name"
            className="w-full"
          />
          <Button type="button" onClick={() => applyQuery(query)}>
            <i className="pi pi-search" />
            <span className="p-button-label">Search</span>
          </Button>
        </div>

        {loading ? (
          <div className="explore-venue-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="explore-venue-card">
                <Skeleton height="8rem" className="w-full" />
              </div>
            ))}
          </div>
        ) : venues.length > 0 ? (
          <div className="explore-venue-grid">{venues.map(renderVenue)}</div>
        ) : (
          <EmptyState
            message="No venues found"
            hint="Try a different address, city, or facility name."
            icon="pi-map-marker"
          />
        )}
      </div>
    </div>
  )
}