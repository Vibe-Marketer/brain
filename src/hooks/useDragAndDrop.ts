import { useState } from "react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

export function useDragAndDrop() {
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [draggedItems, setDraggedItems] = useState<number[]>([]);

  const handleDragStart = (event: DragStartEvent, selectedIds: number[]) => {
    const draggedId = Number(event.active.id);
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
