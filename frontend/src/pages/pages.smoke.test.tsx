/**
 * Smoke tests: every page renders inside the provider stack without crashing.
 * Data is stubbed to empty lists; assertions are intentionally light (mounted
 * + visible content) — deeper behavior lives in dedicated tests.
 */
import { describe, expect, it, vi } from 'vitest'

import { loginAs, renderAtRoute, renderPage, stubListApi } from '../test-utils.tsx'

import { LoginPage } from '../auth/LoginPage.tsx'
import { HomePage } from './HomePage.tsx'
import DashboardPage from './DashboardPage.tsx'
import ProfilePage from './ProfilePage.tsx'
import MySchedulePage from './MySchedulePage.tsx'
import FrequenciesPage from './FrequenciesPage.tsx'
import FacilitiesPage from './FacilitiesPage.tsx'
import EventsPage from './EventsPage.tsx'
import CoachEventsPage from './CoachEventsPage.tsx'
import VenuesPage from './VenuesPage.tsx'
import SchedulesPage from './SchedulesPage.tsx'
import FormsPage from './FormsPage.tsx'
import FormViewPage from './FormViewPage.tsx'
import FormBuilderPage from './FormBuilderPage.tsx'
import ManageUsersPage from './ManageUsersPage.tsx'
import { ErrorPage } from './ErrorPage.tsx'
import ExploreHomePage from './explore/ExploreHomePage.tsx'
import ExploreVenuesPage from './explore/ExploreVenuesPage.tsx'
import VenueSchedulePage from './explore/VenueSchedulePage.tsx'
import EventDetailPage from './explore/EventDetailPage.tsx'

describe('public pages', () => {
  it('LoginPage renders the sign-in card when logged out', () => {
    const { container } = renderPage(<LoginPage />)
    expect(container.textContent).toContain('Swimlane')
  })

  it('HomePage renders', () => {
    stubListApi()
    const { container } = renderPage(<HomePage />)
    expect(container.firstChild).not.toBeNull()
  })

  it('Explore pages render with empty data', async () => {
    stubListApi()

    const explore = renderPage(<ExploreHomePage />)
    await vi.waitFor(() => expect(explore.container.firstChild).not.toBeNull())
    explore.unmount()

    const venues = renderPage(<ExploreVenuesPage />)
    await vi.waitFor(() => expect(venues.container.firstChild).not.toBeNull())
    venues.unmount()

    const schedule = renderAtRoute('/explore/venues/1', '/explore/venues/:venueId', <VenueSchedulePage />)
    await vi.waitFor(() => expect(schedule.container.firstChild).not.toBeNull())
    schedule.unmount()

    const detail = renderAtRoute('/explore/events/1', '/explore/events/:eventId', <EventDetailPage />)
    await vi.waitFor(() => expect(detail.container.firstChild).not.toBeNull())
  })

  it('ErrorPage renders its code and message', () => {
    const { container } = renderPage(<ErrorPage code={404} title="Page not found" message="Nope." />)
    expect(container.textContent).toContain('404')
    expect(container.textContent).toContain('Nope.')
  })
})

describe('authenticated pages', () => {
  it('DashboardPage greets a member and shows quick links per role', () => {
    loginAs('MEMBER')
    const { container, unmount } = renderPage(<DashboardPage />)
    expect(container.textContent).toContain('Welcome')
    unmount()

    // FACILITY_MANAGER sees manager-only quick links via hasRole
    loginAs('FACILITY_MANAGER')
    const mgr = renderPage(<DashboardPage />)
    expect(mgr.container.textContent).toContain('Manage Users')
    mgr.unmount()
  })

  for (const [name, node] of [
    ['ProfilePage', <ProfilePage key="p" />],
    ['MySchedulePage', <MySchedulePage key="m" />],
    ['CoachEventsPage', <CoachEventsPage key="c" />],
  ] as const) {
    it(`${name} renders as MEMBER`, async () => {
      loginAs('MEMBER')
      stubListApi()
      const screen = renderPage(node)
      await vi.waitFor(() => expect(screen.container.firstChild).not.toBeNull())
    })
  }

  for (const [name, node] of [
    ['FrequenciesPage', <FrequenciesPage key="f" />],
    ['FacilitiesPage', <FacilitiesPage key="fa" />],
    ['EventsPage', <EventsPage key="e" />],
    ['VenuesPage', <VenuesPage key="v" />],
    ['SchedulesPage', <SchedulesPage key="s" />],
    ['FormsPage', <FormsPage key="fo" />],
    ['ManageUsersPage', <ManageUsersPage key="mu" />],
  ] as const) {
    it(`${name} renders as FACILITY_MANAGER`, async () => {
      loginAs('FACILITY_MANAGER')
      stubListApi()
      const screen = renderPage(node)
      await vi.waitFor(() => expect(screen.container.firstChild).not.toBeNull())
    })
  }

  it('FormViewPage and FormBuilderPage render with a facility param', async () => {
    loginAs('MEMBER')
    stubListApi()

    const view = renderAtRoute('/forms/facility/1', '/forms/facility/:facilityId', <FormViewPage />)
    await vi.waitFor(() => expect(view.container.firstChild).not.toBeNull())
    view.unmount()

    loginAs('FACILITY_MANAGER')
    const builder = renderAtRoute('/forms/builder/1', '/forms/builder/:facilityId', <FormBuilderPage />)
    await vi.waitFor(() => expect(builder.container.firstChild).not.toBeNull())
  })
})
