import { useState, useMemo } from "react";
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
  RiLoader2Line,
  RiGroupLine,
  RiUserLine,
  RiAdminLine,
  RiUserStarLine,
  RiMoreLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiMailLine,
  RiDeleteBinLine,
  RiUserSettingsLine,
  RiOrganizationChart,
  RiTimeLine,
} from "@remixicon/react";
import type {
  OrgChart,
  OrgChartNode,
  TeamMembershipWithUser,
  TeamRole,
} from "@/types/sharing";

// ============================================================================
// Types
// ============================================================================

interface OrgChartViewProps {
  /** The org chart data to display */
  orgChart: OrgChart | null;
  /** Whether the data is loading */
  isLoading?: boolean;
  /** Current user's membership ID (to highlight) */
  currentMembershipId?: string;
  /** Whether current user is an admin */
  isAdmin?: boolean;
  /** Called when user wants to change someone's role */
  onChangeRole?: (membershipId: string, newRole: TeamRole) => void;
  /** Called when user wants to set/change a member's manager */
  onSetManager?: (membershipId: string) => void;
  /** Called when user wants to remove a member */
  onRemoveMember?: (membershipId: string) => void;
  /** Whether actions are being processed */
  isUpdating?: boolean;
  /** Additional className */
  className?: string;
}

