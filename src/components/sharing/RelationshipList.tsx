import { useState } from "react";
import { RelationshipCard, RelationshipRole } from "./RelationshipCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  RiLoader2Line,
  RiUserStarLine,
  RiUserHeartLine,
  RiUserAddLine,
  RiFilterLine,
} from "@remixicon/react";
import type { CoachRelationshipWithUsers, RelationshipStatus } from "@/types/sharing";

type StatusFilter = "all" | "active" | "pending" | "paused";

interface RelationshipListProps {
  /** List of relationships to display */
  relationships: CoachRelationshipWithUsers[];
  /** The role of the current user in these relationships */
  viewerRole: RelationshipRole;
  /** Whether relationships are loading */
  isLoading?: boolean;
  /** Called when user wants to configure sharing rules */
  onConfigureSharing?: (relationship: CoachRelationshipWithUsers) => void;
  /** Called when user wants to pause/resume the relationship */
  onTogglePause?: (relationship: CoachRelationshipWithUsers) => void;
  /** Called when user wants to end the relationship */
  onEndRelationship?: (relationship: CoachRelationshipWithUsers) => void;
  /** Called when user wants to add a new relationship */
  onInvite?: () => void;
  /** Whether actions are currently being processed */
  isUpdating?: boolean;
  /** Title for the list section */
  title?: string;
  /** Description for the list section */
  description?: string;
  /** Show status filter tabs */
  showFilter?: boolean;
  /** Show grouped sections by status */
  groupByStatus?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Use compact card layout */
  compact?: boolean;
  /** Maximum height with scroll */
  maxHeight?: string;
  className?: string;
}

/**
 * RelationshipList displays a list of coach/coachee relationships
 *
 * Features:
 * - Loading state
 * - Empty state with invite CTA
 * - Filter by status (all, active, pending, paused)
 * - Group by status option
 * - Action handlers passed to individual cards
 */
export function RelationshipList({
  relationships,
  viewerRole,
  isLoading = false,
  onConfigureSharing,
  onTogglePause,
  onEndRelationship,
  onInvite,
  isUpdating = false,
  title,
  description,
  showFilter = false,
  groupByStatus = false,
  emptyMessage,
  compact = false,
  maxHeight,
  className,
}: RelationshipListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filter out revoked relationships by default
  const activeRelationships = relationships.filter(r => r.status !== "revoked");

  // Apply status filter
  const filteredRelationships = statusFilter === "all"
    ? activeRelationships
    : activeRelationships.filter(r => r.status === statusFilter);

  // Group by status if enabled
  const groupedRelationships = groupByStatus ? {
    active: filteredRelationships.filter(r => r.status === "active"),
    pending: filteredRelationships.filter(r => r.status === "pending"),
    paused: filteredRelationships.filter(r => r.status === "paused"),
  } : null;

  // Get counts for filter badges
  const counts = {
    all: activeRelationships.length,
    active: activeRelationships.filter(r => r.status === "active").length,
    pending: activeRelationships.filter(r => r.status === "pending").length,
    paused: activeRelationships.filter(r => r.status === "paused").length,
  };

  // Role-specific empty state
  const defaultEmptyMessage = viewerRole === "coach"
    ? "No coachees yet. Invite someone to get started."
    : "No coaches yet. Invite a coach to get started.";

  const RoleIcon = viewerRole === "coach" ? RiUserHeartLine : RiUserStarLine;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {title && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
        )}
        <div className="flex items-center justify-center py-8">
          <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Render a section of relationships
  const renderSection = (
    sectionRelationships: CoachRelationshipWithUsers[],
    sectionTitle?: string,
    sectionTitleClass?: string
  ) => {
    if (sectionRelationships.length === 0) return null;

    return (
      <div className="space-y-2">
        {sectionTitle && (
          <h4 className={cn("text-sm font-medium", sectionTitleClass)}>
            {sectionTitle} ({sectionRelationships.length})
          </h4>
        )}
        <div className="space-y-2">
          {sectionRelationships.map((relationship) => (
            <RelationshipCard
              key={relationship.id}
              relationship={relationship}
              viewerRole={viewerRole}
              onConfigureSharing={onConfigureSharing}
              onTogglePause={onTogglePause}
              onEndRelationship={onEndRelationship}
              isUpdating={isUpdating}
              compact={compact}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      {(title || onInvite) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
            )}
            {description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          {onInvite && (
            <Button onClick={onInvite} size="sm" variant="outline">
              <RiUserAddLine className="h-4 w-4 mr-2" />
              INVITE
            </Button>
          )}
        </div>
      )}

      {/* Filter tabs */}
      {showFilter && activeRelationships.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <RiFilterLine className="h-4 w-4 text-muted-foreground mr-1" />
          {(["all", "active", "pending", "paused"] as StatusFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={statusFilter === filter ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(filter)}
              className="h-7 px-2 text-xs capitalize"
              disabled={counts[filter] === 0 && filter !== "all"}
            >
              {filter}
              {counts[filter] > 0 && (
                <span className="ml-1 text-muted-foreground">({counts[filter]})</span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeRelationships.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-muted/20">
          <RoleIcon className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground text-center px-4">
            {emptyMessage || defaultEmptyMessage}
          </p>
          {onInvite && (
            <Button onClick={onInvite} variant="outline" size="sm" className="mt-4">
              <RiUserAddLine className="h-4 w-4 mr-2" />
              INVITE
            </Button>
          )}
        </div>
      ) : (
        /* Relationships list */
        <div
          className={cn(
            "space-y-4",
            maxHeight && "overflow-y-auto pr-1"
          )}
          style={maxHeight ? { maxHeight } : undefined}
        >
          {groupByStatus && groupedRelationships ? (
            /* Grouped view */
            <>
              {renderSection(groupedRelationships.active, "Active", "text-green-600 dark:text-green-400")}
              {groupedRelationships.active.length > 0 &&
                (groupedRelationships.pending.length > 0 || groupedRelationships.paused.length > 0) && (
                <Separator />
              )}
              {renderSection(groupedRelationships.pending, "Pending", "text-yellow-600 dark:text-yellow-400")}
              {groupedRelationships.pending.length > 0 && groupedRelationships.paused.length > 0 && (
                <Separator />
              )}
              {renderSection(groupedRelationships.paused, "Paused", "text-gray-500")}
            </>
          ) : (
            /* Flat view */
            <div className="space-y-2">
              {filteredRelationships.map((relationship) => (
                <RelationshipCard
                  key={relationship.id}
                  relationship={relationship}
                  viewerRole={viewerRole}
                  onConfigureSharing={onConfigureSharing}
                  onTogglePause={onTogglePause}
                  onEndRelationship={onEndRelationship}
                  isUpdating={isUpdating}
                  compact={compact}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RelationshipList;
