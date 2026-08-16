import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiBaseUrl, AUTH_UNAUTHORIZED_EVENT } from '../api/client.ts'
import { AuthContext } from './auth-context.ts'
import type { AuthContextValue } from './auth-context.ts'
import { clearStoredUser, clearTokens, getAccessToken, getRefreshToken, getRoleFromToken, getStoredUser } from './tokens.ts'
import { ROLE_RANK } from './types.ts'
import type { User, UserRole } from './types.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>())
  const [accessToken, setAccessTokenState] = useState<string | null>(() => getAccessToken())
  const [refreshToken] = useState<string | null>(() => getRefreshToken())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial hydration of the stored session is synchronous, but exposing a
    // brief `loading` phase lets the login page / RouteGuard avoid flashing.
    setLoading(false)
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      clearTokens()
      clearStoredUser()
      setUser(null)
      setAccessTokenState(null)
      // Hard redirect to the login screen once the session is unrecoverable.
      window.location.href = '/login'
    }
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = (): void => {
    // Google OAuth consent screen; the backend redirects back to
    // /auth/callback with the local JWTs appended.
    window.location.href = `${apiBaseUrl}/login`
  }

  const logout = (): void => {
    // Best-effort server-side session clear (the endpoint needs no access token).
    fetch(`${apiBaseUrl}/logout`, { method: 'GET' }).catch(() => {})
    clearTokens()
    clearStoredUser()
    setUser(null)
    setAccessTokenState(null)
    window.location.href = '/login'
  }

  const hasRole = (required: UserRole): boolean => {
    const role = getRoleFromToken(getAccessToken())
    if (!role) return false
    return ROLE_RANK[role] <= ROLE_RANK[required]
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      loading,
      login,
      logout,
      hasRole,
    }),
    [user, accessToken, refreshToken, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}