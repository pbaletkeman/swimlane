import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import type { DialogRootChangeEvent } from '@primereact/types/primitive/dialog'
import { useAuth } from '../auth/auth-context.ts'
import type { UserRole } from '../auth/types.ts'

/** Props for the ConfirmDelete component. */
export interface ConfirmDeleteProps {
  itemName: string
  onSoftDelete: () => Promise<void> | void
  onHardDelete?: (reason: string) => Promise<void> | void
  softLabel?: string
  hardLabel?: string
  hardRole?: UserRole
  reasonLabel?: string
  reasonPlaceholder?: string
}

type ConfirmMode = 'soft' | 'hard' | null

/** Renders soft/hard delete buttons with a confirmation dialog. */
export function ConfirmDelete({
  itemName,
  onSoftDelete,
  onHardDelete,
  softLabel = `Delete ${itemName}`,
  hardLabel = `Permanently delete ${itemName}`,
  hardRole = 'WEB_ADMIN',
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Reason for permanent deletion',
}: ConfirmDeleteProps) {
  const { hasRole } = useAuth()
  const [mode, setMode] = useState<ConfirmMode>(null)
  const [reason, setReason] = useState('')

  const reasonRef = useRef(reason)

  useEffect(() => {
    reasonRef.current = reason
  })

  const showHardDelete = onHardDelete !== undefined && hasRole(hardRole)

  const confirmAction = () => {
    if (mode === 'hard') {
      onHardDelete?.(reasonRef.current.trim())
    } else {
      onSoftDelete()
    }
    setReason('')
    setMode(null)
  }

  return (
    <div className="confirm-delete">
      <Button
        type="button"
        variant="text"
        severity="danger"
        iconOnly
        aria-label={softLabel}
        title={softLabel}
        onClick={() => setMode('soft')}
      >
        <i className="pi pi-trash" />
      </Button>
      {showHardDelete && (
        <Button
          type="button"
          variant="text"
          severity="danger"
          iconOnly
          aria-label={hardLabel}
          title={hardLabel}
          onClick={() => {
            setReason('')
            setMode('hard')
          }}
        >
          <i className="pi pi-times" />
        </Button>
      )}
      <Dialog.Root
        visible={mode !== null}
        modal
        dismissable
        blockScroll
        onOpenChange={(event: DialogRootChangeEvent) => {
          if (!event.value) {
            setMode(null)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content className="confirm-delete-content">
              <Dialog.Header>
                <Dialog.Title>{mode === 'hard' ? 'Permanently delete?' : 'Delete?'}</Dialog.Title>
                <Dialog.HeaderActions>
                  <Dialog.Close aria-label="Close">
                    <i className="pi pi-times" />
                  </Dialog.Close>
                </Dialog.HeaderActions>
              </Dialog.Header>
              <div className="confirm-delete-body">
                <div className={`confirm-delete-icon ${mode === 'hard' ? 'confirm-delete-icon-hard' : ''}`}>
                  <i className={mode === 'hard' ? 'pi pi-exclamation-triangle' : 'pi pi-trash'} />
                </div>
                <div className="confirm-delete-message">
                  {mode === 'hard' ? (
                    <>
                      Permanently delete <strong>{itemName}</strong>? This action cannot be undone.
                    </>
                  ) : (
                    <>
                      Delete <strong>{itemName}</strong>? It will be deactivated and can be reactivated later.
                    </>
                  )}
                </div>
                {mode === 'hard' && (
                  <div className="confirm-delete-reason">
                    <label className="confirm-delete-reason-label" htmlFor="confirm-delete-reason">
                      {reasonLabel}
                    </label>
                    <InputText
                      id="confirm-delete-reason"
                      value={reason}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value)}
                      placeholder={reasonPlaceholder}
                      invalid={reason.trim() === ''}
                      className="w-full"
                    />
                    {reason.trim() === '' && (
                      <small className="confirm-delete-reason-error">{reasonLabel} is required.</small>
                    )}
                  </div>
                )}
              </div>
              <Dialog.Footer>
                <Button type="button" variant="text" onClick={() => setMode(null)}>
                  <span className="p-button-label">Cancel</span>
                </Button>
                <Button
                  type="button"
                  severity="danger"
                  disabled={mode === 'hard' && reason.trim() === ''}
                  onClick={confirmAction}
                >
                  <i className={mode === 'hard' ? 'pi pi-times' : 'pi pi-trash'} />
                  <span className="p-button-label">{mode === 'hard' ? 'Delete permanently' : 'Delete'}</span>
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}