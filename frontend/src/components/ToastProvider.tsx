/**
 * PrimeReact Toast provider that supplies app-wide success, error, and warning notifications.
 */
import { Toast } from 'primereact/toast'
import { Toaster } from 'primereact/toaster'
import type { ToasterRegionExposes } from '@primereact/types/primitive/toaster'
import type { ToastType } from '@primereact/types/primitive/toaster'
import type { ToasterPosition } from '@primereact/types/headless/toaster'

/** Props for the ToastProvider component. */
export interface ToastProviderProps {
  position?: ToasterPosition
}

/** Provides a global toast notification system using PrimeReact's Toaster. */
export function ToastProvider({ position = 'top-right' }: ToastProviderProps) {
  return (
    <Toaster.Root position={position}>
      <Toaster.Portal>
        <Toaster.Region>
          {({ toaster }: ToasterRegionExposes) =>
            toaster?.toasts?.map((toastItem: ToastType) => (
              <Toast.Root key={toastItem.id} toast={toastItem}>
                <Toast.Content>
                  <Toast.Icon match="success">
                    <i className="pi pi-check" />
                  </Toast.Icon>
                  <Toast.Icon match="error">
                    <i className="pi pi-times-circle" />
                  </Toast.Icon>
                  <Toast.Icon match="warn">
                    <i className="pi pi-exclamation-triangle" />
                  </Toast.Icon>
                  <Toast.Icon match="info">
                    <i className="pi pi-info-circle" />
                  </Toast.Icon>
                  <Toast.Message>
                    <Toast.Title />
                    <Toast.Description />
                  </Toast.Message>
                  <Toast.Close>
                    <i className="pi pi-times" />
                  </Toast.Close>
                </Toast.Content>
              </Toast.Root>
            ))
          }
        </Toaster.Region>
      </Toaster.Portal>
    </Toaster.Root>
  )
}