/**
  * CreateVaultDialog - Dialog for creating new hubs
 *
  * Supports hub name, type selection (team default),
 * and optional share link TTL setting.
 *
 * @pattern dialog-form
 * @brand-version v4.2
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBankContext } from '@/hooks/useBankContext'
import { useCreateVault } from '@/hooks/useVaultMutations'
import type { VaultType } from '@/types/bank'

export interface CreateVaultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankId: string
  onVaultCreated?: (vaultId: string) => void
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
    label: 'Hub',
    description: 'Shared hub for collaboration',
  },
  {
    value: 'youtube',
    label: 'YouTube',
    description: 'Video intelligence and channel content',
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
  onVaultCreated,
}: CreateVaultDialogProps) {
  const [name, setName] = useState('')
  const [vaultType, setVaultType] = useState<VaultType>('team')
  const [ttlDays, setTtlDays] = useState('7')
  const [selectedBankId, setSelectedBankId] = useState(bankId)
  const { banks, activeBankId } = useBankContext()
  const createVault = useCreateVault()

  const businessBanks = useMemo(
    () => banks.filter((bank) => bank.type === 'business'),
    [banks]
  )

  const showBankSelect = businessBanks.length > 1

  useEffect(() => {
    if (!open) return
    const businessDefault =
      businessBanks.find((bank) => bank.id === activeBankId)?.id ||
      businessBanks[0]?.id ||
      ''
    const fallbackBank = showBankSelect
      ? businessDefault
      : bankId || activeBankId || businessDefault
    setSelectedBankId(fallbackBank)
  }, [open, bankId, activeBankId, businessBanks, showBankSelect])

  const trimmedName = name.trim()
  const isNameValid = trimmedName.length >= 3 && trimmedName.length <= 50
  const ttlValue = ttlDays.trim() === '' ? null : Number(ttlDays)
  const shareLinkTtl = ttlValue !== null && Number.isFinite(ttlValue)
    ? Math.min(365, Math.max(1, ttlValue))
    : undefined
  const canSubmit = isNameValid && !!selectedBankId && !createVault.isPending

  const handleSubmit = useCallback(() => {
    if (!isNameValid || !selectedBankId) return

    createVault.mutate(
      {
        bankId: selectedBankId,
        name: trimmedName,
        vaultType,
        defaultShareLinkTtlDays: shareLinkTtl,
      },
      {
        onSuccess: (vault) => {
          setName('')
          setVaultType('team')
          setTtlDays('7')
          onOpenChange(false)
          onVaultCreated?.(vault.id)
        },
      }
    )
  }, [
    createVault,
    isNameValid,
    onOpenChange,
    onVaultCreated,
    selectedBankId,
    shareLinkTtl,
    trimmedName,
    vaultType,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [canSubmit, handleSubmit]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="create-vault-description">
        <DialogHeader>
      <DialogTitle>Create New Hub</DialogTitle>
      <DialogDescription id="create-vault-description">
        A hub is a shared space inside a workspace for one team, client, or community.
      </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Hub name */}
          <div className="space-y-2">
            <Label htmlFor="vault-name">Hub Name</Label>
            <Input
              id="vault-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Sales Hub, Client A"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              3-50 characters
            </p>
            {name.length > 0 && !isNameValid && (
              <p className="text-xs text-destructive">
                Hub name must be between 3 and 50 characters.
              </p>
            )}
          </div>

          {/* Hub type */}
          <div className="space-y-2">
            <Label htmlFor="vault-type">Hub Type</Label>
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
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      </div>
                      {opt.disabled && (
                        <Badge variant="outline" className="text-2xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default share link TTL */}
          <div className="space-y-2">
            <Label htmlFor="vault-ttl">Default Share Link Expiration (days)</Label>
            <Input
              id="vault-ttl"
              type="number"
              min={1}
              max={365}
              value={ttlDays}
              onChange={(e) => setTtlDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shared links expire after this many days (default 7)
            </p>
          </div>

          {/* Workspace selection */}
          {showBankSelect && (
            <div className="space-y-2">
              <Label htmlFor="vault-bank">Workspace</Label>
              <Select
                value={selectedBankId}
                onValueChange={setSelectedBankId}
              >
                <SelectTrigger id="vault-bank">
                  <SelectValue placeholder="Select a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {businessBanks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => onOpenChange(false)}
            disabled={createVault.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {createVault.isPending ? 'Creating...' : 'Create Hub'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateVaultDialog
