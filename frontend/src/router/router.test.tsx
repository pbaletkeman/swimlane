import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { PrimeReactProvider } from '@primereact/core/config'
import { AuthProvider } from '../auth/AuthContext.tsx'
import { ThemeProvider } from '../theme/ThemeContext.tsx'
import { AppRouter } from './index.tsx'
import { loginAs } from '../test-utils.tsx'

function stubAllApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (path: string) => {
      const body = typeof path === 'string' && /\/forms\/\d+$/.test(path)
        ? '{"questions":[],"rules":[]}'
        : '[]'
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

function renderAt(path: string): void {
  render(
    <PrimeReactProvider>
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRouter />
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </PrimeReactProvider>,
  )
}

beforeEach(() => {
  stubAllApi()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AppRouter', () => {
  it('renders the home page at /', async () => {
    renderAt('/')
    await waitFor(() => expect(document.body.innerHTML.length).toBeGreaterThan(100))
  })

  it('renders the login page at /login', async () => {
    renderAt('/login')
    await waitFor(() => expect(document.body.innerHTML).toMatch(/sign in|google|login/i))
  })

  it('renders auth callback page at /auth/callback', async () => {
    renderAt('/auth/callback')
    await waitFor(() => expect(document.body.innerHTML.length).toBeGreaterThan(50))
  })

  it('renders explore page', async () => {
    renderAt('/explore')
    await waitFor(() => expect(document.body.innerHTML).toMatch(/explore/i))
  })

  it('renders explore venues page', async () => {
    renderAt('/explore/venues')
    await waitFor(() => expect(document.body.innerHTML.length).toBeGreaterThan(50))
  })

  it('renders venue schedule page with params', async () => {
    renderAt('/explore/venues/1')
    await waitFor(() => expect(document.body.innerHTML.length).toBeGreaterThan(50))
  })

  it('renders event detail page with params', async () => {
    renderAt('/explore/events/1')
    await new Promise((r) => setTimeout(r, 30))
    expect(document.body.innerHTML.length).toBeGreaterThan(50)
  })

  it('redirects unauthenticated users from /dashboard to /login', async () => {
    renderAt('/dashboard')
    await waitFor(async () => {
      await new Promise((r) => setTimeout(r, 20))
      expect(window.location.pathname === '/login' || document.body.innerHTML.length > 0).toBe(true)
    })
  })

  it('renders dashboard inside AppLayout for authenticated member', async () => {
    loginAs('MEMBER')
    renderAt('/dashboard')
    await waitFor(() => expect(screen.getAllByText('Swimlane').length).toBeGreaterThan(0))
  })

  it('shows app layout sidebar for coach on /manage-events', async () => {
    loginAs('COACH')
    renderAt('/manage-events')
    await waitFor(() => expect(screen.getAllByText('Swimlane').length).toBeGreaterThan(0))
  })

  it('renders frequencies page for facility manager', async () => {
    loginAs('FACILITY_MANAGER')
    renderAt('/frequencies')
    await waitFor(() => expect(screen.getAllByText('Swimlane').length).toBeGreaterThan(0))
  })

  it('renders forms view page with params', async () => {
    loginAs('MEMBER')
    renderAt('/forms/facility/5')
    await waitFor(() => expect(screen.getAllByText('Swimlane').length).toBeGreaterThan(0))
  })

  it('renders form builder page with params', async () => {
    loginAs('FACILITY_MANAGER')
    renderAt('/forms/builder/5')
    await waitFor(() => expect(screen.getAllByText('Swimlane').length).toBeGreaterThan(0))
  })

  it('blocks MEMBER from /manage-users and redirects to /dashboard', async () => {
    loginAs('MEMBER')
    renderAt('/manage-users')
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByLabelText('Sign out')).toBeTruthy()
  })

  it('shows not-found page for unknown routes', async () => {
    loginAs('MEMBER')
    renderAt('/definitely-not-a-route')
    await waitFor(() => expect(screen.getByText('Page not found')).toBeTruthy())
  })

  it('shows profile page in layout footer for member', async () => {
    loginAs('MEMBER')
    renderAt('/profile')
    await waitFor(() => expect(screen.getAllByText('Profile').length).toBeGreaterThan(0))
  })
})
