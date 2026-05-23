/**
 * WorkspaceSelector - Dropdown for choosing which workspace to import recordings into
 *
 * Shows user's workspaces in their per-user sort_order (from useWorkspaces).
 * Auto-selects the org's default workspace (is_default=TRUE) on mount.
 * Remembers per-integration default via useUserPreferences.
 *
 * @pattern workspace-selector
 * @brand-version v4.2
 */

import * as React from 'react'
import { useEffect } from 'react'
import { RiSafeLine, RiLockLine, RiTeamLine } from '@remixicon/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { cn } from '@/lib/utils'
import type { WorkspaceWithMembership } from '@/types/workspace'

type WorkspaceForSelector = WorkspaceWithMembership & { member_count?: number }

type IntegrationKey = 'zoom' | 'fathom' | 'fireflies' | 'youtube' | 'file-upload'

export interface WorkspaceSelectorProps {
  /** Which integration this selector is for (used to remember default) */
  integration: IntegrationKey
  /** Called when user selects a workspace */
  onWorkspaceChange: (workspaceId: string) => void
  /** Currently selected workspace ID (controlled) */
  value?: string
  /** Label text above the selector */
  label?: string
  /** Additional CSS classes */
  className?: string
  /** Disable the selector */
  disabled?: boolean
}

/**
 * Workspace icon — lock for solo workspaces, team for multi-member.
 * Derived from member_count (1 = lock, >1 = team).
 */
function WorkspaceIcon({ workspace }: { workspace: WorkspaceForSelector }) {
  const Icon = (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine
  return <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
}

export function WorkspaceSelector({
  integration,
  onWorkspaceChange,
  value,
  label = 'Import to workspace',
  className,
  disabled = false,
}: WorkspaceSelectorProps) {
  const { workspaces, defaultWorkspace, isLoading } = useOrganizationContext()
  const { getDefaultWorkspace, setDefaultWorkspace } = useUserPreferences()

  // Auto-select on mount: saved per-integration preference > org's default workspace > first
  useEffect(() => {
    if (!value && workspaces.length > 0) {
      const savedDefault = getDefaultWorkspace(integration)
      const savedExists = savedDefault && workspaces.some((workspace) => workspace.id === savedDefault)

      if (savedExists && savedDefault) {
        onWorkspaceChange(savedDefault)
      } else if (defaultWorkspace) {
        onWorkspaceChange(defaultWorkspace.id)
      } else {
        onWorkspaceChange(workspaces[0].id)
      }
    }
  }, [workspaces, defaultWorkspace, value, integration, getDefaultWorkspace, onWorkspaceChange])

  // Handle selection change
  const handleChange = (workspaceId: string) => {
    onWorkspaceChange(workspaceId)
    setDefaultWorkspace(integration, workspaceId)
  }

  // Workspaces arrive pre-sorted by per-user sort_order from useWorkspaces.
  // Use as-is so the dropdown matches the sidebar order.
  const sortedWorkspaces = workspaces

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

  if (sortedWorkspaces.length === 0) {
    return null
  }

  if (sortedWorkspaces.length === 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <RiSafeLine className="w-4 h-4 text-muted-foreground" />
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm">
          <WorkspaceIcon workspace={sortedWorkspaces[0]} />
          <span className="truncate">{sortedWorkspaces[0].name}</span>
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
          <SelectValue placeholder="Select a workspace..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wide">
              Workspaces
            </SelectLabel>
            {sortedWorkspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                <div className="flex items-center gap-2">
                  <WorkspaceIcon workspace={workspace} />
                  <span className="truncate">{workspace.name}</span>
                  {workspace.is_default && (
                    <span className="text-2xs text-muted-foreground ml-1">
                      (default)
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
