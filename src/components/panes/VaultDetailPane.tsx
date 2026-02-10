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

import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TranscriptTable } from '@/components/transcript-library/TranscriptTable'
import { VaultSearchFilter } from '@/components/vault/VaultSearchFilter'
import { EditVaultDialog } from '@/components/dialogs/EditVaultDialog'
import { DeleteVaultDialog } from '@/components/dialogs/DeleteVaultDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  RiGroupLine,
  RiArrowLeftLine,
  RiSafeLine,
  RiMicLine,
  RiRecordCircleLine,
  RiSearchLine,
  RiSettings3Line,
  RiArrowDownSLine,
  RiErrorWarningLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useVaultDetail, useVaultRecordings, mapRecordingToMeeting } from '@/hooks/useVaults'
import { useRecordingSearch } from '@/hooks/useRecordingSearch'
import { queryKeys } from '@/lib/query-config'
import type { VaultType, VaultRole } from '@/types/bank'
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
  vaultId: string | null
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
  const queryClient = useQueryClient()
  const { openPanel } = usePanelStore()
  const { vault, isLoading: vaultLoading, error: vaultError } = useVaultDetail(vaultId)
  const { recordings, isLoading: recordingsLoading, error: recordingsError } = useVaultRecordings(vaultId)

  // Search/filter/sort recordings
  const {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    clearFilters,
    hasActiveFilters,
    filteredRecordings,
    totalCount,
    filteredCount,
  } = useRecordingSearch({ recordings })

  // Transform filtered vault recordings to Meeting[] for TranscriptTable
  const meetings = useMemo(() => {
    return filteredRecordings.map(mapRecordingToMeeting)
  }, [filteredRecordings])

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

  // Edit vault dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Permission check: can user edit vault settings?
  const canEditSettings = vault?.user_role
    ? (['vault_owner', 'vault_admin'] as VaultRole[]).includes(vault.user_role)
    : false
  const canDeleteVault = vault?.user_role === 'vault_owner'

  const handleOpenSettings = useCallback(() => {
    setEditDialogOpen(true)
  }, [])

  const handleOpenDelete = useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  // No-op handlers for TranscriptTable required props
  const handleSelectCall = useCallback(() => {}, [])
  const handleSelectAll = useCallback(() => {}, [])

  if (!vaultId) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <RiArrowLeftLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground mb-1">Select a vault</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Choose a vault from the list to view recordings and members
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (vaultLoading) {
    return <VaultDetailSkeleton />
  }

  if (vaultError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <RiErrorWarningLine className="h-12 w-12 text-destructive/60 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground mb-1">Unable to load this vault</p>
          <p className="text-xs text-muted-foreground mb-4">
            Please try again in a moment.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) })}
            aria-label="Retry loading vault"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
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
          {canEditSettings ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-1 min-w-0 focus:outline-none"
                  aria-label="Vault actions"
                >
                  <span className="font-montserrat font-extrabold text-base uppercase tracking-wide truncate">
                    {vault.name}
                  </span>
                  <RiArrowDownSLine className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={handleOpenSettings}>
                  Edit Vault
                </DropdownMenuItem>
                {canDeleteVault && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenDelete}>
                      Delete Vault
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <h2 className="font-montserrat font-extrabold text-base uppercase tracking-wide truncate">
              {vault.name}
            </h2>
          )}

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

          {/* Settings button (vault_owner/vault_admin only) */}
          {canEditSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenSettings}
              className="h-8 w-8"
              aria-label="Vault settings"
            >
              <RiSettings3Line className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

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

      {/* Search/filter toolbar - only show when vault has recordings */}
      {!recordingsLoading && recordings.length > 0 && (
        <VaultSearchFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      )}

      {/* Recordings - ALWAYS visible (no tabs) */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {recordingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recordingsError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RiErrorWarningLine className="h-12 w-12 text-destructive/60 mb-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Unable to load recordings</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Please try again. If this keeps happening, contact support.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.vaults.recordings(vaultId) })}
                aria-label="Retry loading recordings"
              >
                Try Again
              </Button>
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RiMicLine className="h-16 w-16 text-muted-foreground/20 mb-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No recordings in this vault</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Recordings you add to this vault will appear here.
              </p>
              <Button
                variant="hollow"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/library')}
                aria-label="Go to Library"
              >
                Go to Library
              </Button>
            </div>
          ) : filteredRecordings.length === 0 ? (
            /* Empty filter state - recordings exist but none match filters */
            <div className="flex flex-col items-center justify-center py-16">
              <RiSearchLine className="h-12 w-12 text-muted-foreground/20 mb-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No matching recordings</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                No recordings match your current search or filters. Try adjusting your criteria.
              </p>
              <Button
                variant="hollow"
                size="sm"
                className="mt-4"
                onClick={clearFilters}
                aria-label="Clear filters"
              >
                Clear Filters
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

      {/* Edit Vault Dialog */}
      <EditVaultDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        vault={vault}
        userRole={vault?.user_role || null}
        onDeleteRequest={handleOpenDelete}
      />

      <DeleteVaultDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        vault={vault}
        recordingCount={recordingsLoading ? null : recordings.length}
      />
    </div>
  )
}

export default VaultDetailPane
