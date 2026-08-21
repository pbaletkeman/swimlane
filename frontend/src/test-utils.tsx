/**
 * Shared helpers for component tests.
 *
 * - makeJwt builds unsigned JWT-shaped tokens (same shape the backend issues)
 *   so AuthProvider.hasRole works against localStorage.
 * - loginAs seeds a session for the given role.
 * - renderPage / renderAtRoute wrap content in the providers pages expect
 *   (PrimeReactProvider -> AuthProvider -> MemoryRouter), matching main.tsx.
 * - stubListApi soft-stubs fetch with empty JSON arrays so list endpoints
 *   resolve without network; detail-heavy tests should stub more precisely.
 */
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { PrimeReactProvider } from '@primereact/core/config'
import { AuthProvider } from './auth/AuthContext.tsx'
import { setAccessToken, setStoredUser } from './auth/tokens.ts'
import type { User, UserRole } from './auth/types.ts'
import { vi } from 'vitest'

export function makeJwt(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  const body = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  return `${header}.${body}.signature`
}

export function loginAs(role: UserRole = 'MEMBER', sub = 'test-user'): void {
  setAccessToken(makeJwt({ sub, role: role.toLowerCase(), type: 'access', exp: 4102444800 }))
  setStoredUser({ sub } satisfies User)
}

export function renderPage(node: ReactNode): ReturnType<typeof render> {
  return render(
    <PrimeReactProvider>
      <AuthProvider>
        <Suspense fallback="loading">
          <MemoryRouter>{node}</MemoryRouter>
        </Suspense>
      </AuthProvider>
    </PrimeReactProvider>,
  )
}

export function renderAtRoute(path: string, template: string, element: ReactNode): ReturnType<typeof render> {
  return render(
    <PrimeReactProvider>
      <AuthProvider>
        <Suspense fallback="loading">
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={template} element={element} />
            </Routes>
          </MemoryRouter>
        </Suspense>
      </AuthProvider>
    </PrimeReactProvider>,
  )
}

/** Every GET resolves to an empty JSON array; other methods resolve {}. */
export function stubListApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(async (_path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = method === 'GET' ? '[]' : '{}'
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
