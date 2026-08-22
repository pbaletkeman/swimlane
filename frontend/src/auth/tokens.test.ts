/**
 * Tests for src/auth/tokens.ts — localStorage token/user store and JWT payload
 * decoding (including the lowercase→uppercase role mapping).
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearStoredUser,
  clearTokens,
  decodeTokenPayload,
  getAccessToken,
  getRefreshToken,
  getRoleFromToken,
  getStoredUser,
  setAccessToken,
  setRefreshToken,
  setStoredUser,
} from './tokens.ts'

/** Build an unsigned JWT-shaped token with a base64url JSON payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  // TextEncoder → binary string keeps non-ASCII payloads encodable by btoa.
  const bytes = new TextEncoder().encode(json)
  const body = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${body}.signature`
}

beforeEach(() => {
  clearTokens()
  clearStoredUser()
})

describe('token store', () => {
  it('stores and reads access + refresh tokens', () => {
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()

    setAccessToken('access-1')
    setRefreshToken('refresh-1')
    expect(getAccessToken()).toBe('access-1')
    expect(getRefreshToken()).toBe('refresh-1')

    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})

describe('stored user', () => {
  it('round-trips a user object as JSON', () => {
    const user = { sub: 'u1', email: 'u1@example.com' }
    setStoredUser(user)
    expect(getStoredUser()).toEqual(user)
    clearStoredUser()
    expect(getStoredUser()).toBeNull()
  })

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem('swimlane.user', '{not json')
    expect(getStoredUser()).toBeNull()
  })
})

describe('decodeTokenPayload', () => {
  it('decodes a base64url payload including unicode', () => {
    const jwt = makeJwt({ sub: 'abc', role: 'member', nickname: 'Åse' })
    expect(decodeTokenPayload(jwt)).toMatchObject({ sub: 'abc', role: 'member' })
  })

  it('returns null for tokens without a payload segment or garbage payloads', () => {
    expect(decodeTokenPayload('no-dots')).toBeNull()
    expect(decodeTokenPayload('a.@bad.b')).toBeNull()
    expect(decodeTokenPayload('')).toBeNull()
  })
})

describe('getRoleFromToken', () => {
  it('maps null/missing token to null', () => {
    expect(getRoleFromToken(null)).toBeNull()
  })

  it('uppercases backend lowercase roles into UserRole keys', () => {
    // The backend issues e.g. "facility_manager"; ROLE_RANK keys are uppercase.
    const jwt = makeJwt({ sub: 'u1', role: 'facility_manager' })
    expect(getRoleFromToken(jwt)).toBe('FACILITY_MANAGER')
    expect(getRoleFromToken(makeJwt({ role: 'web_admin' }))).toBe('WEB_ADMIN')
    expect(getRoleFromToken(makeJwt({ role: 'MEMBER' }))).toBe('MEMBER')
  })

  it('returns null for unknown roles or tokens without a role claim', () => {
    expect(getRoleFromToken(makeJwt({ role: 'superuser' }))).toBeNull()
    expect(getRoleFromToken(makeJwt({ sub: 'u1' }))).toBeNull()
  })
})
