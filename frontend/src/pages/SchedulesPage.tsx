import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { events } from '../api/events.ts'
import { schedules } from '../api/schedules.ts'
import { venues } from '../api/venues.ts'
import type { Event, Schedule, ScheduleInput, Venue } from '../api/types.ts'
import { BulkDeleteBar } from '../components/BulkDeleteBar.tsx'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { EntityFormDialog } from '../components/EntityFormDialog.tsx'
import type { EntityFormField, EntityFormFieldOption } from '../components/EntityFormDialog.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export default function SchedulesPage() {
  const [rows, setRows] = useState<Schedule[]>([])
  const [venueRows, setVenueRows] = useState<Venue[]>([])
  const [eventRows, setEventRows] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  const venueOptions = useMemo<EntityFormFieldOption[]>(
    () =>
      venueRows.map((venue) => ({
        label: `${venue.street}, ${venue.city}`,
        value: venue.venue_id ?? -1,
      })),
    [venueRows],
  )
  const eventOptions = useMemo<EntityFormFieldOption[]>(
    () => eventRows.map((event) => ({ label: formatDateTime(event.start_date_time), value: event.event_id ?? -1 })),
    [eventRows],
  )
  const venueLabels = useMemo(() => {
    const map = new Map<number, string>()
    for (const venue of venueRows) {
      if (venue.venue_id !== undefined) {
        map.set(venue.venue_id, `${venue.street}, ${venue.city}`)
      }
    }
    return map
  }, [venueRows])
  const eventLabels = useMemo(() => {
    const map = new Map<number, string>()
    for (const event of eventRows) {
      if (event.event_id !== undefined) {
        map.set(event.event_id, formatDateTime(event.start_date_time))
      }
    }
    return map
  }, [eventRows])
  const lookup = (map: Map<number, string>, id: number | null | undefined): string =>
    id == null ? '' : map.get(id) ?? String(id)

  const columns: EntityDataTableColumn<Schedule>[] = [
    { field: 'venue_id', header: 'Venue', sortable: true, body: (row) => lookup(venueLabels, row.venue_id) },
    { field: 'member_id', header: 'Member', sortable: true },
    { field: 'event_id', header: 'Event', body: (row) => lookup(eventLabels, row.event_id) },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  const fields: EntityFormField<Schedule>[] = [
    { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: venueOptions },
    { name: 'member_id', label: 'Member (Google sub ID)', type: 'text', required: true, placeholder: 'Google sub ID' },
    { name: 'event_id', label: 'Event', type: 'select', required: true, options: eventOptions },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ]

  const load = async () => {
    setLoading(true)
    try {
      const [scheduleList, venueList, eventList] = await Promise.all([
        schedules.list(),
        venues.list(),
        events.list(),
      ])
      setRows(scheduleList)
      setVenueRows(venueList)
      setEventRows(eventList)
      setSelectedKeys({})
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setDialogVisible(true)
  }

  const openEdit = (row: Schedule) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const input: ScheduleInput = {
      venue_id: typeof values.venue_id === 'number' ? values.venue_id : -1,
      member_id: String(values.member_id ?? '').trim(),
      event_id: typeof values.event_id === 'number' ? values.event_id : -1,
      is_active: values.is_active === true,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await schedules.update(editing.schedule_id!, input)
        showToastSuccess('Schedule updated', 'The schedule was updated.')
      } else {
        await schedules.create(input)
        showToastSuccess('Schedule created', 'The schedule was created.')
      }
      setDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSoftDelete = async (row: Schedule) => {
    try {
      await schedules.delete(row.schedule_id!)
      showToastSuccess('Schedule deleted', 'The schedule was deactivated.')
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDelete = async (row: Schedule) => {
    try {
      await schedules.hardDelete(row.schedule_id!)
      showToastSuccess('Schedule deleted', 'The schedule was permanently deleted.')
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDelete = async () => {
    const selected = rows.filter((row) => selectedKeys[String(row.schedule_id)] === true)
    if (selected.length === 0) {
      return
    }
    try {
      await schedules.deleteBulk(selected)
      showToastSuccess('Schedules deleted', `${selected.length} schedule(s) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  const itemName = (row: Schedule): string =>
    `${lookup(venueLabels, row.venue_id)} / ${lookup(eventLabels, row.event_id)}`

  return (
    <div className="app-crud-page">
      <PageHeader title="Schedules" subtitle="Members assigned to events at venues." onNew={openCreate} newLabel="New Schedule" />
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="No schedules yet."
          hint="Assign a member to an event at a venue to get started."
          icon="pi-users"
          action={
            <Button type="button" onClick={openCreate}>
              <i className="pi pi-plus" />
              <span className="p-button-label">New Schedule</span>
            </Button>
          }
        />
      ) : (
        <>
          <BulkDeleteBar
            count={Object.values(selectedKeys).filter(Boolean).length}
            itemLabel="schedule"
            onBulkDelete={handleBulkDelete}
          />
          <EntityDataTable
            data={rows}
            columns={columns}
            dataKey="schedule_id"
            loading={loading}
            searchableFields={['member_id', 'venue_id', 'event_id']}
            searchPlaceholder="Search schedules..."
            defaultSortField="member_id"
            actionsHeader="Actions"
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            actions={(row) => (
              <div className="app-crud-row-actions">
                <Button
                  type="button"
                  variant="text"
                  iconOnly
                  aria-label="Edit schedule"
                  title="Edit schedule"
                  onClick={() => openEdit(row)}
                >
                  <i className="pi pi-pencil" />
                </Button>
                <ConfirmDelete
                  itemName={itemName(row)}
                  onSoftDelete={() => handleSoftDelete(row)}
                  onHardDelete={() => handleHardDelete(row)}
                />
              </div>
            )}
          />
        </>
      )}
      <EntityFormDialog
        visible={dialogVisible}
        title={editing ? 'Edit Schedule' : 'New Schedule'}
        fields={fields}
        initialValues={
          editing
            ? {
                venue_id: editing.venue_id,
                member_id: editing.member_id,
                event_id: editing.event_id,
                is_active: editing.is_active,
              }
            : { is_active: true }
        }
        onSubmit={handleSubmit}
        onHide={() => setDialogVisible(false)}
        submitting={submitting}
      />
    </div>
  )
}