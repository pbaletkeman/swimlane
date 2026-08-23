import { createContext, useContext } from 'react'

/** User-selectable theme preference. */
export type Theme = 'light' | 'dark' | 'system'

/** Theme context value exposing the current preference, effective scheme, and setter. */
export interface ThemeContextValue {
  /** The user-selected preference (defaults to `system`). */
  theme: Theme
  /** The resolved scheme actually applied to the document. */
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

/** React context for theme state. */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/** Hook to read the current theme context; throws if used outside a ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}