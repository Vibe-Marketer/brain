import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useTeamMembers } from "@/hooks/useTeamHierarchy";
import { getSafeUser } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import {
  RiTeamLine,
  RiMailLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiTimeLine,
  RiUserAddLine,
  RiShieldUserLine,
  RiUserLine,
  RiGroupLine,
} from "@remixicon/react";
import type { TeamMembershipWithUser, TeamRole, MembershipStatus } from "@/types/sharing";

interface TeamInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}

export function TeamInviteDialog({
  open,
  onOpenChange,
  teamId,
}: TeamInviteDialogProps) {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("member");
  const [reportsToMe, setReportsToMe] = useState(false);

  // Get current user ID on mount
  useEffect(() => {
    async function loadUser() {
      const { user } = await getSafeUser();
      setUserId(user?.id);
    }
    if (open) {
      loadUser();
    }
  }, [open]);

  const {
    members,
    currentUserMembership,
    isAdmin,
    isManager,
    isLoading,
    inviteMember,
    updateMember,
    removeMember,
    isUpdating,
  } = useTeamMembers({
    teamId,
    userId,
    enabled: open && !!userId && !!teamId,
  });

  // Filter members by status
  const activeMembers = members.filter((m) => m.status === "active");
  const pendingInvites = members.filter((m) => m.status === "pending");

  // Handle inviting a team member
  const handleInviteMember = async () => {
    if (!memberEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await inviteMember({
        email: memberEmail.trim(),
        role: selectedRole,
        reports_to_me: reportsToMe && isManager,
      });
      toast.success("Team invitation sent");
      setMemberEmail("");
      setSelectedRole("member");
      setReportsToMe(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(message);
    }
  };

  // Handle updating member role
  const handleUpdateRole = async (membershipId: string, newRole: TeamRole) => {
    try {
      await updateMember(membershipId, { role: newRole });
      toast.success("Member role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  // Handle removing a member
  const handleRemoveMember = async (membershipId: string) => {
    try {
      await removeMember(membershipId);
      toast.success("Member removed from team");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove member";
      toast.error(message);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get status badge styling
  const getStatusBadge = (status: MembershipStatus): { text: string; className: string } => {
    switch (status) {
      case "active":
        return { text: "Active", className: "bg-green-100 text-green-700" };
      case "pending":
        return { text: "Pending", className: "bg-yellow-100 text-yellow-700" };
      case "removed":
        return { text: "Removed", className: "bg-red-100 text-red-700" };
      default:
        return { text: status, className: "bg-gray-100 text-gray-700" };
    }
  };

  // Get role badge styling
  const getRoleBadge = (role: TeamRole): { text: string; className: string; icon: React.ReactNode } => {
    switch (role) {
      case "admin":
        return {
          text: "Admin",
          className: "bg-purple-100 text-purple-700",
          icon: <RiShieldUserLine className="h-3 w-3" />,
        };
      case "manager":
        return {
          text: "Manager",
          className: "bg-blue-100 text-blue-700",
          icon: <RiGroupLine className="h-3 w-3" />,
        };
      case "member":
        return {
          text: "Member",
          className: "bg-gray-100 text-gray-700",
          icon: <RiUserLine className="h-3 w-3" />,
        };
      default:
        return {
          text: role,
          className: "bg-gray-100 text-gray-700",
          icon: <RiUserLine className="h-3 w-3" />,
        };
    }
  };

  // Render a team member card
  const renderMemberCard = (member: TeamMembershipWithUser) => {
    const statusBadge = getStatusBadge(member.status);
    const roleBadge = getRoleBadge(member.role);
    const isPending = member.status === "pending";
    const isCurrentUser = member.user_id === userId;
    const canModify = isAdmin && !isCurrentUser;

    return (
      <div
        key={member.id}
        className={cn(
          "flex items-center justify-between gap-2 p-3 rounded-md border bg-muted/30",
          "transition-colors hover:bg-muted/50"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <RiUserLine className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {member.user_email || "Unknown Member"}
              {isCurrentUser && " (You)"}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full flex items-center gap-1", roleBadge.className)}>
              {roleBadge.icon}
              {roleBadge.text}
            </span>
            {isPending && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge.className)}>
                {statusBadge.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RiTimeLine className="h-3 w-3" />
              {isPending ? "Invited" : "Joined"} {formatDate(member.joined_at || member.created_at)}
            </span>
            {member.manager_name && (
              <span className="text-xs text-muted-foreground">
                Reports to: {member.manager_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Role selector (only for admins) */}
          {canModify && (
            <Select
              value={member.role}
              onValueChange={(value) => handleUpdateRole(member.id, value as TeamRole)}
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          )}
          {/* Remove member button (only for admins, not self) */}
          {canModify && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveMember(member.id)}
              disabled={isUpdating}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remove member"
            >
              <RiDeleteBinLine className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Check if user can invite members
  const canInvite = isAdmin || isManager;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiTeamLine className="h-5 w-5" />
            Invite Team Members
          </DialogTitle>
          <DialogDescription>
            Invite colleagues to join your team. Managers can see their direct reports&apos; calls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite New Member Section */}
          {canInvite ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Send Invite</Label>
              <div className="space-y-2">
                <div className="relative">
                  <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Team member's email address"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="pl-9"
                    disabled={isUpdating}
                  />
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => setSelectedRole(value as TeamRole)}
                    disabled={isUpdating || !isAdmin}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  {isManager && (
                    <div className="flex items-center space-x-2 flex-1">
                      <Checkbox
                        id="reports-to-me"
                        checked={reportsToMe}
                        onCheckedChange={(checked) => setReportsToMe(checked === true)}
                        disabled={isUpdating}
                      />
                      <label
                        htmlFor="reports-to-me"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Reports to me
                      </label>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleInviteMember}
                  disabled={isUpdating || !memberEmail.trim()}
                  className="w-full"
                >
                  {isUpdating ? (
                    "Sending..."
                  ) : (
                    <>
                      <RiUserAddLine className="h-4 w-4 mr-2" />
                      SEND INVITE
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "As an admin, you can invite members with any role."
                  : "As a manager, you can invite members to report to you."}
              </p>
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
              <RiShieldUserLine className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Only admins and managers can invite new team members.
            </div>
          )}

          {/* Existing Members Section */}
          {isLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              Loading team members...
            </div>
          ) : (
            <>
              {/* Active Members */}
              {activeMembers.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Team Members ({activeMembers.length})
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeMembers.map(renderMemberCard)}
                  </div>
                </div>
              )}

              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-yellow-600">
                    Pending Invites ({pendingInvites.length})
                  </Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pendingInvites.map(renderMemberCard)}
                  </div>
                </div>
              )}

              {/* No members message */}
              {activeMembers.length === 0 && pendingInvites.length === 0 && (
                <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
                  <RiTeamLine className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  No team members yet. Invite someone above to get started.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {currentUserMembership
              ? `Your role: ${currentUserMembership.role}`
              : "Loading..."}
          </p>
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            <RiCloseLine className="h-4 w-4 mr-2" />
            CLOSE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TeamInviteDialog;
