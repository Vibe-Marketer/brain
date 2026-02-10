/**
 * EditVaultDialog - Dialog for editing vault name and settings
 *
 * Allows renaming vault and changing share link TTL.
 * Includes a "Delete Vault" button that opens the DeleteVaultDialog.
 *
 * @pattern dialog-form
 * @brand-version v4.2
 */

import { useState, useEffect, useCallback } from 'react'
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
import { RiDeleteBinLine } from '@remixicon/react'
import { useUpdateVault } from '@/hooks/useVaultMutations'
import { DeleteVaultDialog } from './DeleteVaultDialog'
import type { VaultDetail } from '@/hooks/useVaults'
import type { VaultRole } from '@/types/bank'

export interface EditVaultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vault: VaultDetail | null
  userRole: VaultRole | null
}

/** Roles that can edit vault settings */
const CAN_EDIT_ROLES: VaultRole[] = ['vault_owner', 'vault_admin']

/** Roles that can delete a vault */
const CAN_DELETE_ROLES: VaultRole[] = ['vault_owner']

export function EditVaultDialog({
  open,
  onOpenChange,
  vault,
  userRole,
}: EditVaultDialogProps) {
  const [name, setName] = useState('')
  const [ttlDays, setTtlDays] = useState<number>(7)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const updateVault = useUpdateVault()

  const canEdit = userRole ? CAN_EDIT_ROLES.includes(userRole) : false
  const canDelete = userRole ? CAN_DELETE_ROLES.includes(userRole) : false

  // Sync form state when vault changes
  useEffect(() => {
    if (vault) {
      setName(vault.name)
      setTtlDays(vault.default_sharelink_ttl_days || 7)
    }
  }, [vault])

  const hasChanges =
    vault &&
    (name.trim() !== vault.name ||
      ttlDays !== (vault.default_sharelink_ttl_days || 7))

  const handleSubmit = useCallback(() => {
    if (!vault || !name.trim() || !hasChanges) return

    updateVault.mutate(
      {
        vaultId: vault.id,
        name: name.trim(),
        defaultSharelinkTtlDays: ttlDays,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      }
    )
  }, [vault, name, ttlDays, hasChanges, updateVault, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && hasChanges && !updateVault.isPending) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, hasChanges, updateVault.isPending]
  )

  if (!vault) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby="edit-vault-description">
          <DialogHeader>
            <DialogTitle>Vault Settings</DialogTitle>
            <DialogDescription id="edit-vault-description">
              Update vault name and configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Vault name */}
            <div className="space-y-2">
              <Label htmlFor="edit-vault-name">Vault Name</Label>
              <Input
                id="edit-vault-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Vault name"
                disabled={!canEdit}
                autoFocus
              />
            </div>

            {/* Share link TTL */}
            <div className="space-y-2">
              <Label htmlFor="edit-vault-ttl">Default Share Link Expiry (days)</Label>
              <Input
                id="edit-vault-ttl"
                type="number"
                min={1}
                max={365}
                value={ttlDays}
                onChange={(e) => setTtlDays(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Shared links will expire after this many days
              </p>
            </div>

            {/* Vault type (read-only) */}
            <div className="space-y-2">
              <Label>Vault Type</Label>
              <p className="text-sm text-muted-foreground capitalize">
                {vault.vault_type}
              </p>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {/* Delete button (left side) */}
            <div>
              {canDelete && vault.vault_type !== 'personal' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    // Small delay to prevent animation conflicts
                    setTimeout(() => setDeleteDialogOpen(true), 150)
                  }}
                  className="gap-1.5"
                >
                  <RiDeleteBinLine className="h-4 w-4" />
                  Delete Vault
                </Button>
              )}
            </div>

            {/* Save/Cancel (right side) */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateVault.isPending}
              >
                Cancel
              </Button>
              {canEdit && (
                <Button
                  onClick={handleSubmit}
                  disabled={!hasChanges || updateVault.isPending}
                >
                  {updateVault.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <DeleteVaultDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        vault={vault}
      />
    </>
  )
}

export default EditVaultDialog
