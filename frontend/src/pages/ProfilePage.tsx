/**
 * User profile page with personal info, role display, form submissions, and staff inbox.
 */
import { useEffect, useState } from 'react'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Dialog } from 'primereact/dialog'
import { Skeleton } from 'primereact/skeleton'
import { Tabs } from 'primereact/tabs'
import { Tag } from 'primereact/tag'
import type { DialogRootChangeEvent } from '@primereact/types/primitive/dialog'
import type { TabsRootChangeEvent } from '@primereact/types/primitive/tabs'
import { forms } from '../api/forms.ts'
import { messages } from '../api/messages.ts'
import { listMine } from '../api/schedules.ts'
import type { Message, MyScheduleItem, MySubmission, SubmissionDetail } from '../api/types.ts'
import { useAuth } from '../auth/auth-context.ts'
import { getRoleFromToken } from '../auth/tokens.ts'
import type { UserRole } from '../auth/types.ts'
import { EmptyState } from '../components/EmptyState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

type TagSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'

const ROLE_SEVERITY: Record<UserRole, TagSeverity> = {
  WEB_ADMIN: 'danger',
  FACILITY_MANAGER: 'warn',
  COACH: 'info',
  MEMBER: 'secondary',
}

const ROLE_LABEL: Record<UserRole, string> = {
  WEB_ADMIN: 'Web Admin',
  FACILITY_MANAGER: 'Facility Manager',
  COACH: 'Coach',
  MEMBER: 'Member',
}

