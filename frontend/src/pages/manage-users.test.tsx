/**
 * Deep interaction tests for ManageUsersPage — coach-filtered listing, soft
 * delete, and admin-gated permanent delete with reason.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    Dialog: new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (typeof prop === 'symbol' || prop === 'then' || prop === '$$typeof') return undefined
          return passthrough
        },
      },
    ),
  }
})

import ManageUsersPage from './ManageUsersPage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'
import type { UserRole } from '../auth/types.ts'

let calls: Array<{ url: string; method: string }>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetch(coaches: unknown[]): void {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (method === 'GET' && url.startsWith('/api/users')) return jsonResponse(coaches)
      if (method === 'DELETE' && url.endsWith('/hard'))
        return jsonResponse({ message: 'User permanently deleted' })
      if (method === 'DELETE') return jsonResponse({ message: 'User soft-deleted' })
      return jsonResponse({ message: 'ok' })
    }),
  )
}

const coaches = [{ sub: 'coach-1', role: 'coach', name: 'Carla Coach', email: 'c****@example.com', is_active: true, is_deleted: false }]

async function openAs(role: UserRole): Promise<void> {
  loginAs(role, `${role.toLowerCase()}-test`)
  renderPage(<ManageUsersPage />)
  await screen.findAllByText('Carla Coach')
}

describe('ManageUsersPage', () => {
  beforeEach(() => {
    installFetch(coaches)
  })

  it('loads users filtered by coach role by default', async () => {
    await openAs('WEB_ADMIN')
    expect(calls.some((c) => c.url.includes('/api/users?role=coach'))).toBe(true)
  })

  it('soft deletes a coach after confirmation', async () => {
    await openAs('WEB_ADMIN')

    fireEvent.click(document.querySelector('[aria-label^="Delete"]')!)
    fireEvent.click(await screen.findByText('Delete'))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/users/coach-1' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('offers permanent delete with mandatory reason for WEB_ADMIN', async () => {
    await openAs('WEB_ADMIN')

    const hardButton = document.querySelector('[aria-label^="Permanently delete"]')
    expect(hardButton).not.toBeNull()
    fireEvent.click(hardButton!)

    // confirm disabled until a reason is entered
    const confirmBtn = screen.getByText('Delete permanently').closest('button') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
    fireEvent.change(document.getElementById('confirm-delete-reason')!, {
      target: { value: 'account cleanup' },
    })
    fireEvent.click(screen.getByText('Delete permanently'))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/users/coach-1/hard' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('hides the permanent-delete affordance for FACILITY_MANAGER', async () => {
    await openAs('FACILITY_MANAGER')
    expect(document.querySelector('[aria-label^="Permanently delete"]')).toBeNull()
  })
})
