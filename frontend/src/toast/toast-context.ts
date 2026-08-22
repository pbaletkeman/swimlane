import { toast } from 'primereact/toaster'
import type { ToastType } from '@primereact/types/primitive/toaster'

export interface ToastHelpers {
  show: (options: ToastType) => string | number
  success: (title: string, description?: string) => string | number
  error: (title: string, description?: string) => string | number
}

export const showToast = (options: ToastType): string | number => toast(options)

export const showToastSuccess = (title: string, description?: string): string | number =>
  toast.success({ title, description })

export const showToastError = (title: string, description?: string): string | number => toast.error({ title, description })

export function useToast(): ToastHelpers {
  // Stable identity across renders: helpers are pure module-level functions,
  // so a new object per call only churns consumers' effect dependencies
  // (e.g. explore pages listing `toast` in useEffect deps) into endless
  // refetch loops.
  return TOAST_HELPERS
}

const TOAST_HELPERS: ToastHelpers = {
  show: showToast,
  success: showToastSuccess,
  error: showToastError,
}