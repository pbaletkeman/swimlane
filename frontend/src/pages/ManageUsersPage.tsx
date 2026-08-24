/**
 * User management page with list, invite, role editing, and soft/hard delete for facility managers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Select } from 'primereact/select'
import { Tag } from 'primereact/tag'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'
import {
  createUser,
  hardDeleteUser,
  listUsers,
  softDeleteUser,
  updateUserRole,
} from '../api/users.ts'
import type { ManagedUser, ManagedUserInput, ManagedUserRoleFilter } from '../api/types.ts'
import { useAuth } from '../auth/auth-context.ts'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { EntityFormDialog } from '../components/EntityFormDialog.tsx'
import type { EntityFormField, EntityFormFieldOption } from '../components/EntityFormDialog.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

const ROLE_META: Record<string, { label: string; severity: 'secondary' | 'info' | 'warn' | 'danger' }> = {
  member: { label: 'Member', severity: 'secondary' },
  coach: { label: 'Coach', severity: 'info' },
  facility_manager: { label: 'Facility Manager', severity: 'warn' },
  web_admin: { label: 'Web Admin', severity: 'danger' },
}

/** Invite role options: coach/member for managers, all roles for web admins. */
const MANAGER_INVITE_ROLES: EntityFormFieldOption[] = [
  { label: 'Coach', value: 'coach' },
  { label: 'Member', value: 'member' },
]

const ADMIN_INVITE_ROLES: EntityFormFieldOption[] = [
  { label: 'Coach', value: 'coach' },
  { label: 'Member', value: 'member' },
  { label: 'Facility Manager', value: 'facility_manager' },
  { label: 'Web Admin', value: 'web_admin' },
]

/** Role-edit options for facility managers: coach/member only (cannot assign senior roles). */
const MANAGER_ROLE_OPTIONS: EntityFormFieldOption[] = [
  { label: 'Coach', value: 'coach' },
  { label: 'Member', value: 'member' },
]

/** Role-edit options for web admins: coaches + facility managers (+ web admins). */
const ADMIN_ROLE_OPTIONS: EntityFormFieldOption[] = [
  { label: 'Coach', value: 'coach' },
  { label: 'Member', value: 'member' },
  { label: 'Facility Manager', value: 'facility_manager' },
  { label: 'Web Admin', value: 'web_admin' },
]

