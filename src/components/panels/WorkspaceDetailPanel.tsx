/**
 * WorkspaceDetailPanel - Detailed configuration and member management for a workspace
 *
 * Renders in Pane 4 (DetailPaneOutlet). Includes:
 * - Workspace name editing (inline or input)
 * - Is Default toggle
 * - Member list with invitations
 * - Workspace settings (share link TTL, etc)
 *
 * @pattern detail-panel
 * @brand-version v4.2
 */

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  RiSafeLine, 
  RiCloseLine, 
  RiGroupLine, 
  RiSettings3Line,
  RiCheckLine,
  RiPencilLine,
  RiArrowRightSLine 
} from '@remixicon/react'
import { usePanelStore } from '@/stores/panelStore'
import { useWorkspaceDetail, useWorkspaces } from '@/hooks/useWorkspaces'
import { useUpdateWorkspace, useSetDefaultWorkspace } from '@/hooks/useWorkspaceMutations'
import { WorkspaceMemberPanel } from '@/components/panels/WorkspaceMemberPanel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export interface WorkspaceDetailPanelProps {
  workspaceId: string
}

export function WorkspaceDetailPanel({ workspaceId }: WorkspaceDetailPanelProps) {
  const { closePanel } = usePanelStore()
  const { workspace, isLoading } = useWorkspaceDetail(workspaceId)
  const updateWorkspace = useUpdateWorkspace()
  const setDefaultWorkspace = useSetDefaultWorkspace()
  
  // Track local edits
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  
  const handleEditName = useCallback(() => {
    if (workspace) {
      setEditedName(workspace.name)
      setIsEditingName(true)
    }
  }, [workspace])
  
  const handleSaveName = useCallback(() => {
    if (workspace && editedName.trim() && editedName.trim() !== workspace.name) {
      updateWorkspace.mutate(
        { workspaceId, name: editedName.trim() },
        { onSuccess: () => setIsEditingName(false) }
      )
    } else {
      setIsEditingName(false)
    }
  }, [workspace, editedName, workspaceId, updateWorkspace])
  
  const handleToggleDefault = useCallback((checked: boolean) => {
    if (checked) {
      setDefaultWorkspace.mutate({ workspaceId })
    }
  }, [workspaceId, setDefaultWorkspace])

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
        <div className="flex-1 bg-muted animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Workspace not found</p>
        <Button variant="ghost" size="sm" onClick={closePanel} className="mt-4">
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <RiSafeLine className="h-4 w-4 text-vibe-orange flex-shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide truncate">
            Workspace Detail
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={closePanel} aria-label="Close detail panel">
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {/* Main Content Area (Scrollable) */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Workspace Info Card */}
          <div className="bg-card/40 border border-border/40 rounded-2xl p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input 
                      value={editedName} 
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                      className="h-8 text-sm font-bold"
                      autoFocus
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-success-text hover:bg-success-bg"
                      onClick={handleSaveName}
                      disabled={updateWorkspace.isPending}
                    >
                      <RiCheckLine className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-2 cursor-pointer" onClick={handleEditName}>
                    <h4 className="text-base font-bold text-foreground truncate">{workspace.name}</h4>
                    <RiPencilLine className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {workspace.workspace_type} Workspace
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-vibe-orange/10 flex items-center justify-center border border-vibe-orange/20">
                <RiSafeLine className="h-6 w-6 text-vibe-orange" />
              </div>
            </div>

            {/* Set as Default Switch */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="default-workspace" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Default Workspace
                </Label>
                <p className="text-[10px] text-muted-foreground/60 leading-tight pr-4">
                  Open this workspace automatically on login.
                </p>
              </div>
              <Switch 
                id="default-workspace" 
                checked={workspace.is_default || false} 
                onCheckedChange={handleToggleDefault}
                disabled={setDefaultWorkspace.isPending || workspace.is_default}
              />
            </div>
          </div>

          {/* Member Management Section */}
          <section className="space-y-3">
             <div className="flex items-center justify-between">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                 <RiGroupLine className="h-3 w-3" />
                 Memberships
               </h4>
               <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{workspace.member_count}</Badge>
             </div>
             
             {/* Sub-component for members list - we can re-use the WorkspaceMemberPanel UI logic but integrated here */}
             <div className="border border-border/40 rounded-2xl overflow-hidden bg-card/20">
               <WorkspaceMemberPanel workspaceId={workspaceId} workspaceName={workspace.name} />
             </div>
          </section>
          
          {/* Advanced Settings Link (to Settings tab) */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full justify-between h-10 px-4 rounded-xl text-xs font-bold group"
              onClick={() => {
                // Navigate to Settings? Or open Settings panel?
                // For now just keep it as a placeholder for "Workspace Settings"
              }}
            >
              <div className="flex items-center gap-2">
                <RiSettings3Line className="h-4 w-4 text-muted-foreground" />
                Advanced Settings
              </div>
              <RiArrowRightSLine className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export default WorkspaceDetailPanel;
