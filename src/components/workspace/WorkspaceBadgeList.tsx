/**
 * WorkspaceBadgeList - List of workspace badges with overflow handling
 *
 * Fetches workspace entries for a recording and displays badges for each workspace.
 * Shows up to maxVisible badges, then a "+N" overflow badge with popover.
 * Personal workspace always first with subtle styling.
 *
 * @brand-version v4.2
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiSafeLine } from '@remixicon/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkspaceBadge } from '@/components/workspace/WorkspaceBadge'
import { useWorkspaceAssignment } from '@/hooks/useWorkspaceAssignment'
import { useWorkspaceEntriesBatch } from '@/hooks/useWorkspaceEntriesBatch'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { cn } from '@/lib/utils'
import type { WorkspaceType } from '@/types/workspace'

export interface WorkspaceBadgeListProps {
  /** UUID recording ID (preferred) */
  recordingId?: string | null
  /** Numeric legacy recording ID (from fathom_calls) */
  legacyRecordingId?: number | null
  /** Maximum badges to show before overflow */
  maxVisible?: number
  /** Size of the badges */
  size?: 'sm' | 'md'
  /** Whether to hide personal workspace badges (for table rows) */
  hidePersonal?: boolean
  /** Additional CSS classes */
  className?: string
}

interface WorkspaceInfo {
  id: string
  name: string
  workspaceType: WorkspaceType
}

/**
 * WorkspaceBadgeList - Shows which workspaces a recording belongs to
 */
export function WorkspaceBadgeList({
  recordingId,
  legacyRecordingId,
  maxVisible = 3,
  size = 'md',
  hidePersonal = false,
  className,
}: WorkspaceBadgeListProps) {
  const navigate = useNavigate()
  const [overflowOpen, setOverflowOpen] = useState(false)
  const { workspaces, isLoading: orgLoading } = useOrganizationContext()

  // Use batch context if available (list views), otherwise fall back to individual query
  const batchContext = useWorkspaceEntriesBatch()
  const hasBatchData = batchContext !== null && typeof recordingId === 'string'

  const {
    assignedWorkspaceIds: individualAssignedIds,
    isLoading: individualLoading,
  } = useWorkspaceAssignment(
    hasBatchData ? null : (recordingId || null),
    hasBatchData ? null : legacyRecordingId,
  )

  // Derive assigned workspace IDs from batch context when available
  const batchAssignedIds = useMemo(() => {
    if (!hasBatchData || !recordingId) return new Set<string>()
    const entries = batchContext.entriesByRecording.get(recordingId) || []
    return new Set(entries.map((e) => e.workspace_id))
  }, [hasBatchData, batchContext, recordingId])

  const assignedWorkspaceIds = hasBatchData ? batchAssignedIds : individualAssignedIds
  const entriesLoading = hasBatchData ? batchContext.isLoading : individualLoading
  const isLoading = orgLoading || entriesLoading

  // Build list of workspaces this recording is in, with info
  const assignedWorkspaces: WorkspaceInfo[] = workspaces
    .filter((v) => assignedWorkspaceIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.name,
      workspaceType: v.workspace_type as WorkspaceType,
    }))
    // Sort: personal first, then alphabetical
    .sort((a, b) => {
      if (a.workspaceType === 'personal' && b.workspaceType !== 'personal') return -1
      if (a.workspaceType !== 'personal' && b.workspaceType === 'personal') return 1
      return a.name.localeCompare(b.name)
    })

  // Filter out personal if requested
  const displayWorkspaces = hidePersonal
    ? assignedWorkspaces.filter((v) => v.workspaceType !== 'personal')
    : assignedWorkspaces

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
  if (displayWorkspaces.length === 0) {
    return null
  }

  const visible = displayWorkspaces.slice(0, maxVisible)
  const overflow = displayWorkspaces.slice(maxVisible)

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {visible.map((workspace) => (
        <WorkspaceBadge
          key={workspace.id}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          workspaceType={workspace.workspaceType}
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
              More Hubs
            </p>
            <div className="space-y-1 mt-1">
              {overflow.map((workspace) => (
                <button
                   key={workspace.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/workspaces/${workspace.id}`)
                    setOverflowOpen(false)
                  }}
                   className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <RiSafeLine className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
