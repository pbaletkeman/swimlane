/**
 * Integration tests through the real router: <AppRouter /> exercises
 * RouteGuard redirects, AppLayout chrome (sidebar nav per role), lazy page
 * mounting, and the 404 route — against a stubbed fetch returning empty
 * collections.
 */
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { AppRouter } from './router/index.tsx'
import { loginAs, renderPage, stubListApi, type UserRole } from './test-utils.tsx'

function open(path: string, role: UserRole | null): ReturnType<typeof renderPage> {
  if (role) loginAs(role)
  stubListApi()
  return renderPage(<AppRouter />, path)
}

describe('public routes', () => {
  it('home page renders for anonymous visitors', async () => {
    open('/', null)
    expect(await screen.findAllByText('Swimlane')).not.toHaveLength(0)
  })

  it('login renders for anonymous visitors', async () => {
    open('/login', null)
    expect(await screen.findByText('Sign in with Google')).toBeInTheDocument()
  })

  it('unknown paths render the 404 error page', async () => {
    loginAs('MEMBER')
    const view = renderPage(<AppRouter />, '/definitely-not-a-route')
    await waitFor(() => expect(view.container.textContent).toContain('404'), { timeout: 3000 })
  })
})

describe('guarded routes', () => {
  it('redirects anonymous users from /dashboard to /login', async () => {
    open('/dashboard', null)
    expect(await screen.findByText('Sign in with Google')).toBeInTheDocument()
  })

  it('renders member chrome + dashboard for MEMBER', async () => {
    const view = open('/dashboard', 'MEMBER')
    await waitFor(() => expect(view.container.textContent).toContain('Welcome'), { timeout: 3000 })
    // sidebar shows member items but not manager-only ones
    expect(screen.getAllByText('My Schedule').length).toBeGreaterThan(0)
    expect(screen.queryByText('Frequencies')).toBeNull()
  })

  it('MEMBER reaches list pages but sees no data (empty state)', async () => {
    const view = open('/frequencies', 'MEMBER')
    await screen.findByText('No frequencies yet.')
    expect(view.container.textContent).not.toContain('Manage Users')
  })

  it('shows manager nav for FACILITY_MANAGER on a CRUD page', async () => {
    const view = open('/frequencies', 'FACILITY_MANAGER')
    await screen.findAllByText('Frequencies')
    expect(view.container.textContent).toContain('Manage Users')
  })

  it('manage-users is gated to FACILITY_MANAGER and above', async () => {
    const view = open('/manage-users', 'COACH')
    await waitFor(() => expect(view.container.textContent).toContain('Welcome'), { timeout: 3000 })
  })

  it('WEB_ADMIN reaches manage-users', async () => {
    open('/manage-users', 'WEB_ADMIN')
    expect(await screen.findByText('Invite User')).toBeInTheDocument()
  })
})
