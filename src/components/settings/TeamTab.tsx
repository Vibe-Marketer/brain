import { useState, useEffect, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  RiLoader2Line,
  RiTeamLine,
  RiAddLine,
  RiUserAddLine,
  RiOrganizationChart,
  RiShieldUserLine,
  RiGroupLine,
  RiUserLine,
  RiSettings4Line,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useTeamHierarchy,
  useTeamMembers,
  useOrgChart,
} from "@/hooks/useTeamHierarchy";
import { OrgChartView } from "@/components/sharing/OrgChartView";
import { TeamInviteDialog } from "@/components/sharing/TeamInviteDialog";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import type { TeamRole, TeamMembershipWithUser } from "@/types/sharing";

interface CreateTeamFormData {
  name: string;
  admin_sees_all: boolean;
  domain_auto_join: string;
}

export default function TeamTab() {
  const { isAdmin: isUserAdmin, isTeam } = useUserRole();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [loadingTeamId, setLoadingTeamId] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateTeamFormData>({
    name: "",
    admin_sees_all: false,
    domain_auto_join: "",
  });

  // Get current user ID on mount
  useEffect(() => {
    async function loadUser() {
      const { user } = await getSafeUser();
      setUserId(user?.id);
    }
    loadUser();
  }, []);

  // Find user's team on mount
  useEffect(() => {
    async function findUserTeam() {
      if (!userId) return;

      try {
        // Check if user is a team member
        const { data: membership } = await supabase
          .from("team_memberships")
          .select("team_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (membership) {
          setUserTeamId(membership.team_id);
        } else {
          // Check if user owns a team
          const { data: ownedTeam } = await supabase
            .from("teams")
            .select("id")
            .eq("owner_user_id", userId)
            .maybeSingle();

          if (ownedTeam) {
            setUserTeamId(ownedTeam.id);
          }
        }
      } catch (error) {
        logger.error("Error finding user team", error);
      } finally {
        setLoadingTeamId(false);
      }
    }

    findUserTeam();
  }, [userId]);

  // Hooks
  const {
    team,
    isLoading: teamLoading,
    createTeam,
    updateTeam,
    isUpdating: teamUpdating,
  } = useTeamHierarchy({
    teamId: userTeamId || undefined,
    userId,
    enabled: !!userId && !!userTeamId,
  });

  const {
    members,
    currentUserMembership,
    isAdmin,
    isManager,
    isLoading: membersLoading,
    updateMember,
    setManager,
    removeMember,
    isUpdating: membersUpdating,
  } = useTeamMembers({
    teamId: userTeamId || undefined,
    userId,
    enabled: !!userId && !!userTeamId,
  });

  const {
    orgChart,
    isLoading: orgChartLoading,
    refetch: refetchOrgChart,
  } = useOrgChart({
    teamId: userTeamId || undefined,
    enabled: !!userTeamId,
  });

  // Handle team creation
  const handleCreateTeam = useCallback(async () => {
    if (!createFormData.name.trim()) {
      toast.error("Team name is required");
      return;
    }
    try {
      const newTeam = await createTeam({
        name: createFormData.name,
        admin_sees_all: createFormData.admin_sees_all,
        domain_auto_join: createFormData.domain_auto_join || undefined,
      });
      setUserTeamId(newTeam.id);
      setShowCreateForm(false);
      setCreateFormData({ name: "", admin_sees_all: false, domain_auto_join: "" });
      toast.success("Team created successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create team";
      toast.error(message);
    }
  }, [createTeam, createFormData]);

  // Handle role change
  const handleChangeRole = useCallback(
    async (membershipId: string, newRole: TeamRole) => {
      try {
        await updateMember(membershipId, { role: newRole });
        toast.success("Role updated");
        refetchOrgChart();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update role";
        toast.error(message);
      }
    },
    [updateMember, refetchOrgChart]
  );

  // Handle set manager
  const handleSetManager = useCallback(
    async (membershipId: string, managerMembershipId: string | null) => {
      try {
        await setManager(membershipId, managerMembershipId);
        toast.success("Manager updated");
        refetchOrgChart();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to set manager";
        toast.error(message);
      }
    },
    [setManager, refetchOrgChart]
  );

  // Handle remove member
  const handleRemoveMember = useCallback(
    async (membershipId: string) => {
      try {
        await removeMember(membershipId);
        toast.success("Member removed");
        refetchOrgChart();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove member";
        toast.error(message);
      }
    },
    [removeMember, refetchOrgChart]
  );

  // Get role badge styling
  const getRoleBadge = (role: TeamRole): { text: string; variant: "default" | "outline" | "destructive" } => {
    switch (role) {
      case "admin":
        return { text: "Admin", variant: "destructive" };
      case "manager":
        return { text: "Manager", variant: "default" };
      case "member":
        return { text: "Member", variant: "outline" };
      default:
        return { text: role, variant: "outline" };
    }
  };

  const isLoading = loadingTeamId || teamLoading || membersLoading || orgChartLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No team - show create team UI
  if (!userTeamId) {
    return (
      <div>
        {/* Top separator for breathing room */}
        <Separator className="mb-12" />

        {/* No Team Section */}
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
              Team Management
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              You&apos;re not part of a team yet. Create one to collaborate with colleagues.
            </p>
          </div>

          {!showCreateForm ? (
            <div className="flex flex-col items-center justify-center py-12 border border-cb-border dark:border-cb-border-dark rounded-lg">
              <RiTeamLine className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">No team found</p>
              <Button onClick={() => setShowCreateForm(true)}>
                <RiAddLine className="h-4 w-4 mr-2" />
                CREATE TEAM
              </Button>
            </div>
          ) : (
            <div className="space-y-4 p-4 border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="e.g., Sales Team, Customer Success"
                  value={createFormData.name}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, name: e.target.value })
                  }
                  disabled={teamUpdating}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="admin-sees-all" className="text-sm font-medium">
                    Admin Visibility
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Admins can see all team members&apos; calls
                  </p>
                </div>
                <Switch
                  id="admin-sees-all"
                  checked={createFormData.admin_sees_all}
                  onCheckedChange={(checked) =>
                    setCreateFormData({ ...createFormData, admin_sees_all: checked })
                  }
                  disabled={teamUpdating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain-auto-join">Auto-Join Domain (Optional)</Label>
                <Input
                  id="domain-auto-join"
                  placeholder="e.g., company.com"
                  value={createFormData.domain_auto_join}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, domain_auto_join: e.target.value })
                  }
                  disabled={teamUpdating}
                />
                <p className="text-xs text-muted-foreground">
                  Users with this email domain can automatically join the team.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="hollow"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateFormData({ name: "", admin_sees_all: false, domain_auto_join: "" });
                  }}
                  disabled={teamUpdating}
                >
                  CANCEL
                </Button>
                <Button
                  onClick={handleCreateTeam}
                  disabled={teamUpdating || !createFormData.name.trim()}
                >
                  {teamUpdating ? (
                    <>
                      <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                      CREATING...
                    </>
                  ) : (
                    <>
                      <RiAddLine className="h-4 w-4 mr-2" />
                      CREATE TEAM
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator className="my-16" />

        {/* Information Section */}
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
              About Teams
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              Information about team features and benefits
            </p>
          </div>
          <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-start gap-3">
              <RiOrganizationChart className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p>Organize members in a hierarchy with managers and direct reports</p>
            </div>
            <div className="flex items-start gap-3">
              <RiShieldUserLine className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p>Managers can view their direct reports&apos; calls automatically</p>
            </div>
            <div className="flex items-start gap-3">
              <RiGroupLine className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p>Team members can share folders and tags with specific colleagues</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* Team Overview Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
              {team?.name || "Your Team"}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              {members.length} member{members.length !== 1 ? "s" : ""}
              {isAdmin && " • You are an admin"}
              {!isAdmin && isManager && " • You are a manager"}
            </p>
          </div>
          {(isAdmin || isManager) && (
            <Button onClick={() => setShowInviteDialog(true)} size="sm">
              <RiUserAddLine className="h-4 w-4 mr-2" />
              INVITE
            </Button>
          )}
        </div>

        {/* Org Chart */}
        <div className="border border-cb-border dark:border-cb-border-dark rounded-lg p-4">
          <OrgChartView
            orgChart={orgChart}
            isLoading={orgChartLoading}
            currentMembershipId={currentUserMembership?.id}
            isAdmin={isAdmin}
            onChangeRole={handleChangeRole}
            onSetManager={handleSetManager}
            onRemoveMember={handleRemoveMember}
            isUpdating={membersUpdating}
          />
        </div>
      </div>

      <Separator className="my-16" />

      {/* Team Settings Section (Admin Only) */}
      {isAdmin && team && (
        <>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                Team Settings
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Manage team configuration and settings
              </p>
            </div>
            <div className="space-y-3 p-4 border border-cb-border dark:border-cb-border-dark rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Team Name</span>
                <span className="text-sm font-medium">{team.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Admin Visibility</span>
                <span className="text-sm font-medium">
                  {team.admin_sees_all ? "All calls visible" : "Hierarchy only"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Auto-Join Domain</span>
                <span className="text-sm font-medium">
                  {team.domain_auto_join || "Not set"}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-16" />
        </>
      )}

      {/* Role Descriptions Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            Team Roles
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Information about team roles and permissions
          </p>
        </div>
        <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-start gap-3">
            <Badge variant="destructive" className="shrink-0">Admin</Badge>
            <p>Full team management: invite members, change roles, configure settings</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="default" className="shrink-0">Manager</Badge>
            <p>Can view direct reports&apos; calls and invite members to report to them</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0">Member</Badge>
            <p>Standard team member with access to team collaboration features</p>
          </div>
        </div>
      </div>

      {/* Invite Dialog */}
      {userTeamId && (
        <TeamInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          teamId={userTeamId}
        />
      )}
    </div>
  );
}
