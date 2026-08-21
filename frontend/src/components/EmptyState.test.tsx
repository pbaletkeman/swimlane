/**
 * Tests for src/components/EmptyState.tsx — message/hint rendering and the
 * optional action button.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { EmptyState } from './EmptyState.tsx'
import { renderPage } from '../test-utils.tsx'

describe('EmptyState', () => {
  it('renders message and default icon', () => {
    renderPage(<EmptyState message="Nothing here yet" />)
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    const icon = document.querySelector('.empty-state-icon')
    expect(icon?.className).toContain('pi-inbox')
  })

  it('shows hint and custom icon when provided', () => {
    renderPage(<EmptyState message="No rows" hint="Create one to begin" icon="pi-database" />)
    expect(screen.getByText('Create one to begin')).toBeInTheDocument()
    expect(document.querySelector('.empty-state-icon')?.className).toContain('pi-database')
  })

  it('omits hint block when not provided', () => {
    renderPage(<EmptyState message="No rows" />)
    expect(document.querySelector('.empty-state-hint')).toBeNull()
  })

  it('renders actionLabel+onAction as a clickable button', () => {
    const onAction = vi.fn()
    renderPage(<EmptyState message="No rows" actionLabel="Add one" onAction={onAction} />)
    fireEvent.click(screen.getByText('Add one'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('hides the action button without a handler', () => {
    renderPage(<EmptyState message="No rows" actionLabel="Add one" />)
    expect(screen.queryByText('Add one')).toBeNull()
  })

  it('renders a custom action node', () => {
    renderPage(<EmptyState message="No rows" action={<button type="button">custom</button>} />)
    expect(screen.getByText('custom')).toBeInTheDocument()
  })
})
