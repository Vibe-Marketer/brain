import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { useBreakpointFlags } from '@/hooks/useBreakpoint'
import { useAssignToFolder } from '@/hooks/useFolderAssignment'

// ─────────────────────────────────────────────────────────────
// DraggableCallRow — wraps an individual call list item
// ─────────────────────────────────────────────────────────────

interface DraggableCallRowProps {
  /**
   * The legacy numeric recording ID (from fathom_calls / folder_assignments).
   * Used as the drag item id and passed to the folder assignment mutation.
   */
  recordingId: number
  children: React.ReactNode
  className?: string
}

/**
 * DraggableCallRow — makes a call list item draggable on desktop.
 *
 * On mobile/tablet, this wrapper renders its children
 * without drag functionality — DnD is desktop-only.
 */
export function DraggableCallRow({ recordingId, children, className }: DraggableCallRowProps) {
  const { isMobileOrTablet } = useBreakpointFlags()

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recording-${recordingId}`,
    data: { recordingId },
    disabled: isMobileOrTablet,
  })

  if (isMobileOrTablet) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        className
      )}
      aria-roledescription="draggable call"
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DragOverlayCard — lightweight preview shown while dragging
// ─────────────────────────────────────────────────────────────

interface DragOverlayCardProps {
  recordingId: number | null
}

function DragOverlayCard({ recordingId }: DragOverlayCardProps) {
  if (!recordingId) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-90 pointer-events-none">
      <div className="w-4 h-4 rounded bg-vibe-orange/20 flex-shrink-0" />
      <span className="text-sm text-foreground truncate max-w-[200px]">
        Moving call…
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DndCallProvider — DndContext wrapper for the calls list
// ─────────────────────────────────────────────────────────────

interface DndCallProviderProps {
  children: React.ReactNode
  folderNames?: Record<string, string>
}

/**
 * DndCallProvider — wraps the calls list with @dnd-kit DndContext.
 *
 * Drag-and-drop is desktop-only for call-to-folder assignment.
 * On mobile/tablet, renders children without DnD context.
 */
export function DndCallProvider({ children, folderNames = {} }: DndCallProviderProps) {
  const { isMobileOrTablet } = useBreakpointFlags()
  const assignToFolder = useAssignToFolder()

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  if (isMobileOrTablet) {
    return <>{children}</>
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)

    const { active, over } = event

    if (!over) return
    if (!String(over.id).startsWith('folder-')) return

    const activeIdStr = String(active.id)
    if (!activeIdStr.startsWith('recording-')) return

    const recordingIdStr = activeIdStr.replace('recording-', '')
    const callRecordingId = parseInt(recordingIdStr, 10)
    if (isNaN(callRecordingId)) return

    const folderId = String(over.id).replace('folder-', '')
    const folderName = folderNames[folderId]

    assignToFolder.mutate({ callRecordingId, folderId, folderName })
  }

  const activeRecordingId = activeDragId?.startsWith('recording-')
    ? parseInt(activeDragId.replace('recording-', ''), 10)
    : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeDragId ? (
          <DragOverlayCard recordingId={activeRecordingId} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
