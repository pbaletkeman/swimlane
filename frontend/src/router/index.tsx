import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RouteGuard } from '../auth/RouteGuard.tsx'
import { AppLayout } from '../layout/AppLayout.tsx'

const LoginPage = lazy(() => import('../auth/LoginPage.tsx').then((m) => ({ default: m.LoginPage })))
const AuthCallbackPage = lazy(() =>
  import('../auth/AuthCallbackPage.tsx').then((m) => ({ default: m.AuthCallbackPage })),
)
const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx'))
const FrequenciesPage = lazy(() => import('../pages/FrequenciesPage.tsx'))
const FacilitiesPage = lazy(() => import('../pages/FacilitiesPage.tsx'))
const EventsPage = lazy(() => import('../pages/EventsPage.tsx'))
const VenuesPage = lazy(() => import('../pages/VenuesPage.tsx'))
const SchedulesPage = lazy(() => import('../pages/SchedulesPage.tsx'))
const FormsPage = lazy(() => import('../pages/FormsPage.tsx'))

function LazyFallback() {
  return (
    <div className="app-page-loading">
      <i className="pi pi-spin pi-spinner" />
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="app-page-not-found">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
    </div>
  )
}

export function AppRouter() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          element={
            <RouteGuard>
              <AppLayout />
            </RouteGuard>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/frequencies" element={<FrequenciesPage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}