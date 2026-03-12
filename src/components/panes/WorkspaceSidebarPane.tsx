/**
 * WorkspaceSidebarPane - Unified Navigation Tree (Pane 2)
 *
 * This is the primary navigation tree for the application.
 * Shows:
 * 1. Home (Home) item
 * 2. Organization/Workspace Switcher
 * 3. Workspaces Tree (Workspaces -> Folders)
 * 4. Context menus for all items
 *
 * @pattern sidebar-pane
 * @brand-version v4.2
 */

import * as React from 'react';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFolders, useFolderAssignments, useDeleteFolder, useArchiveFolder } from '@/hooks/useFolders';
import { useSetDefaultWorkspace } from '@/hooks/useWorkspaceMutations';
import { usePanelStore } from '@/stores/panelStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useOrgContext } from '@/hooks/useOrgContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { usePersonalFolders, usePersonalFolderAssignments } from '@/hooks/usePersonalFolders';
import { usePersonalTags } from '@/hooks/usePersonalTags';
import { OrganizationSwitcher } from '@/components/header/OrganizationSwitcher';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';
import { CreateOrganizationDialog } from '@/components/dialogs/CreateOrganizationDialog';
import QuickCreateFolderDialog from '@/components/QuickCreateFolderDialog';
import EditFolderDialog from '@/components/EditFolderDialog';
import { EditWorkspaceDialog } from '@/components/dialogs/EditWorkspaceDialog';
import { DeleteWorkspaceDialog } from '@/components/dialogs/DeleteWorkspaceDialog';
import { WorkspaceMemberPanel } from '@/components/panels/WorkspaceMemberPanel';
import { OrganizationMemberPanel } from '@/components/panels/OrganizationMemberPanel';
import { queryKeys } from '@/lib/query-config';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  RiHome4Line, 
  RiSafeLine, 
  RiAddLine, 
  RiGroupLine, 
  RiSettings3Line, 
  RiArrowRightSLine, 
  RiFolder3Line, 
  RiFolderOpenLine, 
  RiBuildingLine, 
  RiMoreLine, 
  RiPencilLine, 
  RiDeleteBinLine, 
  RiShieldUserLine, 
  RiCheckLine, 
  RiFolderAddLine,
  RiShareForwardLine,
  RiArchiveLine,
  RiPriceTag3Line,
} from '@remixicon/react';
import type { WorkspaceWithMeta, WorkspaceRole } from '@/types/workspace';
import type { Folder } from '@/types/workspace';
import { getIconComponent } from '@/lib/folder-icons';

export interface WorkspaceSidebarPaneProps {
  className?: string;
}

