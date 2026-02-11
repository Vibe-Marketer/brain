/**
 * DeleteBankDialog - Confirmation dialog for workspace deletion
 *
 * When deleting a workspace that has calls/records:
 * - Option 1: Delete all calls in the workspace
 * - Option 2: Move calls back to personal workspace before deleting
 * Requires typing workspace name to confirm.
 *
 * @pattern dialog-confirmation
 * @brand-version v4.2
 */

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RiAlertLine } from '@remixicon/react'
import { useDeleteBank } from '@/hooks/useBankMutations'
import type { BankWithMembership } from '@/types/bank'

export interface DeleteBankDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bank: BankWithMembership | null
}

export function DeleteBankDialog({
  open,
  onOpenChange,
  bank,
}: DeleteBankDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [dataHandling, setDataHandling] = useState<'delete' | 'move'>('move')
  const deleteBank = useDeleteBank()

  const isConfirmed = bank ? confirmText === bank.name : false
  const canDelete = isConfirmed

  const handleDelete = useCallback(() => {
    if (!bank || !isConfirmed) return

    deleteBank.mutate(
      {
        bankId: bank.id,
        moveCallsToPersonal: dataHandling === 'move',
      },
      {
        onSuccess: () => {
          setConfirmText('')
          setDataHandling('move')
          onOpenChange(false)
        },
      }
    )
  }, [bank, isConfirmed, deleteBank, dataHandling, onOpenChange])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setConfirmText('')
        setDataHandling('move')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  if (!bank) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="delete-bank-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <RiAlertLine className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Delete Workspace</DialogTitle>
          </div>
          <DialogDescription id="delete-bank-description">
            This action cannot be undone. The workspace and all its hubs will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-sm text-foreground">
              Deleting <strong>{bank.name}</strong> will:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-4">
              <li>Remove all hubs within this workspace</li>
              <li>Remove all team memberships</li>
              <li>Remove all hub-specific notes, tags, and scores</li>
            </ul>
          </div>

          {/* Data handling options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What should happen to calls in this workspace?</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover transition-colors">
                <input
                  type="radio"
                  name="data-handling"
                  value="move"
                  checked={dataHandling === 'move'}
                  onChange={() => setDataHandling('move')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Move calls to Personal workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Calls will be moved back to your personal workspace before deletion.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover transition-colors">
                <input
                  type="radio"
                  name="data-handling"
                  value="delete"
                  checked={dataHandling === 'delete'}
                  onChange={() => setDataHandling('delete')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Delete all calls</p>
                  <p className="text-xs text-muted-foreground">
                    All calls in this workspace will be permanently deleted. You can re-import them from the original source later.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="delete-bank-confirm">
              Type <strong>{bank.name}</strong> to confirm
            </Label>
            <Input
              id="delete-bank-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={bank.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => handleOpenChange(false)}
            disabled={deleteBank.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteBank.isPending}
          >
            {deleteBank.isPending ? 'Deleting...' : 'Delete Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteBankDialog
