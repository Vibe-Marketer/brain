/**
 * PeopleCategoryPane - Pane 2 navigation for the People page
 *
 * Shows three category items (Contacts, Members, Pending Invites) with
 * two-line style (headline + subhead). Members expands to show workspaces.
 *
 * @pattern secondary-pane
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from '@/components/header/OrganizationSwitcher';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  RiContactsLine,
  RiGroupLine,
  RiMailSendLine,
  RiAddLine,
  RiSafeLine,
  RiFolderLine,
  RiCloseLine,
} from '@remixicon/react';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';
import { useContactFolders, useCreateContactFolder } from '@/hooks/useContactFolders';
import { useAuth } from '@/contexts/AuthContext';

export type PeopleCategoryId = 'contacts' | 'members' | 'pending-invites';

export interface PeopleCategoryPaneProps {
  selectedCategory: PeopleCategoryId | null;
  onSelectCategory: (category: PeopleCategoryId) => void;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string | null) => void;
  selectedContactFolderId: string | null;
  onSelectContactFolder: (folderId: string | null) => void;
}

interface CategoryDef {
  id: PeopleCategoryId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'contacts',
    label: 'Contacts',
    subtitle: 'Manage Your Contacts',
    icon: RiContactsLine,
  },
  {
    id: 'members',
    label: 'Members',
    subtitle: 'Manage Your Team',
    icon: RiGroupLine,
  },
  {
    id: 'pending-invites',
    label: 'Pending Invites',
    subtitle: 'Manage Your Invitations',
    icon: RiMailSendLine,
  },
];

export function PeopleCategoryPane({
  selectedCategory,
  onSelectCategory,
  selectedWorkspaceId,
  onSelectWorkspace,
  selectedContactFolderId,
  onSelectContactFolder,
}: PeopleCategoryPaneProps) {
  const { activeOrgId } = useOrganizationContext();
  const { session } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId);
  const { data: contactFolders, isLoading: contactFoldersLoading } = useContactFolders(activeOrgId);
  const createContactFolder = useCreateContactFolder();
  const [createWsOpen, setCreateWsOpen] = React.useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');

  return (
    <div className="h-full flex flex-col">
      {/* Header with Switcher — matches WorkspaceSidebarPane pattern */}
      <header className="px-4 py-4 space-y-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cb-border/40 flex items-center justify-center">
              <RiContactsLine className="h-4.5 w-4.5 text-vibe-orange" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground leading-none">People</h2>
              <p className="text-[9px] text-muted-foreground/60 uppercase">Contact Manager</p>
            </div>
          </div>
        </div>

        <div className="p-2 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-1 mb-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success-bg shadow-[0_0_8px_rgba(var(--success-bg),0.5)]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">Organization</span>
          </div>
          <OrganizationSwitcher />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col">

      {/* Category list */}
      <div className="flex flex-col gap-0.5">
        {CATEGORIES.map(({ id, label, subtitle, icon: Icon }) => {
          const isActive = selectedCategory === id;

          return (
            <React.Fragment key={id}>
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(id);
                  // Reset workspace selection when switching categories
                  if (id !== 'members') {
                    onSelectWorkspace(null);
                  }
                  // Reset contact folder selection when switching away from contacts
                  if (id !== 'contacts') {
                    onSelectContactFolder(null);
                  }
                }}
                className={cn(
                  'relative w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left',
                  'text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                {isActive && (
                  <span
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r-full bg-vibe-orange"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  size={15}
                  className={cn(
                    'flex-shrink-0 transition-colors mt-0.5',
                    isActive ? 'text-vibe-orange' : 'text-muted-foreground',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {subtitle}
                  </span>
                </div>
              </button>

              {/* Contact folder sub-items under Contacts when expanded */}
              {id === 'contacts' && isActive && (
                <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
                  {contactFoldersLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-full rounded-md" />
                    ))
                  ) : (
                    <>
                      {(contactFolders || []).map((folder) => {
                        const isFolderActive = selectedContactFolderId === folder.id;
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => onSelectContactFolder(folder.id)}
                            className={cn(
                              'relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left',
                              'text-xs transition-colors duration-150',
                              isFolderActive
                                ? 'bg-muted/80 text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            )}
                          >
                            <RiFolderLine
                              size={13}
                              className={cn(
                                'flex-shrink-0',
                                isFolderActive ? 'text-vibe-orange' : 'text-muted-foreground',
                              )}
                            />
                            <span className="truncate">{folder.name}</span>
                          </button>
                        );
                      })}
                      {isCreatingFolder ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1">
                          <RiFolderLine size={13} className="flex-shrink-0 text-muted-foreground" />
                          <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newFolderName.trim() && activeOrgId && session?.user?.id) {
                                createContactFolder.mutate(
                                  {
                                    organizationId: activeOrgId,
                                    userId: session.user.id,
                                    name: newFolderName.trim(),
                                  },
                                  {
                                    onSuccess: () => {
                                      setNewFolderName('');
                                      setIsCreatingFolder(false);
                                    },
                                  }
                                );
                              }
                              if (e.key === 'Escape') {
                                setNewFolderName('');
                                setIsCreatingFolder(false);
                              }
                            }}
                            onBlur={() => {
                              setNewFolderName('');
                              setIsCreatingFolder(false);
                            }}
                            placeholder="Folder name..."
                            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-b border-border"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setNewFolderName('');
                              setIsCreatingFolder(false);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <RiCloseLine size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCreatingFolder(true)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
                        >
                          <RiAddLine size={13} className="flex-shrink-0" />
                          <span>New Folder</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Workspace sub-items under Members when expanded */}
              {id === 'members' && isActive && (
                <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
                  {workspacesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-full rounded-md" />
                    ))
                  ) : (
                    <>
                      {(workspaces || []).map((ws) => {
                        const isWsActive = selectedWorkspaceId === ws.id;
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => onSelectWorkspace(ws.id)}
                            className={cn(
                              'relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left',
                              'text-xs transition-colors duration-150',
                              isWsActive
                                ? 'bg-muted/80 text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            )}
                          >
                            <RiSafeLine
                              size={13}
                              className={cn(
                                'flex-shrink-0',
                                isWsActive ? 'text-vibe-orange' : 'text-muted-foreground',
                              )}
                            />
                            <span className="truncate">{ws.name}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCreateWsOpen(true)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
                      >
                        <RiAddLine size={13} className="flex-shrink-0" />
                        <span>Add Workspace</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        open={createWsOpen}
        onOpenChange={setCreateWsOpen}
        orgId={activeOrgId}
      />
      </div>

      <footer className="shrink-0 px-4 py-1 border-t border-border" />
    </div>
  );
}

export default PeopleCategoryPane;
