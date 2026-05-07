/**
 * MembersOverviewDashboard - Pane 3 default view for Members category
 *
 * Shows workspace cards with member counts when no specific workspace is
 * selected. Follows the same card pattern as ImportOverviewDashboard.
 *
 * @pattern pane3-overview
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RiGroupLine,
  RiSafeLine,
  RiTeamLine,
  RiUserLine,
} from '@remixicon/react';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';

export interface MembersOverviewDashboardProps {
  onSelectWorkspace: (workspaceId: string) => void;
}

export function MembersOverviewDashboard({ onSelectWorkspace }: MembersOverviewDashboardProps) {
  const { activeOrgId } = useOrganizationContext();
  const { workspaces, isLoading } = useWorkspaces(activeOrgId);

  const totalMembers = (workspaces || []).reduce((sum, ws) => sum + (ws.member_count || 0), 0);
  const totalWorkspaces = (workspaces || []).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 space-y-8">
      {/* Page header */}
      <PageHeader
        title="Members"
        subtitle="Manage your team across workspaces"
        icon={RiGroupLine}
      />

      {/* Workspace cards grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Workspaces
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (workspaces || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
              <RiSafeLine className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No workspaces yet</p>
            <p className="text-xs text-muted-foreground">
              Create a workspace to start managing team members.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(workspaces || []).map((ws) => {
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => onSelectWorkspace(ws.id)}
                  className={cn(
                    'bg-card border border-border/60 rounded-xl p-4',
                    'hover:border-border cursor-pointer transition-colors text-left',
                    'flex items-start gap-3 group',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      'bg-muted border border-border',
                      'group-hover:border-vibe-orange/20 transition-colors',
                    )}
                  >
                    <RiSafeLine
                      size={16}
                      className="text-muted-foreground group-hover:text-vibe-orange transition-colors"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{ws.name}</p>
                      {ws.is_default && (
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 h-4 uppercase tracking-wider font-bold border bg-vibe-orange/10 text-vibe-orange border-vibe-orange/20"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <RiUserLine size={11} className="text-muted-foreground" />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {ws.member_count} member{ws.member_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {/* Active indicator */}
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Active
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary stats */}
      {!isLoading && totalWorkspaces > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-card border border-border/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <RiTeamLine size={14} className="text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                  Total Members
                </span>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{totalMembers}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <RiSafeLine size={14} className="text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                  Workspaces
                </span>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{totalWorkspaces}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <RiGroupLine size={14} className="text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                  Avg / Workspace
                </span>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {totalWorkspaces > 0 ? Math.round(totalMembers / totalWorkspaces) : 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Visual hint */}
      <p className="text-sm text-muted-foreground">
        Select a workspace from the sidebar to manage its members.
      </p>
    </div>
  );
}

export default MembersOverviewDashboard;
