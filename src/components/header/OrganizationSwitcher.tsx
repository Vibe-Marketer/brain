import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiUserLine,
  RiBuildingLine,
  RiCheckLine,
  RiArrowDownSLine,
  RiAddLine,
  RiSettingsLine,
  RiFolderLine,
  RiTeamLine,
  RiBriefcaseLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CreateOrganizationDialog } from '@/components/dialogs/CreateOrganizationDialog';
import type { OrganizationWithMembership, WorkspaceWithMembership } from '@/types/workspace';

/**
 * OrganizationSwitcher - Dropdown for switching between organizations and workspaces
 *
 * Replaces OrganizationSwitcher with the new organization/workspace architecture:
 * - Shows current organization with icon (personal vs business)
 * - Shows current workspace if selected
 * - Dropdown lists all user's organizations
 * - Workspaces section within active organization
 * - "All Recordings" option for no workspace filter
 * - "Create Organization" CTA for new orgs
 *
 * @pattern follows OrganizationSwitcher for consistency
 */
export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const {
    activeOrganization,
    activeWorkspace,
    organizations,
    workspaces,
    isLoading,
    switchOrganization,
    switchWorkspace,
    isPersonalOrg,
  } = useOrganizationContext();

  // Create Organization dialog state
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }

  // No organization selected yet (shouldn't happen with proper initialization)
  if (!activeOrganization) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-2 h-8 text-sm font-medium"
        >
          {isPersonalOrg ? (
            <>
              <RiUserLine className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Personal Organization</span>
            </>
          ) : (
            <>
              <RiBuildingLine className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {activeOrganization.name}
              </span>
            </>
          )}
          {activeWorkspace && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="hidden sm:inline max-w-[80px] truncate text-muted-foreground">
                {activeWorkspace.name}
              </span>
            </>
          )}
          <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 bg-background border-border z-50">
        {/* Personal Organization Section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Personal Organization
        </DropdownMenuLabel>
        {organizations.filter((b) => b.type === 'personal').map((org) => (
          <OrganizationMenuItem
            key={org.id}
            organization={org}
            isActive={org.id === activeOrganization.id}
            onClick={() => switchOrganization(org.id)}
          />
        ))}

        {/* Business Organizations Section */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {organizations.filter((b) => b.type === 'business').length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <div>No business organizations</div>
              <div>Create one to collaborate</div>
            </div>
          ) : (
            organizations.filter((b) => b.type === 'business').map((org) => (
              <OrganizationMenuItem
                key={org.id}
                organization={org}
                isActive={org.id === activeOrganization.id}
                onClick={() => switchOrganization(org.id)}
              />
            ))
          )}
        </DropdownMenuGroup>

        {/* Workspaces in active organization */}
        {workspaces.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Workspaces in {activeOrganization.name}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {/* Show all recordings (no workspace filter) */}
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer flex items-center justify-between',
                  !activeWorkspace && 'bg-accent'
                )}
                onClick={() => switchWorkspace(null)}
              >
                <div className="flex items-center gap-2">
                  <RiFolderLine className="h-4 w-4" />
                  <span>All Recordings</span>
                </div>
                {!activeWorkspace && (
                  <RiCheckLine className="h-4 w-4 text-vibe-orange" />
                )}
              </DropdownMenuItem>

              {workspaces.map((workspace) => (
                <WorkspaceMenuItem
                  key={workspace.id}
                  workspace={workspace}
                  isActive={workspace.id === activeWorkspace?.id}
                  onClick={() => switchWorkspace(workspace.id)}
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Create Business Organization */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center gap-2 text-muted-foreground"
          onClick={() => setCreateOrgDialogOpen(true)}
        >
          <RiAddLine className="h-4 w-4" />
          <span>Create Organization</span>
        </DropdownMenuItem>

        {/* Manage Organizations link */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center gap-2 text-muted-foreground"
          onClick={() => {
            navigate('/settings/organizations');
          }}
        >
          <RiSettingsLine className="h-4 w-4" />
          <span>Manage Organizations</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
      />
    </DropdownMenu>
  );
}

/**
 * Organization menu item with role badge
 */
function OrganizationMenuItem({
  organization,
  isActive,
  onClick,
}: {
  organization: OrganizationWithMembership;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = organization.type === 'personal' ? RiUserLine : RiBuildingLine;

  // Format role for display (remove prefix)
  const roleDisplay = organization.membership.role
    .replace('organization_', '')
    .replace('bank_', '');

  return (
    <DropdownMenuItem
      className={cn(
        'cursor-pointer flex items-center justify-between',
        isActive && 'bg-accent'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <div className="flex flex-col min-w-0">
          <span className="truncate max-w-[140px]">{organization.name}</span>
          {organization.type === 'business' && (
            <span className="text-2xs text-muted-foreground">
              {organization.member_count ?? 1} member{(organization.member_count ?? 1) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs capitalize">
          {roleDisplay}
        </Badge>
        {isActive && <RiCheckLine className="h-4 w-4 text-vibe-orange" />}
      </div>
    </DropdownMenuItem>
  );
}

/**
 * Workspace menu item with type indicator
 */
function WorkspaceMenuItem({
  workspace,
  isActive,
  onClick,
}: {
  workspace: WorkspaceWithMembership;
  isActive: boolean;
  onClick: () => void;
}) {
  // Map workspace types to icons
  const workspaceTypeIcons = {
    personal: RiUserLine,
    team: RiTeamLine,
    coach: RiUserLine,
    community: RiTeamLine,
    client: RiBriefcaseLine,
    youtube: RiFolderLine,
  };
  const Icon = (workspaceTypeIcons as any)[workspace.workspace_type] || RiFolderLine;

  return (
    <DropdownMenuItem
      className={cn(
        'cursor-pointer flex items-center justify-between pl-6',
        isActive && 'bg-accent'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="truncate max-w-[120px]">{workspace.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground capitalize">
          {workspace.workspace_type}
        </span>
        {isActive && <RiCheckLine className="h-4 w-4 text-vibe-orange" />}
      </div>
    </DropdownMenuItem>
  );
}
