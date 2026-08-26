/**
 * Main app layout with sidebar navigation and content area.
 */
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { Sidebar } from 'primereact/sidebar'
import type { UseSidebarOpenChangeEvent } from '@primereact/types/headless/sidebar'
import { ThemeSwitch } from '../components/ThemeSwitch.tsx'
import { useAuth } from '../auth/auth-context.ts'
import { useMediaQuery } from '../util/media-query.ts'
import { NAV_ITEMS } from './nav.ts'

const MOBILE_QUERY = '(max-width: 767px)'

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

/** Main authenticated layout with a collapsible sidebar, top bar, and outlet. */
export function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isNarrow = useMediaQuery(MOBILE_QUERY)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    setSidebarOpen(!isNarrow)
  }, [isNarrow])

  const handleSidebarOpenChange = (event: UseSidebarOpenChangeEvent): void => {
    setSidebarOpen(event.value ?? true)
  }

  const visibleItems = NAV_ITEMS.filter((item) => hasRole(item.requiredRole))
  const isActive = (path: string): boolean =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  return (
    <Sidebar.Layout>
      <Sidebar.Root id="main" collapsible="icon" open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
        <Sidebar.Spacer />
        <Sidebar.Aside>
          <Sidebar.Panel>
            <Sidebar.Header>
              <span className="app-logo">Swimlane</span>
            </Sidebar.Header>
            <Sidebar.Content>
              <Sidebar.Group>
                <Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
                <Sidebar.GroupContent>
                  <Sidebar.Menu>
                    {visibleItems.map((item) => (
                      <Sidebar.MenuItem key={item.path}>
                        <Sidebar.MenuButton
                          isActive={isActive(item.path)}
                          onClick={() => {
                            navigate(item.path)
                            if (isNarrow) {
                              setSidebarOpen(false)
                            }
                          }}
                        >
                          <i className={item.icon} />
                          <span>{item.label}</span>
                        </Sidebar.MenuButton>
                      </Sidebar.MenuItem>
                    ))}
                  </Sidebar.Menu>
                </Sidebar.GroupContent>
              </Sidebar.Group>
            </Sidebar.Content>
            <Sidebar.Footer>
              <Sidebar.Menu>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    isActive={isActive('/profile')}
                    onClick={() => {
                      navigate('/profile')
                      if (isNarrow) {
                        setSidebarOpen(false)
                      }
                    }}
                  >
                    <i className="pi pi-user" />
                    <span>Profile</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.Footer>
            <Sidebar.Rail />
          </Sidebar.Panel>
        </Sidebar.Aside>
      </Sidebar.Root>
      <Sidebar.Main>
        <header className="app-topbar">
          <div className="app-topbar-center">Company Name & Logo</div>
          <div className="app-topbar-right">
            <div
              className="app-user-chip"
              onClick={() => navigate('/profile')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/profile') }}
            >
              <Avatar.Root shape="circle" size="normal">
                <Avatar.Image src={user?.picture} alt={user?.name ?? 'User avatar'} />
                <Avatar.Fallback>{getInitials(user?.name)}</Avatar.Fallback>
              </Avatar.Root>
              <span className="app-user-chip-name">{user?.name ?? user?.email ?? 'User'}</span>
            </div>
            <Button
              type="button"
              variant="text"
              iconOnly
              aria-label="Sign out"
              title="Sign out"
              onClick={() => logout()}
            >
              <i className="pi pi-sign-out" />
            </Button>
            <ThemeSwitch />
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </Sidebar.Main>
    </Sidebar.Layout>
  )
}
