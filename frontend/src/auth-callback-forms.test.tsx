/**
 * Tests for AuthCallbackPage (OAuth hand-off storage + redirects) and the
 * remaining forms.ts wrappers (question/rule CRUD + bulk variants).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderPage } from './test-utils.tsx'
import { clearTokens, getAccessToken, getRefreshToken, getStoredUser } from './auth/tokens.ts'

// --- AuthCallbackPage ----------------------------------------------------

function stubLocation(search: string): ReturnType<typeof vi.fn> {
  const replace = vi.fn()
  vi.stubGlobal('location', { search, replace })
  return replace
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
  })

  it('stores tokens and user, then redirects to /dashboard', async () => {
    const replace = stubLocation('?access_token=a&refresh_token=r&user=%7B%22sub%22%3A%22u9%22%7D')
    const { AuthCallbackPage } = await import('./auth/AuthCallbackPage.tsx')
    renderPage(<AuthCallbackPage />)

    expect(getAccessToken()).toBe('a')
    expect(getRefreshToken()).toBe('r')
    expect(getStoredUser()?.sub).toBe('u9')
    expect(replace).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to /login when tokens are missing', async () => {
    const replace = stubLocation('')
    const { AuthCallbackPage } = await import('./auth/AuthCallbackPage.tsx')
    renderPage(<AuthCallbackPage />)

    expect(replace).toHaveBeenCalledWith('/login')
    expect(getAccessToken()).toBeNull()
  })

  it('clears a corrupt user payload but still completes sign-in', async () => {
    localStorage.setItem('swimlane.user', '{"old":1}')
    const replace = stubLocation('?access_token=a2&refresh_token=r2&user=not-json')
    const { AuthCallbackPage } = await import('./auth/AuthCallbackPage.tsx')
    renderPage(<AuthCallbackPage />)

    expect(getAccessToken()).toBe('a2')
    expect(getStoredUser()).toBeNull()
    expect(replace).toHaveBeenCalledWith('/dashboard')
  })
})

// --- forms.ts remaining wrappers -----------------------------------------

import forms from './api/forms.ts'

let calls: Array<{ url: string; method: string; init?: RequestInit }>

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', init })
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

describe('forms API — question management', () => {
  beforeEach(() => {
    calls = []
  })

  it('submitForm posts to /forms/{id}/submit', async () => {
    await forms.submitForm(3, { signed: true, responses: [] } as never)
    expect(calls[0]).toMatchObject({ url: '/api/forms/3/submit', method: 'POST' })
  })

  it('getSubmission fetches detail by id', async () => {
    await forms.getSubmission(8)
    expect(calls[0].url).toBe('/api/forms/submissions/8')
  })

  it('updateQuestion / deleteQuestion hit their paths', async () => {
    await forms.updateQuestion(4, {} as never)
    expect(calls[0]).toMatchObject({ url: '/api/forms/questions/4', method: 'PUT' })
    await forms.deleteQuestion(4)
    expect(calls[1].url).toBe('/api/forms/questions/4')
  })

  it('bulk question endpoints wrap ids into request bodies', async () => {
    await forms.createQuestionsBulk([{}] as never)
    expect(calls[0].url).toBe('/api/forms/questions/bulk')

    await forms.deleteQuestionsBulk([7, 9])
    expect(calls[1].url).toBe('/api/forms/questions/bulk')
    expect(JSON.parse(String(calls[1].init?.body))).toEqual([
      { form_question_id: 7 },
      { form_question_id: 9 },
    ])

    await forms.hardDeleteQuestionsBulk([7])
    expect(calls[2].url).toBe('/api/forms/questions/bulk/hard')
  })
})

describe('forms API — rule management', () => {
  beforeEach(() => {
    calls = []
  })

  it('create/update/delete/hard-delete rules', async () => {
    await forms.createRule({} as never)
    expect(calls[0]).toMatchObject({ url: '/api/forms/rules', method: 'POST' })

    await forms.updateRule(5, {} as never)
    expect(calls[1]).toMatchObject({ url: '/api/forms/rules/5', method: 'PUT' })

    await forms.deleteRule(5)
    expect(calls[2].url).toBe('/api/forms/rules/5')

    await forms.hardDeleteRule(5)
    expect(calls[3].url).toBe('/api/forms/rules/5/hard')

    await forms.createRulesBulk([])
    expect(calls[4].url).toBe('/api/forms/rules/bulk')

    await forms.deleteRulesBulk([2, 3])
    expect(calls[5].url).toBe('/api/forms/rules/bulk')
    expect(JSON.parse(String(calls[5].init?.body))).toEqual([{ rule_id: 2 }, { rule_id: 3 }])

    await forms.hardDeleteRulesBulk([2])
    expect(calls[6].url).toBe('/api/forms/rules/bulk/hard')
  })
})
