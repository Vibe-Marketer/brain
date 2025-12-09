import { useState } from "react";
import { RiFolderLine, RiFolderAddLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterButton } from "./FilterButton";
import { cn } from "@/lib/utils";
import type { Folder } from "@/hooks/useFolders";

interface FolderFilterPopoverProps {
  selectedFolders: string[] | undefined;
  folders: Folder[];
  onFoldersChange: (folderIds: string[]) => void;
  onCreateFolder?: () => void;
  folderCounts?: Record<string, number>;
}

export function FolderFilterPopover({
  selectedFolders = [],
  folders,
  onFoldersChange,
  onCreateFolder,
  folderCounts = {},
}: FolderFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  type FolderWithChildren = Folder & { children: FolderWithChildren[] };

  // Build folder tree structure
  const buildFolderTree = (): FolderWithChildren[] => {
    const folderMap = new Map<string, FolderWithChildren>();
    const rootFolders: FolderWithChildren[] = [];

    // Initialize all folders with children array
    folders.forEach((folder) => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build tree structure
    folders.forEach((folder) => {
      const folderWithChildren = folderMap.get(folder.id)!;
      if (folder.parent_id === null) {
        rootFolders.push(folderWithChildren);
      } else {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(folderWithChildren);
        }
      }
    });

    // Sort by position
    const sortFolders = (folderList: FolderWithChildren[]) => {
      folderList.sort((a, b) => a.position - b.position);
      folderList.forEach((folder) => {
        if (folder.children.length > 0) {
          sortFolders(folder.children);
        }
      });
    };

    sortFolders(rootFolders);
    return rootFolders;
  };

  // Filter folders by search query
  const filterFolders = (folderTree: FolderWithChildren[]): FolderWithChildren[] => {
    if (!searchQuery.trim()) return folderTree;

    const query = searchQuery.toLowerCase();
    return folderTree
      .map((folder) => {
        const matchesSearch = folder.name.toLowerCase().includes(query);
        const filteredChildren = filterFolders(folder.children);

        if (matchesSearch || filteredChildren.length > 0) {
          return { ...folder, children: filteredChildren };
        }
        return null;
      })
      .filter((folder): folder is FolderWithChildren => folder !== null);
  };

  const folderTree = filterFolders(buildFolderTree());

  const handleToggle = (folderId: string, checked: boolean) => {
    if (checked) {
      onFoldersChange([...selectedFolders, folderId]);
    } else {
      onFoldersChange(selectedFolders.filter((id) => id !== folderId));
    }
  };

  const handleToggleUnorganized = (checked: boolean) => {
    if (checked) {
      onFoldersChange([...selectedFolders, "unorganized"]);
    } else {
      onFoldersChange(selectedFolders.filter((id) => id !== "unorganized"));
    }
  };

  const handleClear = () => {
    onFoldersChange([]);
    setIsOpen(false);
  };

  const handleApply = () => {
    setIsOpen(false);
  };

  // Render folder item with proper indentation
  const renderFolderItem = (folder: FolderWithChildren, depth = 0) => {
    const isSelected = selectedFolders.includes(folder.id);
    const indentClass = depth === 0 ? "" : depth === 1 ? "ml-4" : "ml-8";
    const callCount = folderCounts[folder.id];

    return (
      <div key={folder.id}>
        <div className={cn("flex items-center gap-2 py-1", indentClass)}>
          <Checkbox
            id={`folder-${folder.id}`}
            checked={isSelected}
            onCheckedChange={(checked) => handleToggle(folder.id, !!checked)}
          />
          <label
            htmlFor={`folder-${folder.id}`}
            className="text-sm cursor-pointer flex-1 flex items-center gap-2"
          >
            {folder.color && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: folder.color }}
              />
            )}
            <span className="truncate">{folder.name}</span>
            {callCount !== undefined && callCount > 0 && (
              <span className="text-xs text-muted-foreground">({callCount})</span>
            )}
          </label>
        </div>
        {folder.children.length > 0 && (
          <div className="space-y-1">
            {folder.children.map((child: FolderWithChildren) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={<RiFolderLine className="h-3.5 w-3.5" />}
          label="Folder"
          count={selectedFolders.length}
          active={selectedFolders.length > 0}
        />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white dark:bg-card" align="start">
        <div className="space-y-0">
          <div className="p-4 pb-3">
            <div className="text-sm font-medium">Select Folders</div>
          </div>

          {/* Search input */}
          {folders.length > 5 && (
            <div className="px-4 pb-3">
              <Input
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Folder list */}
          <div className="max-h-[300px] overflow-y-auto px-4 pb-2">
            {folderTree.length === 0 && !searchQuery && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No folders yet
              </div>
            )}
            {folderTree.length === 0 && searchQuery && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No folders match your search
              </div>
            )}
            <div className="space-y-1">
              {folderTree.map((folder) => renderFolderItem(folder))}
            </div>

            {/* Unorganized option */}
            {folderTree.length > 0 && (
              <>
                <div className="border-t my-2" />
                <div className="flex items-center gap-2 py-1">
                  <Checkbox
                    id="folder-unorganized"
                    checked={selectedFolders.includes("unorganized")}
                    onCheckedChange={(checked) => handleToggleUnorganized(!!checked)}
                  />
                  <label
                    htmlFor="folder-unorganized"
                    className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                  >
                    <span className="text-muted-foreground italic">Unorganized</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-between items-center gap-2 p-3 border-t">
            {onCreateFolder && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  onCreateFolder();
                }}
                className="text-sm gap-1 px-0"
              >
                <RiFolderAddLine className="h-3.5 w-3.5" />
                Add Folder
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="hollow" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
