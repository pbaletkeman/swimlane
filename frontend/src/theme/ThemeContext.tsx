import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider as PrimeReactThemeProvider } from '@primereact/core/theme'
import Aura from '@primeuix/themes/aura'
import { ThemeContext } from './theme-context.ts'
import type { Theme, ThemeContextValue } from './theme-context.ts'

const STORAGE_KEY = 'theme'
const THEME_ATTR = 'data-theme'

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  const effectiveTheme: 'light' | 'dark' =
    theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme

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