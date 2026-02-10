import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { useBankContext } from "@/hooks/useBankContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiFolderLine,
  RiCheckLine,
  RiPriceTag3Line,
  RiAlertLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { isEmojiIcon, getIconComponent } from "@/components/ui/icon-emoji-picker";
import type { ShareType, TeamShareWithDetails } from "@/types/sharing";

// ============================================================================
// Types
// ============================================================================

interface FolderTreeNode {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  parent_id: string | null;
  position?: number;
  children: FolderTreeNode[];
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface SharingRulesFormProps {
  /** Existing shares to pre-select (for team shares) */
  existingTeamShares?: TeamShareWithDetails[];
  /** Called when the form is submitted */
  onSave: (config: {
    shareAll: boolean;
    folderIds: string[];
    tagIds: string[];
  }) => Promise<void>;
  /** Called when the form is cancelled */
  onCancel?: () => void;
  /** Whether the form is in a saving state */
  isSaving?: boolean;
  /** Optional custom save button text */
  saveButtonText?: string;
  /** Optional custom title */
  title?: string;
  /** Whether to show the share all toggle */
  showShareAllToggle?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SharingRulesForm({
  existingTeamShares = [],
  onSave,
  onCancel,
  isSaving = false,
  saveButtonText = "Save",
  title = "Configure Sharing Rules",
  showShareAllToggle = true,
}: SharingRulesFormProps) {
  const { activeBankId } = useBankContext();
  // State
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [allFoldersFlat, setAllFoldersFlat] = useState<FolderTreeNode[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [shareAll, setShareAll] = useState(false);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // Data Loading
  // ============================================================================

  // Load folders from database (scoped to active workspace)
  const loadFolders = useCallback(async () => {
    try {
      const { user } = await getSafeUser();
      if (!user) return;

      let query = supabase
        .from("folders")
        .select("id, name, color, icon, parent_id, position")
        .eq("user_id", user.id)
        .order("position");

      if (activeBankId) {
        query = query.eq("bank_id", activeBankId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Store flat list
      setAllFoldersFlat(data as FolderTreeNode[] || []);

      // Build tree structure
      const tree = buildFolderTree(data || []);
      setFolders(tree);
    } catch (error) {
      logger.error("Error loading folders", error);
    }
  }, []);

  // Load tags from database (scoped to active workspace)
  const loadTags = useCallback(async () => {
    try {
      const { user } = await getSafeUser();
      if (!user) return;

      let query = supabase
        .from("call_tags")
        .select("id, name, color")
        .eq("user_id", user.id)
        .order("name");

      if (activeBankId) {
        query = query.eq("bank_id", activeBankId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTags(data as Tag[] || []);
    } catch (error) {
      logger.error("Error loading tags", error);
    }
  }, []);

  // Initialize from existing shares
  const initializeFromExistingShares = useCallback(() => {
    const allShares = [...existingTeamShares];

    // Check if sharing all
    if (allShares.some(s => s.share_type === 'all')) {
      setShareAll(true);
      setSelectedFolders(new Set());
      setSelectedTags(new Set());
      return;
    }

    // Get folder IDs
    const folderIds = new Set(
      allShares
        .filter(s => s.share_type === 'folder' && s.folder_id)
        .map(s => s.folder_id!)
    );

    // Get tag IDs
    const tagIds = new Set(
      allShares
        .filter(s => s.share_type === 'tag' && s.tag_id)
        .map(s => s.tag_id!)
    );

    setSelectedFolders(folderIds);
    setSelectedTags(tagIds);
  }, [existingTeamShares]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadFolders(), loadTags()]);
      initializeFromExistingShares();
      setLoading(false);
    };
    loadData();
  }, [loadFolders, loadTags, initializeFromExistingShares]);

  // Auto-expand parents of selected folders
  const autoExpandParents = useCallback((selectedIds: Set<string>, folderList: FolderTreeNode[]) => {
    const parentIds = new Set<string>();
    const folderMap = new Map(folderList.map(f => [f.id, f]));

    selectedIds.forEach(selectedId => {
      let current = folderMap.get(selectedId);
      while (current?.parent_id) {
        parentIds.add(current.parent_id);
        current = folderMap.get(current.parent_id);
      }
    });

    if (parentIds.size > 0) {
      setExpandedFolders(prev => new Set([...prev, ...parentIds]));
    }
  }, []);

  // Auto-expand when selected folders change
  useEffect(() => {
    if (selectedFolders.size > 0 && allFoldersFlat.length > 0) {
      autoExpandParents(selectedFolders, allFoldersFlat);
    }
  }, [selectedFolders, allFoldersFlat, autoExpandParents]);

  // ============================================================================
  // Tree Building
  // ============================================================================

  const buildFolderTree = (folderData: FolderTreeNode[]): FolderTreeNode[] => {
    const folderMap = new Map<string, FolderTreeNode>();
    const rootFolders: FolderTreeNode[] = [];

    // Initialize all folders with children array
    folderData.forEach((folder) => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build tree structure
    folderData.forEach((folder) => {
      const folderNode = folderMap.get(folder.id)!;
      if (folder.parent_id === null) {
        rootFolders.push(folderNode);
      } else {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(folderNode);
        } else {
          // Orphaned folder - add to root
          rootFolders.push(folderNode);
        }
      }
    });

    // Sort by position, fallback to name
    const sortFolders = (folderList: FolderTreeNode[]) => {
      folderList.sort((a, b) => {
        const posA = a.position ?? 999;
        const posB = b.position ?? 999;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });
      folderList.forEach((folder) => {
        if (folder.children.length > 0) {
          sortFolders(folder.children);
        }
      });
    };

    sortFolders(rootFolders);
    return rootFolders;
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const toggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleFolder = (folderId: string) => {
    if (shareAll) return; // Disabled when sharing all

    const newSelected = new Set(selectedFolders);
    if (newSelected.has(folderId)) {
      newSelected.delete(folderId);
    } else {
      newSelected.add(folderId);
    }
    setSelectedFolders(newSelected);
  };

  const toggleTag = (tagId: string) => {
    if (shareAll) return; // Disabled when sharing all

    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTags(newSelected);
  };

  const handleShareAllToggle = (checked: boolean) => {
    setShareAll(checked);
    if (checked) {
      // Clear individual selections when sharing all
      setSelectedFolders(new Set());
      setSelectedTags(new Set());
    }
  };

  const handleSave = async () => {
    try {
      await onSave({
        shareAll,
        folderIds: Array.from(selectedFolders),
        tagIds: Array.from(selectedTags),
      });
      toast.success("Sharing rules updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update sharing rules";
      toast.error(message);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderFolderItem = (folder: FolderTreeNode, depth: number = 0) => {
    const hasChildren = folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolders.has(folder.id);
    const isDisabled = shareAll;

    // Get the appropriate icon
    const folderIsEmoji = folder.icon ? isEmojiIcon(folder.icon) : false;
    const FolderIcon = folder.icon ? getIconComponent(folder.icon) : null;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
            !isDisabled && "cursor-pointer hover:bg-muted/50",
            isSelected && !isDisabled && "bg-primary/10",
            isDisabled && "opacity-50 cursor-not-allowed"
          )}
          style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
        >
          {/* Expand/Collapse button for folders with children */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(folder.id);
              }}
              className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
            >
              {isExpanded ? (
                <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
              ) : (
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          {/* Checkbox */}
          <Checkbox
            id={`folder-${folder.id}`}
            checked={isSelected}
            onCheckedChange={() => toggleFolder(folder.id)}
            disabled={isDisabled}
            className="flex-shrink-0"
          />

          {/* Folder Icon */}
          {folderIsEmoji ? (
            <span className="text-base flex-shrink-0">{folder.icon}</span>
          ) : FolderIcon ? (
            <FolderIcon
              className="h-4 w-4 flex-shrink-0"
              style={{ color: folder.color || '#6B7280' }}
            />
          ) : (
            <RiFolderLine
              className="h-4 w-4 flex-shrink-0"
              style={{ color: folder.color || '#6B7280' }}
            />
          )}

          {/* Folder Name */}
          <label
            htmlFor={`folder-${folder.id}`}
            className={cn(
              "flex-1 text-sm truncate",
              !isDisabled && "cursor-pointer",
              isSelected && !isDisabled && "font-medium"
            )}
          >
            {folder.name}
          </label>

          {/* Selected indicator */}
          {isSelected && !isDisabled && (
            <RiCheckLine className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>

        {/* Children - render recursively when expanded */}
        {hasChildren && isExpanded && (
          <div className="border-l border-muted ml-4 pl-0">
            {folder.children.map((child) => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderTagItem = (tag: Tag) => {
    const isSelected = selectedTags.has(tag.id);
    const isDisabled = shareAll;

    return (
      <div
        key={tag.id}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
          !isDisabled && "cursor-pointer hover:bg-muted/50",
          isSelected && !isDisabled && "bg-primary/10",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Checkbox */}
        <Checkbox
          id={`tag-${tag.id}`}
          checked={isSelected}
          onCheckedChange={() => toggleTag(tag.id)}
          disabled={isDisabled}
          className="flex-shrink-0"
        />

        {/* Tag Icon */}
        <RiPriceTag3Line
          className="h-4 w-4 flex-shrink-0"
          style={{ color: tag.color || '#6B7280' }}
        />

        {/* Tag Name */}
        <label
          htmlFor={`tag-${tag.id}`}
          className={cn(
            "flex-1 text-sm truncate",
            !isDisabled && "cursor-pointer",
            isSelected && !isDisabled && "font-medium"
          )}
        >
          {tag.name}
        </label>

        {/* Selected indicator */}
        {isSelected && !isDisabled && (
          <RiCheckLine className="h-4 w-4 text-primary flex-shrink-0" />
        )}
      </div>
    );
  };

  // Count totals
  const selectedFolderCount = selectedFolders.size;
  const selectedTagCount = selectedTags.size;
  const totalSelected = selectedFolderCount + selectedTagCount;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Title */}
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      )}

      {/* Share All Toggle */}
      {showShareAllToggle && (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
            <div className="flex items-center gap-2">
              <Switch
                id="share-all"
                checked={shareAll}
                onCheckedChange={handleShareAllToggle}
              />
              <Label htmlFor="share-all" className="font-medium cursor-pointer">
                Share all calls
              </Label>
            </div>
          </div>
          {shareAll && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              <RiAlertLine className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                All your calls (past and future) will be shared. Consider using folder or tag-based sharing for more control.
              </span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Folders Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <RiFolderLine className="h-4 w-4" />
              Folders
              {selectedFolderCount > 0 && !shareAll && (
                <span className="text-xs text-muted-foreground">
                  ({selectedFolderCount} selected)
                </span>
              )}
            </Label>
            {folders.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
                <RiFolderLine className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No folders yet
              </div>
            ) : (
              <div className={cn(
                "max-h-48 overflow-y-auto border rounded-md p-2",
                shareAll && "opacity-50"
              )}>
                {folders.map((folder) => renderFolderItem(folder, 0))}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <RiPriceTag3Line className="h-4 w-4" />
              Tags
              {selectedTagCount > 0 && !shareAll && (
                <span className="text-xs text-muted-foreground">
                  ({selectedTagCount} selected)
                </span>
              )}
            </Label>
            {tags.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
                <RiPriceTag3Line className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No tags yet
              </div>
            ) : (
              <div className={cn(
                "max-h-48 overflow-y-auto border rounded-md p-2",
                shareAll && "opacity-50"
              )}>
                {tags.map(renderTagItem)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer with save/cancel */}
      <div className="flex justify-between items-center pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          {shareAll
            ? "Sharing all calls"
            : totalSelected > 0
            ? `Sharing calls in ${totalSelected} item${totalSelected !== 1 ? 's' : ''}`
            : "No sharing rules configured"}
        </p>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="hollow" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || loading}>
            {isSaving ? "Saving..." : saveButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SharingRulesForm;
