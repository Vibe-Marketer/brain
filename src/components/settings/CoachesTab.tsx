import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RiLoader2Line,
  RiUserHeartLine,
  RiAddLine,
  RiLinkM,
  RiDeleteBinLine,
  RiPauseLine,
  RiPlayLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { useCoachRelationships } from "@/hooks/useCoachRelationships";
import { useAuth } from "@/hooks/useAuth";
import { CoachRelationshipWithUsers, RelationshipStatus } from "@/types/sharing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * CoachesTab - Settings tab for managing coach relationships
 *
 * Allows users to:
 * - View their coaches (people who can see their calls)
 * - View their coachees (people whose calls they can see)
 * - Invite new coaches or generate invite links for coachees
 * - Pause/resume or end relationships
 */
export default function CoachesTab() {
  const { user } = useAuth();
  const {
    relationships,
    asCoach,
    asCoachee,
    isLoading,
    inviteCoach,
    inviteCoachee,
    updateStatus,
    endRelationship,
    isInviting,
    isUpdating,
  } = useCoachRelationships({ userId: user?.id, enabled: !!user?.id });

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = useState(false);
  const [coachEmail, setCoachEmail] = useState("");
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  const handleInviteCoach = async () => {
    if (!coachEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await inviteCoach(coachEmail.trim());
      toast.success("Coach invitation sent");
      setCoachEmail("");
      setInviteDialogOpen(false);
    } catch (error) {
      toast.error("Failed to invite coach");
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      const result = await inviteCoachee();
      setGeneratedInviteLink(result.invite_url);
      setInviteLinkDialogOpen(true);
    } catch (error) {
      toast.error("Failed to generate invite link");
    }
  };

  const handleCopyInviteLink = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink);
      toast.success("Invite link copied to clipboard");
    }
  };

  const handleStatusChange = async (relationshipId: string, currentStatus: RelationshipStatus) => {
    try {
      const newStatus: RelationshipStatus = currentStatus === "active" ? "paused" : "active";
      await updateStatus(relationshipId, newStatus);
      toast.success(`Relationship ${newStatus === "paused" ? "paused" : "resumed"}`);
    } catch (error) {
      toast.error("Failed to update relationship status");
    }
  };

  const handleEndRelationship = async (relationshipId: string) => {
    try {
      await endRelationship(relationshipId);
      toast.success("Relationship ended");
    } catch (error) {
      toast.error("Failed to end relationship");
    }
  };

  const getStatusBadge = (status: RelationshipStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Top separator for breathing room */}
      <Separator className="mb-12" />

      {/* My Coaches Section (people I've given access to) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
              My Coaches
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              People who can view your calls and provide feedback
            </p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <RiAddLine className="h-4 w-4 mr-1" />
                Invite Coach
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a Coach</DialogTitle>
                <DialogDescription>
                  Enter the email address of the person you want to invite as your coach.
                  They will be able to view your shared calls.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="coach@example.com"
                  type="email"
                  value={coachEmail}
                  onChange={(e) => setCoachEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteCoach} disabled={isInviting}>
                  {isInviting && <RiLoader2Line className="h-4 w-4 mr-1 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div>
          {asCoachee.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-cb-border dark:border-cb-border-dark rounded-lg">
              <RiUserHeartLine className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No coaches yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Invite someone to be your coach and get feedback on your calls
              </p>
            </div>
          ) : (
            <RelationshipTable
              relationships={asCoachee}
              userId={user?.id || ""}
              role="coachee"
              onStatusChange={handleStatusChange}
              onEndRelationship={handleEndRelationship}
              isUpdating={isUpdating}
              getStatusBadge={getStatusBadge}
              formatDate={formatDate}
            />
          )}
        </div>
      </div>

      <Separator className="my-16" />

      {/* My Coachees Section (people whose calls I can see) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
              My Coachees
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              People who have shared their calls with you
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleGenerateInviteLink} disabled={isInviting}>
            {isInviting && <RiLoader2Line className="h-4 w-4 mr-1 animate-spin" />}
            <RiLinkM className="h-4 w-4 mr-1" />
            Generate Invite Link
          </Button>
        </div>

        <div>
          {asCoach.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-cb-border dark:border-cb-border-dark rounded-lg">
              <RiUserHeartLine className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No coachees yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Generate an invite link to let someone share their calls with you
              </p>
            </div>
          ) : (
            <RelationshipTable
              relationships={asCoach}
              userId={user?.id || ""}
              role="coach"
              onStatusChange={handleStatusChange}
              onEndRelationship={handleEndRelationship}
              isUpdating={isUpdating}
              getStatusBadge={getStatusBadge}
              formatDate={formatDate}
            />
          )}
        </div>
      </div>

      {/* Invite Link Dialog */}
      <Dialog open={inviteLinkDialogOpen} onOpenChange={setInviteLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Link Generated</DialogTitle>
            <DialogDescription>
              Share this link with someone to let them invite you as their coach.
              The link expires in 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={generatedInviteLink || ""}
                className="font-mono text-sm"
              />
              <Button variant="outline" onClick={handleCopyInviteLink}>
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteLinkDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator className="my-16" />

      {/* Information Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            About Coaching
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            How coaching relationships work
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0">Coach</Badge>
              <p>
                A coach can view calls that have been shared with them and leave private notes.
                They cannot modify or delete your calls.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0">Coachee</Badge>
              <p>
                A coachee controls which calls are shared with their coach through folder or tag-based sharing rules.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="shrink-0">Paused</Badge>
              <p>
                Pausing a relationship temporarily stops access. The coach cannot view calls until resumed.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="destructive" className="shrink-0">Ended</Badge>
              <p>
                Ending a relationship permanently removes access. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RelationshipTableProps {
  relationships: CoachRelationshipWithUsers[];
  userId: string;
  role: "coach" | "coachee";
  onStatusChange: (id: string, status: RelationshipStatus) => void;
  onEndRelationship: (id: string) => void;
  isUpdating: boolean;
  getStatusBadge: (status: RelationshipStatus) => React.ReactNode;
  formatDate: (date: string | null) => string;
}

function RelationshipTable({
  relationships,
  userId,
  role,
  onStatusChange,
  onEndRelationship,
  isUpdating,
  getStatusBadge,
  formatDate,
}: RelationshipTableProps) {
  return (
    <div className="border border-cb-border dark:border-cb-border-dark rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{role === "coachee" ? "Coach" : "Coachee"}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Since</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relationships
            .filter((r) => r.status !== "revoked")
            .map((relationship) => (
              <TableRow key={relationship.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {role === "coachee"
                        ? relationship.coach_email || "Unknown"
                        : relationship.coachee_email || "Unknown"}
                    </span>
                    {relationship.status === "pending" && (
                      <span className="text-xs text-muted-foreground">
                        Invitation pending
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(relationship.status)}</TableCell>
                <TableCell>{formatDate(relationship.accepted_at || relationship.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {relationship.status !== "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onStatusChange(relationship.id, relationship.status)}
                        disabled={isUpdating}
                        title={relationship.status === "active" ? "Pause" : "Resume"}
                      >
                        {relationship.status === "active" ? (
                          <RiPauseLine className="h-4 w-4" />
                        ) : (
                          <RiPlayLine className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEndRelationship(relationship.id)}
                      disabled={isUpdating}
                      className="text-destructive hover:text-destructive"
                      title="End relationship"
                    >
                      <RiDeleteBinLine className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
