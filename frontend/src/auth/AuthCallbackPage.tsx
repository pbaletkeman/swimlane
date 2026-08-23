/**
 * OAuth callback page: extracts JWT tokens from URL.
 */
import { useEffect, useRef } from 'react'
import { clearStoredUser, setAccessToken, setRefreshToken, setStoredUser } from './tokens.ts'
import type { User } from './types.ts'

/**
 * Landing page for the OAuth hand-off. The backend redirects the browser here
 * with `access_token`, `refresh_token`, and a JSON-encoded `user` in the query
 * string. Stores them, then sends the user to the dashboard.
 */
export function AuthCallbackPage() {
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const userRaw = params.get('user')

    if (!accessToken || !refreshToken) {
      window.location.replace('/login')
      return
    }

    setAccessToken(accessToken)
    setRefreshToken(refreshToken)

    if (userRaw) {
      try {
        setStoredUser(JSON.parse(userRaw) as User)
      } catch {
        clearStoredUser()
      }
    }

    // Full navigation reloads the app so AuthProvider rehydrates from storage.
    window.location.replace('/dashboard')
  }, [])

  return (
    <div className="app">
      <p>Completing sign-in…</p>
    </div>
  )
}