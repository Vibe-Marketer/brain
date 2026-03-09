/**
 * WorkspaceDetailPane - Main content area showing workspace recordings (always visible)
 *
 * Renders recordings via TranscriptTable (default) or YouTubeVideoList
 * when workspace_type is 'youtube'. NO tabs — recordings always visible.
 * "Members" button opens WorkspaceMemberPanel as slide-in 4th pane.
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
import { WorkspaceSearchFilter } from '@/components/workspace/WorkspaceSearchFilter'
import { PageHeader } from '@/components/ui/page-header'
import { EditWorkspaceDialog } from '@/components/dialogs/EditWorkspaceDialog'
import { DeleteWorkspaceDialog } from '@/components/dialogs/DeleteWorkspaceDialog'
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
import { useOrgContext } from '@/hooks/useOrgContext'
import { useWorkspaceDetail, useWorkspaceRecordings, mapRecordingToMeeting } from '@/hooks/useWorkspaces'
import { useRecordingSearch } from '@/hooks/useRecordingSearch'
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch'
import { queryKeys } from '@/lib/query-config'
import type { WorkspaceType, WorkspaceRole } from '@/types/workspace'
import type { WorkspaceRecording } from '@/hooks/useWorkspaces'
import type { Meeting } from '@/types'

/** Workspace type badge colors */
const WORKSPACE_TYPE_STYLES: Record<WorkspaceType, { bg: string; text: string }> = {
  personal: { bg: 'bg-info-bg', text: 'text-info-text' },
  team: { bg: 'bg-success-bg', text: 'text-success-text' },
  coach: { bg: 'bg-warning-bg', text: 'text-warning-text' },
  community: { bg: 'bg-warning-bg', text: 'text-warning-text' },
  client: { bg: 'bg-info-bg', text: 'text-info-text' },
  youtube: { bg: 'bg-red-500/10', text: 'text-red-600' },
}

export interface WorkspaceDetailPaneProps {
  workspaceId: string | null
  onClose?: () => void
  onBack?: () => void
  showBackButton?: boolean
  className?: string
}

