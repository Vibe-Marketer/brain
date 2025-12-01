import { useDroppable } from "@dnd-kit/core";
import { RiFolderOpenLine, RiFolderReduceLine, RiFolderAddLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface DragDropZonesProps {
  tags: Array<{ id: string; name: string }>;
  isDragging: boolean;
  onDrop: (tagId: string) => void;
  onUntag: () => void;
  onCreateNew: () => void;
}

export function DragDropZones({ tags, isDragging, onUntag, onCreateNew }: DragDropZonesProps) {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-y-0 left-0 right-0 pointer-events-none z-40">
      {/* Left side zones */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 space-y-3 pointer-events-auto">
        {/* Untag zone - always at top left */}
        <UntagZone onDrop={onUntag} />

        {/* Create New zone - right below untag */}
        <CreateNewZone onDrop={onCreateNew} />

        {/* Regular tags */}
        {tags.map((tag) => (
          <DropZone key={tag.id} tag={tag} side="left" />
        ))}
      </div>
    </div>
  );
}

function UntagZone({ onDrop }: { onDrop: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop-zone-untag",
    data: {
      type: "untag-zone",
    },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onDrop}
      className={cn(
        "px-4 py-3 rounded-xl backdrop-blur-xl border-2 border-border transition-all duration-300",
        "min-w-[180px] flex items-center gap-3 cursor-pointer",
        "animate-in fade-in slide-in-from-bottom-4",
        isOver
          ? "bg-destructive/10"
          : "bg-background/80 hover:bg-destructive/10"
      )}
    >
      <div className="p-2 rounded-lg bg-muted transition-colors">
        <RiFolderReduceLine className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          Remove Folder
        </p>
        <p className="text-xs text-muted-foreground">Drop to untag</p>
      </div>
    </div>
  );
}

function CreateNewZone({ onDrop }: { onDrop: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop-zone-create-new",
    data: {
      type: "create-new-zone",
    },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onDrop}
      className={cn(
        "px-4 py-3 rounded-xl backdrop-blur-xl border-2 border-border transition-all duration-300",
        "min-w-[180px] flex items-center gap-3 cursor-pointer",
        "animate-in fade-in slide-in-from-bottom-4",
        isOver
          ? "bg-muted/50"
          : "bg-background/80 hover:bg-muted/50"
      )}
    >
      <div className="p-2 rounded-lg bg-muted transition-colors">
        <RiFolderAddLine className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          Create New
        </p>
        <p className="text-xs text-muted-foreground">Drop to create folder</p>
      </div>
    </div>
  );
}

function DropZone({ tag, side: _side }: { tag: { id: string; name: string }; side: "left" | "right" }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${tag.id}`,
    data: {
      type: "tag-zone",
      tagId: tag.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "px-4 py-3 rounded-xl backdrop-blur-xl border-2 border-border transition-all duration-300",
        "min-w-[180px] flex items-center gap-3",
        "animate-in fade-in slide-in-from-bottom-4",
        isOver
          ? "bg-primary/10"
          : "bg-background/80 hover:bg-primary/10"
      )}
    >
      <div className="p-2 rounded-lg bg-muted transition-colors">
        <RiFolderOpenLine className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {tag.name}
        </p>
        <p className="text-xs text-muted-foreground">Drop to tag</p>
      </div>
    </div>
  );
}
