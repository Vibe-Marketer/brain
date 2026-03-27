import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  RiAddLine,
  RiFolderLine,
  RiFolderFill,
  RiSettings3Line,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiFileTextLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiPaletteLine,
  RiEyeLine,
  RiEyeOffLine,
  RiSearchLine,
  RiCloseLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { Folder } from '@/types/folders';

// Import shared utilities from centralized location
import { getIconComponent } from "@/lib/folder-icons";
import type { AllTranscriptsSettings } from '@/hooks/useAllTranscriptsSettings';
import { useOrgContext } from '@/hooks/useOrgContext';
import { RiSafeLine, RiLockLine, RiTeamLine, RiCommunityLine, RiBriefcaseLine } from '@remixicon/react';

interface FolderSidebarProps {
  folders: Folder[];
  folderCounts: Record<string, number>;
  totalCount: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onNewFolder: () => void;
  onManageFolders: () => void;
  onEditFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  isDragging?: boolean;
  isLoading?: boolean;
  isCollapsed?: boolean;
  // Home customization
  allTranscriptsSettings?: AllTranscriptsSettings;
  onEditAllTranscripts?: () => void;
  // Hidden folders (excluded from Home view)
  hiddenFolders?: Set<string>;
  onToggleHidden?: (folderId: string) => void;
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
  onEditFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  childrenByParent: Record<string, Folder[]>;
  isDragging: boolean;
  expandedFolders: Set<string>;
  isFocused?: boolean;
  selectableItems: Array<{ type: 'all' | 'folder'; id: string | null }>;
  focusedIndex: number;
  hiddenFolders?: Set<string>;
  onToggleHidden?: (folderId: string) => void;
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
  onEditFolder,
  onDeleteFolder,
  childrenByParent,
  isDragging,
  expandedFolders,
  isFocused = false,
  selectableItems,
  focusedIndex,
  hiddenFolders,
  onToggleHidden,
}: DroppableFolderItemProps) {
  const hasChildren = children.length > 0;
  const count = folderCounts[folder.id] || 0;
  const isHidden = hiddenFolders?.has(folder.id) ?? false;

  // Set up droppable zone for this folder
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: {
      type: 'folder-zone',
      folderId: folder.id,
    },
  });

  // Get the appropriate icon for this folder
  const FolderIcon = getIconComponent(folder.icon);

  // Folder row content (shared between context menu and regular view)
  const folderRowContent = (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex items-center h-10 w-full px-2 rounded-lg cursor-pointer',
        'transition-colors duration-150 overflow-hidden',
        isSelected ? 'bg-muted' : 'hover:bg-muted/50',
        depth > 0 && 'ml-3',
        // Drag feedback
        isDragging && 'ring-1 ring-border ring-inset',
        isOver && 'bg-vibe-orange/10 ring-2 ring-vibe-orange',
        // Keyboard focus
        isFocused && 'ring-2 ring-vibe-orange ring-inset'
      )}
      onClick={() => onSelect(folder.id)}
      role="option"
      aria-selected={isSelected}
    >
      {/* Active indicator - pill shape (Loop-style) with smooth transition */}
      <div
        className={cn(
          "cv-side-indicator-pill",
          "transition-all duration-500 ease-in-out",
          isSelected ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
      {/* Expand/Collapse */}
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.id);
          }}
          className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted/50 mr-1"
        >
          {isExpanded ? (
            <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
          ) : (
            <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="w-6 flex-shrink-0" />
      )}

      {/* Folder Icon - use custom icon or emoji if set */}
      {/* Emojis and custom icons don't change on selection; default folder uses fill variant when selected */}
      {FolderIcon ? (
        <FolderIcon
          className="h-4 w-4 flex-shrink-0 mr-2"
          style={{ color: isOver ? '#FF8800' : (folder.color || '#6B7280') }}
        />
      ) : isSelected ? (
        <RiFolderFill
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
          isSelected ? 'text-foreground font-medium' : 'text-muted-foreground',
          isOver && 'text-foreground font-medium',
          isHidden && 'opacity-50 line-through'
        )}
      >
        {folder.name}
      </span>

      {/* Hide/Edit/Delete buttons - appear on hover (or always for hidden toggle) */}
      {(onToggleHidden || onEditFolder || onDeleteFolder) && (
        <div className={cn(
          "flex items-center gap-0.5 transition-opacity flex-shrink-0",
          // Show toggle immediately for hidden folders, otherwise on hover
          isHidden ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {onToggleHidden && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden(folder.id);
              }}
              className={cn(
                "h-6 w-6 flex items-center justify-center rounded transition-colors",
                isHidden
                  ? "text-vibe-orange bg-vibe-orange/10 hover:bg-vibe-orange/20"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              aria-label={isHidden ? `Show ${folder.name} in Home` : `Hide ${folder.name} from Home`}
              title={isHidden ? "Click to show in Home" : "Click to hide from Home"}
            >
              {/* When hidden: show eye (click to reveal), when visible: show eye-off (click to hide) */}
              {isHidden ? <RiEyeLine className="h-3.5 w-3.5" /> : <RiEyeOffLine className="h-3.5 w-3.5" />}
            </button>
          )}
          {onEditFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(folder);
              }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${folder.name}`}
            >
              <RiPencilLine className="h-3.5 w-3.5" />
            </button>
          )}
          {onDeleteFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder);
              }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${folder.name}`}
            >
              <RiDeleteBinLine className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Count Badge */}
      {count > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
          {count}
        </Badge>
      )}
    </div>
  );

  return (
    <div>
      {/* Folder row with context menu */}
      {(onEditFolder || onDeleteFolder) ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {folderRowContent}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {onEditFolder && (
              <ContextMenuItem
                onClick={() => onEditFolder(folder)}
                className="cursor-pointer"
              >
                <RiPencilLine className="h-4 w-4 mr-2" />
                Edit Folder
              </ContextMenuItem>
            )}
            {onEditFolder && onDeleteFolder && <ContextMenuSeparator />}
            {onDeleteFolder && (
              <ContextMenuItem
                onClick={() => onDeleteFolder(folder)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <RiDeleteBinLine className="h-4 w-4 mr-2" />
                Delete Folder
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        folderRowContent
      )}

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
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                childrenByParent={childrenByParent}
                isDragging={isDragging}
                expandedFolders={expandedFolders}
                isFocused={isChildFocused}
                selectableItems={selectableItems}
                focusedIndex={focusedIndex}
                hiddenFolders={hiddenFolders}
                onToggleHidden={onToggleHidden}
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
          <div className="w-4 h-4 rounded bg-border animate-pulse" />
          <div className="flex-1 h-4 rounded bg-border animate-pulse" />
          <div className="w-6 h-4 rounded bg-border animate-pulse" />
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
  onEditFolder,
  onDeleteFolder,
  isDragging = false,
  isLoading = false,
  isCollapsed = false,
  allTranscriptsSettings,
  onEditAllTranscripts,
  hiddenFolders,
  onToggleHidden,
}: FolderSidebarProps) {
  const { activeWorkspaceId, workspaces, activeOrg } = useOrgContext();
  const activeWorkspace = React.useMemo(() => workspaces.find(w => w.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);
  
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchVisible, setIsSearchVisible] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Toggle search visibility and auto-focus when opened
  const handleToggleSearch = React.useCallback(() => {
    setIsSearchVisible(prev => {
      const newValue = !prev;
      if (newValue) {
        // Focus input after state update (next tick)
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        // Clear search when closing
        setSearchQuery("");
      }
      return newValue;
    });
  }, []);

  // Auto-hide search when cleared and unfocused
  const handleSearchBlur = React.useCallback(() => {
    if (!searchQuery.trim()) {
      setIsSearchVisible(false);
    }
  }, [searchQuery]);

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

  // Collapsed view - icons only
  if (isCollapsed) {
    // Get Home icon info
    const allIconName = allTranscriptsSettings?.icon || 'file-text';
    const AllIconComponent = getIconComponent(allIconName);

    return (
      <TooltipProvider delayDuration={300}>
        <div
          className="h-full flex flex-col items-center py-2"
          data-component="FOLDER-SIDEBAR-COLLAPSED"
        >
          {/* Home icon */}
          <button
            type="button"
            onClick={() => onSelectFolder(null)}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg mb-1 transition-colors',
              selectedFolderId === null ? 'bg-muted' : 'hover:bg-muted/50'
            )}
            title={allTranscriptsSettings?.name || 'Home'}
          >
            {AllIconComponent ? (
              <AllIconComponent className="h-4 w-4 text-muted-foreground" />
            ) : (
              <RiFileTextLine className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Divider */}
          <div className="w-5 h-px bg-border my-1" />

          {/* Folder icons - no scroll needed with smaller icons */}
          <div className="flex-1 w-full overflow-y-auto">
            <div className="flex flex-col items-center gap-0.5 px-1">
              {filteredRootFolders.map((folder) => {
                const FolderIcon = getIconComponent(folder.icon);
                const isSelected = selectedFolderId === folder.id;
                const isHidden = hiddenFolders?.has(folder.id) ?? false;

                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onSelectFolder(folder.id)}
                    className={cn(
                      'relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
                      isSelected ? 'bg-muted' : 'hover:bg-muted/50',
                      isHidden && 'opacity-40'
                    )}
                    title={isHidden ? `${folder.name} (hidden)` : folder.name}
                  >
                    {/* Custom icons don't change on selection; default folder uses fill variant when selected */}
                    {FolderIcon ? (
                      <FolderIcon
                        className="h-4 w-4"
                        style={{ color: folder.color || '#6B7280' }}
                      />
                    ) : isSelected ? (
                      <RiFolderFill
                        className="h-4 w-4"
                        style={{ color: folder.color || '#6B7280' }}
                      />
                    ) : (
                      <RiFolderLine
                        className="h-4 w-4"
                        style={{ color: folder.color || '#6B7280' }}
                      />
                    )}
                    {/* Hidden indicator dot */}
                    {isHidden && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-vibe-orange rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col items-center gap-0.5 pt-1 mt-1">
            {/* Search toggle - only when >10 folders */}
            {folders.length > 10 && (
              <button
                type="button"
                onClick={handleToggleSearch}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-lg transition-colors",
                  isSearchVisible || searchQuery
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
                title={isSearchVisible ? "Close search" : "Search folders"}
              >
                {isSearchVisible ? (
                  <RiCloseLine className="h-4 w-4" />
                ) : (
                  <RiSearchLine className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onNewFolder}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
              title="New folder"
            >
              <RiAddLine className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={onManageFolders}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
              title="Manage folders"
            >
              <RiSettings3Line className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Expanded view - full sidebar
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="h-full flex flex-col rounded-overflow"
        data-component="FOLDER-SIDEBAR"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="listbox"
        aria-label="Folder navigation"
      >
        {/* Header - aligned with Workspace architecture */}
        <header className="flex-shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-md">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0" id="library-pane-title">
                <div className="w-9 h-9 rounded-xl bg-vibe-orange/10 flex items-center justify-center flex-shrink-0 shadow-sm border border-vibe-orange/20" aria-hidden="true">
                  <RiFolderLine className="h-5 w-5 text-vibe-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[11px] font-black text-foreground uppercase tracking-[0.15em] leading-none mb-1">Library</h2>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Search toggle button - only shown when >10 folders */}
                {folders.length > 10 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
                      isSearchVisible && "bg-muted text-foreground"
                    )}
                    onClick={handleToggleSearch}
                    aria-label={isSearchVisible ? "Close search" : "Search folders"}
                    aria-expanded={isSearchVisible}
                    title={isSearchVisible ? "Close search" : "Search folders"}
                  >
                    {isSearchVisible ? (
                      <RiCloseLine className="h-4 w-4" />
                    ) : (
                      <RiSearchLine className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all" 
                  onClick={onNewFolder} 
                  aria-label="New folder"
                  title="New Folder"
                >
                  <RiAddLine className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>

            {/* Current Workspace display */}
            <div className="p-3 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/5 shadow-sm space-y-3">
              <div className="min-w-0 px-0.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shadow-[0_0_8px]",
                    activeWorkspace?.workspace_type === 'personal' ? "bg-info-text shadow-info-text/50" : "bg-success-text shadow-success-text/50"
                  )} />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 truncate">
                    {activeOrg?.name || 'Organization'}
                  </p>
                </div>
                <div className="flex items-center gap-2 pl-0.5">
                  {activeWorkspace?.workspace_type === 'personal' ? (
                    <RiLockLine className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : activeWorkspace?.workspace_type === 'team' ? (
                    <RiTeamLine className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : activeWorkspace?.workspace_type === 'coach' ? (
                    <RiBriefcaseLine className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : activeWorkspace?.workspace_type === 'community' ? (
                    <RiCommunityLine className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <RiSafeLine className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <p className="text-sm font-display font-black uppercase tracking-wider text-foreground truncate">
                    {activeWorkspace?.name || 'Workspace'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Search input - hidden by default, toggleable via search icon */}
        {folders.length > 10 && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-500 ease-in-out",
              isSearchVisible ? "max-h-14 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="px-4 pt-3 pb-2">
              <Input
                ref={searchInputRef}
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={handleSearchBlur}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* Folder list */}
        <ScrollArea className="flex-1 overflow-hidden min-w-0">
          {isLoading ? (
            <FolderSidebarSkeleton />
          ) : (
            <div className="p-2 space-y-0.5 overflow-hidden">
            {/* Home - shows ALL transcripts (primary view) */}
            {(() => {
              // Determine icon to display for Home
              const allIconName = allTranscriptsSettings?.icon || 'file-text';
              const allName = allTranscriptsSettings?.name || 'Home';
              const AllIconComponent = getIconComponent(allIconName);

              const allTranscriptsContent = (
                <div
                  className={cn(
                    'group relative flex items-center h-10 w-full px-2 rounded-lg cursor-pointer',
                    'transition-colors duration-150 overflow-hidden',
                    selectedFolderId === null ? 'bg-muted' : 'hover:bg-muted/50',
                    focusedIndex === 0 && 'ring-2 ring-vibe-orange ring-inset'
                  )}
                  onClick={() => onSelectFolder(null)}
                  role="option"
                  aria-selected={selectedFolderId === null}
                >
                  {/* Active indicator - pill shape (Loop-style) with smooth transition */}
                  <div
                    className={cn(
                      "cv-side-indicator-pill",
                      "transition-all duration-500 ease-in-out",
                      selectedFolderId === null ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                  <div className="w-6 flex-shrink-0" />
                  {AllIconComponent ? (
                    <AllIconComponent className="h-4 w-4 flex-shrink-0 mr-2 text-muted-foreground" />
                  ) : (
                    <RiFileTextLine className="h-4 w-4 flex-shrink-0 mr-2 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      'flex-1 min-w-0 truncate text-sm',
                      selectedFolderId === null ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {allName}
                  </span>
                  {/* Edit button - appears on hover */}
                  {onEditAllTranscripts && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mr-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAllTranscripts();
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        aria-label="Customize Home"
                      >
                        <RiPaletteLine className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
                    {totalCount}
                  </Badge>
                </div>
              );

              return onEditAllTranscripts ? (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    {allTranscriptsContent}
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      onClick={onEditAllTranscripts}
                      className="cursor-pointer"
                    >
                      <RiPaletteLine className="h-4 w-4 mr-2" />
                      Customize
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                allTranscriptsContent
              );
            })()}

            {/* Folders section header */}
            {folders.length > 0 && (
              <div className="px-2 py-2 mt-2">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
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
                  onEditFolder={onEditFolder}
                  onDeleteFolder={onDeleteFolder}
                  childrenByParent={childrenByParent}
                  isDragging={isDragging}
                  expandedFolders={expandedFolders}
                  isFocused={isFocused}
                  selectableItems={selectableItems}
                  focusedIndex={focusedIndex}
                  hiddenFolders={hiddenFolders}
                  onToggleHidden={onToggleHidden}
                />
              );
            })}

            {/* Empty state */}
            {folders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <RiFolderLine className="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground mb-1">No folders yet</p>
                <p className="text-xs text-muted-foreground">Create a folder to organize calls</p>
              </div>
            )}
            </div>
          )}
        </ScrollArea>

        {/* Footer - Manage Folders link */}
        <div className="p-2 pt-1">
          <button
            onClick={onManageFolders}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            <RiSettings3Line className="h-4 w-4" />
            Manage Folders
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
