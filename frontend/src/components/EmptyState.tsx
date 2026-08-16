import type { ReactNode } from 'react'

export interface EmptyStateProps {
  message: string
  hint?: string
  icon?: string
  action?: ReactNode
}

export function EmptyState({ message, hint, icon = 'pi-inbox', action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i className={`empty-state-icon ${icon}`} />
      <p className="empty-state-message">{message}</p>
      {hint ? <p className="empty-state-hint">{hint}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}