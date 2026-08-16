import { createContext, useContext } from 'react'
import type { User, UserRole } from './types.ts'

export interface AuthContextValue {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
  login: () => void
  logout: () => void
  hasRole: (required: UserRole) => boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}