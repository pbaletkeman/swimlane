/**
 * Simple custom toast provider — no PrimeReact Toaster dependency.
 */
import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { registerToastAdd } from '../toast/toast-context.ts'

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'warn' | 'info'
  title: string
  description?: string
}

const ICONS: Record<ToastItem['type'], string> = {
  success: 'pi pi-check',
  error: 'pi pi-times-circle',
  warn: 'pi pi-exclamation-triangle',
  info: 'pi pi-info-circle',
}

const COLORS: Record<ToastItem['type'], string> = {
  success: 'var(--p-green-500, #22c55e)',
  error: 'var(--p-red-500, #ef4444)',
  warn: 'var(--p-yellow-500, #eab308)',
  info: 'var(--p-blue-500, #3b82f6)',
}

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback(
    (type: ToastItem['type'], title: string, description?: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, type, title, description }])
      setTimeout(() => remove(id), 5000)
    },
    [remove],
  )

  // Register with the toast-context so useToast() works
  registerToastAdd(add)

  return (
    <>
      {children}
      <div className="custom-toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="custom-toast"
            style={{ borderLeftColor: COLORS[t.type] }}
          >
            <i className={`${ICONS[t.type]} custom-toast-icon`} />
            <div className="custom-toast-body">
              <div className="custom-toast-title">{t.title}</div>
              {t.description && <div className="custom-toast-desc">{t.description}</div>}
            </div>
            <button className="custom-toast-close" onClick={() => remove(t.id)} aria-label="Close">
              <i className="pi pi-times" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
