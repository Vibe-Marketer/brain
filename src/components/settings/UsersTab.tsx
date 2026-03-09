import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RiLoader2Line,
  RiGroupLine,
  RiBuilding4Line,
  RiBuildingLine,
  RiMailLine,
  RiCloseLine,
  RiTimeLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getOrganizations } from "@/services/organizations.service";
import {
  getOrganizationMembers,
  removeOrganizationMember,
} from "@/services/organizations.service";
import {
  getOrganizationInvitations,
  revokeOrganizationInvitation,
} from "@/services/organization-invitations.service";
import type {
  OrganizationMember,
  OrganizationRole,
} from "@/services/organizations.service";
import type { Organization } from "@/types/workspace";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgWithMembers {
  org: Organization;
  members: OrganizationMember[];
  pendingInvites: PendingInvite[];
}

interface WorkspaceWithMembers {
  workspaceId: string;
  workspaceName: string;
  orgId: string;
  members: WorkspaceMember[];
  pendingInvites: PendingInvite[];
}

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  type: "org" | "workspace";
  contextName: string;
  contextId: string;
}

// ─── Role badge helpers ───────────────────────────────────────────────────────

function OrgRoleBadge({ role }: { role: OrganizationRole }) {
  const map: Record<OrganizationRole, { label: string; variant: "default" | "outline" | "destructive" }> = {
    organization_owner: { label: "Owner", variant: "default" },
    organization_admin: { label: "Admin", variant: "default" },
    member: { label: "Member", variant: "outline" },
  };
  const config = map[role] ?? { label: role, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function WorkspaceRoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    workspace_owner: "Owner",
    workspace_admin: "Admin",
    manager: "Manager",
    member: "Member",
    guest: "Guest",
  };
  return <Badge variant="outline">{labels[role] ?? role}</Badge>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberRow({
  name,
  email,
  badge,
  onRemove,
  removing,
}: {
  name: string;
  email: string;
  badge: React.ReactNode;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/40 rounded-lg transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {(name || email).charAt(0)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{name || email}</p>
          {name && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {badge}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={removing}
            aria-label="Remove member"
          >
            {removing ? (
              <RiLoader2Line className="h-4 w-4 animate-spin" />
            ) : (
              <RiCloseLine className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function PendingInviteRow({
  invite,
  onRevoke,
  revoking,
}: {
  invite: PendingInvite;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const expiresAt = new Date(invite.expires_at);
  const isExpired = expiresAt < new Date();

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/40 rounded-lg transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-muted/60 border border-dashed border-border flex items-center justify-center flex-shrink-0">
          <RiMailLine className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <RiTimeLine className="h-3 w-3" />
            <span>{isExpired ? "Expired" : `Expires ${expiresAt.toLocaleDateString()}`}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <Badge variant="outline" className="text-xs">{invite.role}</Badge>
        <Badge variant={isExpired ? "destructive" : "outline"} className="text-xs">
          {isExpired ? "Expired" : "Pending"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={revoking}
          aria-label="Revoke invitation"
        >
          {revoking ? (
            <RiLoader2Line className="h-4 w-4 animate-spin" />
          ) : (
            <RiCloseLine className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UsersTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orgsWithMembers, setOrgsWithMembers] = useState<OrgWithMembers[]>([]);
  const [workspacesWithMembers, setWorkspacesWithMembers] = useState<WorkspaceWithMembers[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get all organizations the user belongs to
      const organizations = await getOrganizations(user.id);

      // 2. For each org, fetch members and pending invites
      const orgResults = await Promise.all(
        organizations.map(async (orgWithRole) => {
          const [members, orgInvitations] = await Promise.all([
            getOrganizationMembers(orgWithRole.id).catch(() => [] as OrganizationMember[]),
            getOrganizationInvitations(orgWithRole.id).catch(() => []),
          ]);

          const pendingInvites: PendingInvite[] = orgInvitations.map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            type: "org" as const,
            contextName: orgWithRole.name,
            contextId: orgWithRole.id,
          }));

          return {
            org: orgWithRole as Organization,
            members,
            pendingInvites,
          };
        })
      );

      setOrgsWithMembers(orgResults);

      // 3. Get all workspaces the user is a member of (across all orgs)
      const { data: wsMemberships, error: wsError } = await supabase
        .from("workspace_memberships")
        .select(`
          id,
          role,
          workspace_id,
          workspace:workspaces (
            id,
            name,
            organization_id
          )
        `)
        .eq("user_id", user.id);

      if (wsError) throw wsError;

      // Collect all workspace member user IDs for a single batch profile fetch
      const workspaceIds = (wsMemberships ?? [])
        .map((wm) => (wm.workspace as { id: string } | null)?.id)
        .filter(Boolean) as string[];

      // Fetch all workspace memberships in one query
      let allWsMemberships: Array<{ id: string; user_id: string; role: string; created_at: string; workspace_id: string }> = [];
      if (workspaceIds.length > 0) {
        const { data: allMemberships, error: allMemberError } = await supabase
          .from("workspace_memberships")
          .select("id, user_id, role, created_at, workspace_id")
          .in("workspace_id", workspaceIds);

        if (allMemberError) throw allMemberError;
        allWsMemberships = allMemberships ?? [];
      }

      // Batch-fetch all user profiles in a single query (user_profiles.user_id = auth.users.id)
      const allMemberUserIds = [...new Set(allWsMemberships.map((m) => m.user_id))];
      const profileMap = new Map<string, { email: string; display_name: string; avatar_url: string | null }>();

      if (allMemberUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, email, display_name, avatar_url")
          .in("user_id", allMemberUserIds);

        for (const p of profiles ?? []) {
          profileMap.set(p.user_id, {
            email: p.email ?? "",
            display_name: p.display_name ?? "",
            avatar_url: p.avatar_url ?? null,
          });
        }
      }

      // Fetch all pending workspace invitations in one query
      let allWsInvites: Array<{ id: string; workspace_id: string; email: string; role: string; created_at: string; expires_at: string }> = [];
      if (workspaceIds.length > 0) {
        const { data: wsInviteData } = await supabase
          .from("workspace_invitations")
          .select("id, workspace_id, email, role, created_at, expires_at")
          .in("workspace_id", workspaceIds)
          .eq("status", "pending");
        allWsInvites = wsInviteData ?? [];
      }

      // 4. Build workspace results using the batch-fetched data
      const wsResults: WorkspaceWithMembers[] = (wsMemberships ?? []).map((wm) => {
        const ws = wm.workspace as { id: string; name: string; organization_id: string } | null;
        if (!ws) return null;

        const wsMembers = allWsMemberships
          .filter((m) => m.workspace_id === ws.id)
          .map((m) => {
            const profile = profileMap.get(m.user_id);
            return {
              id: m.id,
              user_id: m.user_id,
              role: m.role,
              created_at: m.created_at,
              email: profile?.email ?? "",
              display_name: profile?.display_name ?? "",
              avatar_url: profile?.avatar_url ?? null,
            };
          });

        const pendingInvites: PendingInvite[] = allWsInvites
          .filter((inv) => inv.workspace_id === ws.id)
          .map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            type: "workspace" as const,
            contextName: ws.name,
            contextId: ws.id,
          }));

        return {
          workspaceId: ws.id,
          workspaceName: ws.name,
          orgId: ws.organization_id,
          members: wsMembers,
          pendingInvites,
        };
      }).filter(Boolean) as WorkspaceWithMembers[];

      setWorkspacesWithMembers(wsResults);
    } catch (error) {
      logger.error("Error loading team data", error);
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveOrgMember = async (membershipId: string) => {
    setRemovingId(membershipId);
    try {
      await removeOrganizationMember(membershipId);
      toast.success("Member removed");
      await loadData();
    } catch (error) {
      logger.error("Error removing org member", error);
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveWorkspaceMember = async (membershipId: string) => {
    setRemovingId(membershipId);
    try {
      const { error } = await supabase
        .from("workspace_memberships")
        .delete()
        .eq("id", membershipId);
      if (error) throw error;
      toast.success("Member removed from workspace");
      await loadData();
    } catch (error) {
      logger.error("Error removing workspace member", error);
      toast.error("Failed to remove workspace member");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevokeOrgInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      await revokeOrganizationInvitation(inviteId);
      toast.success("Invitation revoked");
      await loadData();
    } catch (error) {
      logger.error("Error revoking org invite", error);
      toast.error("Failed to revoke invitation");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeWorkspaceInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      const { error } = await supabase
        .from("workspace_invitations")
        .update({ status: "revoked" })
        .eq("id", inviteId);
      if (error) throw error;
      toast.success("Invitation revoked");
      await loadData();
    } catch (error) {
      logger.error("Error revoking workspace invite", error);
      toast.error("Failed to revoke invitation");
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasNoData =
    orgsWithMembers.length === 0 && workspacesWithMembers.length === 0;

  if (hasNoData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
        <RiGroupLine className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-foreground mb-1">No team members yet</p>
        <p className="text-xs text-muted-foreground">
          Invite people to your organizations and workspaces to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">

      {/* ── Organization Members ─────────────────────────────────── */}
      {orgsWithMembers.map(({ org, members, pendingInvites }) => (
        <section key={org.id} className="space-y-4">
          <div className="flex items-center gap-2">
            <RiBuilding4Line className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <h2 className="font-semibold text-foreground">{org.name}</h2>
              <p className="text-xs text-muted-foreground">
                Organization · {members.length} member{members.length !== 1 ? "s" : ""}
                {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending`}
              </p>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <RiGroupLine className="h-8 w-8 mb-2" />
                <p className="text-sm">No members in this organization</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    name={member.display_name}
                    email={member.email}
                    badge={<OrgRoleBadge role={member.role} />}
                    onRemove={
                      member.role !== "organization_owner"
                        ? () => handleRemoveOrgMember(member.id)
                        : undefined
                    }
                    removing={removingId === member.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pending org invites for this org */}
          {pendingInvites.length > 0 && (
            <div className="border border-dashed border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Pending Invitations
                </p>
              </div>
              <div className="divide-y divide-border">
                {pendingInvites.map((invite) => (
                  <PendingInviteRow
                    key={invite.id}
                    invite={invite}
                    onRevoke={() => handleRevokeOrgInvite(invite.id)}
                    revoking={revokingId === invite.id}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

      {workspacesWithMembers.length > 0 && orgsWithMembers.length > 0 && (
        <Separator />
      )}

      {/* ── Workspace Members ─────────────────────────────────────── */}
      {workspacesWithMembers.length > 0 && (
        <section className="space-y-8">
          <div>
            <h2 className="font-semibold text-foreground">Workspaces</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              People who have access to your shared workspaces
            </p>
          </div>

          {workspacesWithMembers.map((ws) => (
            <div key={ws.workspaceId} className="space-y-3">
              <div className="flex items-center gap-2">
                <RiBuildingLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{ws.workspaceName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {ws.members.length} member{ws.members.length !== 1 ? "s" : ""}
                    {ws.pendingInvites.length > 0 && ` · ${ws.pendingInvites.length} pending`}
                  </p>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                {ws.members.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <p className="text-sm">No members in this workspace</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {ws.members.map((member) => (
                      <MemberRow
                        key={member.id}
                        name={member.display_name}
                        email={member.email}
                        badge={<WorkspaceRoleBadge role={member.role} />}
                        onRemove={
                          member.role !== "workspace_owner"
                            ? () => handleRemoveWorkspaceMember(member.id)
                            : undefined
                        }
                        removing={removingId === member.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Pending workspace invites */}
              {ws.pendingInvites.length > 0 && (
                <div className="border border-dashed border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Pending Invitations
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {ws.pendingInvites.map((invite) => (
                      <PendingInviteRow
                        key={invite.id}
                        invite={invite}
                        onRevoke={() => handleRevokeWorkspaceInvite(invite.id)}
                        revoking={revokingId === invite.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
