import { ROLE_RANK } from './types.ts'
import type { User, UserRole } from './types.ts'

const ACCESS_TOKEN_KEY = 'swimlane.accessToken'
const REFRESH_TOKEN_KEY = 'swimlane.refreshToken'
const USER_KEY = 'swimlane.user'

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY)

export const setAccessToken = (token: string): void => localStorage.setItem(ACCESS_TOKEN_KEY, token)

export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY)

export const setRefreshToken = (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token)

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export const getStoredUser = <T = User>(): T | null => {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const setStoredUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearStoredUser = (): void => {
  localStorage.removeItem(USER_KEY)
}

export interface JwtPayload {
  sub?: string
  role?: string
  type?: string
  exp?: number
}

/** Decode the (unverified) payload of a JWT for client-side display only. */
export function decodeTokenPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binary = atob(padded)
    const json = decodeURIComponent(
      binary
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function getRoleFromToken(token: string | null): UserRole | null {
  if (!token) return null
  const payload = decodeTokenPayload(token)
  if (!payload?.role || !(payload.role in ROLE_RANK)) return null
  return payload.role as UserRole
}