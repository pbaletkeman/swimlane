/**
 * Tests for src/components/ThemeSwitch.tsx — trigger rendering inside the real
 * ThemeProvider (jsdom matchMedia stub makes "system" resolve to light).
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { ThemeSwitch } from './ThemeSwitch.tsx'
import { ThemeProvider } from '../theme/ThemeContext.tsx'
import { renderPage } from '../test-utils.tsx'

function renderSwitch(): ReturnType<typeof renderPage> {
  return renderPage(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  )
}

describe('ThemeSwitch', () => {
  it('renders the trigger labelled with the active theme preference', () => {
    renderSwitch()
    const trigger = screen.getByLabelText('Theme: system')
    expect(trigger).toBeInTheDocument()
  })

  it('shows the sun icon when the effective theme is light', () => {
    renderSwitch()
    const icon = screen.getByLabelText('Theme: system').querySelector('i')
    expect(icon?.className).toContain('pi-sun')
  })
})
