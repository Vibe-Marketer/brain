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
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useFolders, useFolderAssignments, useDeleteFolder, useArchiveFolder } from '@/hooks/useFolders';
import { useSetDefaultWorkspace } from '@/hooks/useWorkspaceMutations';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePanelStore } from '@/stores/panelStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SelectionButton } from '@/components/ui/selection-button';
import { selectionButtonVariants } from '@/components/ui/selection-button-variants';
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
  RiShareLine,
} from '@remixicon/react';
import type { WorkspaceWithMeta, WorkspaceRole } from '@/types/workspace';
import type { Folder } from '@/types/workspace';
import { FolderDropZone } from '@/components/dnd/FolderDropZone';
import { WorkspaceDropZone } from '@/components/dnd/WorkspaceDropZone';

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
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(folder.id)}
            className={cn(
              'relative w-full flex items-center gap-2 rounded-md pr-2 py-1.5',
              'text-xs transition-all duration-200 text-left group',
              'hover:bg-muted/50',
              isActive
                ? [
                    'bg-muted border border-border shadow-sm text-foreground font-semibold tracking-tight',
                    "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
                  ]
                : 'border border-transparent text-muted-foreground hover:text-foreground',
            )}
            style={{ paddingLeft: `${2.25 + depth * 0.75}rem` }}
          >
            {isActive ? (
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
                <RiFolderOpenLine className="h-3.5 w-3.5 text-foreground" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border" aria-hidden="true">
                <RiFolder3Line className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
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
          <ContextMenuItem disabled className="opacity-50 cursor-not-allowed" title="Coming soon">
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
            onClick={() => setArchiveDialogOpen(true)}
            className="text-muted-foreground"
          >
            <RiArchiveLine className="h-4 w-4 mr-2" />
            Archive Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Archive confirmation dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{folder.name}</strong>? The folder will be hidden from your workspace but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="hollow" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                onArchive?.(folder);
                setArchiveDialogOpen(false);
              }}
            >
              Archive Folder
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  onFolderSelect: (workspaceId: string, folderId: string | null) => void;
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
  const { openPanel } = usePanelStore();
  const [folderToConfirmDelete, setFolderToConfirmDelete] = React.useState<Folder | null>(null);

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
        <FolderDropZone folder={folder}>
          <FolderListItem
            folder={folder}
            isActive={activeFolderId === folder.id}
            onSelect={(id) => onFolderSelect(workspace.id, activeFolderId === id ? null : id)}
            onEdit={onFolderEdit}
            onDelete={(f) => setFolderToConfirmDelete(f)}
            onArchive={(f) => archiveFolder({ folderId: f.id, workspaceId: workspace.id })}
            count={assignments[folder.id]?.length}
            depth={depth}
          />
        </FolderDropZone>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(workspace.id);
                if (!isOpen) setIsOpen(true);
              }
            }}
            className={cn(
              selectionButtonVariants({ orientation: 'vertical', size: 'sm', selected: isActive }),
              'cursor-pointer group',
            )}
            aria-current={isActive && !activeFolderId ? 'true' : undefined}
          >
            {/* Workspace icon wrapper — canonical: orange ring on selected */}
            <div
              className={cn(
                'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                'bg-card transition-all duration-300',
                isActive
                  ? 'ring-1 ring-vibe-orange border-transparent'
                  : 'border border-border'
              )}
            >
              <RiSafeLine
                className={cn(
                  'h-3.5 w-3.5 transition-colors duration-300',
                  isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'block text-xs uppercase tracking-tight truncate transition-colors',
                    isActive ? 'text-foreground font-bold' : 'text-foreground/80 font-bold',
                  )}
                >
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
          {canManage && !workspace.is_default && (
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

      {/* Delete folder confirmation dialog */}
      <AlertDialog open={!!folderToConfirmDelete} onOpenChange={(open) => { if (!open) setFolderToConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <RiDeleteBinLine className="h-5 w-5" />
              Delete Folder
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{folderToConfirmDelete?.name}</strong>? This action cannot be undone and will remove all folder assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="hollow" onClick={() => setFolderToConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (folderToConfirmDelete) {
                  deleteFolder(folderToConfirmDelete.id);
                  setFolderToConfirmDelete(null);
                }
              }}
            >
              Delete Folder
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible.Root>
  );
}

/**
 * SortableWorkspaceItem — wraps a workspace row with @dnd-kit/sortable plumbing.
 *
 * The drag listeners attach ONLY to the small grip-handle button on the left
 * edge — NOT to the whole row — so click-to-select on the row body, the
 * collapse/expand chevron, the context menu, and the inner WorkspaceDropZone
 * (call → workspace folder drop) all keep working untouched.
 */
/** Vertical 3-dot drag affordance — Notion/Linear-style. */
function GripDotsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 16" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="4" cy="3.5" r="1.1" />
      <circle cx="4" cy="8" r="1.1" />
      <circle cx="4" cy="12.5" r="1.1" />
    </svg>
  );
}

