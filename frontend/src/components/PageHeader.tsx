import { Button } from 'primereact/button'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  onNew?: () => void
  newLabel?: string
}

export function PageHeader({ title, subtitle, onNew, newLabel = 'New' }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
      </div>
      {onNew ? (
        <Button type="button" onClick={onNew}>
          <i className="pi pi-plus" />
          <span className="p-button-label">{newLabel}</span>
        </Button>
      ) : null}
    </header>
  )
}