/**
 * React context and hook for authentication state.
 */
import { createContext, useContext } from 'react'
import type { User, UserRole } from './types.ts'

/** Shape of the authentication context exposed by AuthProvider. */
export interface AuthContextValue {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
  login: () => void
  logout: () => void
  hasRole: (required: UserRole) => boolean
}

/** React context holding the current authentication state. */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Hook that returns the current auth context; throws if used outside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}