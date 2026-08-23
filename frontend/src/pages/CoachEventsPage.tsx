/**
 * Coach event management page with create, edit, delete, and per-event member list management.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Select } from 'primereact/select'
import { Skeleton } from 'primereact/skeleton'
import { Tag } from 'primereact/tag'
import type { ChangeEvent } from 'react'
import type { DialogRootChangeEvent } from '@primereact/types/primitive/dialog'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'
import {
  addMember,
  editMember,
  events,
  getEventCapacity,
  listMembers,
  listMine,
  removeMember,
} from '../api/events.ts'
import { facilities } from '../api/facilities.ts'
import { frequencies } from '../api/frequencies.ts'
import { venues } from '../api/venues.ts'
import type {
  CoachEventScope,
  Event,
  EventCapacity,
  EventInput,
  EventMember,
  Facility,
  Frequency,
  Venue,
} from '../api/types.ts'
import { useAuth } from '../auth/auth-context.ts'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { EntityFormDialog } from '../components/EntityFormDialog.tsx'
import type { EntityFormField, EntityFormFieldOption } from '../components/EntityFormDialog.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

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

function toIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value) return new Date(value).toISOString()
  return ''
}

/**
 * Coach "Manage Events" page (Phase F): the coach's own events with an
 * Upcoming / Past / All scope switcher, editable in F.9.2–F.9.3, with a
 * members management drawer in F.9.4.
 */