function SortableWorkspaceItem({
  workspace,
  children,
}: {
  workspace: WorkspaceWithMeta;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: workspace.id, data: { type: 'workspace' } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/sortable rounded-lg',
        isDragging && 'shadow-lg cursor-grabbing',
        isOver && !isDragging && 'before:content-[""] before:absolute before:left-2 before:right-2 before:-top-px before:h-px before:bg-vibe-orange',
      )}
    >
      {/* Drag handle — slim 3-dot grip, sits flush in the chrome */}
      <button
        type="button"
        aria-label={`Reorder ${workspace.name}`}
        className="absolute left-0 top-7 -translate-y-1/2 opacity-0 group-hover/sortable:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing p-1 z-10 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-vibe-orange/40 rounded-sm"
        {...attributes}
        {...listeners}
      >
        <GripDotsIcon className="h-3 w-1.5 text-muted-foreground/60" />
      </button>
      {children}
    </div>
  );
}

export function WorkspaceSidebarPane({ className }: WorkspaceSidebarPaneProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { openPanel } = usePanelStore();
  const {
    activeOrgId,
    activeOrg,
    orgRole: activeOrgRole,
    activeWorkspaceId,
    activeFolderId,
    isSharedView,
    switchWorkspace,
    switchFolder,
    switchToFolder,
    setSharedView,
  } = useOrganizationContext();
  const { workspaces, isLoading, error } = useWorkspaces(activeOrgId);
  const { data: personalFolders = [], isLoading: personalFoldersLoading } = usePersonalFolders(activeOrgId);
  const { data: personalTags = [] } = usePersonalTags(activeOrgId);
  const { data: personalFolderAssignments = {} } = usePersonalFolderAssignments(activeOrgId);

  // Drag-and-drop reorder for the "Your Workspaces" list (WS-03).
  // The DndContext that hosts BOTH workspace reorder AND recording-drop-onto-
  // workspace lives in the consuming page (TranscriptsNew.tsx). Pages that
  // only need reorder (RoutingRulesPage) wrap this pane in their own
  // DndContext from useWorkspaceReorder. Sharing one context per page keeps
  // the WorkspaceDropZone droppables visible to recording drags — separating
  // them was the Phase-25 regression.

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

  // Home (Home) item — not active when in shared view
  const isHomeActive = activeWorkspaceId === null && activeFolderId === null && !isSharedView;

  const handleHomeClick = useCallback(() => {
    setSharedView(false);
    switchWorkspace(null);
    if (location.pathname !== '/') {
      navigate('/');
    }
  }, [setSharedView, switchWorkspace, location.pathname, navigate]);

  /** Navigate to calls page when selecting a workspace from a non-calls page */
  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    setSharedView(false);
    switchWorkspace(workspaceId);
    if (location.pathname !== '/') {
      navigate('/');
    }
  }, [setSharedView, switchWorkspace, location.pathname, navigate]);

  /** Navigate to calls page when selecting a folder from a non-calls page */
  const handleFolderSelect = useCallback((workspaceId: string, folderId: string | null) => {
    switchToFolder(workspaceId, folderId);
    if (location.pathname !== '/') {
      navigate('/');
    }
  }, [switchToFolder, location.pathname, navigate]);

  /** Enter "Shared With Me" virtual workspace view */
  const handleSharedWithMeClick = useCallback(() => {
    setSharedView(true);
    if (location.pathname !== '/') {
      navigate('/');
    }
  }, [setSharedView, location.pathname, navigate]);

  return (
    <div className={cn('h-full flex flex-col bg-card border-r border-border', className)}>
      {/* Header with Switcher */}
      <header className="px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
               <RiSafeLine className="h-4 w-4 text-vibe-orange" />
             </div>
             <div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none">NAVIGATION</h2>
               <p className="text-[9px] text-muted-foreground/60 uppercase">WORKSPACE NAVIGATOR</p>
             </div>
           </div>
           {canCreateWorkspace && (
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateWsOpen(true)}>
               <RiAddLine size={16} />
             </Button>
           )}
        </div>
        
        <div className="w-full p-3 border border-border rounded-xl bg-card">
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
              <SelectionButton
                onClick={() => {
                  switchFolder(null);
                  handleHomeClick();
                }}
                selected={isHomeActive}
                icon={
                  <RiHome4Line className={cn('h-4 w-4', isHomeActive ? 'text-foreground' : 'text-muted-foreground')} />
                }
                label="HOME"
                size="sm"
                rightSlot={
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-foreground">ALL</Badge>
                }
              />
            {/* Section: Personal */}
            {(personalFolders.length > 0 || personalTags.length > 0) && (
              <div className="space-y-1">
                <div className="px-3 mb-2 flex items-center justify-between">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">PERSONAL</h3>
                </div>
                
                {personalFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      switchWorkspace(null);
                      switchFolder(folder.id);
                      if (location.pathname !== '/') {
                        navigate('/');
                      }
                    }}
                    className={cn(
                      'relative w-full flex items-center gap-2 rounded-md pr-2 py-1.5',
                      'text-xs transition-all duration-200 text-left group px-3',
                      'border border-transparent hover:bg-muted/50',
                      activeFolderId === folder.id
                        ? 'bg-muted border-border shadow-sm text-foreground font-semibold tracking-tight'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <RiFolder3Line size={14} className={cn("flex-shrink-0", activeFolderId === folder.id ? "text-foreground" : "text-muted-foreground")} />
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
                    onClick={() => navigate('/sorting-tagging/tags')}
                    className={cn(
                      'relative w-full flex items-center gap-2 rounded-md pr-2 py-1.5',
                      'text-xs transition-all duration-200 text-left group px-3',
                      'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
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
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">YOUR WORKSPACES</h3>
             </div>
             
             {isLoading ? (
               <div className="space-y-2">
                 <Skeleton className="h-10 w-full rounded-lg" />
                 <Skeleton className="h-10 w-full rounded-lg" />
               </div>
             ) : (
               <SortableContext
                 items={workspaces.map((w) => w.id)}
                 strategy={verticalListSortingStrategy}
               >
                   <div className="space-y-1">
                     {workspaces.map((ws: WorkspaceWithMeta) => (
                       <SortableWorkspaceItem key={ws.id} workspace={ws}>
                         <WorkspaceDropZone workspaceId={ws.id}>
                           <WorkspaceListItem
                             workspace={ws}
                             isActive={activeWorkspaceId === ws.id}
                             activeFolderId={activeFolderId}
                             onSelect={handleWorkspaceSelect}
                             onFolderSelect={handleFolderSelect}
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
                         </WorkspaceDropZone>
                       </SortableWorkspaceItem>
                     ))}
                     {workspaces.length === 0 && (
                        <div className="px-3 py-6 text-center border-2 border-dashed border-border/20 rounded-xl">
                          <p className="text-[10px] text-muted-foreground/60 italic">No workspaces found in this org.</p>
                          {canCreateWorkspace && (
                            <Button variant="ghost" size="sm" className="mt-2 text-[10px] h-7" onClick={() => setCreateWsOpen(true)}>
                              Create One
                            </Button>
                          )}
                        </div>
                     )}
                   </div>
               </SortableContext>
             )}
           </div>

           {/* Section: Shared With Me */}
           <div className="pt-2 mt-1/40">
              <SelectionButton
                onClick={handleSharedWithMeClick}
                selected={isSharedView}
                icon={
                  <RiShareLine className={cn('h-4 w-4', isSharedView ? 'text-foreground' : 'text-muted-foreground')} />
                }
                label="SHARED WITH ME"
                size="sm"
              />
           </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <footer className="shrink-0 px-3 py-2.5 space-y-0.5">
        {canCreateWorkspace && (
          <button
            onClick={() => setCreateWsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
              <RiAddLine className="h-4 w-4 text-muted-foreground group-hover:text-vibe-orange" />
            </div>
            <span>New Workspace</span>
          </button>
        )}
        <button
          onClick={() => setCreateOrgOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
        >
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-card border border-border">
            <RiBuildingLine className="h-4 w-4 text-muted-foreground group-hover:text-vibe-orange" />
          </div>
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
        workspace={wsToEdit ? { ...wsToEdit, memberships: [] } : null}
        userRole={wsToEdit?.user_role || null}
        onDeleteRequest={() => {
          setWsToDelete(wsToEdit);
          setDeleteWsOpen(true);
        }}
      />
      <DeleteWorkspaceDialog
        open={deleteWsOpen}
        onOpenChange={setDeleteWsOpen}
        workspace={wsToDelete ? { ...wsToDelete, memberships: [] } : null}
        recordingCount={null}
      />
    </div>
  );
}

export default WorkspaceSidebarPane;
