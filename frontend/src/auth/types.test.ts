/**
 * Tests for src/auth/types.ts — role hierarchy constants.
 */
import { describe, expect, it } from 'vitest'

import { ROLE_RANK, USER_ROLES, type UserRole } from './types.ts'

describe('ROLE_RANK', () => {
  it('orders roles hierarchically (WEB_ADMIN most privileged)', () => {
    expect(ROLE_RANK.WEB_ADMIN).toBeLessThan(ROLE_RANK.FACILITY_MANAGER)
    expect(ROLE_RANK.FACILITY_MANAGER).toBeLessThan(ROLE_RANK.COACH)
    expect(ROLE_RANK.COACH).toBeLessThan(ROLE_RANK.MEMBER)
  })

  it('contains exactly the four backend roles', () => {
    expect(Object.keys(ROLE_RANK).sort()).toEqual([
      'COACH',
      'FACILITY_MANAGER',
      'MEMBER',
      'WEB_ADMIN',
    ])
  })
})

describe('USER_ROLES', () => {
  it('lists every role key from ROLE_RANK', () => {
    const everyRoleCovered = USER_ROLES.every((role: UserRole) => role in ROLE_RANK)
    expect(USER_ROLES).toHaveLength(4)
    expect(everyRoleCovered).toBe(true)
  })
})
