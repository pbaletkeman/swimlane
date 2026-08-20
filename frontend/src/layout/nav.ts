import type { UserRole } from '../auth/types.ts'

export interface NavItem {
  label: string
  icon: string
  path: string
  requiredRole: UserRole
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home', path: '/dashboard', requiredRole: 'MEMBER' },
  { label: 'My Schedule', icon: 'pi pi-calendar-plus', path: '/my-schedule', requiredRole: 'MEMBER' },
  { label: 'Manage Events', icon: 'pi pi-user-edit', path: '/manage-events', requiredRole: 'COACH' },
  { label: 'Frequencies', icon: 'pi pi-calendar', path: '/frequencies', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Facilities', icon: 'pi pi-building', path: '/facilities', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Events', icon: 'pi pi-bolt', path: '/events', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Venues', icon: 'pi pi-map-marker', path: '/venues', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Schedules', icon: 'pi pi-users', path: '/schedules', requiredRole: 'FACILITY_MANAGER' },
  { label: 'Signup Forms', icon: 'pi pi-file-edit', path: '/forms', requiredRole: 'MEMBER' },
]