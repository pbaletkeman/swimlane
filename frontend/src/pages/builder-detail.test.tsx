/**
 * Final surgical batch:
 * - FormBuilderPage: edit + delete flows for questions and rules
 * - ProfilePage: submission detail dialog (fetches responses on open)
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

import FormBuilderPage from './FormBuilderPage.tsx'
import ProfilePage from './ProfilePage.tsx'
import { loginAs, renderAtRoute, renderPage } from '../test-utils.tsx'

let calls: Array<{ url: string; method: string; init?: RequestInit }>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetch(routes: Record<string, unknown>): void {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method, init })
      for (const [pattern, body] of Object.entries(routes)) {
        if (new RegExp(`^${pattern}$`).test(url)) return jsonResponse(body)
      }
      return jsonResponse({ message: 'ok' })
    }),
  )
}

const formData = {
  facility_id: 1,
  questions: [
    { form_question_id: 9, facility_id: 1, prompt: 'Emergency contact?', question_type: 'text', is_required: true, sort_order: 1 },
  ],
  rules: [{ rule_id: 4, facility_id: 1, title: 'No diving', content: 'Shallow end', sort_order: 1 }],
}

describe('FormBuilderPage edit/delete', () => {
  beforeEach(() => {
    loginAs('WEB_ADMIN', 'admin-builder')
    installFetch({
      '/api/facilities/1': { facility_id: 1, name: 'Main Pool' },
      '/api/forms/1': formData,
    })
  })

  async function open(): Promise<void> {
    renderAtRoute('/forms/builder/1', '/forms/builder/:facilityId', <FormBuilderPage />)
    await screen.findAllByText(/Emergency contact\?/)
  }

  it('edits an existing question through the row action', async () => {
    await open()
    fireEvent.click(screen.getByLabelText(/Edit Emergency contact/))

    const input = document.getElementById('entity-form-dialog-prompt') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input!.value).toBe('Emergency contact?')

    fireEvent.change(input!, { target: { value: 'Updated prompt?' } });
    (input!.closest('form') ?? document.querySelector('form'))?.requestSubmit()

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/questions/9' && c.method === 'PUT')).toBe(true),
    )
  })

  it('deletes a question via ConfirmDelete', async () => {
    await open()
    fireEvent.click(document.querySelector('[aria-label^="Delete"]')!)
    // both authoring dialogs are always-mounted passthroughs; fire every confirm
    const confirms = screen.getAllByText('Delete').map((el) => el.closest('button')!)
    confirms.forEach((b) => fireEvent.click(b))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/questions/9' && c.method === 'DELETE')).toBe(true),
    )
  })

  it('deletes a rule via ConfirmDelete', async () => {
    await open()

    const ruleTrigger = document.querySelectorAll('[aria-label^="Delete"]')[1]
    fireEvent.click(ruleTrigger!)
    const ruleConfirms = screen.getAllByText('Delete').map((el) => el.closest('button')!)
    ruleConfirms.forEach((b) => fireEvent.click(b))

    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/rules/4' && c.method === 'DELETE')).toBe(true),
    )
  })
})

describe('ProfilePage submission detail', () => {
  it('fetches and renders the response list when a submission is opened', async () => {
    loginAs('MEMBER', 'profile-detail')
    installFetch({
      '/api/schedules/me': [],
      '/api/forms/me/submissions': [
        { submission_id: 3, facility_id: 1, facility_name: 'Main Pool', signed_at: '2026-08-01T10:00:00Z', submitted_at: '2026-08-01T10:00:01Z', is_complete: true },
      ],
      '/api/messages/me': [],
      '/api/forms/submissions/3': {
        submission: { submission_id: 3, facility_id: 1, sub: 'profile-detail' },
        responses: [
          { form_response_id: 1, question_id: 9, answer_text: 'Yes', answer_bool: null },
        ],
      },
    })
    renderPage(<ProfilePage />)

    // open the submission detail dialog (View button appears once rows load)
    await vi.waitFor(() => {
      if (!screen.getAllByText('View').length) throw new Error('no View buttons yet')
    })
    const viewButton = screen.getAllByText('View').map((el) => el.closest('button')!)[0]
    fireEvent.click(viewButton)

    // detail fetch fires and the response list renders
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/forms/submissions/3')).toBe(true),
    )
    await vi.waitFor(() => expect(document.body.innerHTML).toContain('Question 9'))
  })
})
