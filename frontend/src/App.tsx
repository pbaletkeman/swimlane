/**
 * Root app component with providers and router setup.
 */
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppRouter } from './router/index.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}