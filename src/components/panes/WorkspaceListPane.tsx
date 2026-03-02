/**
 * WorkspaceListPane - Secondary pane showing workspace list for active organization
 *
 * Displays workspaces filtered by the active organization from useOrganizationContext.
 * Shows organization name prominently, workspace cards with type badges and member counts.
 *
 * @pattern workspace-list-pane
 * @brand-version v4.2
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RiSafeLine,
  RiAddLine,
  RiGroupLine,
  RiUserLine,
  RiTeamLine,
  RiCommunityLine,
  RiBriefcaseLine,
  RiBuildingLine,
  RiYoutubeLine,
  RiErrorWarningLine,
  RiArrowRightSLine,
  RiFolder3Line,
  RiFolderOpenLine,
} from '@remixicon/react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';
import { CreateOrganizationDialog } from '@/components/dialogs/CreateOrganizationDialog';
import { OrganizationSwitcher } from '@/components/header/OrganizationSwitcher';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useOrgContext } from '@/hooks/useOrgContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useFolders } from '@/hooks/useFolders';
import { queryKeys } from '@/lib/query-config';
import type { WorkspaceType, WorkspaceWithMeta } from '@/types/workspace';
import type { Folder } from '@/types/workspace';

export interface WorkspaceListPaneProps {
  /** Currently selected workspace ID */
  selectedWorkspaceId: string | null;
  /** Callback when a workspace is selected */
  onWorkspaceSelect: (workspaceId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/** Type badge config for each workspace type */
const WORKSPACE_TYPE_CONFIG: Record<WorkspaceType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}> = {
  personal: {
    label: 'Personal',
    icon: RiUserLine,
    className: 'bg-info-bg text-info-text',
  },
  team: {
    label: 'Team',
    icon: RiTeamLine,
    className: 'bg-success-bg text-success-text',
  },
  coach: {
    label: 'Coach',
    icon: RiBriefcaseLine,
    className: 'bg-warning-bg text-warning-text',
  },
  community: {
    label: 'Community',
    icon: RiCommunityLine,
    className: 'bg-warning-bg text-warning-text',
  },
  client: {
    label: 'Client',
    icon: RiBriefcaseLine,
    className: 'bg-info-bg text-info-text',
  },
  youtube: {
    label: 'YouTube',
    icon: RiYoutubeLine,
    className: 'bg-red-500/10 text-red-600',
  },
};

function FolderItem({
  folder,
  isActive,
  onSelect,
}: {
  folder: Folder;
  isActive: boolean;
  onSelect: (folderId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(folder.id)}
      className={cn(
        'relative w-full flex items-center gap-2 rounded-md pl-9 pr-2 py-1.5',
        'text-xs transition-all duration-200 text-left group',
        'hover:bg-hover/50',
        isActive
          ? 'bg-vibe-orange/5 text-vibe-orange font-semibold'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-r-full bg-vibe-orange" aria-hidden="true" />
      )}
      {isActive ? (
        <RiFolderOpenLine size={14} className="flex-shrink-0 text-vibe-orange" aria-hidden="true" />
      ) : (
        <RiFolder3Line size={14} className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
      )}
      <span className="truncate">{folder.name}</span>
    </button>
  );
}

