# Folder System MVP Implementation Plan

**Created:** 2025-12-08
**Status:** Ready for Implementation
**Priority:** CRITICAL - Last piece before MVP launch
**Estimated Effort:** 12-16 hours total

---

## Related Documents

- **Existing PRP:** `PRPs/active/fix-folder-system-prp.md` - Fixes "Create folder coming soon" toast (40 lines, ~2 hours)
- **Teams Spec:** `docs/planning/teams-feature-specification.md` - Future expansion path
- **Staging Guide:** `docs/planning/staging-environment-setup.md` - Test environment

---

## Current State Assessment

### What's Built ✅

| Component | File | Status |
|-----------|------|--------|
| Database Schema | `migrations/20251201000002_create_folders_tables.sql` | ✅ Complete |
| Folders Hook | `src/hooks/useFolders.ts` | ✅ Complete |
| Quick Create Dialog | `src/components/QuickCreateFolderDialog.tsx` | ✅ Complete |
| Management Dialog | `src/components/transcript-library/FolderManagementDialog.tsx` | ✅ Complete |
| Assign Dialog | `src/components/AssignFolderDialog.tsx` | ⚠️ "Create folder" shows toast |
| Filter Popover | `src/components/transcript-library/FolderFilterPopover.tsx` | ⚠️ Missing "+ Add Folder" |
| Table Integration | `TranscriptTable.tsx` | ✅ Props exist |
| Drag Drop Zones | `DragDropZones.tsx` | ⚠️ Exists, needs verification |

### What's Missing 🚧

| Component | Priority | Effort | Impact | PRP |
|-----------|----------|--------|--------|-----|
| **Fix Create Folder in dialogs** | P0 | 2h | Broken workflow | `fix-folder-system-prp.md` |
| **Sidebar Folder Tree** | P0 | 4-6h | Users can't browse by folder | This doc |
| **Edit Folder Dialog** | P1 | 2h | Can't rename/change colors | This doc |
| **Folder breadcrumb navigation** | P2 | 2h | UX for nested folders | - |
| **Empty state improvements** | P2 | 1h | Better onboarding | - |
| **Keyboard shortcuts** | P3 | 1h | Power user feature | - |

---

## MVP Scope Definition

### Must Have (P0) - Blocks Launch

1. **Sidebar Folder Navigation**
   - Folder tree in left sidebar
   - Click folder to filter transcript list
   - Visual indicator for selected folder
   - Count badge showing transcripts per folder
   - "All Transcripts" option at top

2. **Complete CRUD Flow**
   - Create folder ✅
   - Read folders ✅
   - **Update folder** (missing - need Edit Dialog)
   - Delete folder ✅

### Should Have (P1) - Improves Launch

3. **Edit Folder Dialog**
   - Edit name, description
   - Change color and icon
   - Change parent folder

4. **Drag & Drop Polish**
   - Drag call row to folder in sidebar
   - Visual drop indicators
   - Success feedback

### Nice to Have (P2) - Post-Launch

5. **Folder Breadcrumbs**
6. **Folder reordering**
7. **Bulk folder operations**
8. **Folder search**

---

## Implementation Plan

### Phase 0: Execute Existing PRP (2 hours)

**Goal:** Fix the "Create folder coming soon" toast - already fully documented

**PRP:** `PRPs/active/fix-folder-system-prp.md`

**Summary of changes:**
1. `AssignFolderDialog.tsx` - Add `onCreateFolder` prop, wire button
2. `FolderFilterPopover.tsx` - Add `onCreateFolder` prop, add "+ Add Folder" button
3. `FilterBar.tsx` - Pass `onCreateFolder` prop through
4. `TranscriptsTab.tsx` - Wire callbacks to open `QuickCreateFolderDialog`

**Execute:** `/prp:3-story-task-execute PRPs/active/fix-folder-system-prp.md`

---

### Phase 1: Two-Card Layout + Collapsible Folder Sidebar (4-6 hours)

**Goal:** Implement Chat-style two-card layout with collapsible folder sidebar

**CRITICAL: Must match Chat page pattern exactly:**
- Same `ChatOuterCard` / `ChatInnerCard` structure
- Sidebar INSIDE the card (not outside)
- Mobile: overlay backdrop + slide-in sidebar
- Desktop: sidebar always visible or collapsible

#### Reference: Chat Page Structure (`src/pages/Chat.tsx`)

