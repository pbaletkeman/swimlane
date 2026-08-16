export interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="app-placeholder-page">
      <h1>{title}</h1>
      <p>This page is under construction.</p>
    </div>
  )
}