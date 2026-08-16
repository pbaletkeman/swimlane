import { Menu } from 'primereact/menu'
import { useTheme } from '../theme/theme-context.ts'
import type { Theme } from '../theme/theme-context.ts'

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'pi pi-sun' },
  { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
  { value: 'system', label: 'System', icon: 'pi pi-desktop' },
]

export function ThemeSwitch() {
  const { theme, effectiveTheme, setTheme } = useTheme()

  return (
    <Menu.Root>
      <Menu.Trigger
        type="button"
        className="theme-switch-trigger"
        aria-label={`Theme: ${theme}`}
        title="Theme"
      >
        <i className={effectiveTheme === 'dark' ? 'pi pi-moon' : 'pi pi-sun'} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.List>
              {THEME_OPTIONS.map((option) => (
                <Menu.Item key={option.value} value={option.value} onSelect={() => setTheme(option.value)}>
                  <span className="theme-switch-icon">
                    <i className={option.icon} />
                  </span>
                  <span>{option.label}</span>
                  {theme === option.value && <i className="pi pi-check theme-switch-check" />}
                </Menu.Item>
              ))}
            </Menu.List>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}