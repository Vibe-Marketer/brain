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

type WorkspaceForMenu = WorkspaceWithMembership & { member_count?: number }

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
  const { workspaces, isLoading: orgLoading } = useOrganizationContext()
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

  // Icon derives from member_count (1 = lock, >1 = team)
  const getWorkspaceIcon = (workspace: WorkspaceForMenu) => {
    const Icon = (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine
    return <Icon className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {compact ? (
                <button
                  className="h-5 w-5 md:h-6 md:w-6 p-0 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                  title="Add to workspace"
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
            Workspaces
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
              No workspaces available
            </p>
          ) : (
            workspaces.map((workspace) => {
              const isAssigned = assignedWorkspaceIds.has(workspace.id)
              // Default workspace cannot be unassigned (always-stays-checked)
              const isDefault = workspace.is_default === true

              return (
                <button
                  key={workspace.id}
                  onClick={() => toggleWorkspace(workspace.id)}
                  disabled={isMutating || isDefault}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    'hover:bg-muted/50',
                    isAssigned && 'bg-primary/5',
                    (isMutating || isDefault) && 'opacity-60 cursor-not-allowed',
                    !isMutating && !isDefault && 'cursor-pointer'
                  )}
                >
                  {/* Workspace icon (lock if solo, team if multi-member) */}
                  {getWorkspaceIcon(workspace)}

                  {/* Workspace name */}
                  <span className="flex-1 text-left truncate font-inter text-sm">
                    {workspace.name}
                  </span>

                  {/* Default workspace lock indicator */}
                  {isDefault && isAssigned && (
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
