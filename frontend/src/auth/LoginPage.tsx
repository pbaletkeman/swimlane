/**
 * Login page with Google OAuth button.
 */
import { Button } from 'primereact/button'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth-context.ts'

/** Login page that redirects authenticated users to the dashboard. */
export function LoginPage() {
  const { accessToken, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="login-page">
        <i className="pi pi-spin pi-spinner login-spinner" />
      </div>
    )
  }

  if (accessToken) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Swimlane</h1>
        <p className="login-subtitle">Swimming team management</p>
        <Button type="button" className="login-button" onClick={login}>
          <i className="p-button-icon pi pi-google" />
          <span className="p-button-label">Sign in with Google</span>
        </Button>
      </div>
    </div>
  )
}