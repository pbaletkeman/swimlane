import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth-context.ts'
import type { UserRole } from './types.ts'

interface RouteGuardProps {
  children: ReactNode
  requiredRole?: UserRole
}

/** Wrapper that redirects unauthenticated or under-privileged users away from protected routes. */
export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const { accessToken, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <i className="pi pi-spin pi-spinner" />
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}