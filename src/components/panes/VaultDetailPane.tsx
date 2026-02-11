/**
 * VaultDetailPane - Main content area showing vault recordings (always visible)
 *
 * Renders recordings via TranscriptTable (default) or YouTubeVideoList
 * when vault_type is 'youtube'. NO tabs — recordings always visible.
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
import { YouTubeVideoList } from '@/components/youtube/YouTubeVideoList'
import { YouTubeVideoDetailModal } from '@/components/youtube/YouTubeVideoDetailModal'
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
  RiYoutubeLine,
  RiRecordCircleLine,
  RiSearchLine,
  RiSettings3Line,
  RiArrowDownSLine,
  RiErrorWarningLine,
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useVaultDetail, useVaultRecordings, mapRecordingToMeeting } from '@/hooks/useVaults'
import { useRecordingSearch } from '@/hooks/useRecordingSearch'
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch'
import { queryKeys } from '@/lib/query-config'
import type { VaultType, VaultRole } from '@/types/bank'
import type { VaultRecording } from '@/hooks/useVaults'
import type { Meeting } from '@/types'

/** Vault type badge colors */
const VAULT_TYPE_STYLES: Record<VaultType, { bg: string; text: string }> = {
  personal: { bg: 'bg-info-bg', text: 'text-info-text' },
  team: { bg: 'bg-success-bg', text: 'text-success-text' },
  coach: { bg: 'bg-warning-bg', text: 'text-warning-text' },
  community: { bg: 'bg-warning-bg', text: 'text-warning-text' },
  client: { bg: 'bg-info-bg', text: 'text-info-text' },
  youtube: { bg: 'bg-red-500/10', text: 'text-red-600' },
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
    <div className="p-6 space-y-6" aria-label="Loading hub detail">
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

  // Determine vault type for conditional rendering
  const isYouTubeVault = vault?.vault_type === 'youtube'

  // Standard search/filter/sort recordings (used for non-YouTube vaults)
  const standardSearch = useRecordingSearch({ recordings })

  // YouTube-specific search/sort (used for YouTube vaults)
  const youtubeSearch = useYouTubeSearch({ recordings })

  // Select the active hook's data based on vault type
  const searchQuery = isYouTubeVault ? youtubeSearch.searchQuery : standardSearch.searchQuery
  const setSearchQuery = isYouTubeVault ? youtubeSearch.setSearchQuery : standardSearch.setSearchQuery
  const clearFilters = isYouTubeVault ? youtubeSearch.clearFilters : standardSearch.clearFilters
  const hasActiveFilters = isYouTubeVault ? youtubeSearch.hasActiveFilters : standardSearch.hasActiveFilters
  const filteredRecordings = isYouTubeVault ? youtubeSearch.filteredRecordings : standardSearch.filteredRecordings
  const totalCount = isYouTubeVault ? youtubeSearch.totalCount : standardSearch.totalCount
  const filteredCount = isYouTubeVault ? youtubeSearch.filteredCount : standardSearch.filteredCount

  // Transform filtered vault recordings to Meeting[] for TranscriptTable (non-YouTube only)
  const meetings = useMemo(() => {
    if (isYouTubeVault) return []
    return filteredRecordings.map(mapRecordingToMeeting)
  }, [filteredRecordings, isYouTubeVault])

  // Handle recording click - navigate to call detail page
  const handleCallClick = useCallback(
    (call: Meeting) => {
      navigate(`/call/${call.recording_id}`)
    },
    [navigate]
  )

  // YouTube video detail modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VaultRecording | null>(null)

  // Handle YouTube video click - open detail modal
  const handleVideoClick = useCallback(
    (recording: VaultRecording) => {
      setSelectedVideo(recording)
      setVideoModalOpen(true)
    },
    []
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
            <p className="text-sm font-semibold text-foreground mb-1">Select a hub</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Choose a hub from the list to view recordings and members
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
          <p className="text-sm font-semibold text-foreground mb-1">Unable to load this hub</p>
          <p className="text-xs text-muted-foreground mb-4">
            Please try again in a moment.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) })}
            aria-label="Retry loading hub"
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
          <p className="text-sm text-muted-foreground">Hub not found</p>
        </div>
      </div>
    )
  }

  const typeStyle = VAULT_TYPE_STYLES[vault.vault_type as VaultType] || VAULT_TYPE_STYLES.personal

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-1 -ml-1"
              aria-label="Go back to hub list"
            >
              <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          <RiSafeLine className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />

          {/* Vault name */}
          {canEditSettings ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-1 min-w-0 focus:outline-none"
                  aria-label="Hub actions"
                >
                  <span className="font-display font-extrabold text-sm uppercase tracking-wide truncate">
                    {vault.name}
                  </span>
                  <RiArrowDownSLine className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={handleOpenSettings}>
                  Edit Hub
                </DropdownMenuItem>
                {canDeleteVault && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenDelete}>
                      Delete Hub
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <h2 className="font-display font-extrabold text-sm uppercase tracking-wide truncate">
              {vault.name}
            </h2>
          )}

          {/* Vault type badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-2xs px-1.5 py-0 h-5 uppercase tracking-wider font-medium border-0',
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
              aria-label="Hub settings"
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
            aria-label={`View ${vault.member_count} hub members`}
          >
            <RiGroupLine className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{vault.member_count}</span>
          </Button>
        </div>
      </header>

      {/* Search/filter toolbar - only show when vault has recordings */}
      {/* Non-YouTube vaults: full search + sort toolbar */}
      {!recordingsLoading && recordings.length > 0 && !isYouTubeVault && (
        <VaultSearchFilter
          searchQuery={standardSearch.searchQuery}
          onSearchChange={standardSearch.setSearchQuery}
          sortBy={standardSearch.sortBy}
          onSortByChange={standardSearch.setSortBy}
          sortOrder={standardSearch.sortOrder}
          onSortOrderChange={standardSearch.setSortOrder}
          hasActiveFilters={standardSearch.hasActiveFilters}
          onClearFilters={standardSearch.clearFilters}
          totalCount={standardSearch.totalCount}
          filteredCount={standardSearch.filteredCount}
        />
      )}
      {/* YouTube vaults: search-only bar (sort controlled by column headers) */}
      {!recordingsLoading && recordings.length > 0 && isYouTubeVault && (
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <RiSearchLine
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search videos..."
                value={youtubeSearch.searchQuery}
                onChange={(e) => youtubeSearch.setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background/50 pl-8 pr-8 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Search videos by title"
              />
              {youtubeSearch.searchQuery && (
                <button
                  onClick={() => youtubeSearch.setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <RiSearchLine className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {youtubeSearch.hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={youtubeSearch.clearFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Clear all filters"
              >
                Clear
              </Button>
            )}
          </div>
          {youtubeSearch.filteredCount !== youtubeSearch.totalCount && (
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              Showing <span className="font-medium tabular-nums">{youtubeSearch.filteredCount}</span> of{' '}
              <span className="tabular-nums">{youtubeSearch.totalCount}</span> videos
            </div>
          )}
        </div>
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
              {isYouTubeVault ? (
                <RiYoutubeLine className="h-16 w-16 text-muted-foreground/20 mb-4" aria-hidden="true" />
              ) : (
                <RiMicLine className="h-16 w-16 text-muted-foreground/20 mb-4" aria-hidden="true" />
              )}
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {isYouTubeVault ? 'No videos in this hub' : 'No recordings in this hub'}
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                {isYouTubeVault
                  ? 'Import YouTube videos to start building your video library.'
                  : 'Recordings you add to this hub will appear here.'}
              </p>
              <Button
                variant="hollow"
                size="sm"
                className="mt-4"
                onClick={() => navigate(isYouTubeVault ? '/import' : '/library')}
                aria-label={isYouTubeVault ? 'Import Videos' : 'Go to Library'}
              >
                {isYouTubeVault ? 'Import Videos' : 'Go to Library'}
              </Button>
            </div>
          ) : filteredRecordings.length === 0 ? (
            /* Empty filter state - recordings exist but none match filters */
            <div className="flex flex-col items-center justify-center py-16">
              <RiSearchLine className="h-12 w-12 text-muted-foreground/20 mb-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {isYouTubeVault ? 'No matching videos' : 'No matching recordings'}
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                {isYouTubeVault
                  ? 'No videos match your current search. Try adjusting your criteria.'
                  : 'No recordings match your current search or filters. Try adjusting your criteria.'}
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
          ) : isYouTubeVault ? (
            <YouTubeVideoList
              recordings={youtubeSearch.filteredRecordings}
              onVideoClick={handleVideoClick}
              sortBy={youtubeSearch.sortBy}
              sortOrder={youtubeSearch.sortOrder}
              onSortChange={youtubeSearch.handleSortChange}
            />
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

      {/* YouTube Video Detail Modal */}
      {isYouTubeVault && (
        <YouTubeVideoDetailModal
          open={videoModalOpen}
          onOpenChange={setVideoModalOpen}
          recording={selectedVideo}
          vaultId={vaultId!}
        />
      )}
    </div>
  )
}

export default VaultDetailPane
