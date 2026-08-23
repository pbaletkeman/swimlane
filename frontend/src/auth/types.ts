import type { Role } from '../api/types.ts'

/** User role string literal matching the backend UserRole enum. */
export type UserRole = Role

/** Mirrors the backend's hierarchical roles (WEB_ADMIN highest). */
export const ROLE_RANK: Record<UserRole, number> = {
  WEB_ADMIN: 0,
  FACILITY_MANAGER: 1,
  COACH: 2,
  MEMBER: 3,
}

/** All valid user roles in descending privilege order. */
export const USER_ROLES: UserRole[] = ['WEB_ADMIN', 'FACILITY_MANAGER', 'COACH', 'MEMBER']

/** Google OpenID Connect userinfo profile (from the OAuth callback). */
export interface User {
  sub: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  email?: string
  email_verified?: boolean
  locale?: string
  hd?: string
}