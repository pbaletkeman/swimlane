import type { UserRole } from '../auth/types.ts'

export interface NavItem {
  label: string
  icon: string
  path: string
  requiredRole: UserRole
}

/**
 * Sidebar navigation items.
 *
 * Roles are hierarchical: `AppLayout` renders only items whose `requiredRole`
 * the caller satisfies via `hasRole` (rank-based — WEB_ADMIN passes every
 * check, so admins automatically see all items, including FACILITY_MANAGER
 * ones, with no per-item duplication needed).
 *
 * `Manage Users` was added in Phase G (G.7); Phase H needs no nav change —
 * WEB_ADMIN sees it through the hierarchy, and the widened admin capabilities
 * live in the page itself (H.3).
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', path: '/dashboard', requiredRole: 'MEMBER' },
  { label: 'My Schedule', icon: 'pi pi-calendar-plus', path: '/my-schedule', requiredRole: 'MEMBER' },
  { label: 'Manage Events', icon: 'pi pi-user-edit', path: '/manage-events', requiredRole: 'COACH' },
  { label: 'Frequencies', icon: 'pi pi-calendar', path: '/frequencies', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Facilities', icon: 'pi pi-building', path: '/facilities', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Events', icon: 'pi pi-bolt', path: '/events', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Venues', icon: 'pi pi-map-marker', path: '/venues', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Schedules', icon: 'pi pi-users', path: '/schedules', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Manage Users', icon: 'pi pi-users-cog', path: '/manage-users', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Signup Forms', icon: 'pi pi-file-edit', path: '/forms', requiredRole: 'MEMBER' },
]