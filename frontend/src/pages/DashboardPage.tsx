import { useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { useAuth } from '../auth/auth-context.ts'
import { getRoleFromToken } from '../auth/tokens.ts'
import type { UserRole } from '../auth/types.ts'
import { NAV_ITEMS } from '../layout/nav.ts'

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

export default function DashboardPage() {
  const { user, accessToken, hasRole } = useAuth()
  const navigate = useNavigate()

  const role = getRoleFromToken(accessToken)
  const firstName = user?.given_name ?? user?.name?.split(/\s+/)[0] ?? 'there'
  const quickLinks = NAV_ITEMS.filter((item) => item.path !== '/' && hasRole(item.requiredRole))

  return (
    <div className="app-dashboard">
      <Card.Root>
        <Card.Header>
          <div className="app-dashboard-header">
            <Card.Title>Welcome{user?.name ? `, ${firstName}` : '!'}</Card.Title>
            {role ? (
              <Tag severity={ROLE_SEVERITY[role]} rounded>
                {ROLE_LABEL[role]}
              </Tag>
            ) : null}
          </div>
        </Card.Header>
        <Card.Content>
          <p className="app-dashboard-subtitle">Swimlane swimming team management.</p>
          {quickLinks.length > 0 ? (
            <>
              <h2 className="app-dashboard-links-title">Quick links</h2>
              <div className="app-dashboard-quick-links">
                {quickLinks.map((item) => (
                  <Button key={item.path} type="button" variant="outlined" onClick={() => navigate(item.path)}>
                    <i className={item.icon} />
                    <span className="p-button-label">{item.label}</span>
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </Card.Content>
      </Card.Root>
    </div>
  )
}