import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthCallbackPage } from './auth/AuthCallbackPage.tsx'
import { LoginPage } from './auth/LoginPage.tsx'
import { RouteGuard } from './auth/RouteGuard.tsx'
import { ThemeSwitch } from './components/ThemeSwitch.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="*"
          element={
            <RouteGuard>
              <MainContent />
            </RouteGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

function MainContent() {
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