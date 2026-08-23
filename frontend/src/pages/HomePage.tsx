/**
 * App home page with explore and dashboard routing based on authentication state.
 */
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context.ts'

/** Landing page with explore, sign-in, and dashboard navigation options. */
export function HomePage() {
  const { accessToken, loading, login } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Swimlane</h1>
        <p className="login-subtitle">Swimming team management</p>
        <p className="home-tagline">Browse venues, schedules, and upcoming events — no sign-in needed.</p>
        <div className="home-actions">
          {loading ? (
            <i className="pi pi-spin pi-spinner" />
          ) : (
            <>
              <Button type="button" className="login-button" onClick={() => navigate('/explore')}>
                <i className="p-button-icon pi pi-map-marker" />
                <span className="p-button-label">Explore venues</span>
              </Button>
              {accessToken ? (
                <Button type="button" className="login-button" onClick={() => navigate('/dashboard')}>
                  <i className="p-button-icon pi pi-home" />
                  <span className="p-button-label">Go to Dashboard</span>
                </Button>
              ) : (
                <>
                  <div className="home-divider">
                    <span>or</span>
                  </div>
                  <Button type="button" className="login-button" onClick={login}>
                    <i className="p-button-icon pi pi-google" />
                    <span className="p-button-label">Sign in with Google</span>
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