function roleMeta(role: string): { label: string; severity: 'secondary' | 'info' | 'warn' | 'danger' } {
  return ROLE_META[role] ?? { label: role, severity: 'secondary' }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

/**
 * Manage Users page (Phase G + H.3): coach/member accounts. Role-filtered table
 * (defaults to Coaches; admins can also filter Facility Managers/Web Admins),
 * email invites (coach/member), role edits (admins may assign senior roles),
 * soft delete for managers+, admin-only hard delete (ConfirmDelete hardRole gate).
 */
export default function ManageUsersPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('WEB_ADMIN')
  const [filterRole, setFilterRole] = useState<ManagedUserRoleFilter | ''>('coach')
  const [rows, setRows] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filterOptions = useMemo(() => {
    const options: { label: string; value: ManagedUserRoleFilter | '' }[] = [
      { label: 'All roles', value: '' },
      { label: 'Coach', value: 'coach' },
      { label: 'Member', value: 'member' },
    ]
    if (isAdmin) {
      options.push(
        { label: 'Facility Manager', value: 'facility_manager' },
        { label: 'Web Admin', value: 'web_admin' },
      )
    }
    return options
  }, [isAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listUsers(filterRole === '' ? undefined : filterRole))
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [filterRole])

  useEffect(() => {
    void load()
  }, [load])

  const columns: EntityDataTableColumn<ManagedUser>[] = [
    { field: 'name', header: 'Name', sortable: true, body: (row) => row.name ?? '—' },
    { field: 'email', header: 'Email', sortable: true, body: (row) => row.email ?? '—' },
    {
      field: 'role',
      header: 'Role',
      sortable: true,
      body: (row) => {
        const meta = roleMeta(row.role)
        return <Tag severity={meta.severity}>{meta.label}</Tag>
      },
    },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  const inviteFields: EntityFormField<ManagedUser>[] = [
    { name: 'email', label: 'Email', type: 'text', required: true, placeholder: 'coach@example.com' },
    { name: 'role', label: 'Role', type: 'select', required: true, options: isAdmin ? ADMIN_INVITE_ROLES : MANAGER_INVITE_ROLES },
  ]

  const roleFields: EntityFormField<ManagedUser>[] = [
    {
      name: 'role',
      label: 'Role',
      type: 'select',
      required: true,
      options: isAdmin ? ADMIN_ROLE_OPTIONS : MANAGER_ROLE_OPTIONS,
    },
  ]

  const openCreate = () => {
    setEditing(null)
    setDialogVisible(true)
  }

  const openEdit = (row: ManagedUser) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      if (editing) {
        const role = String(values.role ?? '')
        await updateUserRole(editing.sub, role)
        showToastSuccess('Role updated', `${editing.name ?? editing.sub} is now ${roleMeta(role).label}.`)
      } else {
        const email = String(values.email ?? '').trim().toLowerCase()
        const role = (values.role ?? 'coach') as ManagedUserInput['role']
        await createUser({ email, role })
        showToastSuccess('Invite sent', `An invite was created for ${email}.`)
      }
      setDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSoftDelete = async (row: ManagedUser) => {
    try {
      await softDeleteUser(row.sub)
      showToastSuccess('User deleted', `${row.name ?? row.sub} was deactivated.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDelete = async (row: ManagedUser) => {
    try {
      await hardDeleteUser(row.sub)
      showToastSuccess('User deleted', `${row.name ?? row.sub} was permanently deleted.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  return (
    <div className="app-crud-page">
      <PageHeader title="Manage Users" subtitle="Coach and member accounts." onNew={openCreate} newLabel="Invite User" />
      <div className="manage-users-toolbar">
        <Select.Root
          value={filterRole}
          onValueChange={(event: SelectValueChangeEvent) => setFilterRole(event.value as ManagedUserRoleFilter | '')}
          options={filterOptions}
          optionLabel="label"
          optionValue="value"
          className="manage-users-filter"
        >
          <Select.Trigger>
            <Select.Value placeholder="Filter by role" />
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
        <span className="manage-users-count">
          {rows.length} user{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      {rows.length === 0 && !loading ? (
        <EmptyState
          message={filterRole === '' ? 'No users yet.' : `No ${filterRole} accounts.`}
          hint="Invite a coach or member by email to create their account."
          icon="pi-users"
          action={
            <Button type="button" onClick={openCreate}>
              <i className="pi pi-plus" />
              <span className="p-button-label">Invite User</span>
            </Button>
          }
        />
      ) : (
        <EntityDataTable
          data={rows}
          columns={columns}
          dataKey="sub"
          loading={loading}
          searchableFields={['name', 'email', 'sub', 'role']}
          searchPlaceholder="Search users..."
          defaultSortField="name"
          actionsHeader="Actions"
          actions={(row) => (
            <div className="app-crud-row-actions">
              <Button
                type="button"
                variant="text"
                iconOnly
                aria-label={`Edit role for ${row.name ?? row.sub}`}
                title="Change role"
                onClick={() => openEdit(row)}
              >
                <i className="pi pi-pencil" />
              </Button>
              <ConfirmDelete
                itemName={row.name ?? row.sub}
                onSoftDelete={() => handleSoftDelete(row)}
                onHardDelete={() => handleHardDelete(row)}
              />
            </div>
          )}
        />
      )}
      <EntityFormDialog
        visible={dialogVisible}
        title={editing ? `Change role — ${editing.name ?? editing.sub}` : 'Invite User'}
        fields={editing ? roleFields : inviteFields}
        initialValues={editing ? { role: editing.role } : { role: 'coach' }}
        onSubmit={handleSubmit}
        onHide={() => setDialogVisible(false)}
        submitting={submitting}
        saveLabel={editing ? 'Save Role' : 'Send Invite'}
      />
    </div>
  )
}