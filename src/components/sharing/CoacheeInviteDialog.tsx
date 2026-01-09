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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCoachRelationships } from "@/hooks/useCoachRelationships";
import { getSafeUser } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import {
  RiUserHeartLine,
  RiFileCopyLine,
  RiCloseLine,
  RiLinkM,
  RiDeleteBinLine,
  RiTimeLine,
  RiCheckLine,
  RiUserAddLine,
  RiPauseLine,
  RiPlayLine,
} from "@remixicon/react";
import type { CoachRelationshipWithUsers, RelationshipStatus } from "@/types/sharing";

interface CoacheeInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoacheeInviteDialog({
  open,
  onOpenChange,
}: CoacheeInviteDialogProps) {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Get current user ID on mount
  useEffect(() => {
    async function loadUser() {
      const { user } = await getSafeUser();
      setUserId(user?.id);
    }
    if (open) {
      loadUser();
      // Reset state when dialog opens
      setGeneratedInviteUrl(null);
      setCopiedInvite(false);
    }
  }, [open]);

  const {
    asCoach,
    isLoading,
    inviteCoachee,
    updateStatus,
    endRelationship,
    isInviting,
    isUpdating,
  } = useCoachRelationships({
    userId,
    enabled: open && !!userId,
  });

  // Filter to show coachees by status
  const activeCoachees = asCoach.filter((rel) => rel.status === "active");
  const pendingInvites = asCoach.filter((rel) => rel.status === "pending");
  const pausedCoachees = asCoach.filter((rel) => rel.status === "paused");

  // Handle generating a new invite link
  const handleGenerateInvite = async () => {
    try {
      const result = await inviteCoachee();
      setGeneratedInviteUrl(result.invite_url);

      // Automatically copy to clipboard
      await navigator.clipboard.writeText(result.invite_url);
      setCopiedInvite(true);
      toast.success("Invite link created and copied to clipboard");

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate invite";
      toast.error(message);
    }
  };

  // Handle copying the invite link
  const handleCopyInvite = async () => {
    if (!generatedInviteUrl) return;

    try {
      await navigator.clipboard.writeText(generatedInviteUrl);
      setCopiedInvite(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // Handle pausing/resuming a relationship
  const handleTogglePause = async (relationship: CoachRelationshipWithUsers) => {
    try {
      const newStatus: RelationshipStatus = relationship.status === "paused" ? "active" : "paused";
      await updateStatus(relationship.id, newStatus);
      toast.success(newStatus === "paused" ? "Coachee access paused" : "Coachee access resumed");
    } catch {
      toast.error("Failed to update relationship");
    }
  };

  // Handle ending a relationship
  const handleEndRelationship = async (relationshipId: string) => {
    try {
      await endRelationship(relationshipId);
      toast.success("Coachee relationship ended");
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

  // Render a coachee relationship card
  const renderCoacheeCard = (relationship: CoachRelationshipWithUsers) => {
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
            <RiUserHeartLine className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {relationship.coachee_email || "Pending invite"}
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
            <RiUserHeartLine className="h-5 w-5" />
            Invite a Coachee
          </DialogTitle>
          <DialogDescription>
            Generate an invite link to share with someone you want to coach.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generate Invite Link Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generate Invite Link</Label>
            <div className="space-y-2">
              {generatedInviteUrl ? (
                <div className="space-y-2">
                  <div className={cn(
                    "flex items-center gap-2 p-3 rounded-md border bg-muted/30",
                    "transition-colors"
                  )}>
                    <RiLinkM className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono truncate flex-1">
                      {generatedInviteUrl}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyInvite}
                      className="h-8 w-8 p-0 shrink-0"
                      title="Copy link"
                    >
                      {copiedInvite ? (
                        <RiCheckLine className="h-4 w-4 text-green-500" />
                      ) : (
                        <RiFileCopyLine className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleGenerateInvite}
                    disabled={isInviting}
                    className="w-full"
                  >
                    {isInviting ? (
                      "Generating..."
                    ) : (
                      <>
                        <RiLinkM className="h-4 w-4 mr-2" />
                        GENERATE NEW LINK
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateInvite}
                  disabled={isInviting}
                  className="w-full"
                >
                  {isInviting ? (
                    "Generating..."
                  ) : (
                    <>
                      <RiUserAddLine className="h-4 w-4 mr-2" />
                      GENERATE INVITE LINK
                    </>
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with someone who wants you as their coach. Link expires in 30 days.
            </p>
          </div>

          {/* Existing Coachees Section */}
          {isLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              Loading your coachees...
            </div>
          ) : (
            <>
              {/* Active Coachees */}
              {activeCoachees.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Your Coachees ({activeCoachees.length})
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activeCoachees.map(renderCoacheeCard)}
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
                    {pendingInvites.map(renderCoacheeCard)}
                  </div>
                </div>
              )}

              {/* Paused Coachees */}
              {pausedCoachees.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-500">
                    Paused ({pausedCoachees.length})
                  </Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pausedCoachees.map(renderCoacheeCard)}
                  </div>
                </div>
              )}

              {/* No coachees message */}
              {activeCoachees.length === 0 && pendingInvites.length === 0 && pausedCoachees.length === 0 && (
                <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
                  <RiUserHeartLine className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  No coachees yet. Generate an invite link above to get started.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Coachees control which calls they share with you.
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

export default CoacheeInviteDialog;
