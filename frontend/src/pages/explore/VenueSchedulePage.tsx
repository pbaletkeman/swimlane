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
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
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

/** Format a `Date` as a local `YYYY-MM-DD` string (API date anchor). */
function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

/**
 * Public venue schedule page. Week (default) / Month / Event-list views backed
 * by a date anchor; each event row links to its detail page (Phase C).
 */
export default function VenueSchedulePage() {
  const toast = useToast()
  const { venueId } = useParams<{ venueId: string }>()
  const id = Number(venueId)

  const [venue, setVenue] = useState<PublicVenue | null>(null)
  const [venueMissing, setVenueMissing] = useState(false)
  const [view, setView] = useState<ScheduleView>('week')
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
        <div className="flex align-items-center justify-content-between gap-3 flex-wrap">
          <div className="flex flex-column gap-1">
            <span className="font-semibold">{formatDateTime(event.start_date_time)}</span>
            <small className="text-color-secondary">ends {formatDateTime(event.end_date_time)}</small>
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

  if (loading) {
    return (
      <div className="flex flex-column align-items-center w-full p-3">
        <div className="w-full flex flex-column gap-3" style={{ maxWidth: '64rem' }}>
          <Skeleton height="3rem" className="w-full" />
          <Skeleton height="8rem" className="w-full" />
          <Skeleton height="8rem" className="w-full" />
        </div>
      </div>
    )
  }

  if (venueMissing || !venue) {
    return (
      <div className="flex flex-column align-items-center w-full p-3">
        <div className="w-full flex flex-column gap-3" style={{ maxWidth: '64rem' }}>
          <header className="flex align-items-center gap-3">
            <Link to="/explore/venues" className="flex align-items-center gap-2">
              <i className="pi pi-arrow-left" />
              <span>Back to venues</span>
            </Link>
          </header>
          <EmptyState
            message="Venue not found"
            hint="It may have been removed or deactivated."
            icon="pi-map-marker"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-column align-items-center w-full p-3">
      <div className="w-full flex flex-column gap-3" style={{ maxWidth: '64rem' }}>
        <header className="flex align-items-center justify-content-between gap-3">
          <Link to="/" className="flex align-items-center gap-2">
            <i className="pi pi-home" />
            <span className="font-bold">Swimlane</span>
          </Link>
          <nav className="flex align-items-center gap-3">
            <Link to="/explore">Explore</Link>
            <Link to="/explore/venues">Venues</Link>
          </nav>
        </header>

        <div className="flex align-items-center gap-2 flex-wrap">
          <Link to="/explore/venues" className="flex align-items-center gap-2">
            <i className="pi pi-arrow-left" />
            <span>Back to venues</span>
          </Link>
        </div>

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

        <div className="flex align-items-center gap-3 flex-wrap">
          <Select.Root
            value={view}
            onValueChange={(event: SelectValueChangeEvent) => setView(event.value as ScheduleView)}
            options={VIEW_OPTIONS}
            optionLabel="label"
            optionValue="value"
            className="w-12rem"
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

        {events.length > 0 ? (
          <div className="flex flex-column gap-2">{events.map(renderEvent)}</div>
        ) : (
          <EmptyState
            message="No events in this view"
            hint="Try switching to a different view or date."
            icon="pi-calendar-times"
          />
        )}
      </div>
    </div>
  )
}