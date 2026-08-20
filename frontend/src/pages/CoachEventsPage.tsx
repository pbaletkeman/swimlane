import { useCallback, useEffect, useMemo, useState } from 'react'
import { Select } from 'primereact/select'
import { Tag } from 'primereact/tag'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'
import { getEventCapacity, listMine } from '../api/events.ts'
import { facilities } from '../api/facilities.ts'
import { frequencies } from '../api/frequencies.ts'
import { venues } from '../api/venues.ts'
import type { CoachEventScope, Event, EventCapacity, Facility, Frequency, Venue } from '../api/types.ts'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError } from '../toast/toast-context.ts'

const SCOPE_OPTIONS: { label: string; value: CoachEventScope }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
  { label: 'All', value: 'all' },
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function venueLabel(
  venueId: number | null | undefined,
  venueRows: Venue[],
  facilityRows: Facility[],
): string {
  if (venueId == null) return 'No venue'
  const venue = venueRows.find((item) => item.venue_id === venueId)
  if (!venue) return `Venue ${venueId}`
  const facility = facilityRows.find((item) => item.facility_id === venue.facility_id)
  const name = facility?.name ?? 'Unknown facility'
  return `${name} · ${venue.street}, ${venue.city}, ${venue.state} ${venue.postal_code}`
}

function capacityText(cap: EventCapacity | undefined): string {
  if (!cap) return '—'
  return cap.max_capacity == null ? `${cap.registered_count} / ∞` : `${cap.registered_count} / ${cap.max_capacity}`
}

/**
 * Coach "Manage Events" page (Phase F): the coach's own events with an
 * Upcoming / Past / All scope switcher, editable in F.9.2–F.9.3, with a
 * members management drawer in F.9.4.
 */
export default function CoachEventsPage() {
  const [scope, setScope] = useState<CoachEventScope>('upcoming')
  const [rows, setRows] = useState<Event[]>([])
  const [venueRows, setVenueRows] = useState<Venue[]>([])
  const [facilityRows, setFacilityRows] = useState<Facility[]>([])
  const [frequencyRows, setFrequencyRows] = useState<Frequency[]>([])
  const [capacity, setCapacity] = useState<Record<number, EventCapacity>>({})
  const [loading, setLoading] = useState(true)

  const frequencyNames = useMemo(() => {
    const map = new Map<number, string>()
    for (const frequency of frequencyRows) {
      if (frequency.frequency_id !== undefined) {
        map.set(frequency.frequency_id, frequency.name)
      }
    }
    return map
  }, [frequencyRows])
  const frequencyName = (id: number | null | undefined): string =>
    id == null ? '' : frequencyNames.get(id) ?? String(id)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eventRows, venueList, facilityList, frequencyList] = await Promise.all([
        listMine(scope),
        venues.list(),
        facilities.list(),
        frequencies.list(),
      ])
      setRows(eventRows)
      setVenueRows(venueList)
      setFacilityRows(facilityList)
      setFrequencyRows(frequencyList)
      const capMap: Record<number, EventCapacity> = {}
      await Promise.all(
        eventRows.map(async (event) => {
          const cap = await getEventCapacity(event.event_id!).catch(() => null)
          if (cap) {
            capMap[event.event_id!] = cap
          }
        }),
      )
      setCapacity(capMap)
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void load()
  }, [load])

  const columns: EntityDataTableColumn<Event>[] = [
    { field: 'start_date_time', header: 'Start', sortable: true, body: (row) => formatDateTime(row.start_date_time) },
    { field: 'end_date_time', header: 'End', sortable: true, body: (row) => formatDateTime(row.end_date_time) },
    {
      field: 'description',
      header: 'Description',
      body: (row) => row.description ?? '',
    },
    {
      field: 'frequency_id',
      header: 'Frequency',
      body: (row) => frequencyName(row.frequency_id),
    },
    {
      field: 'venue_id',
      header: 'Facility / Venue',
      body: (row) => venueLabel(row.venue_id, venueRows, facilityRows),
    },
    {
      field: 'capacity',
      header: 'Capacity',
      body: (row) => capacityText(capacity[row.event_id!]),
    },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  return (
    <div className="app-crud-page">
      <PageHeader title="Manage Events" subtitle="Your coaching events and their members." />
      <div className="coach-events-toolbar">
        <Select.Root
          value={scope}
          onValueChange={(event: SelectValueChangeEvent) => setScope(event.value as CoachEventScope)}
          options={SCOPE_OPTIONS}
          optionLabel="label"
          optionValue="value"
          className="coach-events-scope"
        >
          <Select.Trigger>
            <Select.Value placeholder="Select scope" />
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
        <span className="coach-events-count">
          {rows.length} event{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      {rows.length === 0 && !loading ? (
        <EmptyState
          message={`No ${scope === 'all' ? '' : `${scope} `}events.`}
          hint={scope === 'past' ? 'Past coaching events will appear here.' : 'New coaching events will appear here.'}
          icon="pi-bolt"
        />
      ) : (
        <EntityDataTable
          data={rows}
          columns={columns}
          dataKey="event_id"
          loading={loading}
          searchableFields={['start_date_time', 'end_date_time', 'description']}
          searchPlaceholder="Search events..."
          defaultSortField="start_date_time"
        />
      )}
    </div>
  )
}