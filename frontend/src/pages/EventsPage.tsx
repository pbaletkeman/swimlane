/**
 * Facility manager event management page with CRUD operations, bulk delete, and frequency lookup.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { events } from '../api/events.ts'
import { frequencies } from '../api/frequencies.ts'
import type { Event, EventInput, Frequency } from '../api/types.ts'
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

function toIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value) return new Date(value).toISOString()
  return ''
}

export default function EventsPage() {
  const [rows, setRows] = useState<Event[]>([])
  const [frequencyRows, setFrequencyRows] = useState<Frequency[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  const frequencyOptions = useMemo<EntityFormFieldOption[]>(
    () => frequencyRows.map((frequency) => ({ label: frequency.name, value: frequency.frequency_id ?? -1 })),
    [frequencyRows],
  )
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

  const columns: EntityDataTableColumn<Event>[] = [
    { field: 'start_date_time', header: 'Start', sortable: true, body: (row) => formatDateTime(row.start_date_time) },
    { field: 'end_date_time', header: 'End', sortable: true, body: (row) => formatDateTime(row.end_date_time) },
    { field: 'frequency_id', header: 'Frequency', body: (row) => frequencyName(row.frequency_id) },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  const fields: EntityFormField<Event>[] = [
    { name: 'start_date_time', label: 'Start Date Time', type: 'datetime', required: true },
    {
      name: 'end_date_time',
      label: 'End Date Time',
      type: 'datetime',
      required: true,
      validate: (value, values) => {
        const start = values.start_date_time
        if (value instanceof Date && start instanceof Date && value.getTime() <= start.getTime()) {
          return 'End date time must be after the start date time.'
        }
        return undefined
      },
    },
    { name: 'frequency_id', label: 'Frequency', type: 'select', options: frequencyOptions },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ]

  const load = async () => {
    setLoading(true)
    try {
      const [eventRows, frequencyList] = await Promise.all([events.list(), frequencies.list()])
      setRows(eventRows)
      setFrequencyRows(frequencyList)
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

  const openEdit = (row: Event) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const input: EventInput = {
      start_date_time: toIso(values.start_date_time),
      end_date_time: toIso(values.end_date_time),
      frequency_id: typeof values.frequency_id === 'number' ? values.frequency_id : null,
      is_active: values.is_active === true,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await events.update(editing.event_id!, input)
        showToastSuccess('Event updated', 'The event was updated.')
      } else {
        await events.create(input)
        showToastSuccess('Event created', 'The event was created.')
      }
      setDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSoftDelete = async (row: Event) => {
    try {
      await events.delete(row.event_id!)
      showToastSuccess('Event deleted', 'The event was deactivated.')
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDelete = async (row: Event) => {
    try {
      await events.hardDelete(row.event_id!)
      showToastSuccess('Event deleted', 'The event was permanently deleted.')
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDelete = async () => {
    const selected = rows.filter((row) => selectedKeys[String(row.event_id)] === true)
    if (selected.length === 0) {
      return
    }
    try {
      await events.deleteBulk(selected)
      showToastSuccess('Events deleted', `${selected.length} event(s) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  const itemName = (row: Event): string => `${formatDateTime(row.start_date_time)} event`

  return (
    <div className="app-crud-page">
      <PageHeader title="Events" subtitle="Swim meets and training sessions." onNew={openCreate} newLabel="New Event" />
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="No events yet."
          hint="Create your first event to start scheduling."
          icon="pi-bolt"
          action={
            <Button type="button" onClick={openCreate}>
              <i className="pi pi-plus" />
              <span className="p-button-label">New Event</span>
            </Button>
          }
        />
      ) : (
        <>
          <BulkDeleteBar
            count={Object.values(selectedKeys).filter(Boolean).length}
            itemLabel="event"
            onBulkDelete={handleBulkDelete}
          />
          <EntityDataTable
            data={rows}
            columns={columns}
            dataKey="event_id"
            loading={loading}
            searchableFields={['start_date_time', 'end_date_time']}
            searchPlaceholder="Search events..."
            defaultSortField="start_date_time"
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
                aria-label="Edit event"
                title="Edit event"
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
        title={editing ? 'Edit Event' : 'New Event'}
        fields={fields}
        initialValues={
          editing
            ? {
                start_date_time: editing.start_date_time,
                end_date_time: editing.end_date_time,
                frequency_id: editing.frequency_id,
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