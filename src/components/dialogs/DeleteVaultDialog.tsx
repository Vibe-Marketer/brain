/**
 * DeleteVaultDialog - Confirmation dialog for vault deletion
 *
 * Requires typing the vault name to confirm deletion.
 * Prevents accidental deletion of vaults with recordings.
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
import { useDeleteVault } from '@/hooks/useVaultMutations'
import { useNavigate } from 'react-router-dom'
import type { VaultDetail } from '@/hooks/useVaults'

export interface DeleteVaultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vault: VaultDetail | null
}

export function DeleteVaultDialog({
  open,
  onOpenChange,
  vault,
}: DeleteVaultDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const deleteVault = useDeleteVault()
  const navigate = useNavigate()

  const isConfirmed = vault ? confirmText === vault.name : false

  const handleDelete = useCallback(() => {
    if (!vault || !isConfirmed) return

    deleteVault.mutate(
      {
        vaultId: vault.id,
        vaultName: vault.name,
      },
      {
        onSuccess: () => {
          setConfirmText('')
          onOpenChange(false)
          // Navigate back to vaults list
          navigate('/vaults')
        },
      }
    )
  }, [vault, isConfirmed, deleteVault, onOpenChange, navigate])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setConfirmText('')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  if (!vault) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="delete-vault-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <RiAlertLine className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle>Delete Vault</DialogTitle>
          </div>
          <DialogDescription id="delete-vault-description">
            This action cannot be undone. All recordings will be removed from
            this vault (recordings themselves are not deleted from your bank).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-sm text-foreground">
              Deleting <strong>{vault.name}</strong> will:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-4">
              <li>Remove all vault memberships ({vault.member_count} members)</li>
              <li>Remove all vault entry assignments</li>
              <li>Delete all vault-specific notes, tags, and scores</li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <strong>{vault.name}</strong> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={vault.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleteVault.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || deleteVault.isPending}
          >
            {deleteVault.isPending ? 'Deleting...' : 'Delete Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteVaultDialog
