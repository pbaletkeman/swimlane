/**
 * Final interactions:
 * - ProfilePage: opening an unread message marks it read (PUT /messages/{id}/read)
 * - AppLayout: narrow-sidebar branch via matchMedia override
 * - AuthContext: AUTH_UNAUTHORIZED_EVENT handler clears session and redirects
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { PrimeReactProvider } from '@primereact/core/config'
import { ThemeProvider } from './theme/ThemeContext.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { AUTH_UNAUTHORIZED_EVENT } from './api/client.ts'
import ProfilePage from './pages/ProfilePage.tsx'
import { AppLayout } from './layout/AppLayout.tsx'
import { loginAs } from './test-utils.tsx'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function fullRender(node: React.ReactNode, path?: string): ReturnType<typeof render> {
  return render(
    <PrimeReactProvider>
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={path ? [path] : undefined}>{node}</MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </PrimeReactProvider>,
  )
}

describe('ProfilePage mark-read', () => {
  beforeEach(() => {
    loginAs('MEMBER', 'inbox-user')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url === '/api/messages/5/read' && method === 'PUT') {
          return jsonResponse({
            message_id: 5,
            member_id: 'inbox-user',
            sender_id: 'coach-1',
            subject: 'Welcome aboard',
            body: 'See you at practice',
            is_read: true,
            sent_at: '2026-08-02T09:00:00Z',
            is_active: true,
          })
        }
        if (url === '/api/messages/me') {
          return jsonResponse([
            {
              message_id: 5,
              member_id: 'inbox-user',
              sender_id: 'coach-1',
              subject: 'Welcome aboard',
              body: 'See you at practice',
              is_read: false,
              sent_at: '2026-08-02T09:00:00Z',
              is_active: true,
            },
          ])
        }
        return jsonResponse([])
      }),
    )
  })

  it('marks an unread message as read when opened', async () => {
    fullRender(<ProfilePage />)

    // switch to the messages panel
    fireEvent.click(await screen.findByText('My Messages'))
    await screen.findByText('Welcome aboard')

    // the whole message card is a button; opening it marks the message read
    fireEvent.click(screen.getByText('Welcome aboard').closest('button')!)

    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([u]) => String(u) === '/api/messages/5/read'),
      ).toBe(true),
    )
  })
})

describe('AppLayout narrow sidebar', () => {
  it('renders the narrow variant when the media query matches', async () => {
    loginAs('MEMBER', 'narrow-user')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse([])))
    // override setup-file matchMedia so "narrow" matches
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )

    fullRender(<AppLayout />, '/dashboard')

    await waitFor(() => expect(document.body.innerHTML).toContain('app-topbar'))
  })
})

describe('AuthContext unauthorized handler', () => {
  it('clears session state on the unauthorized event', async () => {
    loginAs('MEMBER', 'session-user')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse({ message: 'ok' })))
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

    fullRender(
      <button type="button" onClick={() => window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))}>
        fire-unauth
      </button>,
    )

    fireEvent.click(screen.getByText('fire-unauth'))
    await waitFor(() => expect(hrefs.some((h) => h.includes('/login'))).toBe(true))
    expect(localStorage.getItem('swimlane.accessToken')).toBeNull()
  })
})
