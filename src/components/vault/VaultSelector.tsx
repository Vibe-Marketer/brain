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
import { useEffect, useMemo } from 'react'
import { RiSafeLine, RiLockLine, RiTeamLine, RiYoutubeLine } from '@remixicon/react'
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
  if (vault.vault_type === 'youtube') {
    return <RiYoutubeLine className="h-4 w-4 text-red-500 flex-shrink-0" />
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

  // Filter vaults by type when integration is 'youtube'
  const filteredVaults = useMemo(() => {
    if (integration === 'youtube') {
      return vaults.filter((v) => v.vault_type === 'youtube')
    }
    return vaults
  }, [vaults, integration])

  // Auto-select default vault on mount
  useEffect(() => {
    if (!value && filteredVaults.length > 0) {
      const savedDefault = getDefaultVault(integration)
      const savedExists = savedDefault && filteredVaults.some((v) => v.id === savedDefault)

      if (savedExists && savedDefault) {
        onVaultChange(savedDefault)
      } else if (integration !== 'youtube' && personalVault) {
        onVaultChange(personalVault.id)
      } else {
        onVaultChange(filteredVaults[0].id)
      }
    }
  }, [filteredVaults, personalVault, value, integration, getDefaultVault, onVaultChange])

  // Handle selection change
  const handleChange = (vaultId: string) => {
    onVaultChange(vaultId)
    setDefaultVault(integration, vaultId)
  }

  // Sort vaults: personal first, then team vaults alphabetically
  const sortedVaults = useMemo(() => {
    const personal = filteredVaults.filter((v) => v.vault_type === 'personal')
    const team = filteredVaults
      .filter((v) => v.vault_type !== 'personal')
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...personal, ...team]
  }, [filteredVaults])

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

  if (filteredVaults.length === 0) {
    // When integration is YouTube and no YouTube vault exists, show auto-creation message
    if (integration === 'youtube') {
      return (
        <div className={cn('space-y-2', className)}>
          {label && (
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <RiSafeLine className="w-4 h-4 text-muted-foreground" />
              {label}
            </label>
          )}
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
            <RiYoutubeLine className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span>A YouTube Hub will be created automatically</span>
          </div>
        </div>
      )
    }
    return null
  }

  // If only one vault, show it as plain text (no need for a dropdown)
  if (filteredVaults.length === 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <RiSafeLine className="w-4 h-4 text-muted-foreground" />
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm">
          <VaultIcon vault={filteredVaults[0]} />
          <span className="truncate">{filteredVaults[0].name}</span>
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
                    <span className="text-2xs text-muted-foreground ml-1">
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