function getInitials(name?: string): string {
  if (!name) {
    return 'U'
  }
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

/** Format a naive ISO datetime like `2026-08-19T09:00:00` for local display. */
function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function venueAddress(item: MyScheduleItem): string {
  return `${item.street}, ${item.city}, ${item.state} ${item.postal_code}`
}

/**
 * Member profile page (Phase E): identity header card plus correspondence tabs
 * (My Forms, My Events, My Messages).
 */
export default function ProfilePage() {
  const { user, accessToken } = useAuth()
  const role = getRoleFromToken(accessToken)

  const [activeTab, setActiveTab] = useState<string>('forms')

  const [submissions, setSubmissions] = useState<MySubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(true)

  const [events, setEvents] = useState<MyScheduleItem[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)

  const [inbox, setInbox] = useState<Message[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)

  const [viewSubmission, setViewSubmission] = useState<SubmissionDetail | null>(null)
  const [viewSubmissionLoading, setViewSubmissionLoading] = useState(false)
  const [viewMessage, setViewMessage] = useState<Message | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null)

  const loadSubmissions = async () => {
    setSubmissionsLoading(true)
    try {
      setSubmissions(await forms.listMySubmissions())
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setSubmissionsLoading(false)
    }
  }

  const loadEvents = async () => {
    setEventsLoading(true)
    try {
      setEvents(await listMine())
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setEventsLoading(false)
    }
  }

  const loadInbox = async () => {
    setInboxLoading(true)
    try {
      setInbox(await messages.listMine())
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setInboxLoading(false)
    }
  }

  useEffect(() => {
    void loadSubmissions()
    void loadEvents()
    void loadInbox()
  }, [])

  const handleOpenSubmission = async (submissionId: number) => {
    setViewSubmissionLoading(true)
    try {
      setViewSubmission(await forms.getSubmission(submissionId))
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setViewSubmissionLoading(false)
    }
  }

  const handleOpenMessage = async (message: Message) => {
    setViewMessage(message)
    if (!message.is_read) {
      try {
        const updated = await messages.markRead(message.message_id)
        setInbox((current) => current.map((item) => (item.message_id === message.message_id ? updated : item)))
      } catch (error) {
        showToastError('Mark as read failed', errorMessage(error))
      }
    }
  }

  const handleDownloadPdf = async (submissionId: number) => {
    setDownloadingPdf(submissionId)
    try {
      const blob = await forms.getSubmissionPdf(submissionId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `submission-${submissionId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showToastSuccess('PDF downloaded', 'Your submission was exported as a PDF.')
    } catch (error) {
      showToastError('Download failed', errorMessage(error))
    } finally {
      setDownloadingPdf(null)
    }
  }

  const renderForms = () => {
    if (submissionsLoading) {
      return (
        <div className="profile-tab-loading">
          <Skeleton height="4rem" className="w-full" />
          <Skeleton height="4rem" className="w-full" />
        </div>
      )
    }
    if (submissions.length === 0) {
      return <EmptyState message="No form submissions yet." hint="Complete a facility signup form to see it here." icon="pi-file-edit" />
    }
    return (
      <div className="profile-tab-list">
        {submissions.map((submission) => (
          <Card.Root key={submission.submission_id} className="profile-tab-card">
            <Card.Content>
              <div className="profile-tab-row">
                <div className="profile-tab-info">
                  <h3 className="profile-tab-title">{submission.facility_name}</h3>
                  <p className="profile-tab-meta">Submitted {formatDateTime(submission.submitted_at)}</p>
                </div>
                <Tag severity={submission.is_complete ? 'success' : 'warn'} rounded>
                  {submission.is_complete ? 'Complete' : 'Incomplete'}
                </Tag>
              </div>
              <div className="profile-tab-actions">
                <Button
                  type="button"
                  variant="outlined"
                  loading={viewSubmissionLoading}
                  onClick={() => void handleOpenSubmission(submission.submission_id)}
                >
                  <i className="pi pi-eye" />
                  <span className="p-button-label">View</span>
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  loading={downloadingPdf === submission.submission_id}
                  onClick={() => void handleDownloadPdf(submission.submission_id)}
                >
                  <i className="pi pi-file-pdf" />
                  <span className="p-button-label">PDF</span>
                </Button>
              </div>
            </Card.Content>
          </Card.Root>
        ))}
      </div>
    )
  }

  const renderEvents = () => {
    if (eventsLoading) {
      return (
        <div className="profile-tab-loading">
          <Skeleton height="4rem" className="w-full" />
          <Skeleton height="4rem" className="w-full" />
        </div>
      )
    }
    if (events.length === 0) {
      return <EmptyState message="No registered events yet." hint="Browse public events and register to see them here." icon="pi-calendar-plus" />
    }
    return (
      <div className="profile-tab-list">
        {events.map((item) => (
          <Card.Root key={item.schedule_id} className="profile-tab-card">
            <Card.Content>
              <div className="profile-tab-row">
                <div className="profile-tab-info">
                  <h3 className="profile-tab-title">{item.facility_name}</h3>
                  <p className="profile-tab-meta">
                    {formatDateTime(item.event_start_date_time)} — {formatDateTime(item.event_end_date_time)}
                  </p>
                  <p className="profile-tab-meta">{venueAddress(item)}</p>
                </div>
                <Tag severity={new Date(item.event_start_date_time).getTime() > Date.now() ? 'success' : 'secondary'} rounded>
                  {new Date(item.event_start_date_time).getTime() > Date.now() ? 'Upcoming' : 'Past'}
                </Tag>
              </div>
            </Card.Content>
          </Card.Root>
        ))}
      </div>
    )
  }

  const renderMessages = () => {
    if (inboxLoading) {
      return (
        <div className="profile-tab-loading">
          <Skeleton height="4rem" className="w-full" />
          <Skeleton height="4rem" className="w-full" />
        </div>
      )
    }
    if (inbox.length === 0) {
      return <EmptyState message="No messages yet." hint="Coaches and staff will message you here." icon="pi-inbox" />
    }
    return (
      <div className="profile-tab-list">
        {inbox.map((message) => (
          <Card.Root
            key={message.message_id}
            className={`profile-tab-card ${message.is_read ? '' : 'profile-tab-card-unread'}`}
          >
            <Card.Content>
              <button type="button" className="profile-tab-row profile-tab-row-button" onClick={() => void handleOpenMessage(message)}>
                <div className="profile-tab-info">
                  <h3 className="profile-tab-title">
                    {message.subject}
                    {!message.is_read && <span className="profile-unread-dot" aria-label="Unread" />}
                  </h3>
                  <p className="profile-tab-meta">
                    From {message.sender_name} · {formatDateTime(message.sent_at)}
                  </p>
                  <p className="profile-tab-snippet">{message.body}</p>
                </div>
                <Tag severity={message.is_read ? 'secondary' : 'info'} rounded>
                  {message.is_read ? 'Read' : 'Unread'}
                </Tag>
              </button>
            </Card.Content>
          </Card.Root>
        ))}
      </div>
    )
  }

  return (
    <div className="app-crud-page">
      <PageHeader title="Profile" subtitle="Your account and correspondence." />
      <Card.Root className="profile-header-card">
        <Card.Content>
          <div className="profile-header">
            <Avatar.Root shape="circle" size="xlarge" className="profile-header-avatar">
              <Avatar.Image src={user?.picture} alt={user?.name ?? 'Profile avatar'} />
              <Avatar.Fallback>{getInitials(user?.name)}</Avatar.Fallback>
            </Avatar.Root>
            <div className="profile-header-info">
              <div className="profile-header-name-row">
                <h2 className="profile-header-name">{user?.name ?? user?.email ?? 'Member'}</h2>
                {role ? (
                  <Tag severity={ROLE_SEVERITY[role]} rounded>
                    {ROLE_LABEL[role]}
                  </Tag>
                ) : null}
              </div>
              {user?.email ? <p className="profile-header-email">{user.email}</p> : null}
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <Tabs.Root
        value={activeTab}
        onValueChange={(event: TabsRootChangeEvent) => setActiveTab(String(event.value ?? 'forms'))}
      >
        <Tabs.List>
          <Tabs.Tab value="forms">
            <i className="pi pi-file-edit" />
            <span>My Forms</span>
          </Tabs.Tab>
          <Tabs.Tab value="events">
            <i className="pi pi-calendar-plus" />
            <span>My Events</span>
          </Tabs.Tab>
          <Tabs.Tab value="messages">
            <i className="pi pi-inbox" />
            <span>My Messages</span>
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panels>
          <Tabs.Panel value="forms">{renderForms()}</Tabs.Panel>
          <Tabs.Panel value="events">{renderEvents()}</Tabs.Panel>
          <Tabs.Panel value="messages">{renderMessages()}</Tabs.Panel>
        </Tabs.Panels>
      </Tabs.Root>

      <Dialog.Root
        visible={viewSubmission !== null}
        modal
        dismissable
        blockScroll
        onOpenChange={(event: DialogRootChangeEvent) => {
          if (!event.value) {
            setViewSubmission(null)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content className="profile-dialog-content">
              <Dialog.Header>
                <Dialog.Title>Submission — {viewSubmission?.facility_name ?? '…'}</Dialog.Title>
                <Dialog.HeaderActions>
                  <Dialog.Close aria-label="Close">
                    <i className="pi pi-times" />
                  </Dialog.Close>
                </Dialog.HeaderActions>
              </Dialog.Header>
              <div className="profile-dialog-body">
                {viewSubmission === null ? null : (
                  <>
                    <div className="profile-tab-meta">
                      Submitted {formatDateTime(viewSubmission.submitted_at)}
                      {viewSubmission.signed_at ? ` · Signed ${formatDateTime(viewSubmission.signed_at)}` : ''}
                    </div>
                    {viewSubmission.responses.length === 0 ? (
                      <EmptyState message="No answers recorded." icon="pi-info-circle" />
                    ) : (
                      <ul className="profile-response-list">
                        {viewSubmission.responses.map((response) => (
                          <li key={response.response_id ?? response.question_id} className="profile-response-item">
                            <span className="profile-response-question">Question {response.question_id}</span>
                            <span className="profile-response-answer">
                              {response.answer_text ?? (response.answer_bool ? 'Yes' : 'No')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        visible={viewMessage !== null}
        modal
        dismissable
        blockScroll
        onOpenChange={(event: DialogRootChangeEvent) => {
          if (!event.value) {
            setViewMessage(null)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content className="profile-dialog-content">
              <Dialog.Header>
                <Dialog.Title>{viewMessage?.subject ?? 'Message'}</Dialog.Title>
                <Dialog.HeaderActions>
                  <Dialog.Close aria-label="Close">
                    <i className="pi pi-times" />
                  </Dialog.Close>
                </Dialog.HeaderActions>
              </Dialog.Header>
              <div className="profile-dialog-body">
                {viewMessage === null ? null : (
                  <>
                    <p className="profile-tab-meta">
                      From {viewMessage.sender_name} · {formatDateTime(viewMessage.sent_at)}
                    </p>
                    <p className="profile-message-body">{viewMessage.body}</p>
                  </>
                )}
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}