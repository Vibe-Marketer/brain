import { useState } from 'react'
import {
  RiSafeLine,
  RiCheckLine,
  RiLockLine,
  RiTeamLine,
  RiLoader4Line,
} from '@remixicon/react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useVaultAssignment } from '@/hooks/useVaultAssignment'
import { useBankContext } from '@/hooks/useBankContext'
import type { VaultWithMembership } from '@/types/bank'

export interface AddToVaultMenuProps {
  /** UUID recording ID (from recordings table) - preferred */
  recordingId?: string | null
  /** Numeric legacy recording ID (from fathom_calls) - used for lookup if recordingId not available */
  legacyRecordingId?: number | null
  /** Compact icon-only trigger for table rows */
  compact?: boolean
}

/**
 * AddToVaultMenu - Popover menu to assign/remove recordings from vaults
 *
 * Shows a checklist of all vaults in the current bank.
 * Checkmarks indicate which vaults the recording is already in.
 * Personal vault cannot be removed (always stays checked).
 *
 * Supports both UUID recording IDs and legacy numeric IDs from fathom_calls.
 *
 * @brand-version v4.2
 */
export function AddToVaultMenu({
  recordingId,
  legacyRecordingId,
  compact = true,
}: AddToVaultMenuProps) {
  const [open, setOpen] = useState(false)
  const { vaults, personalVault, isLoading: bankLoading } = useBankContext()
  const {
    assignedVaultIds,
    effectiveRecordingId,
    isLoading: entriesLoading,
    toggleVault,
    isAdding,
    isRemoving,
  } = useVaultAssignment(
    open ? (recordingId || null) : null,
    open ? legacyRecordingId : null,
  )

  const isLoading = bankLoading || entriesLoading
  const isMutating = isAdding || isRemoving
  // If recording hasn't been migrated yet, we can't assign to vaults
  const notMigrated = open && !effectiveRecordingId && !isLoading

  // Get icon for vault type
  const getVaultIcon = (vault: VaultWithMembership) => {
    if (vault.vault_type === 'personal') {
      return <RiLockLine className="h-4 w-4 text-cb-ink-muted" />
    }
    return <RiTeamLine className="h-4 w-4 text-cb-ink-muted" />
  }

  // Check if this is the personal vault (cannot be removed)
  const isPersonalVault = (vaultId: string) =>
    personalVault?.id === vaultId

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {compact ? (
                <button
                  className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-hover dark:hover:bg-cb-panel-dark transition-colors"
                  title="Add to vault"
                >
                  <RiSafeLine className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </button>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <RiSafeLine className="h-4 w-4" />
                </Button>
              )}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Add to vault</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-56 p-2">
        <div className="space-y-1">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Vaults
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RiLoader4Line className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notMigrated ? (
            <p className="px-2 py-3 text-sm text-muted-foreground text-center">
              Recording not yet migrated to vault system
            </p>
          ) : vaults.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground text-center">
              No vaults available
            </p>
          ) : (
            vaults.map((vault) => {
              const isAssigned = assignedVaultIds.has(vault.id)
              const isPersonal = isPersonalVault(vault.id)

              return (
                <button
                  key={vault.id}
                  onClick={() => toggleVault(vault.id)}
                  disabled={isMutating || isPersonal}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    'hover:bg-muted/50',
                    isAssigned && 'bg-primary/5',
                    (isMutating || isPersonal) && 'opacity-60 cursor-not-allowed',
                    !isMutating && !isPersonal && 'cursor-pointer'
                  )}
                >
                  {/* Vault type icon */}
                  {getVaultIcon(vault)}

                  {/* Vault name */}
                  <span className="flex-1 text-left truncate font-inter text-sm">
                    {vault.name}
                  </span>

                  {/* Personal lock indicator */}
                  {isPersonal && isAssigned && (
                    <span className="text-[10px] text-muted-foreground">always</span>
                  )}

                  {/* Check indicator */}
                  {isAssigned && (
                    <RiCheckLine className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
