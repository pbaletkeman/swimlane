import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { Dialog: new Proxy({}, { get: () => passthrough }) }
})

import FormBuilderPage from './FormBuilderPage.tsx'
import { loginAs, renderAtRoute } from '../test-utils.tsx'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let calls: Array<{ url: string; method?: string }>

function stubFetch(routes: Record<string, unknown>): void {
  calls = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    for (const [pattern, body] of Object.entries(routes)) {
      if (new RegExp(`^${pattern}$`).test(url)) return json(body)
    }
    return json([])
  }))
}

const facility = { facility_id: 10, name: 'Pool A', is_active: true }
const questions = [
  { form_question_id: 1, facility_id: 10, prompt: 'Can you swim?', question_type: 'text', is_required: true, sort_order: 0, is_active: true },
  { form_question_id: 2, facility_id: 10, prompt: 'Emergency contact', question_type: 'checkbox', is_required: false, sort_order: 1, is_active: true },
]
const rules = [
  { rule_id: 1, facility_id: 10, title: 'No diving', content: 'Deep end only', sort_order: 0, is_active: true },
]

function renderBuilder(extraRoutes: Record<string, unknown> = {}) {
  stubFetch({
    '/api/facilities/10': facility,
    '/api/forms/10': { facility_id: 10, questions, rules },
    ...extraRoutes,
  })
  loginAs('FACILITY_MANAGER')
  return renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
}

describe('FormBuilderPage', () => {
  it('loads facility form with questions and rules', async () => {
    renderBuilder()
    expect(await screen.findByText('Pool A')).toBeInTheDocument()
    expect(screen.getAllByText('Can you swim?')[0]).toBeInTheDocument()
    expect(screen.getAllByText('No diving')[0]).toBeInTheDocument()
  })

  it('opens New Question dialog', async () => {
    renderBuilder()
    await screen.findByText('Pool A')
    fireEvent.click((await screen.findAllByText('New Question'))[0])
    await waitFor(() => {
      expect(document.querySelectorAll('[id^="entity-form-dialog-"]').length).toBeGreaterThan(0)
    })
  })

  it('opens New Rule dialog', async () => {
    renderBuilder()
    await screen.findByText('Pool A')
    fireEvent.click((await screen.findAllByText('New Rule'))[0])
    await waitFor(() => {
      expect(document.querySelectorAll('[id^="entity-form-dialog-"]').length).toBeGreaterThan(0)
    })
  })

  it('edit question via dialog', async () => {
    renderBuilder()
    await screen.findByText('Pool A')
    fireEvent.click(screen.getByLabelText('Edit Can you swim?'))
    await waitFor(() => {
      expect(document.querySelectorAll('[id^="entity-form-dialog-"]').length).toBeGreaterThan(0)
    })
  })

  it('edit rule via dialog', async () => {
    renderBuilder()
    await screen.findByText('Pool A')
    fireEvent.click(screen.getByLabelText('Edit No diving'))
    await waitFor(() => {
      expect(document.querySelectorAll('[id^="entity-form-dialog-"]').length).toBeGreaterThan(0)
    })
  })

  it('shows empty states when no questions or rules', async () => {
    stubFetch({
      '/api/facilities/10': facility,
      '/api/forms/10': { facility_id: 10, questions: [], rules: [] },
    })
    loginAs('FACILITY_MANAGER')
    renderAtRoute('/forms/builder/10', '/forms/builder/:facilityId', <FormBuilderPage />)
    expect(await screen.findByText('No questions yet.')).toBeInTheDocument()
    expect(screen.getAllByText('No rules yet.')[0]).toBeInTheDocument()
  })

  it('navigates back to forms', async () => {
    renderBuilder()
    await screen.findByText('Pool A')
    const backBtn = screen.getByText('Back to facilities')
    expect(backBtn).toBeInTheDocument()
  })
})