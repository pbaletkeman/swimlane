/**
 * Deep interaction tests for FrequenciesPage — the canonical CRUD page pattern
 * (load -> table -> create/edit dialogs -> soft/hard delete -> bulk).
 *
 * The PrimeReact Dialog shell is mocked as transparent passthroughs (same
 * rationale as EntityFormDialog.test.tsx); inputs/buttons run real code.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const shell = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '$$typeof') return undefined
        if (prop === 'Close' || prop === 'Title') {
          return ({ children }: { children?: React.ReactNode }) => <>{children}</>
        }
        return passthrough
      },
    },
  )
  return { Dialog: shell }
})

import FrequenciesPage from './FrequenciesPage.tsx'
import { loginAs, renderPage } from '../test-utils.tsx'
import type { Frequency } from '../api/types.ts'

const seedRow: Frequency = { frequency_id: 1, name: 'Weekly', day_interval: '7', is_active: true }

let calls: Array<{ url: string; init?: RequestInit }>

function installFetch(rows: Frequency[]): void {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, init })
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

      if (method === 'GET' && url === '/api/frequencies') return json(rows)
      if (method === 'POST' && url === '/api/frequencies')
        return json({ ...seedRow, ...JSON.parse(String(init?.body)), frequency_id: 2 })
      if (method === 'PUT' || (method === 'DELETE' && url !== '/api/frequencies/bulk')) return json({ message: 'ok' })
      return json({ message: 'ok' })
    }),
  )
}

beforeEach(() => {
  loginAs('WEB_ADMIN', 'admin-test')
  installFetch([seedRow])
})

async function openPage(): Promise<void> {
  renderPage(<FrequenciesPage />)
  await screen.findAllByText('Weekly')
}

describe('FrequenciesPage', () => {
  it('loads and renders existing frequencies in the table', async () => {
    await openPage()
    expect(screen.getByText('7')).toBeInTheDocument() // day_interval column
    expect(screen.getByLabelText('Edit Weekly')).toBeInTheDocument()
  })

  it('creates a frequency through the New dialog', async () => {
    await openPage()

    // two "New Frequency" buttons exist (header + empty-state action); use the header one
    fireEvent.click(screen.getAllByText('New Frequency')[0])
    expect(await screen.findByPlaceholderText('e.g., Weekly')).toBeInTheDocument()

    const inputs = document.querySelectorAll<HTMLInputElement>('#entity-form-dialog-name, #entity-form-dialog-day_interval')
    fireEvent.change(inputs[0], { target: { value: 'Biweekly' } })
    fireEvent.change(inputs[1], { target: { value: '14' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/frequencies' && c.init?.method === 'POST')).toBe(true),
    )
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(JSON.parse(String(post.init?.body))).toEqual({
      name: 'Biweekly',
      day_interval: '14',
      is_active: false,
    })
  })

  it('edits an existing frequency through the row action', async () => {
    await openPage()
    fireEvent.click(screen.getByLabelText('Edit Weekly'))

    const nameInput = await screen.findByPlaceholderText('e.g., Weekly')
    expect((nameInput as HTMLInputElement).value).toBe('Weekly')

    fireEvent.change(nameInput, { target: { value: 'Weekly+' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PUT')).toBe(true))
    expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe('/api/frequencies/1')
  })

  it('soft deletes through the confirm flow', async () => {
    await openPage()
    fireEvent.click(screen.getByLabelText('Delete Weekly'))
    fireEvent.click(await screen.findByText('Delete'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/frequencies/1' && c.init?.method === 'DELETE')).toBe(true),
    )
  })

  it('hides hard delete for MEMBER and shows it for WEB_ADMIN with required reason', async () => {
    await openPage()
    expect(screen.queryByLabelText('Permanently delete Weekly')).not.toBeNull() // WEB_ADMIN sees it

    fireEvent.click(screen.getByLabelText('Permanently delete Weekly'))
    const confirmButton = screen.getByText('Delete permanently').closest('button')!
    expect(confirmButton).toHaveAttribute('disabled')

    fireEvent.change(document.getElementById('confirm-delete-reason')!, { target: { value: 'cleanup' } })
    fireEvent.click(screen.getByText('Delete permanently'))
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/frequencies/1/hard' && c.init?.method === 'DELETE')).toBe(true),
    )
  })
})
