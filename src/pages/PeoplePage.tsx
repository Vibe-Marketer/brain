/**
 * PeoplePage - Unified People management page
 *
 * Merges contacts, members, and pending invites into one view.
 * Uses AppShell with PeopleCategoryPane as Pane 2.
 *
 * @pattern page-component
 */

import { useState, useEffect } from 'react';
import {
  RiContactsLine,
} from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { PeopleCategoryPane } from '@/components/panes/PeopleCategoryPane';
import type { PeopleCategoryId } from '@/components/panes/PeopleCategoryPane';
import { PageHeader } from '@/components/ui/page-header';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { MembersContent } from '@/components/people/MembersContent';
import { MembersOverviewDashboard } from '@/components/people/MembersOverviewDashboard';
import { PendingInvitesContent } from '@/components/people/PendingInvitesContent';
import { usePanelStore } from '@/stores/panelStore';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';

export default function PeoplePage() {
  const [selectedCategory, setSelectedCategory] = useState<PeopleCategoryId | null>('contacts');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedContactFolderId, setSelectedContactFolderId] = useState<string | null>(null);
  const { closePanel } = usePanelStore();
  const { activeOrgId } = useOrganizationContext();
  const { workspaces } = useWorkspaces(activeOrgId);

  // Close Pane 4 when switching categories
  useEffect(() => {
    closePanel();
  }, [selectedCategory, closePanel]);

  // Find workspace name for display
  const selectedWorkspace = (workspaces || []).find((ws) => ws.id === selectedWorkspaceId);

  function renderContent() {
    if (!selectedCategory) {
      return (
        <div className="flex flex-col h-full overflow-y-auto">
          <PageHeader
            title="People"
            subtitle="Manage contacts, members, and invitations"
            icon={RiContactsLine}
          />
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a category from the sidebar
          </div>
        </div>
      );
    }

    if (selectedCategory === 'contacts') {
      return (
        <div className="flex flex-col h-full">
          <PageHeader
            title="Contacts"
            subtitle="Manage your contacts"
            icon={RiContactsLine}
          />
          <div className="flex-1 min-h-0">
            <ContactsTable />
          </div>
        </div>
      );
    }

    if (selectedCategory === 'members') {
      if (!selectedWorkspaceId) {
        return (
          <MembersOverviewDashboard
            onSelectWorkspace={setSelectedWorkspaceId}
          />
        );
      }
      return (
        <MembersContent
          workspaceId={selectedWorkspaceId}
          workspaceName={selectedWorkspace?.name}
          organizationId={activeOrgId}
        />
      );
    }

    if (selectedCategory === 'pending-invites') {
      return <PendingInvitesContent />;
    }

    return null;
  }

  return (
    <AppShell
      config={{
        secondaryPane: (
          <PeopleCategoryPane
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelectWorkspace={setSelectedWorkspaceId}
            selectedContactFolderId={selectedContactFolderId}
            onSelectContactFolder={setSelectedContactFolderId}
          />
        ),
        secondaryPaneTitle: "People",
        showDetailPane: true,
      }}
    >
      {renderContent()}
    </AppShell>
  );
}
