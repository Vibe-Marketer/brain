import { useState } from "react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

export function useDragAndDrop() {
  const [activeDragId, setActiveDragId] = useState<string | number | null>(null);
  const [draggedItems, setDraggedItems] = useState<(string | number)[]>([]);

  const handleDragStart = (event: DragStartEvent, selectedIds: (string | number)[]) => {
    const rawId = event.active.id;
    const draggedId = typeof rawId === 'string' ? rawId : Number(rawId);
    setActiveDragId(draggedId);
    
    // If dragging a selected item, drag all selected items
    if (selectedIds.includes(draggedId)) {
      setDraggedItems(selectedIds);
    } else {
      setDraggedItems([draggedId]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setDraggedItems([]);
    return event;
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setDraggedItems([]);
  };

  return {
    activeDragId,
    draggedItems,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