```tsx
<ChatOuterCard>
  {/* Mobile overlay backdrop */}
  {showSidebar && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" />
  )}

  {/* SIDEBAR - inside the outer card */}
  <div className={`
    ${showSidebar ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden'}
    md:block md:relative md:shadow-none
    w-[280px] flex-shrink-0 transition-all duration-200
  `}>
    <ChatSidebar ... />
  </div>

  {/* MAIN CONTENT */}
  <ChatInnerCard>
    <ChatInnerCardHeader>...</ChatInnerCardHeader>
    <ChatInnerCardContent>...</ChatInnerCardContent>
  </ChatInnerCard>
</ChatOuterCard>
```

#### Files to Create/Modify:

1. **New:** `src/components/transcript-library/FolderSidebar.tsx`
   - Exact same structure as `ChatSidebar.tsx`
   - Folder tree with expand/collapse
   - "All Transcripts" option at top
   - Folder count badges
   - "+ New Folder" button
   - "Manage Folders" link

2. **New:** `src/components/transcript-library/TranscriptOuterCard.tsx` (or reuse chat cards)
   - Wrapper using same styling as `ChatOuterCard`
   - Contains sidebar + inner card

3. **Major Modify:** `src/components/transcripts/TranscriptsTab.tsx`
   - Wrap entire content in two-card layout
   - Add `showSidebar` state (mobile toggle)
   - Add `selectedFolderId` state (folder filter)
   - Add mobile overlay backdrop
   - Filter transcript list by selected folder

#### UI Design (Two-Card Layout):

```
┌─────────────────────────────────────────────────────────────────────┐
│ OUTER CARD (bg-card rounded-2xl shadow-lg)                          │
│ ┌────────────────────┬────────────────────────────────────────────┐ │
│ │ FOLDER SIDEBAR     │ INNER CARD (same styling)                  │ │
│ │ (280px)            │                                            │ │
│ │                    │ ┌──────────────────────────────────────┐   │ │
│ │ 📋 All (142)       │ │ HEADER: Title + Filters + Actions    │   │ │
│ │                    │ └──────────────────────────────────────┘   │ │
│ │ FOLDERS    [+]     │                                            │ │
│ │ ├ 📁 Clients (23)  │ ┌──────────────────────────────────────┐   │ │
│ │ │  ├ Acme (8)      │ │                                      │   │ │
│ │ │  └ Beta (15)     │ │ TRANSCRIPT TABLE                     │   │ │
│ │ ├ 📁 Internal (45) │ │                                      │   │ │
│ │ └ 📁 Archive (62)  │ │                                      │   │ │
│ │                    │ │                                      │   │ │
│ │ ⚙️ Manage          │ │                                      │   │ │
│ │                    │ └──────────────────────────────────────┘   │ │
│ └────────────────────┴────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### Mobile Behavior:
- Sidebar hidden by default
- Hamburger menu button in header to toggle
- Overlay backdrop when sidebar open
- Tap backdrop to close sidebar

#### Implementation Steps:

```typescript
// Step 1: Create FolderTree component
// - Recursive rendering for nested folders
// - Expand/collapse for parent folders
// - Folder count badges
// - Color indicators

// Step 2: Add folder filtering to TranscriptsTab
const filteredCalls = useMemo(() => {
  if (!selectedFolderId) return calls; // All transcripts

  const assignedCallIds = Object.entries(folderAssignments)
    .filter(([_, folderIds]) => folderIds.includes(selectedFolderId))
    .map(([callId]) => parseInt(callId));

  return calls.filter(call => assignedCallIds.includes(call.recording_id));
}, [calls, selectedFolderId, folderAssignments]);

// Step 3: Calculate folder counts
const folderCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  folders.forEach(folder => {
    counts[folder.id] = Object.values(folderAssignments)
      .filter(folderIds => folderIds.includes(folder.id))
      .length;
  });
  return counts;
}, [folders, folderAssignments]);
```

### FolderSidebar Component (Mirrors ChatSidebar Exactly)

```typescript
// src/components/transcript-library/FolderSidebar.tsx
// MUST mirror ChatSidebar.tsx structure exactly

import * as React from 'react';
import {
  RiAddLine,
  RiFolderLine,
  RiFolderOpenLine,
  RiSettings3Line,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiInboxLine,
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
}

// Folder item matching ChatSidebar's SessionItem pattern
interface FolderItemProps {
  folder: Folder;
  children: Folder[];
  folderCounts: Record<string, number>;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (folderId: string) => void;
  onToggleExpand: (folderId: string) => void;
}

