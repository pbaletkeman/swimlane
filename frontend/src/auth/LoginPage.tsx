import { Button } from 'primereact/button'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth-context.ts'

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
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Swimlane</h1>
        <p className="login-subtitle">Swimming team management</p>
        <Button
          label="Sign in with Google"
          icon="pi pi-google"
          className="login-button"
          onClick={login}
        />
      </div>
    </div>
  )
}