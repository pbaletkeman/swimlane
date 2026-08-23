/**
 * Frequency management CRUD page with data table, form dialog, and soft/hard delete.
 */
import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { frequencies } from '../api/frequencies.ts'
import type { Frequency, FrequencyInput } from '../api/types.ts'
import { BulkDeleteBar } from '../components/BulkDeleteBar.tsx'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { EntityFormDialog } from '../components/EntityFormDialog.tsx'
import type { EntityFormField } from '../components/EntityFormDialog.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

const columns: EntityDataTableColumn<Frequency>[] = [
  { field: 'name', header: 'Name', sortable: true },
  { field: 'day_interval', header: 'Day Interval', sortable: true },
  {
    field: 'is_active',
    header: 'Active',
    body: (row) => (
      <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
    ),
  },
]

const fields: EntityFormField<Frequency>[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Weekly' },
  { name: 'day_interval', label: 'Day Interval', type: 'text', required: true, placeholder: 'e.g., 7 days' },
  { name: 'is_active', label: 'Active', type: 'checkbox' },
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function FrequenciesPage() {
  const [rows, setRows] = useState<Frequency[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<Frequency | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    try {
      setRows(await frequencies.list())
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

  const openEdit = (row: Frequency) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const input: FrequencyInput = {
      name: String(values.name ?? ''),
      day_interval: String(values.day_interval ?? ''),
      is_active: values.is_active === true,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await frequencies.update(editing.frequency_id!, input)
        showToastSuccess('Frequency updated', `"${input.name}" was updated.`)
      } else {
        await frequencies.create(input)
        showToastSuccess('Frequency created', `"${input.name}" was created.`)
      }
      setDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSoftDelete = async (row: Frequency) => {
    try {
      await frequencies.delete(row.frequency_id!)
      showToastSuccess('Frequency deleted', `"${row.name}" was deactivated.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDelete = async (row: Frequency) => {
    try {
      await frequencies.hardDelete(row.frequency_id!)
      showToastSuccess('Frequency deleted', `"${row.name}" was permanently deleted.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDelete = async () => {
    const selected = rows.filter((row) => selectedKeys[String(row.frequency_id)] === true)
    if (selected.length === 0) {
      return
    }
    try {
      await frequencies.deleteBulk(selected)
      showToastSuccess('Frequencies deleted', `${selected.length} frequency(ies) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  return (
    <div className="app-crud-page">
      <PageHeader title="Frequencies" subtitle="Repeat intervals used by events." onNew={openCreate} newLabel="New Frequency" />
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="No frequencies yet."
          hint="Create your first frequency to define repeat intervals."
          icon="pi-calendar"
          action={
            <Button type="button" onClick={openCreate}>
              <i className="pi pi-plus" />
              <span className="p-button-label">New Frequency</span>
            </Button>
          }
        />
      ) : (
        <>
          <BulkDeleteBar
            count={Object.values(selectedKeys).filter(Boolean).length}
            itemLabel="frequency"
            onBulkDelete={handleBulkDelete}
          />
          <EntityDataTable
            data={rows}
            columns={columns}
            dataKey="frequency_id"
            loading={loading}
            searchableFields={['name', 'day_interval']}
            searchPlaceholder="Search frequencies..."
            defaultSortField="name"
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
                aria-label={`Edit ${row.name}`}
                title={`Edit ${row.name}`}
                onClick={() => openEdit(row)}
              >
                <i className="pi pi-pencil" />
              </Button>
              <ConfirmDelete
                itemName={row.name}
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
        title={editing ? `Edit ${editing.name}` : 'New Frequency'}
        fields={fields}
        initialValues={editing ? { name: editing.name, day_interval: editing.day_interval, is_active: editing.is_active } : { is_active: true }}
        onSubmit={handleSubmit}
        onHide={() => setDialogVisible(false)}
        submitting={submitting}
      />
    </div>
  )
}