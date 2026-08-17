import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { facilities } from '../api/facilities.ts'
import type { Facility, FacilityInput } from '../api/types.ts'
import { BulkDeleteBar } from '../components/BulkDeleteBar.tsx'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { EntityFormDialog } from '../components/EntityFormDialog.tsx'
import type { EntityFormField } from '../components/EntityFormDialog.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

const columns: EntityDataTableColumn<Facility>[] = [
  { field: 'name', header: 'Name', sortable: true },
  { field: 'description', header: 'Description', body: (row) => row.description ?? '' },
  { field: 'max_capacity', header: 'Max Capacity' },
  { field: 'min_capacity', header: 'Min Capacity' },
  {
    field: 'is_active',
    header: 'Active',
    body: (row) => (
      <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
    ),
  },
]

const fields: EntityFormField<Facility>[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'Facility description' },
  { name: 'max_capacity', label: 'Max Capacity', type: 'number', placeholder: 'e.g., 50', min: 1 },
  { name: 'min_capacity', label: 'Min Capacity', type: 'number', placeholder: 'e.g., 25', min: 0 },
  { name: 'is_active', label: 'Active', type: 'checkbox' },
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null
}

export default function FacilitiesPage() {
  const [rows, setRows] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<Facility | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    try {
      setRows(await facilities.list())
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

  const openEdit = (row: Facility) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const input: FacilityInput = {
      name: String(values.name ?? ''),
      description: typeof values.description === 'string' && values.description.trim() ? values.description : null,
      max_capacity: nullableNumber(values.max_capacity),
      min_capacity: nullableNumber(values.min_capacity),
      is_active: values.is_active === true,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await facilities.update(editing.facility_id!, input)
        showToastSuccess('Facility updated', `"${input.name}" was updated.`)
      } else {
        await facilities.create(input)
        showToastSuccess('Facility created', `"${input.name}" was created.`)
      }
      setDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSoftDelete = async (row: Facility) => {
    try {
      await facilities.delete(row.facility_id!)
      showToastSuccess('Facility deleted', `"${row.name}" was deactivated.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDelete = async (row: Facility) => {
    try {
      await facilities.hardDelete(row.facility_id!)
      showToastSuccess('Facility deleted', `"${row.name}" was permanently deleted.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDelete = async () => {
    const selected = rows.filter((row) => selectedKeys[String(row.facility_id)] === true)
    if (selected.length === 0) {
      return
    }
    try {
      await facilities.deleteBulk(selected)
      showToastSuccess('Facilities deleted', `${selected.length} facility(ies) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  return (
    <div className="app-crud-page">
      <PageHeader title="Facilities" subtitle="Pools and training venues." onNew={openCreate} newLabel="New Facility" />
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="No facilities yet."
          hint="Create your first facility to organize venues and signup forms."
          icon="pi-building"
          action={
            <Button type="button" onClick={openCreate}>
              <i className="pi pi-plus" />
              <span className="p-button-label">New Facility</span>
            </Button>
          }
        />
      ) : (
        <>
          <BulkDeleteBar
            count={Object.values(selectedKeys).filter(Boolean).length}
            itemLabel="facility"
            onBulkDelete={handleBulkDelete}
          />
          <EntityDataTable
            data={rows}
            columns={columns}
            dataKey="facility_id"
            loading={loading}
            searchableFields={['name', 'description']}
            searchPlaceholder="Search facilities..."
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
        title={editing ? `Edit ${editing.name}` : 'New Facility'}
        fields={fields}
        initialValues={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? '',
                max_capacity: editing.max_capacity,
                min_capacity: editing.min_capacity,
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