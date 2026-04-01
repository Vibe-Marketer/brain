import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface WorkspaceDropZoneProps {
  /** The workspace ID this drop zone represents. */
  workspaceId: string
  children: React.ReactNode
  className?: string
}

/**
 * WorkspaceDropZone -- Drop target for sidebar workspace items.
 * When a call is dragged over, shows a visual highlight.
 * The droppable ID is prefixed with "workspace-" to distinguish from folder drops.
 */
export function WorkspaceDropZone({ workspaceId, children, className }: WorkspaceDropZoneProps) {
  return (
    <WorkspaceDropZoneInner workspaceId={workspaceId} className={className}>
      {children}
    </WorkspaceDropZoneInner>
  )
}

function WorkspaceDropZoneInner({ workspaceId, children, className }: WorkspaceDropZoneProps) {
  let isOver = false
  let setNodeRef: ((node: HTMLElement | null) => void) | undefined

  try {
    const droppable = useDroppable({
      id: `workspace-${workspaceId}`,
      data: { type: 'workspace-zone', workspaceId },
    })
    isOver = droppable.isOver
    setNodeRef = droppable.setNodeRef
  } catch {
    // No DndContext available -- render as plain wrapper
    return (
      <div className={className}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`Workspace drop target`}
      aria-dropeffect="move"
      className={cn(
        'rounded-lg transition-colors duration-150',
        isOver && 'bg-vibe-orange/10 ring-1 ring-vibe-orange/30',
        className,
      )}
    >
      {children}
    </div>
  )
}