interface OrgChartNodeComponentProps {
  node: OrgChartNode;
  depth: number;
  currentMembershipId?: string;
  isAdmin?: boolean;
  onChangeRole?: (membershipId: string, newRole: TeamRole) => void;
  onSetManager?: (membershipId: string) => void;
  onRemoveMember?: (membershipId: string) => void;
  isUpdating?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get role badge styling based on team role
 */
function getRoleBadge(role: TeamRole): { text: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (role) {
    case "admin":
      return { text: "Admin", variant: "destructive" };
    case "manager":
      return { text: "Manager", variant: "default" };
    case "member":
      return { text: "Member", variant: "secondary" };
    default:
      return { text: role, variant: "outline" };
  }
}

/**
 * Get role icon component
 */
function getRoleIcon(role: TeamRole) {
  switch (role) {
    case "admin":
      return RiAdminLine;
    case "manager":
      return RiUserStarLine;
    default:
      return RiUserLine;
  }
}

/**
 * Get initials from email
 */
function getInitials(email?: string | null, name?: string | null): string {
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

// ============================================================================
// OrgChartNode Component (recursive)
// ============================================================================

function OrgChartNodeComponent({
  node,
  depth,
  currentMembershipId,
  isAdmin,
  onChangeRole,
  onSetManager,
  onRemoveMember,
  isUpdating,
}: OrgChartNodeComponentProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { membership } = node;
  const hasChildren = node.children.length > 0;
  const isCurrentUser = membership.id === currentMembershipId;

  const roleBadge = getRoleBadge(membership.role);
  const RoleIcon = getRoleIcon(membership.role);
  const initials = getInitials(membership.user_email, membership.user_name);
  const displayName = membership.user_name || membership.user_email || "Unknown";
  const showEmail = membership.user_email && membership.user_name && membership.user_email !== membership.user_name;

  const hasActions = isAdmin && (onChangeRole || onSetManager || onRemoveMember);
  const canModify = isAdmin && !isCurrentUser; // Admins can't modify themselves

  return (
    <div className="relative">
      {/* Node content */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card",
          "transition-colors hover:bg-muted/50",
          isCurrentUser && "ring-2 ring-primary/30 bg-primary/5"
        )}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={!hasChildren}
          className={cn(
            "shrink-0 h-6 w-6 flex items-center justify-center rounded transition-colors",
            hasChildren ? "hover:bg-muted cursor-pointer" : "cursor-default opacity-50"
          )}
        >
          {hasChildren ? (
            isExpanded ? (
              <RiArrowDownSLine className="h-4 w-4" />
            ) : (
              <RiArrowRightSLine className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </button>

        {/* Avatar */}
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-medium shrink-0",
            "h-10 w-10 text-sm",
            membership.role === "admin"
              ? "bg-destructive/10 text-destructive"
              : membership.role === "manager"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <RoleIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">
              {displayName}
            </span>
            {isCurrentUser && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                You
              </Badge>
            )}
            <Badge variant={roleBadge.variant} className="shrink-0">
              {roleBadge.text}
            </Badge>
            {membership.onboarding_complete === false && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                <RiTimeLine className="h-3 w-3" />
                Pending setup
              </span>
            )}
          </div>

          {/* Secondary info */}
          <div className="flex items-center gap-3 mt-1">
            {showEmail && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <RiMailLine className="h-3 w-3 shrink-0" />
                {membership.user_email}
              </span>
            )}
            {hasChildren && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <RiGroupLine className="h-3 w-3" />
                {node.children.length} direct report{node.children.length !== 1 ? "s" : ""}
              </span>
            )}
            {membership.manager_name && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                Reports to: {membership.manager_name}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {hasActions && canModify && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isUpdating}
                className="shrink-0 h-8 w-8 p-0"
              >
                <RiMoreLine className="h-5 w-5" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onSetManager && (
                <DropdownMenuItem onClick={() => onSetManager(membership.id)}>
                  <RiOrganizationChart className="h-4 w-4 mr-2" />
                  Set Manager
                </DropdownMenuItem>
              )}

              {onChangeRole && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onChangeRole(membership.id, "admin")}
                    disabled={membership.role === "admin"}
                  >
                    <RiAdminLine className="h-4 w-4 mr-2" />
                    Make Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChangeRole(membership.id, "manager")}
                    disabled={membership.role === "manager"}
                  >
                    <RiUserStarLine className="h-4 w-4 mr-2" />
                    Make Manager
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChangeRole(membership.id, "member")}
                    disabled={membership.role === "member"}
                  >
                    <RiUserLine className="h-4 w-4 mr-2" />
                    Make Member
                  </DropdownMenuItem>
                </>
              )}

              {onRemoveMember && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRemoveMember(membership.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <RiDeleteBinLine className="h-4 w-4 mr-2" />
                    Remove from Team
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children (nested) */}
      {hasChildren && isExpanded && (
        <div className="ml-6 pl-6 mt-2 space-y-2 relative">
          {/* Vertical connector line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

          {node.children.map((childNode, index) => (
            <div key={childNode.membership.id} className="relative">
              {/* Horizontal connector line */}
              <div className="absolute left-[-24px] top-6 w-6 h-px bg-border" />

              <OrgChartNodeComponent
                node={childNode}
                depth={depth + 1}
                currentMembershipId={currentMembershipId}
                isAdmin={isAdmin}
                onChangeRole={onChangeRole}
                onSetManager={onSetManager}
                onRemoveMember={onRemoveMember}
                isUpdating={isUpdating}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// OrgChartView Component
// ============================================================================

/**
 * OrgChartView displays a hierarchical organization chart for a team
 *
 * Features:
 * - Tree visualization of reporting structure
 * - Expand/collapse nodes
 * - Role badges (admin, manager, member)
 * - Direct report counts
 * - Admin actions (change role, set manager, remove)
 * - Highlights current user
 */
export function OrgChartView({
  orgChart,
  isLoading = false,
  currentMembershipId,
  isAdmin = false,
  onChangeRole,
  onSetManager,
  onRemoveMember,
  isUpdating = false,
  className,
}: OrgChartViewProps) {
  // Count members by role
  const roleStats = useMemo(() => {
    if (!orgChart) return { admins: 0, managers: 0, members: 0 };

    const countRoles = (nodes: OrgChartNode[]): { admins: number; managers: number; members: number } => {
      let admins = 0;
      let managers = 0;
      let members = 0;

      nodes.forEach(node => {
        switch (node.membership.role) {
          case "admin":
            admins++;
            break;
          case "manager":
            managers++;
            break;
          case "member":
            members++;
            break;
        }
        const childStats = countRoles(node.children);
        admins += childStats.admins;
        managers += childStats.managers;
        members += childStats.members;
      });

      return { admins, managers, members };
    };

    return countRoles(orgChart.root_nodes);
  }, [orgChart]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgChart || orgChart.root_nodes.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <RiOrganizationChart className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No team members found</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {orgChart.team.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orgChart.total_members} member{orgChart.total_members !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {roleStats.admins > 0 && (
            <Badge variant="destructive" className="text-xs">
              {roleStats.admins} Admin{roleStats.admins !== 1 ? "s" : ""}
            </Badge>
          )}
          {roleStats.managers > 0 && (
            <Badge variant="default" className="text-xs">
              {roleStats.managers} Manager{roleStats.managers !== 1 ? "s" : ""}
            </Badge>
          )}
          {roleStats.members > 0 && (
            <Badge variant="secondary" className="text-xs">
              {roleStats.members} Member{roleStats.members !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Org chart tree */}
      <div className="space-y-3">
        {orgChart.root_nodes.map(node => (
          <OrgChartNodeComponent
            key={node.membership.id}
            node={node}
            depth={0}
            currentMembershipId={currentMembershipId}
            isAdmin={isAdmin}
            onChangeRole={onChangeRole}
            onSetManager={onSetManager}
            onRemoveMember={onRemoveMember}
            isUpdating={isUpdating}
          />
        ))}
      </div>
    </div>
  );
}

export default OrgChartView;
