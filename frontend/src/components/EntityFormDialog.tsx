/**
 * Generic form dialog for creating and editing entities with configurable field definitions.
 */
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { DatePicker } from 'primereact/datepicker'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Select } from 'primereact/select'
import { Textarea } from 'primereact/textarea'
import type { CheckboxRootChangeEvent } from '@primereact/types/primitive/checkbox'
import type { DatePickerRootValueChangeEvent } from '@primereact/types/primitive/datepicker'
import type { DialogRootChangeEvent } from '@primereact/types/primitive/dialog'
import type { InputNumberRootValueChangeEvent } from '@primereact/types/primitive/inputnumber'
import type { SelectValueChangeEvent } from '@primereact/types/primitive/select'

/** Supported form field input types. */
export type EntityFormFieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'datetime'

/** A selectable option for dropdown or select fields. */
export interface EntityFormFieldOption {
  label: string
  value: string | number
}

/** Describes a single form field rendered by EntityFormDialog. */
export interface EntityFormField<T> {
  name: keyof T
  label: string
  type: EntityFormFieldType
  required?: boolean
  placeholder?: string
  options?: EntityFormFieldOption[]
  min?: number
  max?: number
  minLength?: number
  rows?: number
  validate?: (value: unknown, values: Record<string, unknown>) => string | undefined
}

/** Props for the EntityFormDialog component. */
export interface EntityFormDialogProps<T> {
  visible: boolean
  title: string
  fields: EntityFormField<T>[]
  initialValues?: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void
  onHide: () => void
  submitting?: boolean
  saveLabel?: string
  cancelLabel?: string
}

function validateField<T>(
  field: EntityFormField<T>,
  value: unknown,
  values: Record<string, unknown>,
): string | undefined {
  const { label, type, required } = field

  let empty = value === null || value === undefined
  if (type === 'checkbox') {
    empty = value !== true
  } else if (typeof value === 'string') {
    empty = value.trim() === ''
  } else if (type === 'number') {
    empty = Number.isNaN(Number(value))
  } else if (type === 'datetime') {
    empty = !(value instanceof Date && !Number.isNaN(value.getTime()))
  }

  if (required && empty) {
    return `${label} is required.`
  }

  if (type === 'number' && typeof value === 'number') {
    if (field.min !== undefined && value < field.min) {
      return `${label} must be at least ${field.min}.`
    }
    if (field.max !== undefined && value > field.max) {
      return `${label} must be at most ${field.max}.`
    }
  }

  if (type === 'text' && typeof value === 'string') {
    if (field.minLength !== undefined && value.trim().length < field.minLength) {
      return `${label} must be at least ${field.minLength} characters.`
    }
  }

  if (field.validate) {
    return field.validate(value, values)
  }

  return undefined
}

