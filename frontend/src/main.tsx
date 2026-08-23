/**
 * Application entry point: mounts React root with providers.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrimeReactProvider } from '@primereact/core/config'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { ThemeProvider } from './theme/ThemeContext.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrimeReactProvider>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider />
        <App />
      </AuthProvider>
    </ThemeProvider>
    </PrimeReactProvider>
  </StrictMode>,
)