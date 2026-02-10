/**
  * VaultSelector - Dropdown for choosing which hub to import recordings into
 *
  * Shows user's hubs grouped by workspace, with personal hub first.
  * Remembers default hub per integration via useUserPreferences.
 *
 * @pattern vault-selector
 * @brand-version v4.2
 */

import * as React from 'react'
import { useEffect } from 'react'
import { RiSafeLine, RiLockLine, RiTeamLine } from '@remixicon/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBankContext } from '@/hooks/useBankContext'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { cn } from '@/lib/utils'
import type { VaultWithMembership } from '@/types/bank'

type IntegrationKey = 'youtube' | 'zoom' | 'google_meet' | 'fathom'

export interface VaultSelectorProps {
  /** Which integration this selector is for (used to remember default) */
  integration: IntegrationKey
  /** Called when user selects a vault */
  onVaultChange: (vaultId: string) => void
  /** Currently selected vault ID (controlled) */
  value?: string
  /** Label text above the selector */
  label?: string
  /** Additional CSS classes */
  className?: string
  /** Disable the selector */
  disabled?: boolean
}

/**
 * Get icon for vault type
 */
function VaultIcon({ vault }: { vault: VaultWithMembership }) {
  if (vault.vault_type === 'personal') {
    return <RiLockLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  }
  return <RiTeamLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
}

export function VaultSelector({
  integration,
  onVaultChange,
  value,
   label = 'Import to hub',
  className,
  disabled = false,
}: VaultSelectorProps) {
  const { vaults, personalVault, isLoading } = useBankContext()
  const { getDefaultVault, setDefaultVault } = useUserPreferences()

  // Auto-select default vault on mount
  useEffect(() => {
    if (!value && vaults.length > 0) {
      const savedDefault = getDefaultVault(integration)
      const savedExists = savedDefault && vaults.some((v) => v.id === savedDefault)

      if (savedExists && savedDefault) {
        onVaultChange(savedDefault)
      } else if (personalVault) {
        onVaultChange(personalVault.id)
      } else {
        onVaultChange(vaults[0].id)
      }
    }
  }, [vaults, personalVault, value, integration, getDefaultVault, onVaultChange])

  // Handle selection change
  const handleChange = (vaultId: string) => {
    onVaultChange(vaultId)
    setDefaultVault(integration, vaultId)
  }

  // Sort vaults: personal first, then team vaults alphabetically
  const sortedVaults = React.useMemo(() => {
    const personal = vaults.filter((v) => v.vault_type === 'personal')
    const team = vaults
      .filter((v) => v.vault_type !== 'personal')
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...personal, ...team]
  }, [vaults])

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <RiSafeLine className="w-4 h-4 text-muted-foreground" />
            {label}
          </label>
        )}
        <div className="h-10 rounded-md border border-input bg-muted/50 animate-pulse" />
      </div>
    )
  }

  if (vaults.length === 0) {
    return null
  }

  // If only one vault, show it as plain text (no need for a dropdown)
  if (vaults.length === 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <RiSafeLine className="w-4 h-4 text-muted-foreground" />
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm">
          <VaultIcon vault={vaults[0]} />
          <span className="truncate">{vaults[0].name}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <RiSafeLine className="w-4 h-4 text-muted-foreground" />
          {label}
        </label>
      )}
      <Select
        value={value || ''}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full h-10">
          <SelectValue placeholder="Select a hub..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wide">
              Hubs
            </SelectLabel>
            {sortedVaults.map((vault) => (
              <SelectItem key={vault.id} value={vault.id}>
                <div className="flex items-center gap-2">
                  <VaultIcon vault={vault} />
                  <span className="truncate">{vault.name}</span>
                  {vault.vault_type === 'personal' && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      (personal)
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
