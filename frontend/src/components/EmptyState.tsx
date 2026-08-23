/**
 * Reusable empty-state placeholder with an icon, message, hint, and optional action button.
 */
import type { ReactNode } from 'react'
import { Button } from 'primereact/button'

/** Props for the EmptyState component. */
export interface EmptyStateProps {
  message: string
  hint?: string
  icon?: string
  actionLabel?: string
  onAction?: () => void
  action?: ReactNode
}

/** Renders an empty-state placeholder with a message, hint, and optional action. */
export function EmptyState({
  message,
  hint,
  icon = 'pi-inbox',
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i className={`empty-state-icon ${icon}`} />
      <p className="empty-state-message">{message}</p>
      {hint ? <p className="empty-state-hint">{hint}</p> : null}
      {actionLabel && onAction ? (
        <div className="empty-state-action">
          <Button type="button" variant="outlined" onClick={onAction}>
            <span className="p-button-label">{actionLabel}</span>
          </Button>
        </div>
      ) : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}