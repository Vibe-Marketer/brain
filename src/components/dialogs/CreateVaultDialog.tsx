/**
 * CreateVaultDialog - Dialog for creating new vaults
 *
 * Supports vault name, type selection (team default),
 * and optional share link TTL setting.
 *
 * @pattern dialog-form
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateVault } from '@/hooks/useVaultMutations'
import type { VaultType } from '@/types/bank'

export interface CreateVaultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankId: string
}

/** Type descriptions for the select menu */
const VAULT_TYPE_OPTIONS: Array<{
  value: VaultType
  label: string
  description: string
  disabled?: boolean
}> = [
  {
    value: 'team',
    label: 'Team',
    description: 'Shared workspace for your team',
  },
  {
    value: 'coach',
    label: 'Coach',
    description: 'Coaching sessions and feedback',
    disabled: true,
  },
  {
    value: 'community',
    label: 'Community',
    description: 'Community-shared content',
    disabled: true,
  },
  {
    value: 'client',
    label: 'Client',
    description: 'Client-facing recordings',
    disabled: true,
  },
]

export function CreateVaultDialog({
  open,
  onOpenChange,
  bankId,
}: CreateVaultDialogProps) {
  const [name, setName] = useState('')
  const [vaultType, setVaultType] = useState<VaultType>('team')
  const createVault = useCreateVault()

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return

    createVault.mutate(
      {
        bankId,
        name: name.trim(),
        vaultType,
      },
      {
        onSuccess: () => {
          setName('')
          setVaultType('team')
          onOpenChange(false)
        },
      }
    )
  }, [name, vaultType, bankId, createVault, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && name.trim() && !createVault.isPending) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, name, createVault.isPending]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="create-vault-description">
        <DialogHeader>
          <DialogTitle>Create New Vault</DialogTitle>
          <DialogDescription id="create-vault-description">
            Create a collaboration space for your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vault name */}
          <div className="space-y-2">
            <Label htmlFor="vault-name">Vault Name</Label>
            <Input
              id="vault-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Sales Team, Marketing"
              autoFocus
            />
          </div>

          {/* Vault type */}
          <div className="space-y-2">
            <Label htmlFor="vault-type">Vault Type</Label>
            <Select
              value={vaultType}
              onValueChange={(v) => setVaultType(v as VaultType)}
            >
              <SelectTrigger id="vault-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAULT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                    {opt.disabled && ' (Coming Soon)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createVault.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createVault.isPending}
          >
            {createVault.isPending ? 'Creating...' : 'Create Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateVaultDialog
