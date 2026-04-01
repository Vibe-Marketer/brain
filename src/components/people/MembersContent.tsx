/**
 * MembersContent - Pane 3 content for the "Members" category
 *
 * Shows workspace members in a table when a workspace is selected.
 * Empty prompt when no workspace is selected.
 *
 * @pattern pane-content
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  RiGroupLine,
  RiSafeLine,
  RiUserAddLine,
  RiUserLine,
} from '@remixicon/react';
import { useWorkspaceMembers, type WorkspaceMember } from '@/hooks/useWorkspaces';
import { usePanelStore } from '@/stores/panelStore';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceInviteDialog } from '@/components/dialogs/WorkspaceInviteDialog';
import type { WorkspaceRole } from '@/types/workspace';

/** Role badge styling (consistent with WorkspaceMemberPanel) */
const ROLE_BADGE_STYLES: Record<WorkspaceRole, { bg: string; text: string; border: string }> = {
  workspace_owner: { bg: 'bg-vibe-orange/10', text: 'text-vibe-orange', border: 'border-vibe-orange/20' },
  workspace_admin: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  contributor: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  member: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border/50' },
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  workspace_owner: 'Owner',
  workspace_admin: 'Admin',
  contributor: 'Contributor',
  member: 'Member',
};

interface MembersContentProps {
  workspaceId: string | null;
  workspaceName: string | undefined;
}

export function MembersContent({ workspaceId, workspaceName }: MembersContentProps) {
  const { members, isLoading } = useWorkspaceMembers(workspaceId);
  const { openPanel } = usePanelStore();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  // No workspace selected — show prompt
  if (!workspaceId) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <PageHeader
          title="Members"
          subtitle="Manage your team"
          icon={RiGroupLine}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
            <RiSafeLine className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Select a workspace
          </p>
          <p className="text-xs text-muted-foreground max-w-[260px]">
            Choose a workspace from the sidebar to view and manage its members.
          </p>
        </div>
      </div>
    );
  }

  const handleMemberClick = (member: WorkspaceMember) => {
    // Open workspace member panel in Pane 4
    openPanel('workspace_members', {
      type: 'workspace_members',
      workspaceId: workspaceId,
      workspaceName: workspaceName,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Members"
        subtitle={workspaceName}
        icon={RiSafeLine}
        actions={
          <Button
            variant="hollow"
            size="sm"
            onClick={() => setInviteOpen(true)}
          >
            <RiUserAddLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Invite
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
              <RiGroupLine className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No members yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Invite team members to collaborate in this workspace.
            </p>
            <Button variant="hollow" size="sm" onClick={() => setInviteOpen(true)}>
              <RiUserAddLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Invite Members
            </Button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-b border-border/40 text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
              <span>Name / Email</span>
              <span className="w-20 text-center">Role</span>
              <span className="w-24 text-right">Joined</span>
            </div>

            {/* Member rows */}
            <div className="divide-y divide-border/30">
              {members.map((member) => {
                const roleStyle = ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.member;
                const roleLabel = ROLE_LABELS[member.role] || member.role;
                const joinDate = member.created_at
                  ? format(new Date(member.created_at), 'MMM d, yyyy')
                  : null;
                const isCurrentUser = member.user_id === user?.id;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleMemberClick(member)}
                    className="w-full grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-2.5 hover:bg-muted/40 transition-colors text-left group"
                  >
                    {/* Name + Email */}
                    <div className="flex items-center gap-3 min-w-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <RiUserLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">
                            {member.display_name || member.email || 'Unknown user'}
                          </p>
                          {isCurrentUser && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 uppercase tracking-wider"
                            >
                              You
                            </Badge>
                          )}
                        </div>
                        {member.display_name && member.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Role badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1.5 py-0 h-5 uppercase tracking-[0.1em] font-bold border w-20 justify-center',
                        roleStyle.bg,
                        roleStyle.text,
                        roleStyle.border,
                      )}
                    >
                      {roleLabel}
                    </Badge>

                    {/* Joined date */}
                    <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">
                      {joinDate || '--'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Member count footer */}
            <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {/* Invite dialog */}
      <WorkspaceInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName || 'this workspace'}
      />
    </div>
  );
}
