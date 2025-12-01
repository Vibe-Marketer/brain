import { RiFolderLine, RiArrowDownSLine, RiSettingsLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Import Folder type from DDD design specification
interface Folder {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  depth: number;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  path?: string[];
  childCount?: number;
  callCount?: number;
  children?: Folder[];
}

interface FolderNavigationDropdownProps {
  selectedFolder: string | null; // null = "All Transcripts"
  folders: Folder[];
  onFolderSelect: (folderId: string | null) => void;
  onManageFolders: () => void;
  callCounts?: Record<string, number>;
}

export function FolderNavigationDropdown({
  selectedFolder,
  folders,
  onFolderSelect,
  onManageFolders,
  callCounts = {},
}: FolderNavigationDropdownProps) {
  const currentFolder = selectedFolder
    ? findFolderById(folders, selectedFolder)
    : null;

  // Recursively find folder by ID in nested structure
  function findFolderById(folders: Folder[], id: string): Folder | null {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      if (folder.children) {
        const found = findFolderById(folder.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // Get icon component from Remix Icons based on folder.icon field
  function getFolderIcon(iconName?: string) {
    // Default to folder icon if no icon specified
    if (!iconName) return RiFolderLine;

    // Map common icon names to Remix Icon components
    // Users can specify icon names like "folder", "briefcase", "inbox", etc.
    const iconMap: Record<string, typeof RiFolderLine> = {
      folder: RiFolderLine,
      // Add more icon mappings as needed
    };

    return iconMap[iconName] || RiFolderLine;
  }

  // Render folder items recursively with nesting support
  function renderFolderItems(folders: Folder[], depth: number = 0) {
    return folders.map((folder) => {
      const FolderIcon = getFolderIcon(folder.icon);
      const isSelected = selectedFolder === folder.id;
      const count = callCounts[folder.id];

      return (
        <div key={folder.id}>
          <button
            onClick={() => onFolderSelect(folder.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
              isSelected
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-accent"
            )}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            <span className="flex items-center gap-2 truncate">
              <FolderIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{folder.name}</span>
              {folder.color && (
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                  aria-label={`Color: ${folder.color}`}
                />
              )}
            </span>
            {count !== undefined && (
              <Badge variant="secondary" className="h-5 px-2 text-xs ml-2">
                {count}
              </Badge>
            )}
          </button>

          {/* Render nested children with increased depth */}
          {folder.children && folder.children.length > 0 && (
            <div className="mt-1">
              {renderFolderItems(folder.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="hollow"
          className="gap-2 h-9 px-3 border-dashed hover:bg-accent"
        >
          <RiFolderLine className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {currentFolder?.name || "All Transcripts"}
          </span>
          <RiArrowDownSLine className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="max-h-80">
          <div className="space-y-1">
            {/* All Transcripts */}
            <button
              onClick={() => onFolderSelect(null)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                selectedFolder === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2">
                <RiFolderLine className="h-4 w-4" />
                All Transcripts
              </span>
              {callCounts["all"] !== undefined && (
                <Badge variant="secondary" className="h-5 px-2 text-xs">
                  {callCounts["all"]}
                </Badge>
              )}
            </button>

            {/* Separator */}
            {folders.length > 0 && (
              <div className="my-2 border-t" />
            )}

            {/* Folder tree with nesting */}
            {renderFolderItems(folders)}

            {/* Manage Folders Link */}
            <div className="mt-2 pt-2 border-t">
              <button
                onClick={onManageFolders}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <RiSettingsLine className="h-4 w-4" />
                Manage Folders...
              </button>
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
