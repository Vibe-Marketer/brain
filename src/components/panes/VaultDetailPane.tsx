/**
 * VaultDetailPane - Main content area showing vault recordings (always visible)
 *
 * Renders recordings via TranscriptTable with a Recording→Meeting adapter.
 * NO tabs — recordings are always visible per locked decision.
 * "Members" button opens VaultMemberPanel as slide-in 4th pane.
 *
 * @pattern app-shell-main-content
 * @brand-version v4.2
 */

import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TranscriptTable } from '@/components/transcript-library/TranscriptTable'
import { AddToVaultMenu } from '@/components/vault/AddToVaultMenu'
import {
  RiGroupLine,
  RiArrowLeftLine,
  RiSafeLine,
  RiRecordCircleLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useVaultDetail, useVaultRecordings, mapRecordingToMeeting } from '@/hooks/useVaults'
import type { VaultType } from '@/types/bank'
import type { Meeting } from '@/types'

/** Vault type badge colors */
const VAULT_TYPE_STYLES: Record<VaultType, { bg: string; text: string }> = {
  personal: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  team: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  coach: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  community: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  client: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300' },
}

export interface VaultDetailPaneProps {
  vaultId: string
  onClose?: () => void
  onBack?: () => void
  showBackButton?: boolean
  className?: string
}

/** Loading skeleton for vault detail */
function VaultDetailSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-label="Loading vault detail">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

export function VaultDetailPane({
  vaultId,
  onClose,
  onBack,
  showBackButton = false,
  className,
}: VaultDetailPaneProps) {
  const navigate = useNavigate()
  const { openPanel } = usePanelStore()
  const { vault, isLoading: vaultLoading } = useVaultDetail(vaultId)
  const { recordings, isLoading: recordingsLoading } = useVaultRecordings(vaultId)

  // Transform vault recordings to Meeting[] for TranscriptTable
  const meetings = useMemo(() => {
    return recordings.map(mapRecordingToMeeting)
  }, [recordings])

  // Handle recording click - navigate to call detail page
  const handleCallClick = useCallback(
    (call: Meeting) => {
      navigate(`/call/${call.recording_id}`)
    },
    [navigate]
  )

  // Open members panel (4th pane)
  const handleOpenMembers = useCallback(() => {
    openPanel('vault-member', { type: 'vault-member' as const, vaultId })
  }, [openPanel, vaultId])

  // No-op handlers for TranscriptTable required props
  const handleSelectCall = useCallback(() => {}, [])
  const handleSelectAll = useCallback(() => {}, [])

  if (vaultLoading) {
    return <VaultDetailSkeleton />
  }

  if (!vault) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <RiSafeLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Vault not found</p>
        </div>
      </div>
    )
  }

  const typeStyle = VAULT_TYPE_STYLES[vault.vault_type as VaultType] || VAULT_TYPE_STYLES.personal

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-1 -ml-1"
              aria-label="Go back to vault list"
            >
              <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {/* Vault name */}
          <h2 className="font-montserrat font-extrabold text-base uppercase tracking-wide truncate">
            {vault.name}
          </h2>

          {/* Vault type badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 h-5 uppercase tracking-wider font-medium border-0',
              typeStyle.bg,
              typeStyle.text
            )}
          >
            {vault.vault_type}
          </Badge>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Recording count */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <RiRecordCircleLine className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">{recordings.length}</span>
          </div>

          {/* Members button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenMembers}
            className="flex items-center gap-1.5 text-xs"
            aria-label={`View ${vault.member_count} vault members`}
          >
            <RiGroupLine className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{vault.member_count}</span>
          </Button>
        </div>
      </header>

      {/* Recordings - ALWAYS visible (no tabs) */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {recordingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RiSafeLine className="h-16 w-16 text-muted-foreground/20 mb-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No recordings in this vault yet</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Add recordings from your Library using the vault menu on any recording row.
              </p>
              <Button
                variant="hollow"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/')}
              >
                Go to Library
              </Button>
            </div>
          ) : (
            <TranscriptTable
              calls={meetings}
              selectedCalls={[]}
              tags={[]}
              tagAssignments={{}}
              onSelectCall={handleSelectCall}
              onSelectAll={handleSelectAll}
              onCallClick={handleCallClick}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default VaultDetailPane