const FolderItem = React.memo(function FolderItem({
  folder,
  children,
  folderCounts,
  depth,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: FolderItemProps) {
  const hasChildren = children.length > 0;
  const count = folderCounts[folder.id] || 0;

  return (
    <div>
      {/* Folder row - h-9 matches SessionItem */}
      <div
        className={cn(
          'group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer',
          'transition-colors duration-150 overflow-hidden',
          isSelected ? 'bg-cb-hover' : 'hover:bg-cb-hover/50',
          depth > 0 && 'ml-3'
        )}
        onClick={() => onSelect(folder.id)}
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
            style={{ color: folder.color || '#6B7280' }}
          />
        ) : (
          <RiFolderLine
            className="h-4 w-4 flex-shrink-0 mr-2"
            style={{ color: folder.color || '#6B7280' }}
          />
        )}

        {/* Folder Name - truncates with ellipsis */}
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-sm',
            isSelected ? 'text-cb-ink font-medium' : 'text-cb-ink-soft'
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
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              children={[]} // Will be passed from parent
              folderCounts={folderCounts}
              depth={depth + 1}
              isSelected={false} // Will be passed from parent
              isExpanded={false} // Will be passed from parent
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
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
}: FolderSidebarProps) {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());

  // Build folder hierarchy (same as FolderTree)
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

  // Recursive render function for nested folders
  const renderFolder = (folder: Folder, depth: number = 0) => {
    const children = childrenByParent[folder.id] || [];
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id}>
        <FolderItem
          folder={folder}
          children={children}
          folderCounts={folderCounts}
          depth={depth}
          isSelected={isSelected}
          isExpanded={isExpanded}
          onSelect={onSelectFolder}
          onToggleExpand={handleToggleExpand}
        />
        {children.length > 0 && isExpanded && (
          <div className="ml-3">
            {children.sort((a, b) => a.position - b.position).map(child =>
              renderFolder(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sidebar wrapper - EXACT same structure as ChatSidebar */}
      <div
        className="h-full flex flex-col rounded-overflow"
        data-component="FOLDER-SIDEBAR"
      >
        {/* Header - matches ChatSidebar header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-base md:text-lg font-extrabold uppercase text-cb-ink">
            Folders
          </h1>
          <Button variant="ghost" size="icon" onClick={onNewFolder} aria-label="New folder">
            <RiAddLine className="h-4 w-4" />
          </Button>
        </div>

        {/* Folder list - compact padding, matches ChatSidebar ScrollArea */}
        <ScrollArea className="flex-1 overflow-hidden min-w-0">
          <div className="p-2 space-y-0.5 overflow-hidden">
            {/* All Transcripts - always first */}
            <div
              className={cn(
                'group relative flex items-center h-9 w-full px-2 rounded-lg cursor-pointer',
                'transition-colors duration-150 overflow-hidden',
                selectedFolderId === null ? 'bg-cb-hover' : 'hover:bg-cb-hover/50'
              )}
              onClick={() => onSelectFolder(null)}
            >
              <div className="w-6 flex-shrink-0" />
              <RiInboxLine className="h-4 w-4 flex-shrink-0 mr-2 text-cb-ink-muted" />
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
                  Folders
                </span>
              </div>
            )}

            {/* Folder tree */}
            {rootFolders.map(folder => renderFolder(folder))}

            {/* Empty state - matches ChatSidebar empty state */}
            {folders.length === 0 && (
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
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-cb-ink-muted hover:text-cb-ink rounded-lg hover:bg-cb-hover/50 transition-colors"
          >
            <RiSettings3Line className="h-4 w-4" />
            Manage Folders
          </button>
        </div>
      </div>
    </>
  );
}
```

---

### Phase 2: Edit Folder Dialog (2 hours)

**Goal:** Complete the folder CRUD story

#### Files to Create:

1. **New:** `src/components/transcript-library/EditFolderDialog.tsx`

```typescript
interface EditFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  onFolderUpdated: () => void;
}
```

#### Features:
- Pre-populate form with existing folder data
- Same UI as QuickCreateFolderDialog (reuse components)
- Validation for duplicate names within same parent
- Success toast on save

#### Integration:
- FolderManagementDialog already has `onEditFolder` callback
- Just need to wire up the dialog

### Phase 3: Drag & Drop Polish (2-3 hours)

**Goal:** Smooth drag-drop experience

#### Current State:
- `DragDropZones.tsx` exists
- May need integration work

#### Implementation:
1. Add drag handle to TranscriptTableRow
2. Create droppable zones in FolderTree items
3. Visual feedback during drag (highlight target folder)
4. Handle drop → call `assignToFolder` mutation

### Phase 4: Testing & Polish (2-3 hours)

1. Test all folder operations
2. Test nested folder hierarchies
3. Test edge cases (delete folder with calls, etc.)
4. Verify brand guideline compliance
5. Screenshot verification with Playwright

---

## Detailed Component Specifications

### FolderTree Component

```typescript
// src/components/sidebar/FolderTree.tsx

import { useState } from 'react';
import {
  RiFolderLine,
  RiFolderOpenLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiAddLine,
  RiSettings3Line,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Folder } from '@/hooks/useFolders';

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: string | null;
  folderCounts: Record<string, number>;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onManageFolders: () => void;
}