/** Renders a modal dialog containing a dynamic form built from field definitions. */
export function EntityFormDialog<T>({
  visible,
  title,
  fields,
  initialValues,
  onSubmit,
  onHide,
  submitting = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}: EntityFormDialogProps<T>) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fieldsRef = useRef(fields)
  const initialValuesRef = useRef(initialValues)
  const valuesRef = useRef(values)

  useEffect(() => {
    fieldsRef.current = fields
    initialValuesRef.current = initialValues
    valuesRef.current = values
  })

  useEffect(() => {
    if (!visible) return

    const next: Record<string, unknown> = {}
    for (const field of fieldsRef.current) {
      const name = String(field.name)
      const existing = initialValuesRef.current?.[name]
      next[name] = existing ?? (field.type === 'checkbox' ? false : field.type === 'number' || field.type === 'datetime' ? null : '')
    }

    setValues(next)
    setErrors({})
  }, [visible])

  const setFieldValue = (name: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => (previous[name] ? { ...previous, [name]: '' } : previous))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const currentValues = valuesRef.current
    const nextErrors: Record<string, string> = {}

    for (const field of fieldsRef.current) {
      const name = String(field.name)
      const error = validateField(field, currentValues[name], currentValues)
      if (error) {
        nextErrors[name] = error
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    await onSubmit(currentValues)
  }

  const renderField = (field: EntityFormField<T>) => {
    const name = String(field.name)
    const value = values[name]
    const invalid = Boolean(errors[name])
    const fieldId = `entity-form-dialog-${name}`

    if (field.type === 'text') {
      return (
        <InputText
          id={fieldId}
          value={String(value ?? '')}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFieldValue(name, event.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          className="w-full"
        />
      )
    }

    if (field.type === 'number') {
      return (
        <InputNumber.Root
          value={typeof value === 'number' ? value : null}
          onValueChange={(event: InputNumberRootValueChangeEvent) => setFieldValue(name, event.value)}
          min={field.min}
          max={field.max}
          invalid={invalid}
        >
          <InputNumber.Input id={fieldId} className="w-full" placeholder={field.placeholder} />
        </InputNumber.Root>
      )
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          id={fieldId}
          value={String(value ?? '')}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setFieldValue(name, event.target.value)}
          placeholder={field.placeholder}
          invalid={invalid}
          rows={field.rows ?? 3}
          className="w-full"
        />
      )
    }

    if (field.type === 'datetime') {
      const dateValue =
        value instanceof Date ? value : typeof value === 'string' && value ? new Date(value) : null
      return (
        <DatePicker.Root
          value={dateValue}
          onValueChange={(event: DatePickerRootValueChangeEvent) => {
            const next =
              event.value instanceof Date
                ? event.value
                : typeof event.value === 'string'
                  ? new Date(event.value)
                  : null
            setFieldValue(name, next)
          }}
          showTime
          hourFormat="24"
          selectionMode="single"
          invalid={invalid}
        >
          <DatePicker.Input id={fieldId} className="w-full" placeholder={field.placeholder} />
          <DatePicker.Trigger>
            <i className="pi pi-calendar" />
          </DatePicker.Trigger>
          <DatePicker.Portal>
            <DatePicker.Positioner>
              <DatePicker.Popup>
                <DatePicker.Calendar>
                  <DatePicker.Header>
                    <DatePicker.Title />
                    <DatePicker.SelectMonth />
                    <DatePicker.SelectYear />
                    <DatePicker.Prev>
                      <i className="pi pi-chevron-left" />
                    </DatePicker.Prev>
                    <DatePicker.Next>
                      <i className="pi pi-chevron-right" />
                    </DatePicker.Next>
                  </DatePicker.Header>
                  <DatePicker.Table>
                    <DatePicker.TableHead />
                    <DatePicker.TableBody view="date" />
                  </DatePicker.Table>
                  <DatePicker.Time>
                    <DatePicker.Picker type="hour">
                      <DatePicker.Increment>
                        <i className="pi pi-chevron-up" />
                      </DatePicker.Increment>
                      <DatePicker.Hour />
                      <DatePicker.Decrement>
                        <i className="pi pi-chevron-down" />
                      </DatePicker.Decrement>
                    </DatePicker.Picker>
                    <DatePicker.Separator />
                    <DatePicker.Picker type="minute">
                      <DatePicker.Increment>
                        <i className="pi pi-chevron-up" />
                      </DatePicker.Increment>
                      <DatePicker.Minute />
                      <DatePicker.Decrement>
                        <i className="pi pi-chevron-down" />
                      </DatePicker.Decrement>
                    </DatePicker.Picker>
                  </DatePicker.Time>
                  <DatePicker.Footer>
                    <DatePicker.Buttonbar>
                      <DatePicker.Today />
                      <DatePicker.Clear />
                    </DatePicker.Buttonbar>
                  </DatePicker.Footer>
                </DatePicker.Calendar>
              </DatePicker.Popup>
            </DatePicker.Positioner>
          </DatePicker.Portal>
        </DatePicker.Root>
      )
    }

    if (field.type === 'checkbox') {
      return (
        <Checkbox.Root
          id={fieldId}
          value={value === true}
          onCheckedChange={(event: CheckboxRootChangeEvent) => setFieldValue(name, event.checked)}
          invalid={invalid}
          aria-label={field.label}
        >
          <Checkbox.Box>
            <Checkbox.Indicator />
          </Checkbox.Box>
        </Checkbox.Root>
      )
    }

    return (
      <Select.Root
        value={value ?? null}
        onValueChange={(event: SelectValueChangeEvent) => setFieldValue(name, event.value)}
        options={field.options ?? []}
        optionLabel="label"
        optionValue="value"
        invalid={invalid}
        className="w-full"
      >
        <Select.Trigger>
          <Select.Value placeholder={field.placeholder ?? 'Select...'} />
          <Select.Indicator>
            <i className="pi pi-chevron-down" />
          </Select.Indicator>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    )
  }

  return (
    <Dialog.Root
      open={visible}
      modal
      dismissable
      blockScroll
      onOpenChange={(event: DialogRootChangeEvent) => {
        if (!event.value) {
          onHide()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Positioner>
          <Dialog.Content className="entity-form-dialog-content">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.HeaderActions>
                <Dialog.Close aria-label="Close">
                  <i className="pi pi-times" />
                </Dialog.Close>
              </Dialog.HeaderActions>
            </Dialog.Header>
            <form onSubmit={handleSubmit} noValidate>
              <div className="entity-form-dialog-fields">
                {fields.map((field) => {
                  const name = String(field.name)
                  const invalid = Boolean(errors[name])
                  return (
                    <div key={name} className="entity-form-dialog-field">
                      <label className="entity-form-dialog-label" htmlFor={`entity-form-dialog-${name}`}>
                        {field.label}
                        {field.required ? <span className="entity-form-dialog-required"> *</span> : null}
                      </label>
                      {renderField(field)}
                      {invalid ? <small className="entity-form-dialog-error">{errors[name]}</small> : null}
                    </div>
                  )
                })}
              </div>
              <Dialog.Footer>
                <Button type="button" variant="text" disabled={submitting} onClick={onHide}>
                  <span className="p-button-label">{cancelLabel}</span>
                </Button>
                <Button type="submit" disabled={submitting}>
                  <span className="p-button-label">{saveLabel}</span>
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}