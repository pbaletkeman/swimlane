/**
 * ThemeProvider managing system preference detection and localStorage persistence.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider as PrimeReactThemeProvider } from '@primereact/core/theme'
import Aura from '@primeuix/themes/aura'
import { ThemeContext } from './theme-context.ts'
import type { Theme, ThemeContextValue } from './theme-context.ts'

const STORAGE_KEY = 'theme'
const THEME_ATTR = 'data-theme'
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function subscribeSystemDark(callback: () => void): () => void {
  const query = window.matchMedia(SYSTEM_DARK_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function getSystemDarkSnapshot(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches
}

/** Provides theme state and applies the resolved scheme to the document. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const systemPrefersDark = useSyncExternalStore(subscribeSystemDark, getSystemDarkSnapshot)

  const effectiveTheme: 'light' | 'dark' =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme

  // PrimeReact emits dark-scheme tokens under this selector. When the user
  // picks "system", we defer to the OS via the built-in `system` option
  // (@media (prefers-color-scheme: dark)); otherwise we scope dark tokens to
  // the `data-theme="dark"` attribute we control on <html>.
  const darkModeSelector: string =
    theme === 'system' ? 'system' : `[${THEME_ATTR}='dark']`

  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTR, effectiveTheme)
    document.documentElement.style.colorScheme = effectiveTheme
  }, [effectiveTheme])

  const setTheme = (next: Theme): void => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, effectiveTheme, setTheme }),
    [theme, effectiveTheme],
  )

  return (
    <PrimeReactThemeProvider preset={Aura} darkModeSelector={darkModeSelector}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </PrimeReactThemeProvider>
  )
}