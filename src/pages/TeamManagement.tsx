import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiTeamLine,
  RiLoader2Line,
  RiAddLine,
  RiSettings4Line,
  RiUserAddLine,
  RiOrganizationChart,
  RiDeleteBinLine,
  RiEditLine,
  RiCloseLine,
  RiCheckLine,
  RiGroupLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  useTeamHierarchy,
  useTeamMembers,
  useOrgChart,
} from "@/hooks/useTeamHierarchy";
import { OrgChartView } from "@/components/sharing/OrgChartView";
import { TeamInviteDialog } from "@/components/sharing/TeamInviteDialog";
import { cn } from "@/lib/utils";
import type { TeamRole, TeamMembershipWithUser } from "@/types/sharing";

// ============================================================================
// Types
// ============================================================================

interface CreateTeamFormData {
  name: string;
  admin_sees_all: boolean;
  domain_auto_join: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * CreateTeamDialog - Dialog for creating a new team
 */
interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeam: (data: CreateTeamFormData) => Promise<void>;
  isCreating: boolean;
}

function CreateTeamDialog({
  open,
  onOpenChange,
  onCreateTeam,
  isCreating,
}: CreateTeamDialogProps) {
  const [formData, setFormData] = useState<CreateTeamFormData>({
    name: "",
    admin_sees_all: false,
    domain_auto_join: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Team name is required");
      return;
    }
    await onCreateTeam(formData);
    setFormData({ name: "", admin_sees_all: false, domain_auto_join: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiTeamLine className="h-5 w-5" />
            Create Team
          </DialogTitle>
          <DialogDescription>
            Create a new team to collaborate with colleagues and manage call visibility.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              placeholder="e.g., Sales Team, Customer Success"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={isCreating}
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
              checked={formData.admin_sees_all}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, admin_sees_all: checked })
              }
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain-auto-join">Auto-Join Domain (Optional)</Label>
            <Input
              id="domain-auto-join"
              placeholder="e.g., company.com"
              value={formData.domain_auto_join}
              onChange={(e) =>
                setFormData({ ...formData, domain_auto_join: e.target.value })
              }
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Users with this email domain can automatically join the team.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="hollow"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              CANCEL
            </Button>
            <Button type="submit" disabled={isCreating || !formData.name.trim()}>
              {isCreating ? (
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * TeamSettingsPanel - Panel for editing team settings
 */
interface TeamSettingsPanelProps {
  teamId: string;
  teamName: string;
  adminSeesAll: boolean;
  domainAutoJoin: string | null;
  onUpdate: (data: Partial<CreateTeamFormData>) => Promise<void>;
  onDelete: () => Promise<void>;
  isUpdating: boolean;
  isAdmin: boolean;
}

function TeamSettingsPanel({
  teamId,
  teamName,
  adminSeesAll,
  domainAutoJoin,
  onUpdate,
  onDelete,
  isUpdating,
  isAdmin,
}: TeamSettingsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState({
    name: teamName,
    admin_sees_all: adminSeesAll,
    domain_auto_join: domainAutoJoin || "",
  });

  // Reset edit data when team changes
  useEffect(() => {
    setEditData({
      name: teamName,
      admin_sees_all: adminSeesAll,
      domain_auto_join: domainAutoJoin || "",
    });
  }, [teamName, adminSeesAll, domainAutoJoin]);

  const handleSave = async () => {
    if (!editData.name.trim()) {
      toast.error("Team name is required");
      return;
    }
    try {
      await onUpdate(editData);
      setIsEditing(false);
      toast.success("Team settings updated");
    } catch {
      toast.error("Failed to update team settings");
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      toast.success("Team deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete team";
      toast.error(message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RiSettings4Line className="h-4 w-4" />
          <span className="text-sm font-medium">Team Settings</span>
        </div>
        <div className="text-sm text-muted-foreground p-4 rounded-lg border bg-muted/30 text-center">
          Only team admins can modify settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RiSettings4Line className="h-4 w-4" />
          <span className="text-sm font-medium">Team Settings</span>
        </div>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            disabled={isUpdating}
          >
            <RiEditLine className="h-4 w-4 mr-1" />
            EDIT
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="edit-team-name">Team Name</Label>
            <Input
              id="edit-team-name"
              value={editData.name}
              onChange={(e) =>
                setEditData({ ...editData, name: e.target.value })
              }
              disabled={isUpdating}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="edit-admin-sees-all" className="text-sm font-medium">
                Admin Visibility
              </Label>
              <p className="text-xs text-muted-foreground">
                Admins can see all calls
              </p>
            </div>
            <Switch
              id="edit-admin-sees-all"
              checked={editData.admin_sees_all}
              onCheckedChange={(checked) =>
                setEditData({ ...editData, admin_sees_all: checked })
              }
              disabled={isUpdating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-domain">Auto-Join Domain</Label>
            <Input
              id="edit-domain"
              placeholder="e.g., company.com"
              value={editData.domain_auto_join}
              onChange={(e) =>
                setEditData({ ...editData, domain_auto_join: e.target.value })
              }
              disabled={isUpdating}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="hollow"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setEditData({
                  name: teamName,
                  admin_sees_all: adminSeesAll,
                  domain_auto_join: domainAutoJoin || "",
                });
              }}
              disabled={isUpdating}
            >
              <RiCloseLine className="h-4 w-4 mr-1" />
              CANCEL
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isUpdating || !editData.name.trim()}
            >
              {isUpdating ? (
                <RiLoader2Line className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RiCheckLine className="h-4 w-4 mr-1" />
              )}
              SAVE
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Team Name</span>
            <span className="text-sm font-medium">{teamName}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Admin Visibility</span>
            <span className="text-sm font-medium">
              {adminSeesAll ? "All calls visible" : "Hierarchy only"}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Auto-Join Domain</span>
            <span className="text-sm font-medium">
              {domainAutoJoin || "Not set"}
            </span>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-4">
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Deleting the team will remove all memberships and sharing rules.
            This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isUpdating}
          >
            <RiDeleteBinLine className="h-4 w-4 mr-1" />
            DELETE TEAM
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the team &quot;{teamName}&quot; and remove all
              members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * SetManagerDialog - Dialog for setting a member's manager
 */
interface SetManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  memberName: string;
  members: TeamMembershipWithUser[];
  currentManagerId: string | null;
  onSetManager: (membershipId: string, managerMembershipId: string | null) => Promise<void>;
  isUpdating: boolean;
}

function SetManagerDialog({
  open,
  onOpenChange,
  membershipId,
  memberName,
  members,
  currentManagerId,
  onSetManager,
  isUpdating,
}: SetManagerDialogProps) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>(
    currentManagerId || "none"
  );

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedManagerId(currentManagerId || "none");
    }
  }, [open, currentManagerId]);

  // Filter out the member themselves and exclude members that would create circular hierarchy
  const availableManagers = members.filter(
    (m) => m.id !== membershipId && m.status === "active"
  );

  const handleSave = async () => {
    try {
      await onSetManager(
        membershipId,
        selectedManagerId === "none" ? null : selectedManagerId
      );
      toast.success("Manager updated");
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set manager";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiOrganizationChart className="h-5 w-5" />
            Set Manager
          </DialogTitle>
          <DialogDescription>
            Choose who {memberName} reports to in the team hierarchy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reports To</Label>
            <Select
              value={selectedManagerId}
              onValueChange={setSelectedManagerId}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select manager..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager (Top Level)</SelectItem>
                {availableManagers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.user_email || "Unknown"} ({m.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            CANCEL
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? (
              <>
                <RiLoader2Line className="h-4 w-4 mr-2 animate-spin" />
                SAVING...
              </>
            ) : (
              "SAVE"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // State
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSetManagerDialog, setShowSetManagerDialog] = useState(false);
  const [selectedMemberForManager, setSelectedMemberForManager] =
    useState<TeamMembershipWithUser | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "settings">("members");

  // Get user's team membership to find their team
  const [userTeamId, setUserTeamId] = useState<string | null>(null);

  // Hooks
  const {
    team,
    isLoading: teamLoading,
    createTeam,
    updateTeam,
    deleteTeam,
    isUpdating: teamUpdating,
  } = useTeamHierarchy({
    teamId: userTeamId || undefined,
    userId: user?.id,
    enabled: !!user?.id && !!userTeamId,
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
    userId: user?.id,
    enabled: !!user?.id && !!userTeamId,
  });

  const {
    orgChart,
    isLoading: orgChartLoading,
    refetch: refetchOrgChart,
  } = useOrgChart({
    teamId: userTeamId || undefined,
    enabled: !!userTeamId,
  });

  // Find user's team on mount
  useEffect(() => {
    async function findUserTeam() {
      if (!user?.id) return;

      const { supabase } = await import("@/integrations/supabase/client");

      // Check if user is a team member
      const { data: membership } = await supabase
        .from("team_memberships")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membership) {
        setUserTeamId(membership.team_id);
      } else {
        // Check if user owns a team
        const { data: ownedTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("owner_user_id", user.id)
          .maybeSingle();

        if (ownedTeam) {
          setUserTeamId(ownedTeam.id);
        }
      }
    }

    findUserTeam();
  }, [user?.id]);

  // Handle team creation
  const handleCreateTeam = useCallback(
    async (data: CreateTeamFormData) => {
      try {
        const newTeam = await createTeam({
          name: data.name,
          admin_sees_all: data.admin_sees_all,
          domain_auto_join: data.domain_auto_join || undefined,
        });
        setUserTeamId(newTeam.id);
        setShowCreateDialog(false);
        toast.success("Team created successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create team";
        toast.error(message);
      }
    },
    [createTeam]
  );

  // Handle team update
  const handleUpdateTeam = useCallback(
    async (data: Partial<CreateTeamFormData>) => {
      await updateTeam(data);
    },
    [updateTeam]
  );

  // Handle team deletion
  const handleDeleteTeam = useCallback(async () => {
    await deleteTeam();
    setUserTeamId(null);
  }, [deleteTeam]);

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
  const handleOpenSetManager = useCallback(
    (membershipId: string) => {
      const member = members.find((m) => m.id === membershipId);
      if (member) {
        setSelectedMemberForManager(member);
        setShowSetManagerDialog(true);
      }
    },
    [members]
  );

  const handleSetManager = useCallback(
    async (membershipId: string, managerMembershipId: string | null) => {
      await setManager(membershipId, managerMembershipId);
      refetchOrgChart();
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

  // Loading state
  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <RiTeamLine className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Please sign in to manage your team</p>
        <Button onClick={() => navigate("/login")}>SIGN IN</Button>
      </div>
    );
  }

  // No team - show create team UI
  if (!userTeamId && !teamLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <RiTeamLine className="h-16 w-16 text-muted-foreground opacity-50" />
        <h1 className="text-xl font-bold">Team Management</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You&apos;re not part of a team yet. Create a team to collaborate with
          colleagues and manage call visibility.
        </p>
        <Button onClick={() => setShowCreateDialog(true)}>
          <RiAddLine className="h-4 w-4 mr-2" />
          CREATE TEAM
        </Button>

        <CreateTeamDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateTeam={handleCreateTeam}
          isCreating={teamUpdating}
        />
      </div>
    );
  }

  const isLoading = teamLoading || membersLoading || orgChartLoading;

  return (
    <>
      {/* Main Layout */}
      <div className="h-full flex gap-3 overflow-hidden p-1">
        {/* Main Content */}
        <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full">
          {/* Header */}
          <div className="w-full border-b border-black dark:border-white flex-shrink-0" />
          <div className="px-4 md:px-10 pt-4 flex-shrink-0 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <RiTeamLine className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                TEAM
              </p>
            </div>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl md:text-4xl font-extrabold text-foreground uppercase tracking-wide mb-0.5">
                  {team?.name || "Team Management"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? "s" : ""}
                  {isAdmin && " • You are an admin"}
                  {!isAdmin && isManager && " • You are a manager"}
                </p>
              </div>
              {(isAdmin || isManager) && (
                <Button
                  onClick={() => setShowInviteDialog(true)}
                  className="shrink-0"
                >
                  <RiUserAddLine className="h-4 w-4 mr-2" />
                  INVITE
                </Button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1">
              <Button
                variant={activeTab === "members" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("members")}
                className="rounded-b-none"
              >
                <RiGroupLine className="h-4 w-4 mr-2" />
                MEMBERS
              </Button>
              {isAdmin && (
                <Button
                  variant={activeTab === "settings" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("settings")}
                  className="rounded-b-none"
                >
                  <RiSettings4Line className="h-4 w-4 mr-2" />
                  SETTINGS
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 md:p-10">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <RiLoader2Line className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activeTab === "members" ? (
              <OrgChartView
                orgChart={orgChart}
                isLoading={orgChartLoading}
                currentMembershipId={currentUserMembership?.id}
                isAdmin={isAdmin}
                onChangeRole={handleChangeRole}
                onSetManager={handleOpenSetManager}
                onRemoveMember={handleRemoveMember}
                isUpdating={membersUpdating}
              />
            ) : (
              team && (
                <TeamSettingsPanel
                  teamId={team.id}
                  teamName={team.name}
                  adminSeesAll={team.admin_sees_all}
                  domainAutoJoin={team.domain_auto_join || null}
                  onUpdate={handleUpdateTeam}
                  onDelete={handleDeleteTeam}
                  isUpdating={teamUpdating}
                  isAdmin={isAdmin}
                />
              )
            )}
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

      {/* Set Manager Dialog */}
      {selectedMemberForManager && (
        <SetManagerDialog
          open={showSetManagerDialog}
          onOpenChange={setShowSetManagerDialog}
          membershipId={selectedMemberForManager.id}
          memberName={selectedMemberForManager.user_email || "Member"}
          members={members}
          currentManagerId={selectedMemberForManager.manager_membership_id || null}
          onSetManager={handleSetManager}
          isUpdating={membersUpdating}
        />
      )}

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateTeam={handleCreateTeam}
        isCreating={teamUpdating}
      />
    </>
  );
}
