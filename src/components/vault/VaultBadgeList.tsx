/**
 * VaultBadgeList - List of vault badges with overflow handling
 *
 * Fetches vault entries for a recording and displays badges for each vault.
 * Shows up to maxVisible badges, then a "+N" overflow badge with popover.
 * Personal vault always first with subtle styling.
 *
 * @brand-version v4.2
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiSafeLine } from '@remixicon/react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { VaultBadge } from '@/components/vault/VaultBadge'
import { useVaultAssignment } from '@/hooks/useVaultAssignment'
import { useBankContext } from '@/hooks/useBankContext'
import { cn } from '@/lib/utils'
import type { VaultType } from '@/types/bank'

export interface VaultBadgeListProps {
  /** UUID recording ID (preferred) */
  recordingId?: string | null
  /** Numeric legacy recording ID (from fathom_calls) */
  legacyRecordingId?: number | null
  /** Maximum badges to show before overflow */
  maxVisible?: number
  /** Size of the badges */
  size?: 'sm' | 'md'
  /** Whether to hide personal vault badges (for table rows) */
  hidePersonal?: boolean
  /** Additional CSS classes */
  className?: string
}

interface VaultInfo {
  id: string
  name: string
  vaultType: VaultType
}

/**
 * VaultBadgeList - Shows which vaults a recording belongs to
 */
export function VaultBadgeList({
  recordingId,
  legacyRecordingId,
  maxVisible = 3,
  size = 'md',
  hidePersonal = false,
  className,
}: VaultBadgeListProps) {
  const navigate = useNavigate()
  const [overflowOpen, setOverflowOpen] = useState(false)
  const { vaults, personalVault, isLoading: bankLoading } = useBankContext()

  const {
    assignedVaultIds,
    isLoading: entriesLoading,
  } = useVaultAssignment(
    recordingId || null,
    legacyRecordingId,
  )

  const isLoading = bankLoading || entriesLoading

  // Build list of vaults this recording is in, with info
  const assignedVaults: VaultInfo[] = vaults
    .filter((v) => assignedVaultIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.name,
      vaultType: v.vault_type as VaultType,
    }))
    // Sort: personal first, then alphabetical
    .sort((a, b) => {
      if (a.vaultType === 'personal' && b.vaultType !== 'personal') return -1
      if (a.vaultType !== 'personal' && b.vaultType === 'personal') return 1
      return a.name.localeCompare(b.name)
    })

  // Filter out personal if requested
  const displayVaults = hidePersonal
    ? assignedVaults.filter((v) => v.vaultType !== 'personal')
    : assignedVaults

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
    )
  }

  // Nothing to show
  if (displayVaults.length === 0) {
    return null
  }

  const visible = displayVaults.slice(0, maxVisible)
  const overflow = displayVaults.slice(maxVisible)

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {visible.map((vault) => (
        <VaultBadge
          key={vault.id}
          vaultId={vault.id}
          vaultName={vault.name}
          vaultType={vault.vaultType}
          size={size}
        />
      ))}

      {overflow.length > 0 && (
        <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'inline-flex items-center rounded-md font-inter font-medium transition-colors',
                'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer',
                size === 'sm' ? 'h-6 text-xs px-1.5' : 'h-7 text-sm px-2',
              )}
            >
              +{overflow.length}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              More Vaults
            </p>
            <div className="space-y-1 mt-1">
              {overflow.map((vault) => (
                <button
                  key={vault.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/vaults/${vault.id}`)
                    setOverflowOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <RiSafeLine className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">{vault.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
