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
  return {
    show: showToast,
    success: showToastSuccess,
    error: showToastError,
  }
}