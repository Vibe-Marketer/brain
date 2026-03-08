import { RiRouteLine } from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/page-header';
import WorkspaceSidebarPane from '@/components/panes/WorkspaceSidebarPane';
import { RoutingRulesTab } from '@/components/import/RoutingRulesTab';

export default function RoutingRulesPage() {
  return (
    <AppShell
      config={{
        secondaryPane: <WorkspaceSidebarPane />,
        showDetailPane: true,
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader
          title="Routing Rules"
          subtitle="Automatically organize and route your incoming calls"
          icon={RiRouteLine}
        />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <RoutingRulesTab />
        </div>
      </div>
    </AppShell>
  );
}
