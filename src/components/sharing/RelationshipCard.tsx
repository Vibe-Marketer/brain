import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  RiUserStarLine,
  RiUserHeartLine,
  RiMoreLine,
  RiPlayLine,
  RiPauseLine,
  RiDeleteBinLine,
  RiSettings3Line,
  RiTimeLine,
  RiMailLine,
} from "@remixicon/react";
import type { CoachRelationshipWithUsers, RelationshipStatus } from "@/types/sharing";

export type RelationshipRole = "coach" | "coachee";

interface RelationshipCardProps {
  relationship: CoachRelationshipWithUsers;
  /** The role of the current user in this relationship */
  viewerRole: RelationshipRole;
  /** Called when user wants to configure sharing rules */
  onConfigureSharing?: (relationship: CoachRelationshipWithUsers) => void;
  /** Called when user wants to pause/resume the relationship */
  onTogglePause?: (relationship: CoachRelationshipWithUsers) => void;
  /** Called when user wants to end the relationship */
  onEndRelationship?: (relationship: CoachRelationshipWithUsers) => void;
  /** Whether actions are currently being processed */
  isUpdating?: boolean;
  /** Show compact view */
  compact?: boolean;
  className?: string;
}

/**
 * Get status badge styling based on relationship status
 */
function getStatusBadge(status: RelationshipStatus): { text: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (status) {
    case "active":
      return { text: "Active", variant: "default" };
    case "pending":
      return { text: "Pending", variant: "secondary" };
    case "paused":
      return { text: "Paused", variant: "outline" };
    case "revoked":
      return { text: "Ended", variant: "destructive" };
    default:
      return { text: status, variant: "outline" };
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get initials from name or email
 */
function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "??";
}

/**
 * RelationshipCard displays a single coach/coachee relationship with actions
 *
 * Features:
 * - Avatar with initials
 * - Name/email display
 * - Status badge (active, pending, paused, ended)
 * - Action dropdown: configure sharing, pause/resume, end relationship
 * - Compact mode for list views
 */
export function RelationshipCard({
  relationship,
  viewerRole,
  onConfigureSharing,
  onTogglePause,
  onEndRelationship,
  isUpdating = false,
  compact = false,
  className,
}: RelationshipCardProps) {
  const isActive = relationship.status === "active";
  const isPaused = relationship.status === "paused";
  const isPending = relationship.status === "pending";
  const isEnded = relationship.status === "revoked";

  // Determine which person to display (the other party)
  const displayName = viewerRole === "coach"
    ? relationship.coachee_name || relationship.coachee_email
    : relationship.coach_name || relationship.coach_email;

  const displayEmail = viewerRole === "coach"
    ? relationship.coachee_email
    : relationship.coach_email;

  const initials = getInitials(
    viewerRole === "coach" ? relationship.coachee_name : relationship.coach_name,
    displayEmail
  );

  const statusBadge = getStatusBadge(relationship.status);

  // Determine icon based on role
  const RoleIcon = viewerRole === "coach" ? RiUserHeartLine : RiUserStarLine;

  const hasActions = onConfigureSharing || onTogglePause || onEndRelationship;
  const canConfigureSharing = viewerRole === "coachee" && isActive && onConfigureSharing;
  const canTogglePause = (isActive || isPaused) && onTogglePause;
  const canEnd = !isEnded && onEndRelationship;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card",
        "transition-colors hover:bg-muted/50",
        compact && "p-2",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0",
          compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
        )}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <RoleIcon className={cn("text-muted-foreground shrink-0", compact ? "h-3 w-3" : "h-4 w-4")} />
          <span className={cn("font-medium truncate", compact ? "text-sm" : "text-base")}>
            {displayName || "Unknown"}
          </span>
          <Badge variant={statusBadge.variant} className={cn(compact && "text-[10px] px-1.5 py-0")}>
            {statusBadge.text}
          </Badge>
        </div>

        {/* Secondary info */}
        {!compact && (
          <div className="flex items-center gap-3 mt-1">
            {displayEmail && displayEmail !== displayName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <RiMailLine className="h-3 w-3 shrink-0" />
                {displayEmail}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <RiTimeLine className="h-3 w-3" />
              {isPending ? "Invited" : "Since"} {formatDate(relationship.created_at)}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {hasActions && !isEnded && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className={cn("shrink-0", compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0")}
            >
              <RiMoreLine className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canConfigureSharing && (
              <DropdownMenuItem onClick={() => onConfigureSharing(relationship)}>
                <RiSettings3Line className="h-4 w-4 mr-2" />
                Configure Sharing
              </DropdownMenuItem>
            )}

            {canTogglePause && (
              <DropdownMenuItem onClick={() => onTogglePause(relationship)}>
                {isPaused ? (
                  <>
                    <RiPlayLine className="h-4 w-4 mr-2 text-green-500" />
                    Resume Access
                  </>
                ) : (
                  <>
                    <RiPauseLine className="h-4 w-4 mr-2 text-yellow-500" />
                    Pause Access
                  </>
                )}
              </DropdownMenuItem>
            )}

            {(canConfigureSharing || canTogglePause) && canEnd && <DropdownMenuSeparator />}

            {canEnd && (
              <DropdownMenuItem
                onClick={() => onEndRelationship(relationship)}
                className="text-destructive focus:text-destructive"
              >
                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                End Relationship
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default RelationshipCard;
