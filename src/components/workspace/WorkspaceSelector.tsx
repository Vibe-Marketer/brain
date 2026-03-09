/**
 * WorkspaceSelector - Dropdown for choosing which workspace to import recordings into
 *
 * Shows user's workspaces grouped by organization, with personal workspace first.
 * Remembers default workspace per integration via useUserPreferences.
 *
 * @pattern workspace-selector
 * @brand-version v4.2
 */

import * as React from 'react'
import { useEffect, useMemo } from 'react'
import { RiSafeLine, RiLockLine, RiTeamLine, RiYoutubeLine } from '@remixicon/react'
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

type IntegrationKey = 'youtube' | 'zoom' | 'fathom'

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
 * Get icon for workspace type
 */
function WorkspaceIcon({ workspace }: { workspace: WorkspaceWithMembership }) {
  if (workspace.workspace_type === 'personal') {
    return <RiLockLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  }
  if (workspace.workspace_type === 'youtube') {
    return <RiYoutubeLine className="h-4 w-4 text-red-500 flex-shrink-0" />
  }
  return <RiTeamLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
}

export function WorkspaceSelector({
  integration,
  onWorkspaceChange,
  value,
  label = 'Import to workspace',
  className,
  disabled = false,
}: WorkspaceSelectorProps) {
  const { workspaces, personalWorkspace, isLoading } = useOrganizationContext()
  const { getDefaultWorkspace, setDefaultWorkspace } = useUserPreferences()

  // Filter workspaces by type when integration is 'youtube'
  const filteredWorkspaces = useMemo(() => {
    if (integration === 'youtube') {
      return workspaces.filter((workspace) => workspace.workspace_type === 'youtube')
    }
    return workspaces
  }, [workspaces, integration])

  // Auto-select default workspace on mount
  useEffect(() => {
    if (!value && filteredWorkspaces.length > 0) {
      const savedDefault = getDefaultWorkspace(integration)
      const savedExists = savedDefault && filteredWorkspaces.some((workspace) => workspace.id === savedDefault)

      if (savedExists && savedDefault) {
        onWorkspaceChange(savedDefault)
      } else if (integration !== 'youtube' && personalWorkspace) {
        onWorkspaceChange(personalWorkspace.id)
      } else {
        onWorkspaceChange(filteredWorkspaces[0].id)
      }
    }
  }, [filteredWorkspaces, personalWorkspace, value, integration, getDefaultWorkspace, onWorkspaceChange])

  // Handle selection change
  const handleChange = (workspaceId: string) => {
    onWorkspaceChange(workspaceId)
    setDefaultWorkspace(integration, workspaceId)
  }

  // Sort workspaces: personal first, then team workspaces alphabetically
  const sortedWorkspaces = useMemo(() => {
    const personal = filteredWorkspaces.filter((workspace) => workspace.workspace_type === 'personal')
    const team = filteredWorkspaces
      .filter((workspace) => workspace.workspace_type !== 'personal')
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...personal, ...team]
  }, [filteredWorkspaces])

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

  if (filteredWorkspaces.length === 0) {
    if (integration === 'youtube') {
      return (
        <div className={cn('space-y-2', className)}>
          {label && (
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <RiSafeLine className="w-4 h-4 text-muted-foreground" />
              {label}
            </label>
          )}
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
            <RiYoutubeLine className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span>A YouTube Workspace will be created automatically</span>
          </div>
        </div>
      )
    }
    return null
  }

  if (filteredWorkspaces.length === 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <RiSafeLine className="w-4 h-4 text-muted-foreground" />
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm">
          <WorkspaceIcon workspace={filteredWorkspaces[0]} />
          <span className="truncate">{filteredWorkspaces[0].name}</span>
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
                  {workspace.workspace_type === 'personal' && (
                    <span className="text-2xs text-muted-foreground ml-1">
                      (personal)
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
