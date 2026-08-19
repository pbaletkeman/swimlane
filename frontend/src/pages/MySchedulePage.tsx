import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Skeleton } from 'primereact/skeleton'
import { Select } from 'primereact/select'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'
import { Tag } from 'primereact/tag'
import { getMyCalendarIcs, cancelRegistration, listMine, reschedule } from '../api/schedules.ts'
import type { MyScheduleItem, PublicEvent } from '../api/types.ts'
import { searchEvents } from '../api/public.ts'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

/** Format a naive ISO datetime like `2026-08-19T09:00:00` for local display. */
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function venueAddress(item: MyScheduleItem): string {
  return `${item.street}, ${item.city}, ${item.state} ${item.postal_code}`
}

/**
 * Member "My Schedule" page (Phase D): lists the signed-in member's upcoming
 * scheduled events with facility, venue, and time detail.
 */
export default function MySchedulePage() {
  const [items, setItems] = useState<MyScheduleItem[]>([])
  const [alternates, setAlternates] = useState<PublicEvent[]>([])
  const [targets, setTargets] = useState<Record<number, number | null>>({})
  const [movingId, setMovingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setItems(await listMine())
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadAlternates = async () => {
      try {
        const upcoming = await searchEvents()
        if (!cancelled) {
          setAlternates(upcoming)
        }
      } catch {
        // Non-fatal: reschedule just won't offer choices.
      }
    }
    void loadAlternates()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const text = await getMyCalendarIcs()
      const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'swimlane-calendar.ics'
      anchor.click()
      URL.revokeObjectURL(url)
      showToastSuccess('Calendar downloaded', 'Your schedule was exported as an .ics file.')
    } catch (error) {
      showToastError('Download failed', errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const handleReschedule = async (item: MyScheduleItem) => {
    const target = targets[item.schedule_id]
    if (target == null) {
      return
    }
    setMovingId(item.schedule_id)
    try {
      await reschedule(item.schedule_id, { event_id: target })
      showToastSuccess('Rescheduled', 'Your registration was moved to the selected event.')
      await load()
    } catch (error) {
      showToastError('Reschedule failed', errorMessage(error))
    } finally {
      setMovingId(null)
    }
  }

  const handleCancel = async (item: MyScheduleItem) => {
    try {
      await cancelRegistration(item.schedule_id)
      showToastSuccess('Registration cancelled', 'Your registration was cancelled.')
      await load()
    } catch (error) {
      showToastError('Cancel failed', errorMessage(error))
    }
  }

  const upcoming = (item: MyScheduleItem): boolean => new Date(item.event_start_date_time).getTime() > Date.now()
  const registeredEventIds = new Set(items.map((item) => item.event_id))
  const alternateOptions = alternates
    .filter((event) => !registeredEventIds.has(event.event_id))
    .map((event) => ({ label: formatDateTime(event.start_date_time), value: event.event_id }))

  return (
    <div className="app-crud-page">
      <PageHeader title="My Schedule" subtitle="Your upcoming registered events." />
      <div className="my-schedule-toolbar">
        <p className="my-schedule-reschedule-hint">Add your schedule to a calendar app such as Google Calendar or Apple Calendar.</p>
        <Button type="button" variant="outlined" onClick={handleDownload} disabled={downloading || items.length === 0}>
          <i className="pi pi-calendar-plus" />
          <span className="p-button-label">{downloading ? 'Downloading…' : 'Add to calendar (iCal)'}</span>
        </Button>
      </div>
      {loading ? (
        <div className="my-schedule-loading">
          <Skeleton height="5rem" className="w-full" />
          <Skeleton height="5rem" className="w-full" />
          <Skeleton height="5rem" className="w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          message="No upcoming registrations."
          hint="Browse public events and register to see them here."
          icon="pi-calendar-plus"
        />
      ) : (
        <div className="my-schedule-list">
          {items.map((item) => (
            <Card.Root key={item.schedule_id} className="my-schedule-card">
              <Card.Header>
                <div className="my-schedule-card-head">
                  <h2 className="my-schedule-card-title">{item.facility_name}</h2>
                  <Tag severity={upcoming(item) ? 'success' : 'secondary'} rounded>
                    {upcoming(item) ? 'Upcoming' : 'Past'}
                  </Tag>
                </div>
              </Card.Header>
              <Card.Content>
                <div className="my-schedule-meta">
                  <div className="my-schedule-meta-row">
                    <i className="pi pi-calendar" />
                    <span>
                      {formatDateTime(item.event_start_date_time)} — {formatDateTime(item.event_end_date_time)}
                    </span>
                  </div>
                  <div className="my-schedule-meta-row">
                    <i className="pi pi-map-marker" />
                    <span>{venueAddress(item)}</span>
                  </div>
                  {item.event_description ? (
                    <p className="my-schedule-description">{item.event_description}</p>
                  ) : null}
                </div>
                {upcoming(item) ? (
                  <>
                    <hr className="my-schedule-divider" />
                    {alternateOptions.length > 0 ? (
                      <div className="my-schedule-reschedule-controls">
                        <Select.Root
                          value={targets[item.schedule_id] ?? null}
                          onValueChange={(event: SelectValueChangeEvent) =>
                            setTargets((current) => ({
                              ...current,
                              [item.schedule_id]: event.value as number | null,
                            }))
                          }
                          options={alternateOptions}
                          optionLabel="label"
                          optionValue="value"
                          className="my-schedule-view-select"
                        >
                          <Select.Trigger>
                            <Select.Value placeholder="Reschedule to…" />
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
                        <Button
                          type="button"
                          variant="outlined"
                          onClick={() => handleReschedule(item)}
                          disabled={targets[item.schedule_id] == null || movingId === item.schedule_id}
                        >
                          <i className="pi pi-calendar" />
                          <span className="p-button-label">
                            {movingId === item.schedule_id ? 'Moving…' : 'Move'}
                          </span>
                        </Button>
                      </div>
                    ) : (
                      <p className="my-schedule-reschedule-hint">No other upcoming events are available right now.</p>
                    )}
                    <div className="my-schedule-actions">
                      <ConfirmDelete
                        itemName={`your registration at ${item.facility_name}`}
                        softLabel="Cancel this registration"
                        onSoftDelete={() => handleCancel(item)}
                      />
                    </div>
                  </>
                ) : null}
              </Card.Content>
            </Card.Root>
          ))}
        </div>
      )}
    </div>
  )
}