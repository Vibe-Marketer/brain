import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RiLinkM,
  RiTeamLine,
  RiUserLine,
  RiShareLine,
} from "@remixicon/react";
import type { SharingStatus, AccessLevel } from "@/types/sharing";

interface SharedWithIndicatorProps {
  /** Detailed sharing status for showing what's shared */
  sharingStatus?: SharingStatus;
  /** Access level for showing how user got access */
  accessLevel?: AccessLevel;
  /** Compact mode shows only icons without text */
  compact?: boolean;
  /** Additional className for styling */
  className?: string;
}

/**
 * SharedWithIndicator displays badges indicating the sharing status of a call.
 * It can show:
 * - Link badge: when the call has active share links
 * - Team badge: when visible to team members or managers
 * - Access indicator: when viewing as non-owner, shows how access was granted
 */
export function SharedWithIndicator({
  sharingStatus,
  accessLevel,
  compact = false,
  className,
}: SharedWithIndicatorProps) {
  // If nothing to show, return null
  const hasSharing = sharingStatus && (
    sharingStatus.hasShareLinks ||
    sharingStatus.visibleToTeam ||
    sharingStatus.visibleToManager
  );

  const hasAccessLevel = accessLevel && accessLevel !== "owner";

  if (!hasSharing && !hasAccessLevel) {
    return null;
  }

  // Render access level badge (for non-owners viewing shared content)
  if (hasAccessLevel && accessLevel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("inline-flex items-center", className)}>
              <AccessLevelBadge accessLevel={accessLevel} compact={compact} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getAccessLevelTooltip(accessLevel)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Render sharing status badges (for owners viewing their shared content)
  if (hasSharing && sharingStatus) {
    return (
      <TooltipProvider>
        <div className={cn("inline-flex items-center gap-1", className)}>
          {/* Share Links Badge */}
          {sharingStatus.hasShareLinks && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-default"
                >
                  <RiLinkM className="h-3 w-3" />
                  {!compact && (
                    <span>
                      {sharingStatus.shareLinkCount}
                    </span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {sharingStatus.shareLinkCount === 1
                    ? "1 active share link"
                    : `${sharingStatus.shareLinkCount} active share links`}
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Team/Manager Badge */}
          {(sharingStatus.visibleToTeam || sharingStatus.visibleToManager) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-default"
                >
                  <RiTeamLine className="h-3 w-3" />
                  {!compact && (
                    <span>Team</span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {sharingStatus.visibleToManager && !sharingStatus.visibleToTeam
                    ? "Visible to your manager"
                    : "Visible to team members"}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return null;
}

/**
 * Helper component to render access level badges
 */
function AccessLevelBadge({
  accessLevel,
  compact,
}: {
  accessLevel: AccessLevel;
  compact: boolean;
}) {
  const config = getAccessLevelConfig(accessLevel);

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 cursor-default",
        config.className
      )}
    >
      {config.icon}
      {!compact && <span>{config.label}</span>}
    </Badge>
  );
}

/**
 * Get configuration for each access level
 */
function getAccessLevelConfig(accessLevel: AccessLevel): {
  icon: React.ReactNode;
  label: string;
  className: string;
} {
  switch (accessLevel) {
    case "shared_link":
      return {
        icon: <RiLinkM className="h-3 w-3" />,
        label: "Shared",
        className: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300",
      };
    case "manager":
      return {
        icon: <RiUserLine className="h-3 w-3" />,
        label: "Manager View",
        className: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300",
      };
    case "peer":
      return {
        icon: <RiTeamLine className="h-3 w-3" />,
        label: "Team Shared",
        className: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300",
      };
    case "owner":
    default:
      return {
        icon: <RiShareLine className="h-3 w-3" />,
        label: "Owner",
        className: "",
      };
  }
}

/**
 * Get tooltip text for access level
 */
function getAccessLevelTooltip(accessLevel: AccessLevel): string {
  switch (accessLevel) {
    case "shared_link":
      return "You have access via a share link";
    case "manager":
      return "You have access as the manager";
    case "peer":
      return "Shared with you by a team member";
    case "owner":
    default:
      return "You own this call";
  }
}

export default SharedWithIndicator;
