/**
 * Venue management CRUD page with facility lookup, data table, and soft/hard delete.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { facilities } from '../api/facilities.ts'
import { venues } from '../api/venues.ts'
import type { Facility, Venue, VenueInput } from '../api/types.ts'
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

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null
}

export default function VenuesPage() {
  const [rows, setRows] = useState<Venue[]>([])
  const [facilityRows, setFacilityRows] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<Venue | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  const facilityOptions = useMemo<EntityFormFieldOption[]>(
    () => facilityRows.map((facility) => ({ label: facility.name, value: facility.facility_id ?? -1 })),
    [facilityRows],
  )
  const facilityNames = useMemo(() => {
    const map = new Map<number, string>()
    for (const facility of facilityRows) {
      if (facility.facility_id !== undefined) {
        map.set(facility.facility_id, facility.name)
      }
    }
    return map
  }, [facilityRows])
  const facilityName = (id: number | null | undefined): string => (id == null ? '' : facilityNames.get(id) ?? String(id))

  const columns: EntityDataTableColumn<Venue>[] = [
    { field: 'street', header: 'Street', sortable: true },
    { field: 'city', header: 'City', sortable: true },
    { field: 'state', header: 'State' },
    { field: 'postal_code', header: 'Postal Code' },
    { field: 'cost', header: 'Cost', body: (row) => (row.cost == null ? '' : `$${row.cost}`) },
    { field: 'facility_id', header: 'Facility', body: (row) => facilityName(row.facility_id) },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  const fields: EntityFormField<Venue>[] = [
    { name: 'street', label: 'Street', type: 'text', required: true },
    { name: 'city', label: 'City', type: 'text', required: true },
    { name: 'state', label: 'State', type: 'text', required: true },
    { name: 'postal_code', label: 'Postal Code', type: 'text', required: true },
    { name: 'cost', label: 'Cost', type: 'number', placeholder: 'e.g., 200', min: 0 },
    { name: 'facility_id', label: 'Facility', type: 'select', required: true, options: facilityOptions },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ]

  const load = async () => {
    setLoading(true)
    try {
      const [venueList, facilityList] = await Promise.all([venues.list(), facilities.list()])
      setRows(venueList)
      setFacilityRows(facilityList)
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

  const openEdit = (row: Venue) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const cost = nullableNumber(values.cost)
    const input: VenueInput = {
      street: String(values.street ?? ''),
      city: String(values.city ?? ''),
      state: String(values.state ?? ''),
      postal_code: String(values.postal_code ?? ''),
      cost: cost ?? undefined,
      facility_id: typeof values.facility_id === 'number' ? values.facility_id : -1,
      is_active: values.is_active === true,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await venues.update(editing.venue_id!, input)
        showToastSuccess('Venue updated', `${input.street}, ${input.city} was updated.`)
      } else {
        await venues.create(input)
        showToastSuccess('Venue created', `${input.street}, ${input.city} was created.`)
      }
      setDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSoftDelete = async (row: Venue) => {
    try {
      await venues.delete(row.venue_id!)
      showToastSuccess('Venue deleted', `${row.street}, ${row.city} was deactivated.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDelete = async (row: Venue) => {
    try {
      await venues.hardDelete(row.venue_id!)
      showToastSuccess('Venue deleted', `${row.street}, ${row.city} was permanently deleted.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDelete = async () => {
    const selected = rows.filter((row) => selectedKeys[String(row.venue_id)] === true)
    if (selected.length === 0) {
      return
    }
    try {
      await venues.deleteBulk(selected)
      showToastSuccess('Venues deleted', `${selected.length} venue(s) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  return (
    <div className="app-crud-page">
      <PageHeader title="Venues" subtitle="Locations where events take place." onNew={openCreate} newLabel="New Venue" />
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="No venues yet."
          hint="Create your first venue to assign event locations."
          icon="pi-map-marker"
          action={
            <Button type="button" onClick={openCreate}>
              <i className="pi pi-plus" />
              <span className="p-button-label">New Venue</span>
            </Button>
          }
        />
      ) : (
        <>
          <BulkDeleteBar
            count={Object.values(selectedKeys).filter(Boolean).length}
            itemLabel="venue"
            onBulkDelete={handleBulkDelete}
          />
          <EntityDataTable
            data={rows}
            columns={columns}
            dataKey="venue_id"
            loading={loading}
            searchableFields={['street', 'city', 'state', 'postal_code']}
            searchPlaceholder="Search venues..."
            defaultSortField="street"
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
                  aria-label={`Edit ${row.street}, ${row.city}`}
                  title={`Edit ${row.street}, ${row.city}`}
                  onClick={() => openEdit(row)}
                >
                  <i className="pi pi-pencil" />
                </Button>
                <ConfirmDelete
                  itemName={`${row.street}, ${row.city}`}
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
        title={editing ? `Edit ${editing.street}, ${editing.city}` : 'New Venue'}
        fields={fields}
        initialValues={
          editing
            ? {
                street: editing.street,
                city: editing.city,
                state: editing.state,
                postal_code: editing.postal_code,
                cost: editing.cost,
                facility_id: editing.facility_id,
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