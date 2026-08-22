/**
 * Deep interaction tests for the member signup-form flow (FormViewPage):
 * required-question validation, consent gating, submit, post-submit PDF
 * download, and the no-form / empty-form render states.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import FormViewPage from './FormViewPage.tsx'
import { loginAs, renderAtRoute } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string; init?: RequestInit }>
let formStatus: number

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const facility = { facility_id: 1, name: 'Main Pool', description: '25m', is_active: true }
const formData = {
  facility_id: 1,
  questions: [
    { form_question_id: 10, facility_id: 1, prompt: 'Full name?', question_type: 'text', is_required: true, sort_order: 1, is_active: true },
    { form_question_id: 9, facility_id: 1, prompt: 'Can you swim 50m?', question_type: 'checkbox', is_required: true, sort_order: 2, is_active: true },
  ],
  rules: [{ rule_id: 4, facility_id: 1, title: 'No diving', content: 'Shallow end', sort_order: 1, is_active: true }],
}

function installFetch(): void {
  calls = []
  formStatus = 200
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method, init })
      if (method === 'GET' && url === '/api/facilities/1') return jsonResponse(facility)
      if (method === 'GET' && url === '/api/forms/1') return jsonResponse(formStatus === 200 ? formData : { detail: 'no form' }, formStatus)
      if (method === 'GET' && url === '/api/forms/3') return jsonResponse({ facility_id: 3, questions: [], rules: [] })
      if (method === 'GET' && url === '/api/facilities/3') return jsonResponse({ facility_id: 3, name: 'Empty Facility', is_active: true })
      if (method === 'POST' && url === '/api/forms/1/submit')
        return jsonResponse({ submission_id: 77, facility_id: 1, sub: 'test-user', is_complete: true, submitted_at: '2026-08-22T09:00:00Z' })
      if (method === 'GET' && url === '/api/forms/submissions/77/pdf')
        return jsonResponse('%PDF-fake', 200, { 'Content-Type': 'application/pdf' })
      return jsonResponse({ message: 'ok' })
    }),
  )
}

function mount(path: string): void {
  renderAtRoute(path, '/forms/facility/:facilityId', <FormViewPage />)
}

/** Toggle a primereact Checkbox.Root via its inner native input control. */
function toggle(ariaLabel: RegExp): void {
  const root = screen.getByLabelText(ariaLabel)
  fireEvent.click(root.querySelector('input[type="checkbox"]')!)
}

beforeEach(() => {
  loginAs('MEMBER', 'test-user')
  installFetch()
})

describe('FormViewPage signup flow', () => {
  it('flags unanswered required questions and blocks submit', async () => {
    mount('/forms/facility/1')

    expect(await screen.findByText('Full name?')).toBeInTheDocument()
    expect(await screen.findByText('This question is required.')).toBeInTheDocument()
    expect(screen.getByText('This question must be checked.')).toBeInTheDocument()
    expect(screen.getByText('Check the consent box to submit.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Submit Signup Form').closest('button')!)
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/1/submit')).toBe(false),
    )
  })

  it('submits answers after filling text + checkboxes + consent', async () => {
    mount('/forms/facility/1')
    await screen.findByText('Full name?')

    fireEvent.change(document.getElementById('question-10')!, { target: { value: 'Pete Swimmer' } })
    toggle(/Can you swim 50m?/)
    toggle(/I agree to the facility rules/)

    await waitFor(() =>
      expect(screen.queryByText('This question is required.')).toBeNull(),
    )
    fireEvent.click(screen.getByText('Submit Signup Form').closest('button')!)

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/1/submit' && c.method === 'POST')).toBe(true),
    )
    const body = JSON.parse(String(calls.find((c) => c.method === 'POST')!.init?.body))
    expect(body.signed).toBe(true)
    expect(body.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ question_id: 10, answer_text: 'Pete Swimmer' }),
        expect.objectContaining({ question_id: 9, answer_bool: true }),
      ]),
    )
    // success banner replaces the editing affordances
    expect(await screen.findByText(/Your responses have been recorded/)).toBeInTheDocument()
  })

  it('downloads the PDF after a successful submit', async () => {
    const createObjectURL = vi.fn(() => 'blob:pdf-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL

    mount('/forms/facility/1')
    await screen.findByText('Full name?')

    fireEvent.change(document.getElementById('question-10')!, { target: { value: 'Pete Swimmer' } })
    toggle(/Can you swim 50m?/)
    toggle(/I agree to the facility rules/)
    fireEvent.click(screen.getByText('Submit Signup Form').closest('button')!)

    const pdfBtn = await screen.findByText('Download PDF')
    fireEvent.click(pdfBtn.closest('button')!)

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/submissions/77/pdf')).toBe(true),
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob)))
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('renders the empty state for a facility without a form', async () => {
    mount('/forms/facility/3')
    expect(await screen.findByText('No signup form yet')).toBeInTheDocument()
  })

  it('renders the not-found state when the form is missing', async () => {
    formStatus = 404
    mount('/forms/facility/1')
    expect(await screen.findByText('Form not found')).toBeInTheDocument()
  })

  it('lists facility rules alongside questions', async () => {
    mount('/forms/facility/1')
    expect(await screen.findByText('Facility Rules')).toBeInTheDocument()
    expect(screen.getByText('No diving')).toBeInTheDocument()
    expect(screen.getByText('Shallow end')).toBeInTheDocument()
  })
})
