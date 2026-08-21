/**
 * App shell coverage:
 * - AppLayout sign-out button drives AuthProvider.logout end-to-end
 * - AuthContext.login builds the Google OAuth redirect with frontend_url
 * - HomePage quick actions navigate through the router
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { PrimeReactProvider } from '@primereact/core/config'
import { Suspense } from 'react'

import { AppLayout } from './layout/AppLayout.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { ThemeProvider } from './theme/ThemeContext.tsx'
import { AuthContext } from './auth/auth-context.ts'
import { loginAs } from './test-utils.tsx'

function Providers({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <PrimeReactProvider>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </PrimeReactProvider>
  )
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('AppLayout sign-out', () => {
  it('signs out from the topbar (logout endpoint + redirect)', async () => {
    const hrefs: string[] = []
    const fakeLocation: Record<string, unknown> = {}
    Object.defineProperty(fakeLocation, 'href', {
      set(v: string) {
        hrefs.push(String(v))
      },
      get() {
        return 'http://localhost:3000/dashboard'
      },
    })
    vi.stubGlobal('location', fakeLocation)
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ message: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)
    loginAs('MEMBER', 'layout-user')

    render(
      <Providers>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Suspense fallback="loading">
            <Routes>
              <Route
                path="/dashboard"
                element={<AppLayout />}
              />
            </Routes>
          </Suspense>
        </MemoryRouter>
      </Providers>,
    )

    await screen.findByLabelText('Sign out')
    fireEvent.click(screen.getByLabelText('Sign out'))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u) === '/api/logout')).toBe(true),
    )
    expect(hrefs.some((h) => h.includes('/login'))).toBe(true)
    expect(localStorage.getItem('swimlane.accessToken')).toBeNull()
  })
})

describe('AuthContext.login', () => {
  it('redirects to the backend login route with our origin', async () => {
    const hrefs: string[] = []
    const fakeLocation: Record<string, unknown> = {
      origin: 'http://localhost:5199',
    }
    Object.defineProperty(fakeLocation, 'href', {
      set(v: string) {
        hrefs.push(String(v))
      },
      get() {
        return ''
      },
    })
    vi.stubGlobal('location', fakeLocation)
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse({ message: 'ok' })))

    render(
      <Providers>
        <AuthContext.Consumer>
          {(value) => (
            <button type="button" onClick={() => value?.login()}>
              trigger-login
            </button>
          )}
        </AuthContext.Consumer>
      </Providers>,
    )

    fireEvent.click(screen.getByText('trigger-login'))
    expect(hrefs.some((h) => h.startsWith('/api/login?frontend_url='))).toBe(true)
  })
})

describe('HomePage navigation', () => {
  it('Explore venues button routes to /explore', async () => {
    let pathname = '/'
    function LocationSpy(): null {
      const loc = useLocation()
      pathname = loc.pathname
      return null
    }

    render(
      <PrimeReactProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <HomePage />
            <LocationSpy />
          </MemoryRouter>
        </AuthProvider>
      </PrimeReactProvider>,
    )

    fireEvent.click(screen.getByText('Explore venues'))
    await waitFor(() => expect(pathname).toBe('/explore'))
  })
})