/** Row component for a single folder */
function FolderListItem({
  folder,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  count = 0,
  depth = 0,
  onArchive,
}: {
  folder: Folder;
  isActive: boolean;
  onSelect: (folderId: string) => void;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onArchive?: (folder: Folder) => void;
  count?: number;
  depth?: number;
}) {
  const FolderIcon = getIconComponent(folder.icon);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={cn(
            'relative w-full flex items-center gap-2 rounded-md pr-2 py-1.5',
            'text-xs transition-all duration-200 text-left group',
            'hover:bg-hover/50',
            isActive
              ? 'bg-vibe-orange/5 text-vibe-orange font-semibold font-display italic tracking-tight'
              : 'text-muted-foreground hover:text-foreground',
          )}
          style={{ paddingLeft: `${2.25 + depth * 0.75}rem` }}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-r-full bg-vibe-orange" aria-hidden="true" />
          )}
          {isActive ? (
            <RiFolderOpenLine size={14} className="flex-shrink-0 text-vibe-orange" aria-hidden="true" />
          ) : (
            <RiFolder3Line size={14} className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
          )}
          <span className="truncate flex-1">{folder.name}</span>
          {count > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1 tabular-nums bg-muted/40 text-muted-foreground/60">
              {count}
            </Badge>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onEdit(folder)}>
          <RiPencilLine className="h-4 w-4 mr-2" />
          Rename Folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {/* TODO: move folder logic */}}>
          <RiShareForwardLine className="h-4 w-4 mr-2" />
          Move to Workspace
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDelete(folder)}
          className="text-destructive focus:text-destructive"
        >
          <RiDeleteBinLine className="h-4 w-4 mr-2" />
          Delete Folder
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
             if (confirm(`Are you sure you want to archive folder '${folder.name}'?`)) {
               onArchive?.(folder);
             }
          }}
          className="text-muted-foreground"
        >
          <RiArchiveLine className="h-4 w-4 mr-2" />
          Archive Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function WorkspaceListItem({
  workspace,
  isActive,
  onSelect,
  activeFolderId,
  onFolderSelect,
  onManageDetail,
  onCreateFolder,
  onFolderEdit,
  onRenameWorkspace,
  onDeleteWorkspace,
}: {
  workspace: WorkspaceWithMeta;
  isActive: boolean;
  onSelect: (workspaceId: string) => void;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onManageDetail: (workspaceId: string) => void;
  onCreateFolder: (workspaceId: string) => void;
  onFolderEdit: (folder: Folder) => void;
  onRenameWorkspace: (workspace: WorkspaceWithMeta) => void;
  onDeleteWorkspace: (workspace: WorkspaceWithMeta) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(isActive);
  const { data: folders = [] } = useFolders(isOpen ? workspace.id : null);
  const { data: assignments = {} } = useFolderAssignments(isOpen ? workspace.id : null);
  const { mutate: deleteFolder } = useDeleteFolder();
  const { mutate: archiveFolder } = useArchiveFolder();
  
  const canManage = workspace.user_role === 'workspace_owner' || workspace.user_role === 'workspace_admin';

  React.useEffect(() => {
    if (isActive) setIsOpen(true);
  }, [isActive]);

  // Group folders by parent_id
  const foldersByParent = React.useMemo(() => {
    const map: Record<string, Folder[]> = {};
    folders.forEach(f => {
      const parentId = f.parent_id || 'root';
      if (!map[parentId]) map[parentId] = [];
      map[parentId].push(f);
    });
    return map;
  }, [folders]);

  const renderFolderTree = (parentId: string = 'root', depth: number = 0) => {
    const currentFolders = foldersByParent[parentId] || [];
    if (currentFolders.length === 0 && parentId === 'root') return null;

    return currentFolders.sort((a, b) => (a.position || 0) - (b.position || 0)).map(folder => (
      <React.Fragment key={folder.id}>
        <FolderListItem
          folder={folder}
          isActive={activeFolderId === folder.id}
          onSelect={(id) => onFolderSelect(activeFolderId === id ? null : id)}
          onEdit={onFolderEdit}
          onDelete={(f) => {
             if (confirm(`Are you sure you want to delete folder '${f.name}'?`)) {
               deleteFolder(f.id);
             }
          }}
          onArchive={(f) => archiveFolder({ folderId: f.id, workspaceId: workspace.id })}
          count={assignments[folder.id]?.length}
          depth={depth}
        />
        {renderFolderTree(folder.id, depth + 1)}
      </React.Fragment>
    ));
  };

  const { mutate: setDefaultWorkspace } = useSetDefaultWorkspace();

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="mb-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              onSelect(workspace.id);
              if (!isOpen) setIsOpen(true);
            }}
            className={cn(
              'relative w-full flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
              'text-left transition-all duration-300 ease-in-out',
              'hover:bg-hover/70 group',
              isActive && [
                'bg-hover border border-border/60 shadow-sm',
                'border-l-0 pl-4',
                "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[60%] before:rounded-full before:bg-vibe-orange",
              ]
            )}
            aria-current={isActive && !activeFolderId ? 'true' : undefined}
          >
            {/* Workspace icon wrapper */}
            <div
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                'bg-card border border-border shrink-0 transition-all duration-300 shadow-sm',
                isActive && 'border-vibe-orange/20 bg-vibe-orange/10'
              )}
            >
              <RiSafeLine
                className={cn(
                  'h-3.5 w-3.5 transition-colors duration-300',
                  isActive ? 'text-vibe-orange' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('block text-xs font-bold uppercase tracking-tight truncate', isActive ? 'text-foreground font-display italic' : 'text-foreground/80')}>
                  {workspace.name}
                </span>
                <Collapsible.Trigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(!isOpen);
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <RiArrowRightSLine
                      size={14}
                      className={cn(
                        'text-muted-foreground transition-transform duration-300',
                        isOpen && 'rotate-90'
                      )}
                    />
                  </button>
                </Collapsible.Trigger>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => openPanel('workspace_members', { type: 'workspace_members', workspaceId: workspace.id, workspaceName: workspace.name })}>
            <RiGroupLine className="h-4 w-4 mr-2" />
            Manage Members
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateFolder(workspace.id)}>
            <RiFolderAddLine className="h-4 w-4 mr-2" />
            Create Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onRenameWorkspace(workspace)}>
            <RiPencilLine className="h-4 w-4 mr-2" />
            Rename Workspace
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onManageDetail(workspace.id)}>
            <RiSettings3Line className="h-4 w-4 mr-2" />
            Workspace Settings
          </ContextMenuItem>
          {canManage && !workspace.is_default && (
             <ContextMenuItem onClick={() => setDefaultWorkspace({ workspaceId: workspace.id })}>
               <RiCheckLine className="h-4 w-4 mr-2" />
               Set as Default
             </ContextMenuItem>
          )}
          {canManage && workspace.workspace_type !== 'personal' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem 
                onClick={() => onDeleteWorkspace(workspace)}
                className="text-destructive focus:text-destructive"
              >
                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                Delete Workspace
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 mt-1">
        <div className="flex flex-col gap-0.5 ml-1 border-l border-border/40 pb-1">
          {renderFolderTree()}
          {folders.length === 0 && (
            <p className="pl-9 py-1 text-[10px] font-medium text-muted-foreground/30 italic">
              No folders
            </p>
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function WorkspaceSidebarPane({ className }: WorkspaceSidebarPaneProps) {
  const queryClient = useQueryClient();
  const { openPanel } = usePanelStore();
  const { 
    activeOrgId, 
    activeOrg, 
    activeOrgRole, 
    activeWorkspaceId,
    activeFolderId,
    switchWorkspace, 
    switchFolder 
  } = useOrgContext();
  const { workspaces, isLoading, error } = useWorkspaces(activeOrgId);
  const { data: personalFolders = [], isLoading: personalFoldersLoading } = usePersonalFolders(activeOrgId);
  const { data: personalTags = [] } = usePersonalTags(activeOrgId);
  const { data: personalFolderAssignments = {} } = usePersonalFolderAssignments(activeOrgId);
  
  const canCreateWorkspace = 
    activeOrgRole === 'organization_owner' || 
    activeOrgRole === 'organization_admin';

  // State for dialogs
  const [createWsOpen, setCreateWsOpen] = React.useState(false);
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false);
  const [createFolderOpen, setCreateFolderOpen] = React.useState(false);
  const [editFolderOpen, setEditFolderOpen] = React.useState(false);
  const [folderToEdit, setFolderToEdit] = React.useState<Folder | null>(null);
  const [wsForFolder, setWsForFolder] = React.useState<string | null>(null);

  const [editWsOpen, setEditWsOpen] = React.useState(false);
  const [wsToEdit, setWsToEdit] = React.useState<WorkspaceWithMeta | null>(null);
  const [deleteWsOpen, setDeleteWsOpen] = React.useState(false);
  const [wsToDelete, setWsToDelete] = React.useState<WorkspaceWithMeta | null>(null);

  // Home (Home) item
  const isHomeActive = activeWorkspaceId === null && activeFolderId === null;

  const handleHomeClick = useCallback(() => {
    switchWorkspace(null);
  }, [switchWorkspace]);

  return (
    <div className={cn('h-full flex flex-col bg-card border-r border-border', className)}>
      {/* Header with Switcher */}
      <header className="px-4 py-4 space-y-4 border-b border-border">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-cb-border/40 flex items-center justify-center">
               <RiSafeLine className="h-4.5 w-4.5 text-vibe-orange" />
             </div>
             <div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none">Navigation</h2>
               <p className="text-[9px] text-muted-foreground/60 uppercase">Workspace Navigator</p>
             </div>
           </div>
           {canCreateWorkspace && (
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateWsOpen(true)}>
               <RiAddLine size={16} />
             </Button>
           )}
        </div>
        
        <div className="p-2 border border-border rounded-xl bg-card">
           <div className="flex items-center justify-between gap-1 mb-2 px-1">
             <div className="flex items-center gap-1">
               <div className="w-1.5 h-1.5 rounded-full bg-success-bg shadow-[0_0_8px_rgba(var(--success-bg),0.5)]" />
               <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Organization</span>
             </div>
             {activeOrg && (
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-4 w-4 text-muted-foreground hover:text-foreground"
                 onClick={() => openPanel('organization_members', { type: 'organization_members', organizationId: activeOrgId, organizationName: activeOrg.name })}
               >
                 <RiGroupLine size={10} />
               </Button>
             )}
           </div>
           <OrganizationSwitcher />
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-2.5 space-y-2">
           {/* Section: Global */}
           <div className="pb-2">
              <button
                onClick={() => {
                  handleHomeClick();
                  switchFolder(null);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300',
                  isHomeActive ? 'bg-hover border border-border shadow-sm' : 'hover:bg-hover/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center border transition-all',
                  isHomeActive ? 'border-vibe-orange/20 bg-vibe-orange/10' : 'bg-card border-border'
                )}>
                  <RiHome4Line size={14} className={isHomeActive ? 'text-vibe-orange' : 'text-muted-foreground'} />
                </div>
                <span className={cn('text-xs font-bold uppercase tracking-tight', isHomeActive && 'font-display italic text-foreground')}>
                  Home
                </span>
                <Badge variant="secondary" className="ml-auto text-[10px] px-1 bg-cb-border/30">ALL</Badge>
              </button>
            {/* Section: Personal */}
            {(personalFolders.length > 0 || personalTags.length > 0) && (
              <div className="space-y-1">
                <div className="px-3 mb-2 flex items-center justify-between">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Personal</h3>
                </div>
                
                {personalFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      switchWorkspace(null);
                      switchFolder(folder.id);
                    }}
                    className={cn(
                      'relative w-full flex items-center gap-2 rounded-md pr-2 py-1.5',
                      'text-xs transition-all duration-200 text-left group px-3',
                      'hover:bg-hover/50',
                      activeFolderId === folder.id
                        ? 'bg-vibe-orange/5 text-vibe-orange font-semibold font-display italic tracking-tight'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <RiFolder3Line size={14} className={cn("flex-shrink-0", activeFolderId === folder.id ? "text-vibe-orange" : "text-muted-foreground")} />
                    <span className="truncate flex-1">{folder.name}</span>
                    {personalFolderAssignments[folder.id]?.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 tabular-nums bg-muted/40 text-muted-foreground/60">
                        {personalFolderAssignments[folder.id].length}
                      </Badge>
                    )}
                  </button>
                ))}

                {personalTags.map((tag) => (
                  <button
                    key={tag.id}
                    className={cn(
                      'relative w-full flex items-center gap-2 rounded-md pr-2 py-1.5',
                      'text-xs transition-all duration-200 text-left group px-3',
                      'hover:bg-hover/50 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <RiPriceTag3Line size={14} className="flex-shrink-0 text-muted-foreground" style={{ color: tag.color || undefined }} />
                    <span className="truncate flex-1">{tag.name}</span>
                  </button>
                ))}
              </div>
            )}
           </div>

           {/* Section: Workspaces */}
           <div>
             <div className="px-3 mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Your Workspaces</h3>
             </div>
             
             {isLoading ? (
               <div className="space-y-2">
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
               </div>
             ) : (
               <div className="space-y-1">
                 {workspaces.map((ws: WorkspaceWithMeta) => (
                   <WorkspaceListItem
                     key={ws.id}
                     workspace={ws}
                     isActive={activeWorkspaceId === ws.id}
                     activeFolderId={activeFolderId}
                     onSelect={switchWorkspace}
                     onFolderSelect={switchFolder}
                     onManageDetail={(id) => openPanel('workspace-detail', { type: 'workspace-detail', workspaceId: id })}
                     onCreateFolder={(id) => {
                       setWsForFolder(id);
                       setCreateFolderOpen(true);
                     }}
                      onFolderEdit={(folder) => {
                        setFolderToEdit(folder);
                        setEditFolderOpen(true);
                      }}
                      onRenameWorkspace={(ws) => {
                        setWsToEdit(ws);
                        setEditWsOpen(true);
                      }}
                      onDeleteWorkspace={(ws) => {
                        setWsToDelete(ws);
                        setDeleteWsOpen(true);
                      }}
                    />
                 ))}
                 {workspaces.length === 0 && (
                    <div className="px-3 py-6 text-center border-2 border-dashed border-border/20 rounded-xl">
                      <p className="text-[10px] text-muted-foreground/60 italic">No workspaces found in this org.</p>
                      <Button variant="ghost" size="sm" className="mt-2 text-[10px] h-7" onClick={() => setCreateWsOpen(true)}>
                        Create One
                      </Button>
                    </div>
                 )}
               </div>
             )}
           </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <footer className="p-3 border-t border-border bg-card">
        <button
          onClick={() => setCreateOrgOpen(true)}
          className="w-full h-10 flex items-center gap-3 px-4 rounded-xl text-xs font-bold text-muted-foreground hover:bg-hover hover:text-foreground transition-all group"
        >
          <RiBuildingLine size={16} className="group-hover:text-vibe-orange" />
          <span>New Organization</span>
        </button>
      </footer>

      {/* Dialogs */}
      <CreateWorkspaceDialog
        open={createWsOpen}
        onOpenChange={setCreateWsOpen}
        orgId={activeOrgId || ''}
      />
      <CreateOrganizationDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
      />
      {wsForFolder && (
        <QuickCreateFolderDialog
          open={createFolderOpen}
          onOpenChange={setCreateFolderOpen}
          workspaceId={wsForFolder}
          organizationId={activeOrgId || undefined}
        />
      )}
      <EditFolderDialog
        open={editFolderOpen}
        onOpenChange={setEditFolderOpen}
        folder={folderToEdit}
      />
      <EditWorkspaceDialog
        open={editWsOpen}
        onOpenChange={setEditWsOpen}
        workspace={wsToEdit as any}
        userRole={wsToEdit?.user_role || null}
        onDeleteRequest={() => {
          setWsToDelete(wsToEdit);
          setDeleteWsOpen(true);
        }}
      />
      <DeleteWorkspaceDialog
        open={deleteWsOpen}
        onOpenChange={setDeleteWsOpen}
        workspace={wsToDelete as any}
        recordingCount={null}
      />
    </div>
  );
}

export default WorkspaceSidebarPane;
