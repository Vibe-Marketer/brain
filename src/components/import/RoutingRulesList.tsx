/**
 * RoutingRulesList — Drag-to-reorder container for RoutingRuleCard components.
 */

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { RoutingRuleCard } from './RoutingRuleCard';
import type { RoutingRule } from '@/types/routing';

interface RoutingRulesListProps {
  rules: RoutingRule[];
  onReorder: (orderedIds: string[]) => void;
  onEdit: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  workspaceNames?: Record<string, string>;
  folderNames?: Record<string, string>;
}

export function RoutingRulesList({
  rules,
  onReorder,
  onEdit,
  onToggle,
  workspaceNames,
  folderNames,
}: RoutingRulesListProps) {
  const [items, setItems] = useState<RoutingRule[]>(rules);

  useEffect(() => {
    setItems(rules);
  }, [rules]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    onReorder(newItems.map((item) => item.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.map((rule) => (
            <RoutingRuleCard
              key={rule.id}
              rule={rule}
              workspaceName={workspaceNames?.[rule.target_workspace_id]}
              folderName={rule.target_folder_id ? folderNames?.[rule.target_folder_id] : undefined}
              onEdit={onEdit}
              onToggle={onToggle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