export default function CoachEventsPage() {
  const { user } = useAuth()
  const callerSub = user?.sub ?? ''
  const [scope, setScope] = useState<CoachEventScope>('upcoming')
  const [rows, setRows] = useState<Event[]>([])
  const [venueRows, setVenueRows] = useState<Venue[]>([])
  const [facilityRows, setFacilityRows] = useState<Facility[]>([])
  const [frequencyRows, setFrequencyRows] = useState<Frequency[]>([])
  const [capacity, setCapacity] = useState<Record<number, EventCapacity>>({})
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [membersEvent, setMembersEvent] = useState<Event | null>(null)
  const [members, setMembers] = useState<EventMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [addSub, setAddSub] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [editingMember, setEditingMember] = useState<EventMember | null>(null)
  const [savingMember, setSavingMember] = useState(false)

  const frequencyOptions = useMemo<EntityFormFieldOption[]>(
    () => frequencyRows.map((frequency) => ({ label: frequency.name, value: frequency.frequency_id ?? -1 })),
    [frequencyRows],
  )
  const venueOptions = useMemo<EntityFormFieldOption[]>(
    () =>
      venueRows.map((venue) => ({
        label: venueLabel(venue.venue_id, venueRows, facilityRows),
        value: venue.venue_id ?? -1,
      })),
    [venueRows, facilityRows],
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
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'venue_id', label: 'Facility / Venue', type: 'select', options: venueOptions },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ]

  const memberFields: EntityFormField<EventMember>[] = [
    { name: 'venue_id', label: 'Facility / Venue', type: 'select', options: venueOptions },
  ]

  const openCreate = () => {
    setEditing(null)
    setDialogVisible(true)
  }

  const openEdit = (row: Event) => {
    setEditing(row)
    setDialogVisible(true)
  }

  const refreshCapacity = async (eventId: number) => {
    const cap = await getEventCapacity(eventId).catch(() => null)
    if (cap) {
      setCapacity((current) => ({ ...current, [eventId]: cap }))
    }
  }

  const openMembers = async (row: Event) => {
    setMembersEvent(row)
    setMembers([])
    setAddSub('')
    setMembersLoading(true)
    try {
      setMembers(await listMembers(row.event_id!))
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setMembersLoading(false)
    }
  }

  const handleAddMember = async () => {
    const sub = addSub.trim()
    if (!sub || !membersEvent) return
    setAddingMember(true)
    try {
      await addMember(membersEvent.event_id!, sub)
      showToastSuccess('Member added', 'The member was added to the event.')
      setAddSub('')
      setMembers(await listMembers(membersEvent.event_id!))
      await refreshCapacity(membersEvent.event_id!)
    } catch (error) {
      showToastError('Add failed', errorMessage(error))
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (member: EventMember) => {
    if (!membersEvent) return
    try {
      await removeMember(membersEvent.event_id!, member.schedule_id)
      showToastSuccess('Member removed', 'The member was removed from the event.')
      setMembers((current) => current.filter((item) => item.schedule_id !== member.schedule_id))
      await refreshCapacity(membersEvent.event_id!)
    } catch (error) {
      showToastError('Remove failed', errorMessage(error))
    }
  }

  const handleMemberEditSubmit = async (values: Record<string, unknown>) => {
    if (!membersEvent || !editingMember) return
    setSavingMember(true)
    try {
      await editMember(membersEvent.event_id!, editingMember.schedule_id, {
        venue_id: typeof values.venue_id === 'number' ? values.venue_id : null,
      })
      showToastSuccess('Member updated', 'The member schedule was updated.')
      setEditingMember(null)
      setMembers(await listMembers(membersEvent.event_id!))
      await refreshCapacity(membersEvent.event_id!)
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSavingMember(false)
    }
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const input: EventInput = {
      start_date_time: toIso(values.start_date_time),
      end_date_time: toIso(values.end_date_time),
      frequency_id: typeof values.frequency_id === 'number' ? values.frequency_id : null,
      description: typeof values.description === 'string' && values.description.trim() ? values.description : null,
      coach_id: callerSub,
      venue_id: typeof values.venue_id === 'number' ? values.venue_id : null,
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

  return (
    <div className="app-crud-page">
      <PageHeader title="Manage Events" subtitle="Your coaching events and their members." onNew={openCreate} newLabel="New Event" />
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
          actionsHeader="Actions"
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
              <Button
                type="button"
                variant="text"
                iconOnly
                aria-label="Manage members"
                title="Manage members"
                onClick={() => void openMembers(row)}
              >
                <i className="pi pi-users" />
              </Button>
            </div>
          )}
        />
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
                description: editing.description,
                venue_id: editing.venue_id,
                is_active: editing.is_active,
              }
            : { is_active: true }
        }
        onSubmit={handleSubmit}
        onHide={() => setDialogVisible(false)}
        submitting={submitting}
      />
      <Dialog.Root
        visible={membersEvent !== null}
        modal
        dismissable
        blockScroll
        onOpenChange={(event: DialogRootChangeEvent) => {
          if (!event.value) {
            setMembersEvent(null)
            setMembers([])
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content className="coach-members-dialog-content">
              <Dialog.Header>
                <Dialog.Title>Members — {membersEvent ? formatDateTime(membersEvent.start_date_time) : '…'}</Dialog.Title>
                <Dialog.HeaderActions>
                  <Dialog.Close aria-label="Close">
                    <i className="pi pi-times" />
                  </Dialog.Close>
                </Dialog.HeaderActions>
              </Dialog.Header>
              <div className="coach-members-body">
                <div className="coach-members-add">
                  <InputText
                    value={addSub}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setAddSub(event.target.value)}
                    placeholder="Member sub (e.g. Google subject)"
                    className="w-full"
                    aria-label="Member sub"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleAddMember()}
                    loading={addingMember}
                    disabled={addSub.trim() === ''}
                  >
                    <i className="pi pi-plus" />
                    <span className="p-button-label">Add</span>
                  </Button>
                </div>
                {membersLoading ? (
                  <div className="coach-members-loading">
                    <Skeleton height="2.5rem" className="w-full" />
                    <Skeleton height="2.5rem" className="w-full" />
                  </div>
                ) : members.length === 0 ? (
                  <EmptyState message="No members registered." hint="Add a member by their sub to register them." icon="pi-users" />
                ) : (
                  <ul className="coach-members-list">
                    {members.map((member) => (
                      <li key={member.schedule_id} className="coach-member-row">
                        <div className="coach-member-info">
                          <span className="coach-member-name">{member.member_name}</span>
                          <span className="coach-member-meta">{member.email ?? member.member_id}</span>
                          <span className="coach-member-meta">
                            {venueLabel(member.venue_id, venueRows, facilityRows)}
                          </span>
                        </div>
                        <div className="coach-member-actions">
                          <Button
                            type="button"
                            variant="text"
                            iconOnly
                            aria-label="Edit member schedule"
                            title="Edit member schedule"
                            onClick={() => setEditingMember(member)}
                          >
                            <i className="pi pi-pencil" />
                          </Button>
                          <ConfirmDelete
                            itemName={member.member_name}
                            softLabel="Remove from event"
                            onSoftDelete={() => void handleRemoveMember(member)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
      <EntityFormDialog
        visible={editingMember !== null}
        title="Edit Member Schedule"
        fields={memberFields}
        initialValues={editingMember ? { venue_id: editingMember.venue_id } : undefined}
        onSubmit={handleMemberEditSubmit}
        onHide={() => setEditingMember(null)}
        submitting={savingMember}
      />
    </div>
  )
}