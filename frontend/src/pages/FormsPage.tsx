import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { facilities } from '../api/facilities.ts'
import type { Facility } from '../api/types.ts'
import { useAuth } from '../auth/auth-context.ts'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError } from '../toast/toast-context.ts'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function FormsPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [rows, setRows] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)

  const canManage = hasRole('FACILITY_MANAGER')

  const load = async () => {
    setLoading(true)
    try {
      setRows(await facilities.list())
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const columns: EntityDataTableColumn<Facility>[] = [
    { field: 'name', header: 'Facility', sortable: true },
    { field: 'description', header: 'Description', body: (row) => row.description ?? '' },
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
      <PageHeader title="Signup Forms" subtitle="Select a facility to view its signup form." />
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="No facilities yet."
          hint="A facility must exist before a signup form can be viewed."
          icon="pi-file-edit"
          actionLabel={canManage ? 'Manage Facilities' : undefined}
          onAction={canManage ? () => navigate('/facilities') : undefined}
        />
      ) : (
        <EntityDataTable
          data={rows}
          columns={columns}
          dataKey="facility_id"
          loading={loading}
          searchableFields={['name', 'description']}
          searchPlaceholder="Search facilities..."
          defaultSortField="name"
          actionsHeader="Actions"
          actions={(row) => (
            <div className="app-crud-row-actions">
              <Button
                type="button"
                variant="outlined"
                onClick={() => navigate(`/forms/facility/${row.facility_id}`)}
              >
                <i className="pi pi-file-edit" />
                <span className="p-button-label">View Signup Form</span>
              </Button>
              {canManage && (
                <Button
                  type="button"
                  variant="text"
                  iconOnly
                  aria-label={`Manage form for ${row.name}`}
                  title={`Manage form for ${row.name}`}
                  onClick={() => navigate(`/forms/builder/${row.facility_id}`)}
                >
                  <i className="pi pi-pencil" />
                </Button>
              )}
            </div>
          )}
        />
      )}
    </div>
  )
}