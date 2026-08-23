/**
 * Sticky toolbar showing selected count with bulk/hard delete actions and a confirmation dialog.
 */
import { useEffect, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import type { DialogRootChangeEvent } from '@primereact/types/primitive/dialog'

/** Props for the BulkDeleteBar component. */
export interface BulkDeleteBarProps {
  count: number
  itemLabel: string
  onBulkDelete: () => Promise<void> | void
  loading?: boolean
}

/** Renders a bulk-delete action bar with a confirmation dialog for selected items. */
export function BulkDeleteBar({ count, itemLabel, onBulkDelete, loading = false }: BulkDeleteBarProps) {
  const [visible, setVisible] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deletingRef = useRef(deleting)

  useEffect(() => {
    deletingRef.current = deleting
  })

  const confirm = async () => {
    setDeleting(true)
    try {
      await onBulkDelete()
      setVisible(false)
    } finally {
      setDeleting(false)
    }
  }

  if (count === 0) {
    return null
  }

  return (
    <div className="bulk-delete-bar">
      <span className="bulk-delete-count">
        {count} {itemLabel}
        {count === 1 ? '' : 's'} selected
      </span>
      <Button
        type="button"
        severity="danger"
        variant="outlined"
        loading={loading}
        disabled={deletingRef.current}
        aria-label={`Delete ${count} selected ${itemLabel}${count === 1 ? '' : 's'}`}
        onClick={() => setVisible(true)}
      >
        <i className="pi pi-trash" />
        <span className="p-button-label">Delete</span>
      </Button>
      <Dialog.Root
        visible={visible}
        modal
        dismissable
        blockScroll
        onOpenChange={(event: DialogRootChangeEvent) => {
          if (!event.value) {
            setVisible(false)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content className="confirm-delete-content">
              <Dialog.Header>
                <Dialog.Title>Bulk delete?</Dialog.Title>
                <Dialog.HeaderActions>
                  <Dialog.Close aria-label="Close">
                    <i className="pi pi-times" />
                  </Dialog.Close>
                </Dialog.HeaderActions>
              </Dialog.Header>
              <div className="confirm-delete-message">
                Delete <strong>{count}</strong> selected {itemLabel}
                {count === 1 ? '' : 's'}? They will be deactivated and can be reactivated later.
              </div>
              <Dialog.Footer>
                <Button type="button" variant="text" disabled={deleting} onClick={() => setVisible(false)}>
                  <span className="p-button-label">Cancel</span>
                </Button>
                <Button type="button" severity="danger" loading={deleting} onClick={() => void confirm()}>
                  <i className="pi pi-trash" />
                  <span className="p-button-label">Delete {count}</span>
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}