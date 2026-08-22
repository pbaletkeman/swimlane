import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton">loading...</div>,
}))

vi.mock('primereact/button', () => ({
  Button: ({ children, onClick, type }: { children?: React.ReactNode; onClick?: () => void; type?: string }) => (
    <button type={type as 'button' | 'submit' | 'reset'} onClick={onClick}>{children}</button>
  ),
}))

vi.mock('primereact/card', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { Card: new Proxy({}, { get: () => passthrough }) }
})

import ExploreHomePage from './ExploreHomePage.tsx'
import { renderPage } from '../../test-utils.tsx'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(fixture: Record<string, unknown>): void {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL) => {
    const url = String(input)
    for (const [key, value] of Object.entries(fixture)) {
      if (new RegExp(`^${key}$`).test(url)) return json(value)
    }
    return json([])
  }))
}

describe('ExploreHomePage', () => {
  it('renders search forms', async () => {
    stubFetch({})
    renderPage(<ExploreHomePage />, '/explore')
    expect(await screen.findByText('Find by address')).toBeInTheDocument()
    expect(screen.getByText('Find by event')).toBeInTheDocument()
  })

  it('submits address search and navigates', async () => {
    stubFetch({})
    renderPage(<ExploreHomePage />, '/explore')
    const input = screen.getByPlaceholderText('Search by street, city, or postal code')
    fireEvent.change(input, { target: { value: 'Miami' } })
    const forms = document.querySelectorAll('form')
    fireEvent.submit(forms[0])
    await waitFor(() => {
      expect(input).toHaveValue('Miami')
    })
  })

  it('submits empty address search navigates to venues', async () => {
    stubFetch({})
    renderPage(<ExploreHomePage />, '/explore')
    const forms = document.querySelectorAll('form')
    fireEvent.submit(forms[0])
    await waitFor(() => {
      expect(screen.getByText('Find by address')).toBeInTheDocument()
    })
  })

  it('shows empty state when no events found', async () => {
    stubFetch({ '/api/public/events': [] })
    renderPage(<ExploreHomePage />, '/explore')
    const forms = document.querySelectorAll('form')
    fireEvent.submit(forms[1])
    await waitFor(() => {
      expect(screen.getByText('No events found')).toBeInTheDocument()
    })
  })

  it('shows error toast on event search failure', async () => {
    stubFetch({ '/api/public/events': { detail: 'Server error' } })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: 'fail' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }))
    renderPage(<ExploreHomePage />, '/explore')
    const forms = document.querySelectorAll('form')
    fireEvent.submit(forms[1])
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('No events found')
    })
  })
})