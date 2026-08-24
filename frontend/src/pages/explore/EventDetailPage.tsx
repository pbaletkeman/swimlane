/**
 * Public event detail page showing description, schedule, venue, live capacity, and registration.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Skeleton } from 'primereact/skeleton'
import { Select } from 'primereact/select'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'
import { ApiError } from '../../api/client.ts'
import { getEventDetail, searchEvents } from '../../api/public.ts'
import { registerForEvent } from '../../api/events.ts'
import { cancelRegistration, reschedule, schedules } from '../../api/schedules.ts'
import type { PublicEvent, Schedule } from '../../api/types.ts'
import type { PublicEventDetail } from '../../api/types.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { useAuth } from '../../auth/auth-context.ts'
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
 * Public single-event detail page: description, times, venue and live
 * capacity. Registration, unregister, and reschedule actions.
 */
export default function EventDetailPage() {
  const toast = useToast()
  const { user, accessToken } = useAuth()
  const { eventId } = useParams<{ eventId: string }>()
  const id = Number(eventId)

  const [detail, setDetail] = useState<PublicEventDetail | null>(null)
  const [eventMissing, setEventMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mySchedule, setMySchedule] = useState<Schedule | null>(null)
  const [alternates, setAlternates] = useState<PublicEvent[]>([])
  const [targetEventId, setTargetEventId] = useState<number | null>(null)
  const [registering, setRegistering] = useState(false)
  const [unregistering, setUnregistering] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false)
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false)

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

  useEffect(() => {
    if (!accessToken || !user) {
      setMySchedule(null)
      setAlternates([])
      return
    }
    let cancelled = false

    const load = async () => {
      try {
        const result = await schedules.list()
        if (!cancelled) {
          const mine = result.find(
            (schedule) => schedule.is_active && schedule.event_id === id && schedule.member_id === user.sub,
          )
          setMySchedule(mine ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : 'Could not load your registration'
          toast.error('Failed to load registration', message)
        }
      }

      try {
        const upcoming = await searchEvents()
        if (!cancelled) {
          setAlternates(upcoming.filter((event) => event.event_id !== id))
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : 'Could not load other events'
          toast.error('Failed to load events', message)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, accessToken, user, toast])

  const refreshDetail = async () => {
    try {
      setDetail(await getEventDetail(id))
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not refresh event'
      toast.error('Failed to refresh event', message)
    }
  }

  const handleRegister = async () => {
    setShowRegisterConfirm(false)
    setRegistering(true)
    try {
      const created = await registerForEvent(id)
      setMySchedule(created as Schedule)
      toast.success('Registered', 'You are registered for this event.')
      await refreshDetail()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not register for this event'
      toast.error('Registration failed', message)
    } finally {
      setRegistering(false)
    }
  }

  const handleUnregister = async () => {
    if (!mySchedule?.schedule_id) return
    setShowUnregisterConfirm(false)
    setUnregistering(true)
    try {
      await cancelRegistration(mySchedule.schedule_id)
      setMySchedule(null)
      toast.success('Unregistered', 'Your registration has been cancelled.')
      await refreshDetail()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not cancel registration'
      toast.error('Unregister failed', message)
    } finally {
      setUnregistering(false)
    }
  }

  const handleReschedule = async () => {
    if (!mySchedule?.schedule_id || targetEventId === null) {
      return
    }
    setRescheduling(true)
    try {
      await reschedule(mySchedule.schedule_id, { event_id: targetEventId })
      setMySchedule(null)
      setTargetEventId(null)
      toast.success('Rescheduled', 'Your registration was moved to the selected event.')
      await refreshDetail()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not reschedule'
      toast.error('Reschedule failed', message)
    } finally {
      setRescheduling(false)
    }
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
  const registeredForThisEvent = Boolean(mySchedule)
  const signedIn = Boolean(accessToken)
  const alternateOptions = alternates.map((event) => ({
    label: formatDateTime(event.start_date_time),
    value: event.event_id,
  }))

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
                  {detail.venue ? (
                    <>
                      {detail.venue.facility_name} — {detail.venue.street}, {detail.venue.city}, {detail.venue.state}
                      <Link to={`/explore/venues/${detail.venue.venue_id}`} className="explore-venue-link">
                        <i className="pi pi-calendar" />
                        <span>View all events at this venue</span>
                      </Link>
                    </>
                  ) : (
                    'To be announced'
                  )}
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

            <div className="explore-actions">
              {signedIn ? (
                registeredForThisEvent ? (
                  <>
                    <span className="explore-registered-note">
                      <i className="pi pi-check-circle" />
                      <span>You are registered for this event.</span>
                    </span>
                    <Button
                      type="button"
                      severity="danger"
                      variant="outlined"
                      onClick={() => setShowUnregisterConfirm(true)}
                      disabled={unregistering}
                      loading={unregistering}
                    >
                      <span className="p-button-label">Unregister</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setShowRegisterConfirm(true)}
                    disabled={full || registering}
                    loading={registering}
                  >
                    <span className="p-button-label">
                      {registering ? 'Registering…' : full ? 'Event full' : 'Register'}
                    </span>
                  </Button>
                )
              ) : (
                <Link to={`/login?frontend_url=${encodeURIComponent(window.location.origin)}`}>
                  <Button type="button" variant="outlined">
                    <span className="p-button-label">Sign in to register</span>
                  </Button>
                </Link>
              )}
            </div>
          </Card.Content>
        </Card.Root>

        {registeredForThisEvent ? (
          <Card.Root>
            <Card.Header>
              <Card.Title>Reschedule</Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="explore-hint">
                Your current registration is for the event above. Move it to a different upcoming event below.
              </p>
              {alternates.length > 0 ? (
                <div className="explore-reschedule-controls">
                  <Select.Root
                    value={targetEventId}
                    onValueChange={(event: SelectValueChangeEvent) => setTargetEventId(event.value as number | null)}
                    options={alternateOptions}
                    optionLabel="label"
                    optionValue="value"
                    className="explore-view-select"
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select an event" />
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
                  <Button type="button" onClick={handleReschedule} disabled={targetEventId === null || rescheduling}>
                    <span className="p-button-label">{rescheduling ? 'Moving…' : 'Move registration'}</span>
                  </Button>
                </div>
              ) : (
                <p className="explore-hint">No other upcoming events are available right now.</p>
              )}
            </Card.Content>
          </Card.Root>
        ) : null}
      </div>

      {/* Register confirmation modal */}
      {showRegisterConfirm && (
        <div className="explore-modal-backdrop" onClick={() => setShowRegisterConfirm(false)}>
          <div className="explore-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="explore-modal-title">Confirm Registration</h3>
            <p>
              Register for <strong>{detail.description || 'this event'}</strong>?
            </p>
            <p className="explore-hint">
              Starts: {formatDateTime(detail.start_date_time)}
              <br />
              Ends: {formatDateTime(detail.end_date_time)}
            </p>
            <div className="explore-modal-actions">
              <Button type="button" variant="text" onClick={() => setShowRegisterConfirm(false)}>
                <span className="p-button-label">Cancel</span>
              </Button>
              <Button type="button" onClick={handleRegister} disabled={registering} loading={registering}>
                <i className="pi pi-check" />
                <span className="p-button-label">Confirm</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unregister confirmation modal */}
      {showUnregisterConfirm && (
        <div className="explore-modal-backdrop" onClick={() => setShowUnregisterConfirm(false)}>
          <div className="explore-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="explore-modal-title">Cancel Registration?</h3>
            <p>
              Are you sure you want to unregister from <strong>{detail.description || 'this event'}</strong>?
            </p>
            <p className="explore-hint">This action cannot be undone.</p>
            <div className="explore-modal-actions">
              <Button type="button" variant="text" onClick={() => setShowUnregisterConfirm(false)}>
                <span className="p-button-label">Keep registration</span>
              </Button>
              <Button type="button" severity="danger" onClick={handleUnregister} disabled={unregistering} loading={unregistering}>
                <i className="pi pi-times" />
                <span className="p-button-label">Unregister</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
