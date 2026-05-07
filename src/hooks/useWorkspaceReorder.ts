import { useCallback } from 'react';
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useUpdateWorkspaceOrder } from '@/hooks/useWorkspaceMutations';

/**
 * Shared workspace-reorder DnD logic. Returns sensors + a drag-end handler
 * that ignores any drag whose `active.id` isn't a workspace UUID, so it can
 * coexist in the SAME DndContext as recording-row drags (TranscriptsNew) or
 * stand alone in pages that only show the sidebar (RoutingRulesPage).
 *
 * Returning a guard handler instead of mounting our own DndContext is
 * deliberate: the reorder droppables and the recording-drop droppables
 * (WorkspaceDropZone) MUST share one DndContext or the recording drag's
 * collision detection cannot see the workspace targets — that was the
 * Phase-25 regression that broke call-drop-onto-workspace.
 */
export function useWorkspaceReorder() {
  const { activeOrgId } = useOrganizationContext();
  const { workspaces } = useWorkspaces(activeOrgId);
  const updateWorkspaceOrder = useUpdateWorkspaceOrder();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleWorkspaceReorderDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !activeOrgId) return;

      // Guard: only handle drags whose active.id is a workspace UUID.
      // Skips recording-* drags so they fall through to the page-level handler.
      const isWorkspaceDrag = workspaces.some((w) => w.id === active.id);
      if (!isWorkspaceDrag) return;

      // over.id may be the bare workspace UUID (sortable item) or
      // "workspace-{uuid}" (the WorkspaceDropZone wrapper). Normalize.
      const overId = String(over.id).replace(/^workspace-/, '');

      const oldIdx = workspaces.findIndex((w) => w.id === active.id);
      const newIdx = workspaces.findIndex((w) => w.id === overId);
      if (oldIdx < 0 || newIdx < 0) return;

      const reordered = arrayMove(workspaces, oldIdx, newIdx);
      updateWorkspaceOrder.mutate({
        orgId: activeOrgId,
        pairs: reordered.map((w, i) => ({ workspaceId: w.id, sortOrder: i })),
      });
    },
    [activeOrgId, workspaces, updateWorkspaceOrder],
  );

  return { sensors, handleWorkspaceReorderDragEnd };
}
