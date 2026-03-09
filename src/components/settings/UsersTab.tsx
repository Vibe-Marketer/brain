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
  RiUserAddLine,
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
  updateOrganizationMemberRole,
  removeOrganizationMember,
} from "@/services/organizations.service";
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
          const [members, inviteData] = await Promise.all([
            getOrganizationMembers(orgWithRole.id).catch(() => [] as OrganizationMember[]),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
              .from("organization_invitations")
              .select("id, email, role, created_at, expires_at")
              .eq("organization_id", orgWithRole.id)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .then(({ data }: { data: unknown[] | null }) => data ?? []),
          ]);

          const pendingInvites: PendingInvite[] = (inviteData as Array<{
            id: string;
            email: string;
            role: string;
            created_at: string;
            expires_at: string;
          }>).map((inv) => ({
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

      // 4. For each workspace, fetch all members + pending invites
      const wsResults = await Promise.all(
        (wsMemberships ?? []).map(async (wm) => {
          const ws = wm.workspace as { id: string; name: string; organization_id: string } | null;
          if (!ws) return null;

          // Fetch workspace members
          const { data: memberships, error: memberError } = await supabase
            .from("workspace_memberships")
            .select("id, user_id, role, created_at")
            .eq("workspace_id", ws.id);

          if (memberError) {
            logger.warn("Failed to fetch workspace members", memberError);
            return null;
          }

          // Fetch profiles for members
          const userIds = (memberships ?? []).map((m) => m.user_id);
          const profileMap = new Map<string, { email: string; display_name: string; avatar_url: string | null }>();

          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from("user_profiles")
              .select("id, email, display_name, avatar_url")
              .in("id", userIds);

            for (const p of profiles ?? []) {
              profileMap.set(p.id, {
                email: p.email ?? "",
                display_name: p.display_name ?? "",
                avatar_url: p.avatar_url ?? null,
              });
            }
          }

          const members: WorkspaceMember[] = (memberships ?? []).map((m) => {
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

          // Fetch pending workspace invitations
          const { data: wsInvites } = await supabase
            .from("workspace_invitations")
            .select("id, email, role, created_at, expires_at")
            .eq("workspace_id", ws.id)
            .eq("status", "pending");

          const pendingInvites: PendingInvite[] = (wsInvites ?? []).map((inv) => ({
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
            members,
            pendingInvites,
          } satisfies WorkspaceWithMembers;
        })
      );

      setWorkspacesWithMembers(wsResults.filter(Boolean) as WorkspaceWithMembers[]);
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

  const handleRemoveOrgMember = async (membershipId: string, _orgId: string) => {
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

  const handleUpdateOrgMemberRole = async (membershipId: string, newRole: OrganizationRole) => {
    try {
      await updateOrganizationMemberRole(membershipId, newRole);
      toast.success("Role updated");
      await loadData();
    } catch (error) {
      logger.error("Error updating member role", error);
      toast.error("Failed to update role");
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("organization_invitations")
        .update({ status: "revoked" })
        .eq("id", inviteId);
      if (error) throw error;
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

  // Collect all pending invites across orgs + workspaces
  const allPendingInvites: PendingInvite[] = [
    ...orgsWithMembers.flatMap((o) => o.pendingInvites),
    ...workspacesWithMembers.flatMap((w) => w.pendingInvites),
  ];

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
                        ? () => handleRemoveOrgMember(member.id, org.id)
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

      {/* ── All pending invites summary (if any) ─────────────────── */}
      {allPendingInvites.length > 0 && (
        <>
          <Separator />
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <RiUserAddLine className="h-4 w-4 text-muted-foreground" />
              <div>
                <h2 className="font-semibold text-foreground">All Pending Invitations</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {allPendingInvites.length} outstanding invitation{allPendingInvites.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="border border-dashed border-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border">
                {allPendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <RiMailLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {invite.type === "org" ? "Organization" : "Workspace"}: {invite.contextName}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-4 flex-shrink-0 text-xs">
                      {invite.type === "org" ? "Org Invite" : "Workspace Invite"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
