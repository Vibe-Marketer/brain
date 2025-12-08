import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  RiAddLine,
  RiFolderLine,
  RiFolderOpenLine,
  RiSettings3Line,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiInboxLine,
  RiSidebarFoldLine,
  RiSidebarUnfoldLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed?: boolean;
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
  isCollapsed = false,
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
          depth > 0 && !isCollapsed && 'ml-3',
          // Drag feedback
          isDragging && 'ring-1 ring-cb-border ring-inset',
          isOver && 'bg-cb-vibe-orange/10 ring-2 ring-cb-vibe-orange',
          isCollapsed && 'justify-center'
        )}
        onClick={() => onSelect(folder.id)}
        title={isCollapsed ? `${folder.name}${count > 0 ? ` (${count})` : ''}` : undefined}
      >
        {!isCollapsed && (
          <>
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
          </>
        )}

        {/* Folder Icon */}
        {isExpanded && hasChildren && !isCollapsed ? (
          <RiFolderOpenLine
            className={cn("h-4 w-4 flex-shrink-0", !isCollapsed && "mr-2")}
            style={{ color: isOver ? '#FF8800' : (folder.color || '#6B7280') }}
          />
        ) : (
          <RiFolderLine
            className={cn("h-4 w-4 flex-shrink-0", !isCollapsed && "mr-2")}
            style={{ color: isOver ? '#FF8800' : (folder.color || '#6B7280') }}
          />
        )}

        {!isCollapsed && (
          <>
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
          </>
        )}
      </div>

      {/* Children - nested */}
      {hasChildren && isExpanded && !isCollapsed && (
        <div className="mt-0.5">
          {children.sort((a, b) => a.position - b.position).map((child) => {
            const grandChildren = childrenByParent[child.id] || [];
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
                isCollapsed={isCollapsed}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

export function FolderSidebar({
  folders,
  folderCounts,
  totalCount,
  selectedFolderId,
  onSelectFolder,
  onNewFolder,
  onManageFolders,
  isDragging = false,
  isCollapsed = false,
  onToggleCollapse,
}: FolderSidebarProps) {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());

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

  return (
    <div
      className={cn(
        "h-full flex flex-col rounded-overflow transition-all duration-300",
        isCollapsed ? "w-[60px]" : "w-[280px]"
      )}
      data-component="FOLDER-SIDEBAR"
    >
      {/* Header - matches ChatSidebar header */}
      <div className="flex items-center justify-between">
        {!isCollapsed && (
          <h1 className="font-display text-base md:text-lg font-extrabold uppercase text-cb-ink">
            Folders
          </h1>
        )}
        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <Button variant="ghost" size="icon" onClick={onNewFolder} aria-label="New folder">
              <RiAddLine className="h-4 w-4" />
            </Button>
          )}
          {onToggleCollapse && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleCollapse} 
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden md:flex"
            >
              {isCollapsed ? (
                <RiSidebarUnfoldLine className="h-4 w-4" />
              ) : (
                <RiSidebarFoldLine className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Folder list - compact padding, matches ChatSidebar ScrollArea */}
      <ScrollArea className="flex-1 overflow-hidden min-w-0">
        <div className="p-2 space-y-0.5 overflow-hidden">
          {/* All Transcripts - always first */}
          <div
            className={cn(
              'group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer',
              'transition-colors duration-150 overflow-hidden',
              selectedFolderId === null ? 'bg-cb-hover' : 'hover:bg-cb-hover/50',
              isCollapsed && 'justify-center'
            )}
            onClick={() => onSelectFolder(null)}
            title={isCollapsed ? `All Transcripts (${totalCount})` : undefined}
          >
            {!isCollapsed && <div className="w-6 flex-shrink-0" />}
            <RiInboxLine className={cn("h-4 w-4 flex-shrink-0 text-cb-ink-muted", !isCollapsed && "mr-2")} />
            {!isCollapsed && (
              <>
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
              </>
            )}
          </div>

          {/* Folders section header */}
          {folders.length > 0 && !isCollapsed && (
            <div className="px-2 py-2 mt-2">
              <span className="text-[11px] text-cb-ink-muted uppercase tracking-wider">
                {isDragging ? 'Drop on a folder' : 'Folders'}
              </span>
            </div>
          )}

          {/* Folder tree */}
          {rootFolders.map(folder => {
            const children = childrenByParent[folder.id] || [];
            const isExpanded = expandedFolders.has(folder.id);
            const isSelected = selectedFolderId === folder.id;

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
                isCollapsed={isCollapsed}
              />
            );
          })}

          {/* Empty state - matches ChatSidebar empty state */}
          {folders.length === 0 && !isCollapsed && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <RiFolderLine className="h-10 w-10 text-cb-ink-muted mb-3" aria-hidden="true" />
              <p className="text-sm text-cb-ink-soft mb-1">No folders yet</p>
              <p className="text-xs text-cb-ink-muted">Create a folder to organize calls</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer - Manage Folders link */}
      <div className="p-2 border-t border-cb-border">
        <button
          onClick={onManageFolders}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-2 text-sm text-cb-ink-muted hover:text-cb-ink rounded-lg hover:bg-cb-hover/50 transition-colors",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Manage Folders" : undefined}
        >
          <RiSettings3Line className="h-4 w-4" />
          {!isCollapsed && "Manage Folders"}
        </button>
      </div>
    </div>
  );
}
