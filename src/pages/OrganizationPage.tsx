import { useState, useEffect } from 'react';
import {
  RiBuilding4Line,
  RiDashboardLine,
  RiStackLine,
  RiDeleteBinLine,
  RiAlertLine,
  RiLockLine,
} from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { OrganizationCategoryPane } from '@/components/panes/OrganizationCategoryPane';
import type { OrganizationCategoryId } from '@/components/panes/OrganizationCategoryPane';
import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceManagement } from '@/components/settings/WorkspaceManagement';
import { MembersOverviewDashboard } from '@/components/people/MembersOverviewDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePanelStore } from '@/stores/panelStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import DeleteOrganizationDialog from '@/components/dialogs/DeleteOrganizationDialog';
import type { OrganizationRole, OrganizationWithMembership, WorkspaceWithMembership } from '@/types/workspace';

interface OverviewContentProps {
  activeOrgId: string;
  activeOrganization: OrganizationWithMembership | null;
  orgRole: OrganizationRole | null;
  isPersonalOrg: boolean;
  workspaces: WorkspaceWithMembership[];
  canManage: boolean;
}

function OverviewContent({
  activeOrgId,
  activeOrganization,
  orgRole,
  isPersonalOrg,
  workspaces,
  canManage,
}: OverviewContentProps) {
  const [orgName, setOrgName] = useState(activeOrganization?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const queryClient = useQueryClient();

  const isDirty = orgName !== (activeOrganization?.name || '');
  const isOwner = orgRole === 'organization_owner';

  // Sync local state when org changes
  useEffect(() => {
    setOrgName(activeOrganization?.name || '');
  }, [activeOrganization?.name]);

  async function handleSave() {
    if (!isDirty || !activeOrgId) return;
    const trimmed = orgName.trim();
    if (trimmed.length < 3 || trimmed.length > 50) {
      toast.error('Organization name must be between 3 and 50 characters');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: trimmed })
        .eq('id', activeOrgId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['orgContext'] });
      toast.success('Organization name updated');
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Overview"
        subtitle="Organization details and settings"
        icon={RiDashboardLine}
      />
      <div className="px-6 py-4 space-y-6 max-w-2xl">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization Name</label>
              {canManage ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && isDirty && handleSave()}
                      placeholder="Organization name"
                      maxLength={50}
                      className="flex-1"
                    />
                    {isDirty && (
                      <Button onClick={handleSave} disabled={isSaving} size="sm">
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    )}
                  </div>
                  {orgName === 'Personal' && (activeOrganization?.member_count ?? 1) > 1 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-vibe-orange/5 border border-vibe-orange/20">
                      <RiAlertLine className="h-4 w-4 text-vibe-orange shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Your organization is still named "Personal." Consider renaming it so members see a clear, recognizable name when they switch between organizations.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Input
                    value={orgName}
                    disabled
                    className="flex-1"
                  />
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/60 border border-border">
                    <RiLockLine className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      The organization name is set by the owner and applies to all members. Contact your organization admin to request a change.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</span>
                <div className="mt-1">
                  <Badge variant={isPersonalOrg ? 'secondary' : 'default'}>
                    {isPersonalOrg ? 'Personal' : 'Business'}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Role</span>
                <div className="mt-1">
                  <Badge variant="outline">
                    {orgRole?.replace('organization_', '').replace('_', ' ') || 'member'}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Members</span>
                <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
                  {activeOrganization?.member_count ?? 1}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workspaces</span>
                <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
                  {workspaces?.length ?? 0}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</span>
                <p className="mt-1 text-sm text-foreground tabular-nums">
                  {activeOrganization?.created_at
                    ? new Date(activeOrganization.created_at).toLocaleDateString()
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isOwner && !isPersonalOrg && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete this organization and all its workspaces. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeletingOrg(true)}
              >
                <RiDeleteBinLine className="h-4 w-4 mr-1.5" />
                Delete Organization
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {activeOrganization && (
        <DeleteOrganizationDialog
          open={deletingOrg}
          onOpenChange={setDeletingOrg}
          organization={activeOrganization}
        />
      )}
    </div>
  );
}

export default function OrganizationPage() {
  const [selectedCategory, setSelectedCategory] = useState<OrganizationCategoryId | null>('overview');
  const { closePanel, openPanel } = usePanelStore();
  const {
    activeOrgId,
    activeOrganization,
    orgRole,
    isPersonalOrg,
    workspaces,
  } = useOrganizationContext();

  useEffect(() => {
    closePanel();
  }, [selectedCategory, closePanel]);

  const canManage = orgRole === 'organization_owner' || orgRole === 'organization_admin';

  function renderContent() {
    if (!selectedCategory) {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Organization"
            subtitle="Manage your organization"
            icon={RiBuilding4Line}
          />
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a category from the sidebar
          </div>
        </div>
      );
    }

    if (selectedCategory === 'overview') {
      return (
        <OverviewContent
          activeOrgId={activeOrgId}
          activeOrganization={activeOrganization}
          orgRole={orgRole}
          isPersonalOrg={isPersonalOrg}
          workspaces={workspaces}
          canManage={canManage}
        />
      );
    }

    if (selectedCategory === 'workspaces') {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="Workspaces"
            subtitle="Manage workspaces in this organization"
            icon={RiStackLine}
          />
          <div className="px-6 py-4">
            <WorkspaceManagement orgId={activeOrgId} canManage={canManage} />
          </div>
        </div>
      );
    }

    if (selectedCategory === 'members') {
      return (
        <MembersOverviewDashboard
          onSelectWorkspace={(workspaceId) => {
            const workspace = workspaces.find((ws) => ws.id === workspaceId);
            openPanel('workspace_members', {
              type: 'workspace_members',
              workspaceId,
              workspaceName: workspace?.name,
            });
          }}
        />
      );
    }

    return null;
  }

  return (
    <AppShell
      config={{
        secondaryPane: (
          <OrganizationCategoryPane
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        ),
        secondaryPaneTitle: "Organization",
        showDetailPane: true,
      }}
    >
      {renderContent()}
    </AppShell>
  );
}