export function FolderTree({
  folders,
  selectedFolderId,
  folderCounts,
  onSelectFolder,
  onCreateFolder,
  onManageFolders,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Build folder hierarchy
  const rootFolders = folders.filter(f => !f.parent_id);
  const childrenByParent = folders.reduce((acc, folder) => {
    const parentId = folder.parent_id || 'root';
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(folder);
    return acc;
  }, {} as Record<string, Folder[]>);

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

  const renderFolder = (folder: Folder, depth: number = 0) => {
    const children = childrenByParent[folder.id] || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const count = folderCounts[folder.id] || 0;

    return (
      <div key={folder.id}>
        <button
          onClick={() => onSelectFolder(folder.id)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
            'hover:bg-accent/50',
            isSelected && 'bg-accent text-accent-foreground',
            depth > 0 && 'ml-4'
          )}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(folder.id);
              }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? (
                <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
              ) : (
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-5" /> // Spacer
          )}

          {/* Folder Icon with Color */}
          {isExpanded ? (
            <RiFolderOpenLine
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
          <span className="flex-1 truncate text-left">{folder.name}</span>

          {/* Count Badge */}
          {count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {count}
            </Badge>
          )}
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {children
              .sort((a, b) => a.position - b.position)
              .map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const totalCount = Object.values(folderCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full">
      {/* All Transcripts */}
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          'hover:bg-accent/50',
          selectedFolderId === null && 'bg-accent text-accent-foreground'
        )}
      >
        <div className="w-5" />
        <RiFolderOpenLine className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left">All Transcripts</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
          {totalCount}
        </Badge>
      </button>

      {/* Folders Header */}
      <div className="flex items-center justify-between px-3 py-2 mt-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Folders
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateFolder}
          className="h-6 w-6 p-0"
        >
          <RiAddLine className="h-4 w-4" />
          <span className="sr-only">New Folder</span>
        </Button>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto px-1">
        {rootFolders.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No folders yet
          </div>
        ) : (
          <div className="space-y-1">
            {rootFolders
              .sort((a, b) => a.position - b.position)
              .map(folder => renderFolder(folder))}
          </div>
        )}
      </div>

      {/* Manage Folders */}
      <button
        onClick={onManageFolders}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <RiSettings3Line className="h-4 w-4" />
        Manage Folders
      </button>
    </div>
  );
}
```

---

## Testing Checklist

### Folder CRUD
- [ ] Create folder at root level
- [ ] Create nested folder (up to 3 levels)
- [ ] Edit folder name
- [ ] Edit folder color/icon
- [ ] Change folder parent
- [ ] Delete folder (verify calls unassigned, not deleted)
- [ ] Delete parent folder (verify children behavior)

### Assignment
- [ ] Assign single call to folder
- [ ] Assign multiple calls to folder (bulk)
- [ ] Remove call from folder
- [ ] Move call between folders
- [ ] Assign call to multiple folders

### Navigation
- [ ] Click folder in sidebar → filters list
- [ ] Click "All Transcripts" → shows all
- [ ] Folder counts accurate
- [ ] Nested folder expand/collapse
- [ ] Selected folder visual state

### Edge Cases
- [ ] 0 folders state (empty state)
- [ ] 100+ folders (scroll performance)
- [ ] Very long folder names (truncation)
- [ ] Deep nesting (3 levels)
- [ ] Unicode folder names

### Brand Compliance
- [ ] Colors match brand guidelines
- [ ] Icons from Remix Icon library
- [ ] Typography correct
- [ ] Spacing on 4px grid
- [ ] Dark mode support

---

## Success Criteria

**MVP is ready when:**

1. ✅ User can create/edit/delete folders
2. ✅ User can assign calls to folders
3. ✅ User can filter transcript list by folder (sidebar)
4. ✅ Folder counts display correctly
5. ✅ Nested folders work (up to 3 levels)
6. ✅ All operations provide visual feedback
7. ✅ No console errors
8. ✅ Works on mobile viewport
9. ✅ Dark mode supported
10. ✅ Tested on staging environment

---

## Rollout Plan

### Week 1: Implementation
- Day 1-2: Sidebar FolderTree component
- Day 2-3: Integration with TranscriptsTab
- Day 3-4: Edit Folder Dialog
- Day 4-5: Drag & Drop polish

### Week 2: Testing & Ship
- Day 1-2: Testing on staging
- Day 2-3: Bug fixes
- Day 3: Final review
- Day 4: Merge to production
- Day 5: Monitor & address feedback
