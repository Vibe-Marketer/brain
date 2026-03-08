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
import { useWorkspaceAssignment } from '@/hooks/useWorkspaceAssignment'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import type { WorkspaceWithMembership } from '@/types/workspace'

export interface AddToWorkspaceMenuProps {
  /** UUID recording ID (from recordings table) - preferred */
  recordingId?: string | null
  /** Numeric legacy recording ID (from fathom_calls) - used for lookup if recordingId not available */
  legacyRecordingId?: number | null
  /** Compact icon-only trigger for table rows */
  compact?: boolean
}

/**
 * AddToWorkspaceMenu - Popover menu to assign/remove recordings from workspaces
 *
 * Shows a checklist of all workspaces in the current organization.
 * Checkmarks indicate which workspaces the recording is already in.
 * Personal workspace cannot be removed (always stays checked).
 *
 * Supports both UUID recording IDs and legacy numeric IDs from fathom_calls.
 *
 * @brand-version v4.2
 */
export function AddToWorkspaceMenu({
  recordingId,
  legacyRecordingId,
  compact = true,
}: AddToWorkspaceMenuProps) {
  const [open, setOpen] = useState(false)
  const { workspaces, personalWorkspace, isLoading: orgLoading } = useOrganizationContext()
  const {
    assignedWorkspaceIds,
    effectiveRecordingId,
    isLoading: entriesLoading,
    toggleWorkspace,
    isAdding,
    isRemoving,
  } = useWorkspaceAssignment(
    open ? (recordingId || null) : null,
    open ? legacyRecordingId : null,
  )

  const isLoading = orgLoading || entriesLoading
  const isMutating = isAdding || isRemoving
  // If recording hasn't been migrated yet, we can't assign to workspaces
  const notMigrated = open && !effectiveRecordingId && !isLoading

  // Get icon for workspace type
  const getWorkspaceIcon = (workspace: WorkspaceWithMembership) => {
    if (workspace.workspace_type === 'personal') {
      return <RiLockLine className="h-4 w-4 text-cb-ink-muted" />
    }
    return <RiTeamLine className="h-4 w-4 text-cb-ink-muted" />
  }

  // Check if this is the personal workspace (cannot be removed)
  const isPersonalWorkspace = (workspaceId: string) =>
    personalWorkspace?.id === workspaceId

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {compact ? (
                <button
                  className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-hover dark:hover:bg-cb-panel-dark transition-colors"
                  title="Add to hub"
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
            <p>Add to workspace</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-56 p-2">
        <div className="space-y-1">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Hubs
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RiLoader4Line className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notMigrated ? (
            <p className="px-2 py-3 text-sm text-muted-foreground text-center">
              Recording not yet migrated
            </p>
          ) : workspaces.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground text-center">
              No hubs available
            </p>
          ) : (
            workspaces.map((workspace) => {
              const isAssigned = assignedWorkspaceIds.has(workspace.id)
              const isPersonal = isPersonalWorkspace(workspace.id)

              return (
                <button
                  key={workspace.id}
                  onClick={() => toggleWorkspace(workspace.id)}
                  disabled={isMutating || isPersonal}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    'hover:bg-muted/50',
                    isAssigned && 'bg-primary/5',
                    (isMutating || isPersonal) && 'opacity-60 cursor-not-allowed',
                    !isMutating && !isPersonal && 'cursor-pointer'
                  )}
                >
                  {/* Workspace type icon */}
                  {getWorkspaceIcon(workspace)}

                  {/* Workspace name */}
                  <span className="flex-1 text-left truncate font-inter text-sm">
                    {workspace.name}
                  </span>

                  {/* Personal lock indicator */}
                  {isPersonal && isAssigned && (
                    <span className="text-2xs text-muted-foreground">always</span>
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
