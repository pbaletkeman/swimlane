import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Skeleton } from 'primereact/skeleton'
import { Tag } from 'primereact/tag'
import { getMyCalendarIcs, listMine } from '../api/schedules.ts'
import type { MyScheduleItem } from '../api/types.ts'
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

  const upcoming = (item: MyScheduleItem): boolean => new Date(item.event_start_date_time).getTime() > Date.now()

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
              </Card.Content>
            </Card.Root>
          ))}
        </div>
      )}
    </div>
  )
}