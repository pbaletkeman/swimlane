import './index.css'
import { ThemeSwitch } from './components/ThemeSwitch.tsx'

export default function App() {
  return (
    <div className="app">
      <header className="app-topbar">
        <ThemeSwitch />
      </header>
      <h1>Swimlane</h1>
      <p>Swimming team management — frontend under construction.</p>
    </div>
  )
}