/**
 * Tests for src/components/EntityFormDialog.tsx — open-state rendering, field
 * validation on submit, and the submit/cancel flows.
 *
 * PrimeReact v11's Dialog portals into document.body via internals jsdom does
 * not fully support, so the Dialog shell is mocked as transparent passthrough
 * components here. Everything else (inputs, buttons, form flow, validation)
 * runs the real implementation.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

// Dialog shell -> plain fragments so content stays queryable in jsdom.
vi.mock('primereact/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const Proxy2 = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '$$typeof') return undefined
        return passthrough
      },
    },
  )
  return { Dialog: Proxy2 }
})

import { EntityFormDialog, type EntityFormField } from './EntityFormDialog.tsx'
import { renderPage } from '../test-utils.tsx'

interface Row {
  name: string
}

const baseFields: EntityFormField<Row>[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter name' },
]

interface SetupOverrides {
  fields?: EntityFormField<Row>[]
  initialValues?: Record<string, unknown>
  saveLabel?: string
  cancelLabel?: string
}

function setup(overrides: SetupOverrides = {}): {
  onSubmit: ReturnType<typeof vi.fn>
  onHide: ReturnType<typeof vi.fn>
} {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onHide = vi.fn()
  renderPage(
    <EntityFormDialog<Row>
      visible
      title="Edit row"
      fields={overrides.fields ?? baseFields}
      initialValues={overrides.initialValues}
      onSubmit={onSubmit}
      onHide={onHide}
      saveLabel={overrides.saveLabel}
      cancelLabel={overrides.cancelLabel}
    />,
  )
  return { onSubmit, onHide }
}

async function typeIntoField(value: string): Promise<void> {
  const input = await screen.findByPlaceholderText('Enter name')
  fireEvent.change(input, { target: { value } })
}

describe('EntityFormDialog', () => {
  it('renders title, fields and buttons when visible', () => {
    setup()
    expect(screen.getByText('Edit row')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('blocks submit and shows a required error for an empty field', async () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText('Name is required.')).toBeInTheDocument())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits typed values through onSubmit', async () => {
    const { onSubmit } = setup()
    await typeIntoField('Springfield Pool')
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Springfield Pool' })),
    )
  })

  it('pre-fills from initialValues', async () => {
    setup({ initialValues: { name: 'Existing' } })
    const input = (await screen.findByPlaceholderText('Enter name')) as HTMLInputElement
    expect(input.value).toBe('Existing')
  })

  it('clears a field error once the value changes', async () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText('Name is required.')).toBeInTheDocument())
    await typeIntoField('fixed')
    expect(screen.queryByText('Name is required.')).toBeNull()
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })

  it('enforces minLength validation', async () => {
    setup({ fields: [{ ...baseFields[0], minLength: 5 }] })
    await typeIntoField('abc')
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(screen.getByText('Name must be at least 5 characters.')).toBeInTheDocument(),
    )
  })

  it('runs custom field validators', async () => {
    setup({
      fields: [{ ...baseFields[0], validate: (value) => (value === 'nope' ? 'Not allowed' : undefined) }],
      initialValues: { name: 'nope' },
    })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText('Not allowed')).toBeInTheDocument())
  })

  it('Cancel invokes onHide without submitting', async () => {
    const { onHide, onSubmit } = setup()
    await typeIntoField('typed but cancelled')
    fireEvent.click(screen.getByText('Cancel'))
    expect(onHide).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('uses custom save/cancel labels', () => {
    setup({ saveLabel: 'Opslaan', cancelLabel: 'Annuleren' })
    expect(screen.getByText('Opslaan')).toBeInTheDocument()
    expect(screen.getByText('Annuleren')).toBeInTheDocument()
  })
})
