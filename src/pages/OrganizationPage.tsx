import { useState, useEffect } from 'react';
import {
  RiBuilding4Line,
  RiDashboardLine,
  RiStackLine,
  RiGroupLine,
  RiSettings3Line,
  RiDeleteBinLine,
} from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { OrganizationCategoryPane } from '@/components/panes/OrganizationCategoryPane';
import type { OrganizationCategoryId } from '@/components/panes/OrganizationCategoryPane';
import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceManagement } from '@/components/settings/WorkspaceManagement';
import { MembersOverviewDashboard } from '@/components/people/MembersOverviewDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePanelStore } from '@/stores/panelStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useDeleteOrganization } from '@/hooks/useOrganizationMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import DeleteOrganizationDialog from '@/components/dialogs/DeleteOrganizationDialog';

export default function OrganizationPage() {
  const [selectedCategory, setSelectedCategory] = useState<OrganizationCategoryId | null>('overview');
  const { closePanel } = usePanelStore();
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
      return <OverviewContent />;
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
          onSelectWorkspace={() => {}}
        />
      );
    }

    if (selectedCategory === 'settings') {
      return <SettingsContent />;
    }

    return null;
  }

  function OverviewContent() {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <PageHeader
          title="Overview"
          subtitle="Organization details"
          icon={RiDashboardLine}
        />
        <div className="px-6 py-4 space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium text-foreground">{activeOrganization?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <Badge variant={isPersonalOrg ? 'secondary' : 'default'}>
                  {isPersonalOrg ? 'Personal' : 'Business'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm text-foreground tabular-nums">
                  {activeOrganization?.created_at
                    ? new Date(activeOrganization.created_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Members</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {activeOrganization?.member_count ?? 1}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Workspaces</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {workspaces?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge variant="outline">
                  {orgRole?.replace('organization_', '').replace('_', ' ') || 'member'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function SettingsContent() {
    const [orgName, setOrgName] = useState(activeOrganization?.name || '');
    const [isSaving, setIsSaving] = useState(false);
    const [deletingOrg, setDeletingOrg] = useState(false);
    const queryClient = useQueryClient();

    const isDirty = orgName !== (activeOrganization?.name || '');
    const isOwner = orgRole === 'organization_owner';

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
          title="Settings"
          subtitle="Organization configuration"
          icon={RiSettings3Line}
        />
        <div className="px-6 py-4 space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Name</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organization name"
                disabled={!canManage}
                maxLength={50}
              />
              {canManage && (
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  size="sm"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
              )}
            </CardContent>
          </Card>

          {isOwner && !isPersonalOrg && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Permanently delete this organization and all its workspaces. This action cannot be undone.
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
