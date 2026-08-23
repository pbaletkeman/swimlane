import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RouteGuard } from '../auth/RouteGuard.tsx'
import { AppLayout } from '../layout/AppLayout.tsx'
import { ErrorPage } from '../pages/ErrorPage.tsx'

const LoginPage = lazy(() => import('../auth/LoginPage.tsx').then((m) => ({ default: m.LoginPage })))
const HomePage = lazy(() => import('../pages/HomePage.tsx').then((m) => ({ default: m.HomePage })))
const AuthCallbackPage = lazy(() =>
  import('../auth/AuthCallbackPage.tsx').then((m) => ({ default: m.AuthCallbackPage })),
)
const ExploreHomePage = lazy(() => import('../pages/explore/ExploreHomePage.tsx'))
const ExploreVenuesPage = lazy(() => import('../pages/explore/ExploreVenuesPage.tsx'))
const VenueSchedulePage = lazy(() => import('../pages/explore/VenueSchedulePage.tsx'))
const EventDetailPage = lazy(() => import('../pages/explore/EventDetailPage.tsx'))
const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx'))
const ProfilePage = lazy(() => import('../pages/ProfilePage.tsx'))
const MySchedulePage = lazy(() => import('../pages/MySchedulePage.tsx'))
const FrequenciesPage = lazy(() => import('../pages/FrequenciesPage.tsx'))
const FacilitiesPage = lazy(() => import('../pages/FacilitiesPage.tsx'))
const EventsPage = lazy(() => import('../pages/EventsPage.tsx'))
const CoachEventsPage = lazy(() => import('../pages/CoachEventsPage.tsx'))
const VenuesPage = lazy(() => import('../pages/VenuesPage.tsx'))
const SchedulesPage = lazy(() => import('../pages/SchedulesPage.tsx'))
const FormsPage = lazy(() => import('../pages/FormsPage.tsx'))
const FormViewPage = lazy(() => import('../pages/FormViewPage.tsx'))
const FormBuilderPage = lazy(() => import('../pages/FormBuilderPage.tsx'))
const ManageUsersPage = lazy(() => import('../pages/ManageUsersPage.tsx'))

function LazyFallback() {
  return (
    <div className="app-page-loading">
      <i className="pi pi-spin pi-spinner" />
    </div>
  )
}

function NotFoundPage() {
  return <ErrorPage code={404} title="Page not found" message="The page you requested does not exist." />
}

/** Root router component defining all public and authenticated routes. */
export function AppRouter() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/explore" element={<ExploreHomePage />} />
        <Route path="/explore/venues" element={<ExploreVenuesPage />} />
        <Route path="/explore/venues/:venueId" element={<VenueSchedulePage />} />
        <Route path="/explore/events/:eventId" element={<EventDetailPage />} />
        {/* Everything below requires auth; public routes live above, outside RouteGuard (I.1). */}
        <Route
          element={
            <RouteGuard>
              <AppLayout />
            </RouteGuard>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-schedule" element={<MySchedulePage />} />
          <Route path="/manage-events" element={<CoachEventsPage />} />
          <Route path="/frequencies" element={<FrequenciesPage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/forms/facility/:facilityId" element={<FormViewPage />} />
          <Route path="/forms/builder/:facilityId" element={<FormBuilderPage />} />
          <Route
            path="/manage-users"
            element={
              <RouteGuard requiredRole="FACILITY_MANAGER">
                <ManageUsersPage />
              </RouteGuard>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}