/**
 * useMediaQuery hook using matchMedia for responsive breakpoints.
 */
import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 * Tracks live changes (e.g. viewport resizes across breakpoints).
 */
export function useMediaQuery(query: string): boolean {
  const getSnapshot = (): boolean => window.matchMedia(query).matches

  return useSyncExternalStore(
    (callback: () => void) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', callback)
      return () => mediaQuery.removeEventListener('change', callback)
    },
    getSnapshot,
  )
}