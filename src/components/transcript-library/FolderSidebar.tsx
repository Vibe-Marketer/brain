import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  RiAddLine,
  RiFolderLine,
  RiFolderOpenLine,
  RiSettings3Line,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiFileTextLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Folder } from '@/hooks/useFolders';

interface FolderSidebarProps {
  folders: Folder[];
  folderCounts: Record<string, number>;
  totalCount: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onNewFolder: () => void;
  onManageFolders: () => void;
  isDragging?: boolean;
  isLoading?: boolean;
}

// Droppable folder item with drag feedback
interface DroppableFolderItemProps {
  folder: Folder;
  children: Folder[];
  folderCounts: Record<string, number>;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (folderId: string) => void;
  onToggleExpand: (folderId: string) => void;
  childrenByParent: Record<string, Folder[]>;
  isDragging: boolean;
  expandedFolders: Set<string>;
  isFocused?: boolean;
  selectableItems: Array<{ type: 'all' | 'folder'; id: string | null }>;
  focusedIndex: number;
}

const DroppableFolderItem = React.memo(function DroppableFolderItem({
  folder,
  children,
  folderCounts,
  depth,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  childrenByParent,
  isDragging,
  expandedFolders,
  isFocused = false,
  selectableItems,
  focusedIndex,
}: DroppableFolderItemProps) {
  const hasChildren = children.length > 0;
  const count = folderCounts[folder.id] || 0;

  // Set up droppable zone for this folder
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: {
      type: 'folder-zone',
      folderId: folder.id,
    },
  });

  return (
    <div>
      {/* Folder row - h-9 matches SessionItem */}
      <div
        ref={setNodeRef}
        className={cn(
          'group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer',
          'transition-colors duration-150 overflow-hidden',
          isSelected ? 'bg-cb-hover' : 'hover:bg-cb-hover/50',
          depth > 0 && 'ml-3',
          // Drag feedback
          isDragging && 'ring-1 ring-cb-border ring-inset',
          isOver && 'bg-cb-vibe-orange/10 ring-2 ring-cb-vibe-orange',
          // Keyboard focus
          isFocused && 'ring-2 ring-cb-vibe-orange ring-inset'
        )}
        onClick={() => onSelect(folder.id)}
        role="option"
        aria-selected={isSelected}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(folder.id);
            }}
            className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-cb-border/50 mr-1"
          >
            {isExpanded ? (
              <RiArrowDownSLine className="h-4 w-4 text-cb-ink-muted" />
            ) : (
              <RiArrowRightSLine className="h-4 w-4 text-cb-ink-muted" />
            )}
          </button>
        ) : (
          <div className="w-6 flex-shrink-0" />
        )}

        {/* Folder Icon */}
        {isExpanded && hasChildren ? (
          <RiFolderOpenLine
            className="h-4 w-4 flex-shrink-0 mr-2"
            style={{ color: isOver ? '#FF8800' : (folder.color || '#6B7280') }}
          />
        ) : (
          <RiFolderLine
            className="h-4 w-4 flex-shrink-0 mr-2"
            style={{ color: isOver ? '#FF8800' : (folder.color || '#6B7280') }}
          />
        )}

        {/* Folder Name - truncates with ellipsis */}
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-sm',
            isSelected ? 'text-cb-ink font-medium' : 'text-cb-ink-soft',
            isOver && 'text-cb-ink font-medium'
          )}
        >
          {folder.name}
        </span>

        {/* Count Badge */}
        {count > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
            {count}
          </Badge>
        )}
      </div>

      {/* Children - nested */}
      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          {children.sort((a, b) => a.position - b.position).map((child) => {
            const grandChildren = childrenByParent[child.id] || [];
            const childItemIndex = selectableItems.findIndex(item => item.id === child.id);
            const isChildFocused = focusedIndex === childItemIndex;

            return (
              <DroppableFolderItem
                key={child.id}
                folder={child}
                children={grandChildren}
                folderCounts={folderCounts}
                depth={depth + 1}
                isSelected={false}
                isExpanded={expandedFolders.has(child.id)}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                childrenByParent={childrenByParent}
                isDragging={isDragging}
                expandedFolders={expandedFolders}
                isFocused={isChildFocused}
                selectableItems={selectableItems}
                focusedIndex={focusedIndex}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

// Loading skeleton for folders
function FolderSidebarSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center h-9 px-2 gap-2">
          <div className="w-4 h-4 rounded bg-cb-border animate-pulse" />
          <div className="flex-1 h-4 rounded bg-cb-border animate-pulse" />
          <div className="w-6 h-4 rounded bg-cb-border animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function FolderSidebar({
  folders,
  folderCounts,
  totalCount,
  selectedFolderId,
  onSelectFolder,
  onNewFolder,
  onManageFolders,
  isDragging = false,
  isLoading = false,
}: FolderSidebarProps) {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Build folder hierarchy
  const rootFolders = React.useMemo(() =>
    folders.filter(f => !f.parent_id).sort((a, b) => a.position - b.position),
    [folders]
  );

  const childrenByParent = React.useMemo(() => {
    return folders.reduce((acc, folder) => {
      if (folder.parent_id) {
        if (!acc[folder.parent_id]) acc[folder.parent_id] = [];
        acc[folder.parent_id].push(folder);
      }
      return acc;
    }, {} as Record<string, Folder[]>);
  }, [folders]);

  // Filter folders by search query
  const filteredRootFolders = React.useMemo(() => {
    if (!searchQuery.trim()) return rootFolders;
    const query = searchQuery.toLowerCase();
    return folders.filter(f => f.name.toLowerCase().includes(query));
  }, [rootFolders, folders, searchQuery]);

  const handleToggleExpand = React.useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Create flat list of selectable items for keyboard navigation
  const selectableItems = React.useMemo(() => {
    const items: Array<{ type: 'all' | 'folder'; id: string | null }> = [
      { type: 'all', id: null },
    ];

    // Add all folders in display order (flatten tree)
    const addFolders = (foldersList: Folder[], parentId: string | null = null) => {
      const filtered = foldersList.filter(f => f.parent_id === parentId).sort((a, b) => a.position - b.position);
      filtered.forEach(folder => {
        items.push({ type: 'folder', id: folder.id });
        if (expandedFolders.has(folder.id)) {
          addFolders(foldersList, folder.id);
        }
      });
    };
    addFolders(folders);

    return items;
  }, [folders, expandedFolders]);

  // Keyboard handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, selectableItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < selectableItems.length) {
          const item = selectableItems[focusedIndex];
          onSelectFolder(item.id);
        }
        break;
      case 'ArrowRight':
        // Expand folder if collapsed
        if (focusedIndex >= 0) {
          const item = selectableItems[focusedIndex];
          if (item.type === 'folder' && item.id && !expandedFolders.has(item.id)) {
            handleToggleExpand(item.id);
          }
        }
        break;
      case 'ArrowLeft':
        // Collapse folder if expanded
        if (focusedIndex >= 0) {
          const item = selectableItems[focusedIndex];
          if (item.type === 'folder' && item.id && expandedFolders.has(item.id)) {
            handleToggleExpand(item.id);
          }
        }
        break;
    }
  }, [focusedIndex, selectableItems, onSelectFolder, expandedFolders, handleToggleExpand]);

  return (
    <div
      className="h-full flex flex-col rounded-overflow"
      data-component="FOLDER-SIDEBAR"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Folder navigation"
    >
      {/* Header - matches ChatSidebar header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h1 className="font-display text-base md:text-lg font-extrabold uppercase text-cb-ink">
          Folders
        </h1>
        <Button variant="ghost" size="icon" onClick={onNewFolder} aria-label="New folder">
          <RiAddLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Search input - only when >10 folders */}
      {folders.length > 10 && (
        <div className="px-4 pb-2">
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* Folder list - compact padding, matches ChatSidebar ScrollArea */}
      <ScrollArea className="flex-1 overflow-hidden min-w-0">
        {isLoading ? (
          <FolderSidebarSkeleton />
        ) : (
          <div className="p-2 space-y-0.5 overflow-hidden">
          {/* All Transcripts - shows ALL transcripts (primary view) */}
          <div
            className={cn(
              'group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer',
              'transition-colors duration-150 overflow-hidden',
              selectedFolderId === null ? 'bg-cb-hover' : 'hover:bg-cb-hover/50',
              focusedIndex === 0 && 'ring-2 ring-cb-vibe-orange ring-inset'
            )}
            onClick={() => onSelectFolder(null)}
            role="option"
            aria-selected={selectedFolderId === null}
          >
            <div className="w-6 flex-shrink-0" />
            <RiFileTextLine className="h-4 w-4 flex-shrink-0 mr-2 text-cb-ink-muted" />
            <span
              className={cn(
                'flex-1 min-w-0 truncate text-sm',
                selectedFolderId === null ? 'text-cb-ink font-medium' : 'text-cb-ink-soft'
              )}
            >
              All Transcripts
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
              {totalCount}
            </Badge>
          </div>

          {/* Folders section header */}
          {folders.length > 0 && (
            <div className="px-2 py-2 mt-2">
              <span className="text-[11px] text-cb-ink-muted uppercase tracking-wider">
                {isDragging ? 'Drop on a folder' : 'Folders'}
              </span>
            </div>
          )}

          {/* Folder tree */}
          {filteredRootFolders.map(folder => {
            const children = childrenByParent[folder.id] || [];
            const isExpanded = expandedFolders.has(folder.id);
            const isSelected = selectedFolderId === folder.id;

            // Calculate the flat index for this folder
            const itemIndex = selectableItems.findIndex(item => item.id === folder.id);
            const isFocused = focusedIndex === itemIndex;

            return (
              <DroppableFolderItem
                key={folder.id}
                folder={folder}
                children={children}
                folderCounts={folderCounts}
                depth={0}
                isSelected={isSelected}
                isExpanded={isExpanded}
                onSelect={onSelectFolder}
                onToggleExpand={handleToggleExpand}
                childrenByParent={childrenByParent}
                isDragging={isDragging}
                expandedFolders={expandedFolders}
                isFocused={isFocused}
                selectableItems={selectableItems}
                focusedIndex={focusedIndex}
              />
            );
          })}

          {/* Empty state - matches ChatSidebar empty state */}
          {folders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <RiFolderLine className="h-10 w-10 text-cb-ink-muted mb-3" aria-hidden="true" />
              <p className="text-sm text-cb-ink-soft mb-1">No folders yet</p>
              <p className="text-xs text-cb-ink-muted">Create a folder to organize calls</p>
            </div>
          )}
          </div>
        )}
      </ScrollArea>

      {/* Footer - Manage Folders link */}
      <div className="p-2 border-t border-cb-border">
        <button
          onClick={onManageFolders}
          className="flex items-center gap-2 w-full px-2 py-2 text-sm text-cb-ink-muted hover:text-cb-ink rounded-lg hover:bg-cb-hover/50 transition-colors"
        >
          <RiSettings3Line className="h-4 w-4" />
          Manage Folders
        </button>
      </div>
    </div>
  );
}
