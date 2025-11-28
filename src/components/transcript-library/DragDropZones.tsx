import { useDroppable } from "@dnd-kit/core";
import { RiFolderOpenLine, RiFolderReduceLine, RiFolderAddLine } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface DragDropZonesProps {
  categories: Array<{ id: string; name: string }>;
  isDragging: boolean;
  onDrop: (categoryId: string) => void;
  onUncategorize: () => void;
  onCreateNew: () => void;
}

export function DragDropZones({ categories, isDragging, onUncategorize, onCreateNew }: DragDropZonesProps) {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-y-0 left-0 right-0 pointer-events-none z-40">
      {/* Left side zones */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 space-y-3 pointer-events-auto">
        {/* Uncategorize zone - always at top left */}
        <UncategorizeZone onDrop={onUncategorize} />
        
        {/* Create New zone - right below uncategorize */}
        <CreateNewZone onDrop={onCreateNew} />
        
        {/* Regular categories */}
        {categories.map((category) => (
          <DropZone key={category.id} category={category} side="left" />
        ))}
      </div>
    </div>
  );
}

function UncategorizeZone({ onDrop }: { onDrop: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop-zone-uncategorize",
    data: {
      type: "uncategorize-zone",
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
        <p className="text-xs text-muted-foreground">Drop to uncategorize</p>
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

function DropZone({ category, side: _side }: { category: { id: string; name: string }; side: "left" | "right" }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${category.id}`,
    data: {
      type: "category-zone",
      categoryId: category.id,
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
          {category.name}
        </p>
        <p className="text-xs text-muted-foreground">Drop to categorize</p>
      </div>
    </div>
  );
}
