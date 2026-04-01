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
} from '@remixicon/react';
import { CreateWorkspaceDialog } from '@/components/dialogs/CreateWorkspaceDialog';

export type PeopleCategoryId = 'contacts' | 'members' | 'pending-invites';

export interface PeopleCategoryPaneProps {
  selectedCategory: PeopleCategoryId | null;
  onSelectCategory: (category: PeopleCategoryId) => void;
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string | null) => void;
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
}: PeopleCategoryPaneProps) {
  const { activeOrgId } = useOrganizationContext();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId);
  const [createWsOpen, setCreateWsOpen] = React.useState(false);

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col">
      {/* Org switcher */}
      <div className="mb-3">
        <OrganizationSwitcher />
      </div>

      {/* Pane heading */}
      <p className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground mb-3 px-1">
        People
      </p>

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
  );
}

export default PeopleCategoryPane;
