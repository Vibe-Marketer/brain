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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCoachRelationships } from "@/hooks/useCoachRelationships";
import { getSafeUser } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import {
  RiUserStarLine,
  RiMailLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiTimeLine,
  RiCheckLine,
  RiUserAddLine,
  RiPauseLine,
  RiPlayLine,
} from "@remixicon/react";
import type { CoachRelationshipWithUsers, RelationshipStatus } from "@/types/sharing";

interface CoachInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoachInviteDialog({
  open,
  onOpenChange,
}: CoachInviteDialogProps) {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [coachEmail, setCoachEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

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
    asCoachee,
    isLoading,
    inviteCoach,
    updateStatus,
    endRelationship,
    isInviting,
    isUpdating,
  } = useCoachRelationships({
    userId,
    enabled: open && !!userId,
  });

  // Filter to show coaches by status
  const activeCoaches = asCoachee.filter((rel) => rel.status === "active");
  const pendingInvites = asCoachee.filter((rel) => rel.status === "pending");
  const pausedCoaches = asCoachee.filter((rel) => rel.status === "paused");

  // Handle inviting a coach
  const handleInviteCoach = async () => {
    if (!coachEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await inviteCoach(coachEmail.trim(), inviteMessage.trim() || undefined);
      toast.success("Coach invitation sent");
      setCoachEmail("");
      setInviteMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(message);
    }
  };

  // Handle pausing/resuming a relationship
  const handleTogglePause = async (relationship: CoachRelationshipWithUsers) => {
    try {
      const newStatus: RelationshipStatus = relationship.status === "paused" ? "active" : "paused";
      await updateStatus(relationship.id, newStatus);
      toast.success(newStatus === "paused" ? "Coach access paused" : "Coach access resumed");
    } catch {
      toast.error("Failed to update relationship");
    }
  };

  // Handle ending a relationship
  const handleEndRelationship = async (relationshipId: string) => {
    try {
      await endRelationship(relationshipId);
      toast.success("Coach relationship ended");
    } catch {
      toast.error("Failed to end relationship");
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
  const getStatusBadge = (status: RelationshipStatus): { text: string; className: string } => {
    switch (status) {
      case "active":
        return { text: "Active", className: "bg-green-100 text-green-700" };
      case "pending":
        return { text: "Pending", className: "bg-yellow-100 text-yellow-700" };
      case "paused":
        return { text: "Paused", className: "bg-gray-100 text-gray-700" };
      case "revoked":
        return { text: "Ended", className: "bg-red-100 text-red-700" };
      default:
        return { text: status, className: "bg-gray-100 text-gray-700" };
    }
  };

  // Render a coach relationship card
  const renderCoachCard = (relationship: CoachRelationshipWithUsers) => {
    const statusBadge = getStatusBadge(relationship.status);
    const isActive = relationship.status === "active";
    const isPaused = relationship.status === "paused";
    const isPending = relationship.status === "pending";

    return (
      <div
        key={relationship.id}
        className={cn(
          "flex items-center justify-between gap-2 p-3 rounded-md border bg-muted/30",
          "transition-colors hover:bg-muted/50"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <RiUserStarLine className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {relationship.coach_email || "Unknown Coach"}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge.className)}>
              {statusBadge.text}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RiTimeLine className="h-3 w-3" />
              {isPending ? "Invited" : "Since"} {formatDate(relationship.created_at)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Pause/Resume button (only for active or paused) */}
          {(isActive || isPaused) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTogglePause(relationship)}
              disabled={isUpdating}
              className="h-8 w-8 p-0"
              title={isPaused ? "Resume access" : "Pause access"}
            >
              {isPaused ? (
                <RiPlayLine className="h-4 w-4 text-green-500" />
              ) : (
                <RiPauseLine className="h-4 w-4 text-yellow-500" />
              )}
            </Button>
          )}
          {/* End relationship button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEndRelationship(relationship.id)}
            disabled={isUpdating}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="End relationship"
          >
            <RiDeleteBinLine className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiUserStarLine className="h-5 w-5" />
            Invite a Coach
          </DialogTitle>
          <DialogDescription>
            Invite someone to be your coach. They&apos;ll have access to calls you share with them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite New Coach Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Send Invite</Label>
            <div className="space-y-2">
              <div className="relative">
                <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Coach's email address"
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                  className="pl-9"
                  disabled={isInviting}
                />
              </div>
              <Textarea
                placeholder="Add a personal message (optional)"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="resize-none"
                rows={2}
                disabled={isInviting}
              />
              <Button
                onClick={handleInviteCoach}
                disabled={isInviting || !coachEmail.trim()}
                className="w-full"
              >
                {isInviting ? (
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
              Once accepted, you can configure which calls your coach can view.
            </p>
          </div>

          {/* Existing Coaches Section */}
          {isLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              Loading your coaches...
            </div>
          ) : (
            <>
              {/* Active Coaches */}
              {activeCoaches.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Your Coaches ({activeCoaches.length})
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeCoaches.map(renderCoachCard)}
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
                    {pendingInvites.map(renderCoachCard)}
                  </div>
                </div>
              )}

              {/* Paused Coaches */}
              {pausedCoaches.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-500">
                    Paused ({pausedCoaches.length})
                  </Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pausedCoaches.map(renderCoachCard)}
                  </div>
                </div>
              )}

              {/* No coaches message */}
              {activeCoaches.length === 0 && pendingInvites.length === 0 && pausedCoaches.length === 0 && (
                <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
                  <RiUserStarLine className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  No coaches yet. Invite one above to get started.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Coaches only see calls you explicitly share.
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

export default CoachInviteDialog;
