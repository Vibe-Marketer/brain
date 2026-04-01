/**
 * PendingInvitesContent - Pane 3 content for "Pending Invites" category
 *
 * Shows two sections: Organization Invites and Workspace Invites.
 * Supports revoking pending invitations and creating new ones.
 *
 * @pattern pane-content
 */

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  RiMailSendLine,
  RiMailLine,
  RiTimeLine,
  RiCloseLine,
  RiLoader2Line,
  RiUserAddLine,
  RiBuilding4Line,
  RiBuildingLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import {
  getOrganizationInvitations,
  revokeOrganizationInvitation,
} from '@/services/organization-invitations.service';
import type { OrganizationInvitation } from '@/services/organization-invitations.service';
import { OrganizationInviteDialog } from '@/components/dialogs/OrganizationInviteDialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  workspace_name: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InviteRow({
  email,
  role,
  createdAt,
  expiresAt,
  contextName,
  contextIcon: ContextIcon,
  onRevoke,
  revoking,
}: {
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  contextName: string;
  contextIcon: React.ElementType;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const expires = new Date(expiresAt);
  const isExpired = expires < new Date();
  const created = new Date(createdAt);

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-muted/60 border border-dashed border-border flex items-center justify-center flex-shrink-0">
          <RiMailLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{email}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ContextIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{contextName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {/* Role */}
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 uppercase tracking-wider">
          {role}
        </Badge>

        {/* Status */}
        <Badge
          variant={isExpired ? 'destructive' : 'outline'}
          className="text-[9px] px-1.5 py-0 h-5"
        >
          {isExpired ? 'Expired' : 'Pending'}
        </Badge>

        {/* Dates */}
        <div className="hidden sm:flex flex-col items-end text-[10px] text-muted-foreground tabular-nums">
          <span>Sent {format(created, 'MMM d')}</span>
          <div className="flex items-center gap-0.5">
            <RiTimeLine className="h-2.5 w-2.5" aria-hidden="true" />
            <span>{isExpired ? 'Expired' : format(expires, 'MMM d')}</span>
          </div>
        </div>

        {/* Revoke */}
        {!isExpired && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevoke}
            disabled={revoking}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            aria-label="Revoke invitation"
          >
            {revoking ? (
              <RiLoader2Line className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PendingInvitesContent() {
  const { activeOrgId, activeOrganization } = useOrganizationContext();
  const { workspaces } = useWorkspaces(activeOrgId);

  const [loading, setLoading] = useState(true);
  const [orgInvites, setOrgInvites] = useState<OrganizationInvitation[]>([]);
  const [wsInvites, setWsInvites] = useState<WorkspaceInvite[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [orgInviteOpen, setOrgInviteOpen] = useState(false);

  const loadInvites = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);

    try {
      // Fetch org-level invitations
      const orgData = await getOrganizationInvitations(activeOrgId).catch(() => []);
      setOrgInvites(orgData);

      // Fetch workspace-level invitations across all workspaces in this org
      const workspaceIds = (workspaces || []).map((ws) => ws.id);
      if (workspaceIds.length > 0) {
        const { data: wsInviteData } = await supabase
          .from('workspace_invitations')
          .select('id, workspace_id, email, role, created_at, expires_at')
          .in('workspace_id', workspaceIds)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        // Map workspace names
        const wsNameMap = new Map((workspaces || []).map((ws) => [ws.id, ws.name]));
        setWsInvites(
          (wsInviteData || []).map((inv) => ({
            ...inv,
            workspace_name: wsNameMap.get(inv.workspace_id) || 'Unknown workspace',
          }))
        );
      } else {
        setWsInvites([]);
      }
    } catch (error) {
      logger.error('Error loading invitations', error);
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, workspaces]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleRevokeOrgInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      await revokeOrganizationInvitation(inviteId);
      toast.success('Invitation revoked');
      await loadInvites();
    } catch (error) {
      logger.error('Error revoking org invite', error);
      toast.error('Failed to revoke invitation');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeWsInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      const { error } = await supabase
        .from('workspace_invitations')
        .update({ status: 'revoked' })
        .eq('id', inviteId);
      if (error) throw error;
      toast.success('Invitation revoked');
      await loadInvites();
    } catch (error) {
      logger.error('Error revoking workspace invite', error);
      toast.error('Failed to revoke invitation');
    } finally {
      setRevokingId(null);
    }
  };

  const orgName = activeOrganization?.name || 'Organization';
  const totalCount = orgInvites.length + wsInvites.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Pending Invites"
        subtitle={`${totalCount} pending invitation${totalCount !== 1 ? 's' : ''}`}
        icon={RiMailSendLine}
        actions={
          <Button
            variant="hollow"
            size="sm"
            onClick={() => setOrgInviteOpen(true)}
          >
            <RiUserAddLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Invite
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
              <RiMailSendLine className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No pending invites</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[260px]">
              All invitations have been accepted, expired, or revoked.
            </p>
            <Button variant="hollow" size="sm" onClick={() => setOrgInviteOpen(true)}>
              <RiUserAddLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Send Invite
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {/* Organization Invites */}
            {orgInvites.length > 0 && (
              <section>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/30">
                  <RiBuilding4Line className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                    Organization Invites
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                    {orgInvites.length}
                  </Badge>
                </div>
                <div className="divide-y divide-border/30">
                  {orgInvites.map((invite) => (
                    <InviteRow
                      key={invite.id}
                      email={invite.email}
                      role={invite.role}
                      createdAt={invite.created_at}
                      expiresAt={invite.expires_at}
                      contextName={orgName}
                      contextIcon={RiBuilding4Line}
                      onRevoke={() => handleRevokeOrgInvite(invite.id)}
                      revoking={revokingId === invite.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Workspace Invites */}
            {wsInvites.length > 0 && (
              <section>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/30">
                  <RiBuildingLine className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-medium">
                    Workspace Invites
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                    {wsInvites.length}
                  </Badge>
                </div>
                <div className="divide-y divide-border/30">
                  {wsInvites.map((invite) => (
                    <InviteRow
                      key={invite.id}
                      email={invite.email}
                      role={invite.role}
                      createdAt={invite.created_at}
                      expiresAt={invite.expires_at}
                      contextName={invite.workspace_name}
                      contextIcon={RiBuildingLine}
                      onRevoke={() => handleRevokeWsInvite(invite.id)}
                      revoking={revokingId === invite.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Org invite dialog */}
      {orgInviteOpen && (
        <OrganizationInviteDialog
          open={orgInviteOpen}
          onOpenChange={(open) => {
            if (!open) {
              setOrgInviteOpen(false);
              loadInvites();
            }
          }}
          organizationId={activeOrgId}
          organizationName={orgName}
        />
      )}
    </div>
  );
}
