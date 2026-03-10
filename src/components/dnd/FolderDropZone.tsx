import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { Folder } from '@/types/workspace'

interface FolderDropZoneProps {
  /** The folder this drop zone represents. id is used as the droppable id. */
  folder: Folder
  children: React.ReactNode
  className?: string
}

/**
 * FolderDropZone — Drop target component for sidebar folders.
 */
export function FolderDropZone({ folder, children, className }: FolderDropZoneProps) {
  return (
    <FolderDropZoneInner folder={folder} className={className}>
      {children}
    </FolderDropZoneInner>
  )
}

function FolderDropZoneInner({ folder, children, className }: FolderDropZoneProps) {
  let isOver = false
  let setNodeRef: ((node: HTMLElement | null) => void) | undefined

  try {
    // useDroppable throws if called outside DndContext
    const droppable = useDroppable({
      id: `folder-${folder.id}`,
      data: { folder },
    })
    isOver = droppable.isOver
    setNodeRef = droppable.setNodeRef
  } catch {
    // No DndContext available — render as plain wrapper
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
      aria-label={`Folder: ${folder.name}`}
      aria-dropeffect="move"
      className={cn(
        'rounded-lg transition-colors duration-150',
        isOver && 'bg-vibe-orange/10 ring-1 ring-vibe-orange/40',
        className
      )}
    >
      {children}
    </div>
  )
}
