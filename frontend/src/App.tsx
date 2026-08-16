import { Button } from 'primereact/button'
import './index.css'
import { useTheme } from './theme/theme-context.ts'

const THEME_OPTIONS = ['light', 'dark', 'system'] as const

export default function App() {
  const { theme, effectiveTheme, setTheme } = useTheme()

  return (
    <div className="app">
      <h1>Swimlane</h1>
      <p>Swimming team management — frontend under construction.</p>
      <p className="theme-status">
        Theme: {theme} (effective: {effectiveTheme})
      </p>
      <div className="theme-switcher">
        {THEME_OPTIONS.map((option) => (
          <Button
            key={option}
            label={option}
            icon={option === 'dark' ? 'pi pi-moon' : option === 'light' ? 'pi pi-sun' : 'pi pi-desktop'}
            size="small"
            severity={theme === option ? 'primary' : 'secondary'}
            onClick={() => setTheme(option)}
          />
        ))}
      </div>
    </div>
  )
}