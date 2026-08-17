import { Button } from 'primereact/button'

export interface ErrorPageProps {
  title?: string
  message?: string
  code?: number
  actionLabel?: string
  onAction?: () => void
}

export function ErrorPage({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  code,
  actionLabel,
  onAction,
}: ErrorPageProps) {
  return (
    <div className="app-error-page">
      <div className="app-error-icon">
        <i className="pi pi-exclamation-circle" />
      </div>
      {code !== undefined && <div className="app-error-code">{code}</div>}
      <h1 className="app-error-title">{title}</h1>
      <p className="app-error-message">{message}</p>
      {actionLabel && onAction && (
        <Button type="button" severity="danger" onClick={onAction}>
          <span className="p-button-label">{actionLabel}</span>
        </Button>
      )}
    </div>
  )
}