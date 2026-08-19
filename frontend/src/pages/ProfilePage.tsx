import { Avatar } from 'primereact/avatar'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { useAuth } from '../auth/auth-context.ts'
import { getRoleFromToken } from '../auth/tokens.ts'
import type { UserRole } from '../auth/types.ts'
import { PageHeader } from '../components/PageHeader.tsx'

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

/**
 * Member profile page (Phase E): header card with the Google identity and role.
 */
export default function ProfilePage() {
  const { user, accessToken } = useAuth()
  const role = getRoleFromToken(accessToken)

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
    </div>
  )
}