/** Loading skeleton for workspace detail */
function WorkspaceDetailSkeleton() {
  return (
    <div className="p-6 space-y-6" aria-label="Loading workspace detail">
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

export function WorkspaceDetailPane({
  workspaceId,
  onClose,
  onBack,
  showBackButton = false,
  className,
}: WorkspaceDetailPaneProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { openPanel } = usePanelStore()
  const { activeFolderId } = useOrgContext()
  const { workspace, isLoading: workspaceLoading, error: workspaceError } = useWorkspaceDetail(workspaceId)
  const { recordings, isLoading: recordingsLoading, error: recordingsError } = useWorkspaceRecordings(workspaceId, { folderId: activeFolderId })

  // Determine workspace type for conditional rendering
  const isYouTubeWorkspace = workspace?.workspace_type === 'youtube'

  // Standard search/filter/sort recordings (used for non-YouTube workspaces)
  const standardSearch = useRecordingSearch({ recordings })

  // YouTube-specific search/sort (used for YouTube workspaces)
  const youtubeSearch = useYouTubeSearch({ recordings })

  // Select the active hook's data based on workspace type
  const searchQuery = isYouTubeWorkspace ? youtubeSearch.searchQuery : standardSearch.searchQuery
  const setSearchQuery = isYouTubeWorkspace ? youtubeSearch.setSearchQuery : standardSearch.setSearchQuery
  const clearFilters = isYouTubeWorkspace ? youtubeSearch.clearFilters : standardSearch.clearFilters
  const hasActiveFilters = isYouTubeWorkspace ? youtubeSearch.hasActiveFilters : standardSearch.hasActiveFilters
  const filteredRecordings = isYouTubeWorkspace ? youtubeSearch.filteredRecordings : standardSearch.filteredRecordings
  const totalCount = isYouTubeWorkspace ? youtubeSearch.totalCount : standardSearch.totalCount
  const filteredCount = isYouTubeWorkspace ? youtubeSearch.filteredCount : standardSearch.filteredCount

  // Transform filtered workspace recordings to Meeting[] for TranscriptTable (non-YouTube only)
  const meetings = useMemo(() => {
    if (isYouTubeWorkspace) return []
    return filteredRecordings.map(mapRecordingToMeeting)
  }, [filteredRecordings, isYouTubeWorkspace])

  // Handle recording click - navigate to call detail page
  const handleCallClick = useCallback(
    (call: Meeting) => {
      navigate(`/call/${call.recording_id}`)
    },
    [navigate]
  )

  // YouTube video detail modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<WorkspaceRecording | null>(null)

  // Handle YouTube video click - open detail modal
  const handleVideoClick = useCallback(
    (recording: WorkspaceRecording) => {
      setSelectedVideo(recording)
      setVideoModalOpen(true)
    },
    []
  )

  // Open members panel (4th pane)
  const handleOpenMembers = useCallback(() => {
    openPanel('workspace-member', { type: 'workspace-member' as const, workspaceId: workspaceId || '' })
  }, [openPanel, workspaceId])

  // Edit workspace dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Permission check: can user edit workspace settings?
  const canEditSettings = workspace?.user_role
    ? (['workspace_owner', 'workspace_admin'] as WorkspaceRole[]).includes(workspace.user_role)
    : false
  const canDeleteWorkspace = workspace?.user_role === 'workspace_owner'

  const handleOpenSettings = useCallback(() => {
    setEditDialogOpen(true)
  }, [])

  const handleOpenDelete = useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  // No-op handlers for TranscriptTable required props
  const handleSelectCall = useCallback(() => {}, [])
  const handleSelectAll = useCallback(() => {}, [])

  if (!workspaceId) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <PageHeader 
          title="Workspaces"
          icon={RiSafeLine}
          showBackButton={showBackButton}
          onBack={onBack}
        />
        <div className="flex-1 flex items-center justify-center p-6 text-ink">
          <div className="text-center">
            <RiArrowLeftLine className="h-12 w-12 text-ink-muted/30 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-bold uppercase tracking-wide mb-1">Select a workspace</p>
            <p className="text-xs text-ink-muted max-w-xs">
              Choose a workspace from the list to view recordings and members
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (workspaceLoading) {
    return <WorkspaceDetailSkeleton />
  }

  if (workspaceError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <RiErrorWarningLine className="h-12 w-12 text-destructive/60 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground mb-1">Unable to load this workspace</p>
          <p className="text-xs text-muted-foreground mb-4">
            Please try again in a moment.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })}
            aria-label="Retry loading workspace"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <RiSafeLine className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Workspace not found</p>
        </div>
      </div>
    )
  }

  const typeStyle = WORKSPACE_TYPE_STYLES[workspace.workspace_type as WorkspaceType] || WORKSPACE_TYPE_STYLES.personal

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <PageHeader
        title={workspace.name}
        icon={RiSafeLine}
        showBackButton={showBackButton}
        onBack={onBack}
        children={
          <Badge
            variant="outline"
            className={cn(
              'text-2xs px-1.5 py-0 h-5 uppercase tracking-wider font-medium border-0',
              typeStyle.bg,
              typeStyle.text
            )}
          >
            {workspace.workspace_type}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <RiRecordCircleLine className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">{recordings.length}</span>
            </div>

            {canEditSettings && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenSettings}
                className="h-8 w-8"
                aria-label="Workspace settings"
              >
                <RiSettings3Line className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenMembers}
              className="flex items-center gap-1.5 text-xs"
              aria-label={`View ${workspace.member_count} workspace members`}
            >
              <RiGroupLine className="h-4 w-4" aria-hidden="true" />
              <span className="tabular-nums">{workspace.member_count}</span>
            </Button>
          </div>
        }
      />

      {/* Search/filter toolbar - only show when workspace has recordings */}
      {/* Non-YouTube workspaces: full search + sort toolbar */}
      {!recordingsLoading && recordings.length > 0 && !isYouTubeWorkspace && (
        <WorkspaceSearchFilter
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
      {/* YouTube workspaces: search-only bar (sort controlled by column headers) */}
      {!recordingsLoading && recordings.length > 0 && isYouTubeWorkspace && (
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
                onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.recordings(workspaceId) })}
                aria-label="Retry loading recordings"
              >
                Try Again
              </Button>
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              {isYouTubeWorkspace ? (
                <RiYoutubeLine className="h-16 w-16 text-muted-foreground/20 mb-4" aria-hidden="true" />
              ) : (
                <RiMicLine className="h-16 w-16 text-muted-foreground/20 mb-4" aria-hidden="true" />
              )}
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {isYouTubeWorkspace ? 'No videos in this workspace' : 'No recordings in this workspace'}
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                {isYouTubeWorkspace
                  ? 'Import YouTube videos to start building your video library.'
                  : 'Recordings you add to this workspace will appear here.'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => navigate(isYouTubeWorkspace ? '/import' : '/library')}
                aria-label={isYouTubeWorkspace ? 'Import Videos' : 'Go to Library'}
              >
                {isYouTubeWorkspace ? 'Import Videos' : 'Go to Library'}
              </Button>
            </div>
          ) : filteredRecordings.length === 0 ? (
            /* Empty filter state - recordings exist but none match filters */
            <div className="flex flex-col items-center justify-center py-16">
              <RiSearchLine className="h-12 w-12 text-muted-foreground/20 mb-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {isYouTubeWorkspace ? 'No matching videos' : 'No matching recordings'}
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                {isYouTubeWorkspace
                  ? 'No videos match your current search. Try adjusting your criteria.'
                  : 'No recordings match your current search or filters. Try adjusting your criteria.'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={clearFilters}
                aria-label="Clear filters"
              >
                Clear Filters
              </Button>
            </div>
          ) : isYouTubeWorkspace ? (
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

      {/* Edit workspace dialog */}
      <EditWorkspaceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        workspace={workspace}
        userRole={workspace?.user_role || null}
        onDeleteRequest={handleOpenDelete}
      />

      {/* Delete workspace dialog */}
      <DeleteWorkspaceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        workspace={workspace}
        recordingCount={recordingsLoading ? null : recordings.length}
      />

      {/* YouTube Video Detail Modal */}
      {isYouTubeWorkspace && (
        <YouTubeVideoDetailModal
          open={videoModalOpen}
          onOpenChange={setVideoModalOpen}
          recording={selectedVideo}
          workspaceId={workspaceId!}
        />
      )}
    </div>
  )
}

export default WorkspaceDetailPane
