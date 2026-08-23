/**
 * Toast helper functions — delegates to the custom toast system.
 */
import type { ToastItem } from '../components/ToastProvider.tsx'

/** Stable toast helper methods for show, success, error, warn, info notifications. */
export interface ToastHelpers {
  show: (options: { title: string; description?: string; type?: ToastItem['type'] }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warn: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

let addToast: ((type: ToastItem['type'], title: string, description?: string) => void) | null = null

/** Called by ToastProvider to register the add function. */
export function registerToastAdd(fn: (type: ToastItem['type'], title: string, description?: string) => void) {
  addToast = fn
}

/** Show a toast notification. */
export function showToast(type: ToastItem['type'], title: string, description?: string) {
  addToast?.(type, title, description)
}

/** Show a success toast with a title and optional description. */
export const showToastSuccess = (title: string, description?: string): void => showToast('success', title, description)

/** Show an error toast with a title and optional description. */
export const showToastError = (title: string, description?: string): void => showToast('error', title, description)

/** Return a stable set of toast helpers. */
export function useToast(): ToastHelpers {
  return TOAST_HELPERS
}

const TOAST_HELPERS: ToastHelpers = {
  show: (opts) => showToast(opts.type ?? 'info', opts.title, opts.description),
  success: (title, desc) => showToast('success', title, desc),
  error: (title, desc) => showToast('error', title, desc),
  warn: (title, desc) => showToast('warn', title, desc),
  info: (title, desc) => showToast('info', title, desc),
}
