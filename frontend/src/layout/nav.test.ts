/**
 * Tests for src/layout/nav.ts — nav item inventory and rank-based filtering.
 */
import { describe, expect, it } from 'vitest'

import type { UserRole } from '../auth/types.ts'
import { ROLE_RANK } from '../auth/types.ts'
import { NAV_ITEMS, type NavItem } from './nav.ts'

/** Mirrors AppLayout's hasRole: caller passes when its rank <= required rank. */
const visible = (role: UserRole): NavItem[] =>
  NAV_ITEMS.filter((item) => ROLE_RANK[role] <= ROLE_RANK[item.requiredRole])

describe('NAV_ITEMS', () => {
  it('has unique labels and paths', () => {
    const labels = NAV_ITEMS.map((i) => i.label)
    const paths = NAV_ITEMS.map((i) => i.path)
    expect(new Set(labels).size).toBe(labels.length)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('every path starts with / and every icon is a primeicons class', () => {
    for (const item of NAV_ITEMS) {
      expect(item.path.startsWith('/')).toBe(true)
      expect(item.icon.startsWith('pi pi-')).toBe(true)
    }
  })
})

describe('rank-based visibility', () => {
  it('MEMBER sees only member-level items', () => {
    expect(visible('MEMBER').map((i) => i.label)).toEqual([
      'Dashboard',
      'My Schedule',
      'Signup Forms',
    ])
  })

  it('COACH adds Manage Events', () => {
    const labels = visible('COACH').map((i) => i.label)
    expect(labels).toContain('Manage Events')
    expect(labels).toHaveLength(4)
    expect(labels).not.toContain('Frequencies')
  })

  it('FACILITY_MANAGER sees every item (highest requirement is FM itself)', () => {
    expect(visible('FACILITY_MANAGER')).toHaveLength(NAV_ITEMS.length)
  })

  it('WEB_ADMIN sees every item via the hierarchy', () => {
    expect(visible('WEB_ADMIN')).toHaveLength(NAV_ITEMS.length)
  })
})