function WorkspaceListItem({
  workspace,
  isActive,
  onSelect,
  activeFolderId,
  onFolderSelect,
}: {
  workspace: WorkspaceWithMeta;
  isActive: boolean;
  onSelect: (workspaceId: string) => void;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(isActive);
  const { data: folders = [] } = useFolders(isOpen ? workspace.id : null);
  const typeConfig = WORKSPACE_TYPE_CONFIG[workspace.workspace_type] || WORKSPACE_TYPE_CONFIG.personal;
  const TypeIcon = typeConfig.icon;
  const WorkspaceIcon = RiSafeLine;

  React.useEffect(() => {
    if (isActive) setIsOpen(true);
  }, [isActive]);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="mb-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            onSelect(workspace.id);
            if (!isOpen) setIsOpen(true);
          }}
          className={cn(
            'relative w-full flex items-start gap-3 px-3 py-3 rounded-lg',
            'text-left transition-all duration-300 ease-in-out',
            'hover:bg-hover/70',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2',
            isActive && [
              'bg-hover border border-border shadow-sm',
              'border-l-0 pl-4',
              "before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-[65%] before:rounded-full before:bg-vibe-orange",
            ]
          )}
          aria-current={isActive ? 'true' : undefined}
        >
          {/* Workspace icon wrapper */}
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              'bg-card border border-border shrink-0 transition-all duration-300',
              isActive && 'border-vibe-orange/30 bg-vibe-orange/10 shadow-inner'
            )}
          >
            <WorkspaceIcon
              className={cn(
                'h-4 w-4 transition-colors duration-300',
                isActive ? 'text-vibe-orange' : 'text-muted-foreground'
              )}
            />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('block text-sm font-bold truncate', isActive ? 'text-foreground' : 'text-foreground/90')}>
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
                    size={16}
                    className={cn(
                      'text-muted-foreground transition-transform duration-300',
                      isOpen && 'rotate-90'
                    )}
                  />
                </button>
              </Collapsible.Trigger>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn('inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md', typeConfig.className)}>
                <TypeIcon className="h-2.5 w-2.5" />
                {typeConfig.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60">
                <RiGroupLine className="h-2.5 w-2.5" />
                <span className="tabular-nums">{workspace.member_count}</span>
              </span>
            </div>
          </div>
        </button>
      </div>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 mt-1">
        <div className="flex flex-col gap-0.5 ml-1 border-l border-border/40 pb-1">
          {folders.length > 0 ? (
            folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                isActive={activeFolderId === folder.id}
                onSelect={(id) => onFolderSelect(activeFolderId === id ? null : id)}
              />
            ))
          ) : (
            isOpen && !isActive ? null : (
               <p className="pl-9 py-1.5 text-[10px] font-medium text-muted-foreground/40 italic">
                 No folders found
               </p>
            )
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/** Loading skeleton for workspace list */
function WorkspaceListSkeleton() {
  return (
    <div className="space-y-2 px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border/20 bg-muted/5">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty state when no workspaces exist */
function WorkspaceListEmpty({
  onCreateClick,
  canCreate,
}: {
  onCreateClick?: () => void;
  canCreate: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <RiSafeLine className="h-16 w-16 text-muted-foreground/30 mb-5" aria-hidden="true" />
      <p className="text-sm font-display font-extrabold uppercase tracking-widest text-foreground/80 mb-2">
        No workspaces yet
      </p>
      <p className="text-xs text-muted-foreground mb-6 max-w-[180px] leading-relaxed">
        Start by creating a workspace to organize your team's meetings.
      </p>
      <Button
        variant="default"
        size="sm"
        onClick={canCreate ? onCreateClick : undefined}
        className="gap-2 px-6 shadow-lg shadow-vibe-orange/10"
        disabled={!canCreate}
      >
        <RiAddLine className="h-4 w-4" />
        New Workspace
      </Button>
    </div>
  );
}

function WorkspaceListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <RiErrorWarningLine className="h-12 w-12 text-destructive/40 mb-3" aria-hidden="true" />
      <p className="text-sm font-bold text-foreground">Sync Error</p>
      <p className="text-xs text-muted-foreground mt-1 mb-5 max-w-[200px]">
        We encountered a problem fetching your workspaces.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="h-8 text-xs">
        Reconnect
      </Button>
    </div>
  );
}

export function WorkspaceListPane({
  selectedWorkspaceId,
  onWorkspaceSelect,
  className,
}: WorkspaceListPaneProps) {
  const queryClient = useQueryClient();
  const { activeOrgId, activeOrg: activeOrganization, activeOrgRole: orgRole, organizations, activeFolderId, switchFolder } = useOrgContext();
  const { workspaces, isLoading, error } = useWorkspaces(activeOrgId);
  
  const canCreateWorkspace = 
    orgRole === 'organization_owner' || 
    orgRole === 'organization_admin';

  const businessOrganizations = (organizations || []).filter((org) => org.type === 'business');
  const hasBusinessOrganizations = businessOrganizations.length > 0;

  // Track mount state for enter animations
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Create Workspace dialog state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  // Create Business Organization dialog state
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = React.useState(false);

  const handleCreateWorkspace = React.useCallback(() => {
    if (!canCreateWorkspace) return;
    setCreateDialogOpen(true);
  }, [canCreateWorkspace]);

  const handleWorkspaceCreated = React.useCallback(
    (workspaceId: string) => {
      onWorkspaceSelect(workspaceId);
    },
    [onWorkspaceSelect]
  );

  return (
    <div
      className={cn(
        'h-full flex flex-col bg-card/30',
        'transition-all duration-700 ease-out',
        isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4',
        className
      )}
      role="navigation"
      aria-label="Workspace list"
    >
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-md">
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0" id="workspace-list-title">
              <div className="w-9 h-9 rounded-xl bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 shadow-sm border border-vibe-orange/20" aria-hidden="true">
                <RiSafeLine className="h-5 w-5 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[11px] font-black text-ink uppercase tracking-[0.15em] leading-none mb-1">Vaults</h2>
                <p className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">Workspace Management</p>
              </div>
            </div>
            {canCreateWorkspace && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCreateWorkspace}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                title="Create Workspace"
              >
                <RiAddLine className="h-4.5 w-4.5" />
              </Button>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/5 shadow-sm space-y-3">
            <div className="min-w-0 px-0.5">
               <div className="flex items-center gap-1.5 mb-1">
                 <div className={cn(
                   "w-1.5 h-1.5 rounded-full shadow-[0_0_8px]",
                   activeOrganization?.type === 'personal' ? "bg-info-text shadow-info-text/50" : "bg-success-text shadow-success-text/50"
                 )} />
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                  {activeOrganization?.type === 'personal' ? 'Personal Cloud' : 'Business Organization'}
                </p>
               </div>
              <p className="text-sm font-display font-black uppercase tracking-wider text-foreground truncate pl-0.5">
                {activeOrganization?.name || '---'}
              </p>
            </div>
            <OrganizationSwitcher />
          </div>
        </div>
      </header>

      {/* Workspace List */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {isLoading ? (
          <WorkspaceListSkeleton />
        ) : error ? (
          <WorkspaceListError
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() })}
          />
        ) : workspaces.length === 0 ? (
          <WorkspaceListEmpty
            onCreateClick={handleCreateWorkspace}
            canCreate={canCreateWorkspace}
          />
        ) : (
          <div
            className="flex-1 overflow-y-auto pt-4 px-2.5 pb-20 custom-scrollbar"
            role="list"
            aria-labelledby="workspace-list-title"
          >
            {workspaces.map((workspace: WorkspaceWithMeta) => (
              <WorkspaceListItem
                key={workspace.id}
                workspace={workspace}
                isActive={selectedWorkspaceId === workspace.id}
                onSelect={onWorkspaceSelect}
                activeFolderId={activeFolderId}
                onFolderSelect={switchFolder}
              />
            ))}
          </div>
        )}
        
        {/* Faded bottom mask for scroll list */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/30 to-transparent pointer-events-none" />
      </div>

      {/* Footer / Create Organization */}
      <div className="flex-shrink-0 border-t border-border/40 p-3 bg-card/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setCreateOrgDialogOpen(true)}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
            'text-xs font-bold uppercase tracking-widest text-muted-foreground transition-all duration-300',
            'hover:bg-hover/80 hover:text-foreground group border border-transparent hover:border-border/40',
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-vibe-orange/10 group-hover:text-vibe-orange transition-colors">
            <RiBuildingLine className="h-4 w-4" />
          </div>
          <span>New Organization</span>
        </button>
      </div>

      {/* Dialogs */}
      {activeOrgId && canCreateWorkspace && (
        <CreateWorkspaceDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          orgId={activeOrgId}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      )}

      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
      />
    </div>
  );
}

export default WorkspaceListPane;
