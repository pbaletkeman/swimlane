import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context.ts'

export function HomePage() {
  const { accessToken, loading, login } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Swimlane</h1>
        <p className="login-subtitle">Swimming team management</p>
        <p className="home-tagline">Welcome to Swimlane. Home page content is coming soon.</p>
        <div className="home-actions">
          {loading ? (
            <i className="pi pi-spin pi-spinner" />
          ) : accessToken ? (
            <Button type="button" className="login-button" onClick={() => navigate('/dashboard')}>
              <i className="p-button-icon pi pi-home" />
              <span className="p-button-label">Go to Dashboard</span>
            </Button>
          ) : (
            <Button type="button" className="login-button" onClick={login}>
              <i className="p-button-icon pi pi-google" />
              <span className="p-button-label">Sign in with Google</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
