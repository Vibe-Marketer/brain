import { DndContext } from '@dnd-kit/core';
import { RiRouteLine } from '@remixicon/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/page-header';
import WorkspaceSidebarPane from '@/components/panes/WorkspaceSidebarPane';
import { RoutingRulesTab } from '@/components/import/RoutingRulesTab';
import { useWorkspaceReorder } from '@/hooks/useWorkspaceReorder';

export default function RoutingRulesPage() {
  // WorkspaceSidebarPane's SortableContext requires an ancestor DndContext.
  // This page has no recording-row drags, so the only handler we need is the
  // workspace reorder one.
  const { sensors, handleWorkspaceReorderDragEnd } = useWorkspaceReorder();

  return (
    <DndContext sensors={sensors} onDragEnd={handleWorkspaceReorderDragEnd}>
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
    </DndContext>
  );
}
