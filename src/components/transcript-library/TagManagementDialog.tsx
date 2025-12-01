import { RiFolderOpenLine, RiAddLine, RiPencilLine } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Tag {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  onCreateTag: () => void;
  onEditTag: (tag: Tag) => void;
  callCounts?: Record<string, number>;
}

export function TagManagementDialog({
  open,
  onOpenChange,
  tags,
  onCreateTag,
  onEditTag,
  callCounts = {},
}: TagManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Folders</DialogTitle>
          <DialogDescription>
            Create and organize your transcript folders
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* New Folder Button */}
          <Button
            onClick={onCreateTag}
            className="w-full gap-2"
          >
            <RiAddLine className="h-4 w-4" />
            New Folder
          </Button>

          {/* Tags List */}
          <ScrollArea className="flex-1 min-h-[300px] max-h-[500px] pr-4">
            {tags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RiFolderOpenLine className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No folders yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first folder to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="group flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <RiFolderOpenLine className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{tag.name}</h4>
                        {callCounts[tag.id] !== undefined && (
                          <Badge variant="secondary" className="h-5 px-2 text-xs">
                            {callCounts[tag.id]}
                          </Badge>
                        )}
                      </div>
                      {tag.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tag.description}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="hollow"
                      size="sm"
                      onClick={() => onEditTag(tag)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    >
                      <RiPencilLine className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit folder</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Backward-compatible export
export const CategoryManagementDialog = TagManagementDialog;
