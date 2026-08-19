import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from 'primereact/card'
import { Skeleton } from 'primereact/skeleton'
import { ApiError } from '../../api/client.ts'
import { getEventDetail } from '../../api/public.ts'
import type { PublicEventDetail } from '../../api/types.ts'
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
 * Public single-event detail page (Phase C): description, times, venue and live
 * capacity. Registration and reschedule actions are added in C.12.2–C.12.4.
 */
export default function EventDetailPage() {
  const toast = useToast()
  const { eventId } = useParams<{ eventId: string }>()
  const id = Number(eventId)

  const [detail, setDetail] = useState<PublicEventDetail | null>(null)
  const [eventMissing, setEventMissing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEventMissing(false)

    const load = async () => {
      if (!Number.isInteger(id) || id <= 0) {
        if (!cancelled) {
          setEventMissing(true)
        }
        return
      }
      try {
        const result = await getEventDetail(id)
        if (!cancelled) {
          setDetail(result)
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 404) {
            setEventMissing(true)
          } else {
            const message = error instanceof ApiError ? error.message : 'Could not load event'
            toast.error('Failed to load event', message)
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

  if (eventMissing || !detail) {
    return (
      <div className="explore-page">
        <div className="explore-container">
          <header className="explore-header">
            <Link to="/explore" className="explore-back-link">
              <i className="pi pi-arrow-left" />
              <span>Back to explore</span>
            </Link>
          </header>
          <EmptyState message="Event not found" hint="It may have been removed or deactivated." icon="pi-calendar-times" />
        </div>
      </div>
    )
  }

  const max = detail.max_capacity
  const registered = detail.registered_count
  const full = max !== null && registered >= max
  const pct = max ? Math.min(100, Math.round((registered / max) * 100)) : 0

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

        <Link to="/explore" className="explore-back-link">
          <i className="pi pi-arrow-left" />
          <span>Back to explore</span>
        </Link>

        <Card.Root>
          <Card.Header>
            <Card.Title>{detail.description || 'Event details'}</Card.Title>
          </Card.Header>
          <Card.Content>
            <dl className="explore-event-meta">
              <div>
                <dt>Starts</dt>
                <dd>{formatDateTime(detail.start_date_time)}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{formatDateTime(detail.end_date_time)}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>
                  {detail.venue
                    ? `${detail.venue.facility_name} — ${detail.venue.street}, ${detail.venue.city}, ${detail.venue.state}`
                    : 'To be announced'}
                </dd>
              </div>
            </dl>

            <div className="explore-capacity">
              <div className="explore-capacity-label">
                <span>Registration</span>
                <span>
                  {registered} / {max === null ? 'unlimited' : max} registered{full ? ' — full' : ''}
                </span>
              </div>
              {max !== null ? (
                <div className="explore-capacity-track">
                  <div className="explore-capacity-fill" style={{ width: `${pct}%` }} />
                </div>
              ) : null}
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  )
}
