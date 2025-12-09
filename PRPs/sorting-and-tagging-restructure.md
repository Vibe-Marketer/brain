---
name: sorting-and-tagging-restructure.md
description: "PRP for restructuring Categories page to Sorting & Tagging with new tab structure"
created: 2025-12-09
confidence_score: 9/10
---

## Goal

**Feature Goal**: Restructure the current "Categories" page into a clearer "Sorting & Tagging" page with four well-organized tabs (FOLDERS | TAGS | RULES | RECURRING) that provide complete management of both organizational folders AND classification tags in one unified location.

**Deliverable**:
- Renamed page: "SORTING & TAGGING"
- New tab structure: FOLDERS | TAGS | RULES | RECURRING
- New FOLDERS tab with full folder CRUD management
- Updated UI copy throughout for clarity on folders vs tags
- Enhanced RECURRING tab to support folder assignment in rule creation

**Success Definition**:
1. User can navigate to `/sorting-tagging` (renamed route) and see 4 tabs
2. FOLDERS tab allows full folder management (create, edit, delete, view hierarchy)
3. TAGS tab displays existing tags with clear "controls AI" messaging
4. RULES tab shows unified rules that can assign tags AND/OR folders
5. RECURRING tab allows creating rules that assign folders in addition to tags
6. All UI copy clearly distinguishes folders (organization) from tags (AI control)

## User Persona

**Target User**: CallVault power user who wants to organize their call library AND control AI analysis behavior

**Use Case**:
- Create folders to organize calls by client, project, or time period
- Create tags to classify calls by type (sales, coaching, team meeting)
- Set up rules to automatically sort and tag incoming calls
- Discover common recurring titles and quickly create rules for them

**User Journey**:
1. Navigate to "Sorting & Tagging" from dock/navigation
2. See 4 clear tabs: FOLDERS | TAGS | RULES | RECURRING
3. Go to FOLDERS tab to create/manage folder hierarchy
4. Go to TAGS tab to view available classification tags
5. Go to RULES tab to create automation rules assigning tags/folders
6. Go to RECURRING tab to discover common titles needing rules

**Pain Points Addressed**:
- Current "Categories" naming is vague and confusing
- No dedicated place to manage folders (only in Transcripts sidebar)
- Tab order (RECURRING | RULES | TAGS) doesn't reflect workflow
- "TAG RULES" title is misleading since rules can assign folders too
- RecurringTitlesTab only supports tag assignment, not folder assignment

## Why

- **Clarity**: "Sorting & Tagging" immediately communicates purpose (organize + classify)
- **Completeness**: FOLDERS tab fills gap - users need central folder management
- **Logical Workflow**: Tab order reflects user flow (setup folders → setup tags → create rules → discover patterns)
- **Accuracy**: "RULES" (not "TAG RULES") reflects that rules assign both tags AND folders
- **Alignment**: Matches existing folder management UX in Transcripts page

## What

### User-Visible Behavior

1. **Page Rename**: "Categories" → "SORTING & TAGGING"
   - Route: `/categorization` → `/sorting-tagging`
   - Dock label: "Tags" → "Sorting"
   - Top bar: "CATEGORIES" → "SORTING & TAGGING"

2. **Tab Restructure**: RECURRING | RULES | TAGS → FOLDERS | TAGS | RULES | RECURRING
   - Default tab: FOLDERS (was RECURRING)
   - Each tab has clear header copy explaining its purpose

3. **New FOLDERS Tab**:
   - Header: "FOLDERS" with description: "Organize calls into folders for easy browsing. Folders don't affect AI analysis."
   - Hierarchical folder list showing: Name, Icon/Emoji, Call Count, Actions
   - "Create Folder" button opens QuickCreateFolderDialog
   - Inline edit/delete actions per folder
   - Shows nested hierarchy (indented children)
   - Empty state: "No folders yet. Create a folder to organize calls."

4. **Updated RULES Tab**:
   - Header: "RULES" (was "TAG RULES")
   - Description: "Automatically assign tags and/or folders to incoming calls."
   - Table shows both Tag and Folder columns (already implemented)
   - No functionality change needed - UI copy only

5. **Enhanced RECURRING Tab**:
   - When creating rule from recurring title, modal now allows:
     - Assign Tag (optional)
     - Assign to Folder (optional)
     - At least one required
   - Same pattern as existing RulesTab dialog

### Success Criteria

- [ ] Page title displays "SORTING & TAGGING"
- [ ] Route is `/sorting-tagging` with redirect from old `/categorization`
- [ ] Tabs display in order: FOLDERS | TAGS | RULES | RECURRING
- [ ] FOLDERS tab shows hierarchical folder list with CRUD operations
- [ ] FOLDERS tab integrates with existing useFolders hook
- [ ] TAGS tab unchanged except header copy clarifies "controls AI"
- [ ] RULES tab header says "RULES" not "TAG RULES"
- [ ] RECURRING tab rule creation supports folder assignment
- [ ] All folder operations align with existing TranscriptsTab behavior
- [ ] Brand guidelines followed (tab styling, typography, icons)

## All Needed Context

### Context Completeness Check

_"If someone knew nothing about this codebase, would they have everything needed to implement this successfully?"_ **YES** - This PRP includes all file paths, component patterns, database schema, and UI specifications.

### Documentation & References

```yaml
# MUST READ - Brand Guidelines
- file: docs/design/brand-guidelines-v4.1.md
  why: Tab styling, typography, button variants, color usage
  pattern: Section 7 "Tab Navigation" - 6px vibe orange underline, angular shape
  gotcha: Tabs must be left-justified with 24px gap, ALL CAPS labels

# Existing Categories Page (to be modified)
- file: src/pages/Categorization.tsx
  why: Main page component to restructure
  pattern: Tab config object with title/description per tab
  gotcha: Uses standard Tabs component from @/components/ui/tabs

# Existing Tab Components
- file: src/components/tags/TagsTab.tsx
  why: Read-only tags display - no changes needed except header copy
  pattern: Table with tag color, name, description, type, count

- file: src/components/tags/RulesTab.tsx
  why: Full rule CRUD - already supports folders, only header copy change
  pattern: Form with tag_id AND folder_id dropdowns
  gotcha: Validation requires at least one of tag/folder

- file: src/components/tags/RecurringTitlesTab.tsx
  why: Needs folder support in rule creation dialog
  pattern: Dialog currently only has tag selector
  gotcha: Must add folder selector matching RulesTab pattern

# Folder Management Components (to reuse)
- file: src/components/transcript-library/FolderSidebar.tsx
  why: Reference for folder display patterns (hierarchy, icons, counts)
  pattern: DroppableFolderItem with expand/collapse, icon handling
  gotcha: Uses getIconComponent/isEmojiIcon from icon-emoji-picker

- file: src/components/QuickCreateFolderDialog.tsx
  why: Reuse directly for FOLDERS tab "Create Folder" action
  pattern: Dialog with emoji picker, name input, parent selector

- file: src/components/EditFolderDialog.tsx
  why: Reuse directly for FOLDERS tab edit action
  pattern: Same as create but pre-populated with folder data

- file: src/components/transcript-library/FolderManagementDialog.tsx
  why: Alternative - full-screen folder management view
  pattern: Complete folder list with edit/delete inline

# Data Hooks
- file: src/hooks/useFolders.ts
  why: Core folder data and mutations
  pattern: folders array, folderAssignments, createFolder, updateFolder, deleteFolder
  gotcha: Returns Folder type from src/types/folders.ts

# Database Schema Reference
- file: supabase/migrations/20251201000002_create_folders_tables.sql
  why: folders table structure
  pattern: id, user_id, name, description, color, icon, parent_id, position

- file: supabase/migrations/20251209000001_extend_tag_rules_with_folders.sql
  why: tag_rules now supports folder_id
  pattern: tag_id OR folder_id (at least one required via CHECK constraint)

# Route Configuration
- file: src/App.tsx
  why: Route definition to update
  pattern: <Route path="/categorization" element={<Categorization />} />

# Navigation/Layout
- file: src/components/Layout.tsx
  why: Dock icon and page labels
  pattern: dockItems array and pageLabels mapping
```

### Current Codebase Tree (Relevant Files)

```bash
src/
├── pages/
│   └── Categorization.tsx                    # MODIFY: Rename, restructure tabs
├── components/
│   ├── tags/
│   │   ├── TagsTab.tsx                       # MODIFY: Update header copy only
│   │   ├── RulesTab.tsx                      # MODIFY: Update header copy only
│   │   ├── RecurringTitlesTab.tsx            # MODIFY: Add folder selector to dialog
│   │   └── FoldersTab.tsx                    # CREATE: New tab component
│   ├── transcript-library/
│   │   ├── FolderSidebar.tsx                 # REFERENCE: Folder display patterns
│   │   └── FolderManagementDialog.tsx        # REFERENCE/REUSE: Full folder management
│   ├── QuickCreateFolderDialog.tsx           # REUSE: Create folder dialog
│   └── EditFolderDialog.tsx                  # REUSE: Edit folder dialog
├── hooks/
│   └── useFolders.ts                         # REUSE: Folder data/mutations
└── types/
    └── folders.ts                            # REFERENCE: Folder type definition
```

### Desired Codebase Tree (After Implementation)

```bash
src/
├── pages/
│   └── SortingTagging.tsx                    # RENAMED from Categorization.tsx
├── components/
│   ├── tags/                                 # Consider renaming folder to 'sorting' later
│   │   ├── TagsTab.tsx                       # Updated header copy
│   │   ├── RulesTab.tsx                      # Updated header copy
│   │   ├── RecurringTitlesTab.tsx            # Added folder selector in dialog
│   │   └── FoldersTab.tsx                    # NEW: Folder management tab
│   └── ... (existing components unchanged)
```

### Known Gotchas & Constraints

```typescript
// CRITICAL: Folder display must match TranscriptsTab sidebar
// Use same icon handling pattern:
import { isEmojiIcon, getIconComponent } from '@/components/ui/icon-emoji-picker';

// CRITICAL: useFolders hook returns flat array
// Must build hierarchy manually for display:
const rootFolders = folders.filter(f => !f.parent_id);
const childrenByParent = folders.reduce((acc, folder) => {
  if (folder.parent_id) {
    if (!acc[folder.parent_id]) acc[folder.parent_id] = [];
    acc[folder.parent_id].push(folder);
  }
  return acc;
}, {} as Record<string, Folder[]>);

// CRITICAL: Folder counts need calculation
// TranscriptsTab computes folderCounts from folderAssignments:
const folderCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  Object.values(folderAssignments).forEach((folderIds) => {
    folderIds.forEach((folderId) => {
      counts[folderId] = (counts[folderId] || 0) + 1;
    });
  });
  return counts;
}, [folderAssignments]);

// CRITICAL: RecurringTitlesTab rule creation needs both tag AND folder
// Current validation only checks tagId, must update to:
if (!selectedTagId && !selectedFolderId) {
  toast.error("Please select at least a tag or folder to assign");
  return;
}

// CRITICAL: Route redirect for backwards compatibility
// Add redirect from /categorization to /sorting-tagging
```

## Implementation Blueprint

### Data Models (No Changes Needed)

Database schema already supports all needed functionality:
- `folders` table for folder hierarchy
- `tag_rules` table with `tag_id` AND `folder_id` columns
- Both fields nullable with CHECK constraint requiring at least one

### Implementation Tasks (Ordered by Dependencies)

```yaml
Task 1: CREATE src/components/tags/FoldersTab.tsx
  - IMPLEMENT: New tab component for folder management
  - FOLLOW pattern: src/components/transcript-library/FolderManagementDialog.tsx (table layout)
  - FOLLOW pattern: src/components/transcript-library/FolderSidebar.tsx (icon/hierarchy display)
  - REUSE: QuickCreateFolderDialog, EditFolderDialog
  - REUSE: useFolders hook for data and mutations
  - NAMING: FoldersTab function component
  - INCLUDE: Header copy "FOLDERS" with description about organization vs AI
  - INCLUDE: Create Folder button, hierarchical table, edit/delete actions

Task 2: MODIFY src/components/tags/RecurringTitlesTab.tsx
  - ADD: Import folders query from supabase (match RulesTab pattern)
  - ADD: selectedFolderId state and setter
  - ADD: Folder selector dropdown in rule creation dialog
  - MODIFY: handleSubmitRule to include folder_id in insert
  - MODIFY: Validation to accept tag OR folder (not require tag)
  - FOLLOW pattern: src/components/tags/RulesTab.tsx lines 690-754 (actions section)

Task 3: MODIFY src/components/tags/RulesTab.tsx
  - MODIFY: tabConfig.rules.title from "TAG RULES" to "RULES"
  - MODIFY: tabConfig.rules.description to mention "tags and/or folders"
  - NO OTHER CHANGES - functionality already complete

Task 4: MODIFY src/components/tags/TagsTab.tsx
  - VERIFY: Header copy already says "Tags control which AI prompts..."
  - ADD: Clarifying copy that folders are for organization only
  - MINIMAL CHANGE - just copy update

Task 5: RENAME src/pages/Categorization.tsx → src/pages/SortingTagging.tsx
  - RENAME: File and default export
  - MODIFY: Tab order to FOLDERS | TAGS | RULES | RECURRING
  - MODIFY: tabConfig object with new titles/descriptions
  - MODIFY: Default activeTab to "folders"
  - ADD: Import FoldersTab component
  - ADD: TabsContent for folders tab
  - UPDATE: Page header to show "SORTING & TAGGING"

Task 6: MODIFY src/App.tsx
  - RENAME: Import from SortingTagging
  - CHANGE: Route path from "/categorization" to "/sorting-tagging"
  - ADD: Redirect from "/categorization" to "/sorting-tagging" (optional but good)

Task 7: MODIFY src/components/Layout.tsx
  - UPDATE: dockItems array - change path to "/sorting-tagging"
  - UPDATE: Dock label from "Tags" to "Sorting" (or "Organize")
  - UPDATE: pageLabels mapping for new route

Task 8: VERIFY brand compliance and test
  - RUN: Visual verification with Playwright
  - CHECK: Tab styling matches brand guidelines (6px orange underline)
  - CHECK: Typography (Montserrat headings, Inter body)
  - CHECK: All folder operations work correctly
  - CHECK: Rule creation with folder assignment works
```

### Implementation Patterns & Key Details

```tsx
// ========================================
// PATTERN: FoldersTab Component Structure
// ========================================
// File: src/components/tags/FoldersTab.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFolders, Folder } from "@/hooks/useFolders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiFolderLine } from "@remixicon/react";
import { isEmojiIcon, getIconComponent } from "@/components/ui/icon-emoji-picker";
import QuickCreateFolderDialog from "@/components/QuickCreateFolderDialog";
import EditFolderDialog from "@/components/EditFolderDialog";

export function FoldersTab() {
  const { folders, folderAssignments, deleteFolder, isLoading } = useFolders();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);

  // Build hierarchy
  const rootFolders = folders.filter(f => !f.parent_id).sort((a, b) => a.position - b.position);
  const childrenByParent = folders.reduce((acc, folder) => {
    if (folder.parent_id) {
      if (!acc[folder.parent_id]) acc[folder.parent_id] = [];
      acc[folder.parent_id].push(folder);
    }
    return acc;
  }, {} as Record<string, Folder[]>);

  // Calculate counts
  const folderCounts = Object.values(folderAssignments).reduce((counts, folderIds) => {
    folderIds.forEach(fid => { counts[fid] = (counts[fid] || 0) + 1; });
    return counts;
  }, {} as Record<string, number>);

  // Render folder row recursively
  const renderFolder = (folder: Folder, depth: number = 0) => {
    const children = childrenByParent[folder.id] || [];
    const FolderIcon = getIconComponent(folder.icon);
    const isEmoji = isEmojiIcon(folder.icon);

    return (
      <>
        <TableRow key={folder.id}>
          <TableCell style={{ paddingLeft: `${depth * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {isEmoji ? (
                <span className="text-base">{folder.icon}</span>
              ) : FolderIcon ? (
                <FolderIcon className="h-4 w-4" style={{ color: folder.color }} />
              ) : (
                <RiFolderLine className="h-4 w-4" style={{ color: folder.color }} />
              )}
              <span className="font-medium">{folder.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {folderCounts[folder.id] || 0}
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm" onClick={() => setEditFolder(folder)}>
              <RiEditLine className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(folder)}>
              <RiDeleteBinLine className="h-4 w-4 text-destructive" />
            </Button>
          </TableCell>
        </TableRow>
        {children.sort((a, b) => a.position - b.position).map(child => renderFolder(child, depth + 1))}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-cb-ink-muted">
        Folders organize your calls for easy browsing. Folder assignment has no effect on AI analysis—only tags control that.
      </p>

      <Button onClick={() => setCreateDialogOpen(true)}>
        <RiAddLine className="h-4 w-4 mr-2" />
        Create Folder
      </Button>

      <div className="border border-cb-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-cb-white dark:bg-card">
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-right">Calls</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rootFolders.map(folder => renderFolder(folder))}
            {folders.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-cb-ink-muted">
                  No folders yet. Create a folder to organize calls.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <QuickCreateFolderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onFolderCreated={() => {}}
      />
      <EditFolderDialog
        open={!!editFolder}
        onOpenChange={(open) => !open && setEditFolder(null)}
        folder={editFolder}
        onFolderUpdated={() => setEditFolder(null)}
      />
    </div>
  );
}


// ========================================
// PATTERN: RecurringTitlesTab Folder Support
// ========================================
// Add to existing RecurringTitlesTab.tsx

// Add state:
const [selectedFolderId, setSelectedFolderId] = useState<string>("");

// Add folders query (same as RulesTab):
const { data: folders } = useQuery({
  queryKey: ["folders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("id, name, color, icon")
      .order("name");
    if (error) throw error;
    return data;
  },
});

// Update mutation to include folder_id:
const { error } = await supabase.from("tag_rules").insert({
  user_id: userData.user.id,
  name: name,
  rule_type: "title_exact",
  conditions: { title },
  tag_id: tagId || null,        // Can be null now
  folder_id: folderId || null,  // NEW
  priority: 100,
  is_active: true,
});

// Update validation:
if (!selectedTagId && !selectedFolderId) {
  toast.error("Please select at least a tag or folder to assign");
  return;
}

// Add folder selector to dialog (same JSX as RulesTab lines 724-754)


// ========================================
// PATTERN: Page Tab Configuration
// ========================================
// Update in SortingTagging.tsx

type TabValue = "folders" | "tags" | "rules" | "recurring";

const tabConfig = {
  folders: {
    title: "FOLDERS",
    description: "Create and manage folders to organize your calls.",
  },
  tags: {
    title: "TAGS",
    description: "View available call tags. Tags classify calls and control AI behavior.",
  },
  rules: {
    title: "RULES",
    description: "Create and manage rules for automatic sorting and tagging.",
  },
  recurring: {
    title: "RECURRING TITLES",
    description: "View your most common call titles and create sorting rules.",
  },
};

// Tab order in JSX:
<TabsList>
  <TabsTrigger value="folders">FOLDERS</TabsTrigger>
  <TabsTrigger value="tags">TAGS</TabsTrigger>
  <TabsTrigger value="rules">RULES</TabsTrigger>
  <TabsTrigger value="recurring">RECURRING</TabsTrigger>
</TabsList>
```

### Integration Points

```yaml
ROUTING:
  - modify: src/App.tsx
  - change: "/categorization" → "/sorting-tagging"
  - add: Optional redirect from old route

NAVIGATION:
  - modify: src/components/Layout.tsx
  - update: dockItems path and label
  - update: pageLabels mapping

EXISTING HOOKS:
  - reuse: useFolders (no changes needed)
  - reuse: useQuery for folders in RecurringTitlesTab

EXISTING DIALOGS:
  - reuse: QuickCreateFolderDialog (no changes)
  - reuse: EditFolderDialog (no changes)

DATABASE:
  - no changes: Schema already supports tag_id + folder_id in tag_rules
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# After each file modification
npm run type-check
npm run lint

# Expected: Zero errors
```

### Level 2: Unit Tests (Component Validation)

```bash
# Run existing tests to ensure no regressions
npm run test

# Specific component tests if they exist
npm run test -- --grep "FoldersTab"
npm run test -- --grep "RecurringTitlesTab"
```

### Level 3: Integration Testing (Visual Validation)

```bash
# Start dev server
npm run dev

# Use Playwright to navigate and verify:
# 1. Navigate to /sorting-tagging
# 2. Verify 4 tabs visible in correct order
# 3. Click each tab and verify content loads
# 4. Create folder in FOLDERS tab
# 5. Create rule with folder assignment in RECURRING tab
# 6. Verify rule shows in RULES tab with folder column populated
```

### Level 4: Design Compliance Validation

```bash
# Visual verification checklist:
# - Tab underlines are 6px vibe orange (#FF8800)
# - Tab labels are ALL CAPS
# - Tabs left-justified with 24px gap
# - Page title uses Montserrat Extra Bold
# - Body text uses Inter
# - Buttons use correct variants (primary for Create, hollow for secondary)
# - Icons are from Remix Icon library
# - Table styling matches brand guidelines
```

## Final Validation Checklist

### Technical Validation

- [ ] All TypeScript type errors resolved: `npm run type-check`
- [ ] All ESLint errors resolved: `npm run lint`
- [ ] Existing tests pass: `npm run test`
- [ ] Dev server starts without errors: `npm run dev`
- [ ] Build completes without errors: `npm run build`

### Feature Validation

- [ ] Route `/sorting-tagging` loads correctly
- [ ] FOLDERS tab shows folder hierarchy with correct counts
- [ ] FOLDERS tab Create Folder opens dialog and creates folder
- [ ] FOLDERS tab Edit opens dialog and updates folder
- [ ] FOLDERS tab Delete removes folder (with confirmation)
- [ ] TAGS tab displays existing tags with usage counts
- [ ] RULES tab displays rules with Tag AND Folder columns
- [ ] RULES tab header says "RULES" (not "TAG RULES")
- [ ] RECURRING tab shows common titles
- [ ] RECURRING tab "Create Rule" allows selecting folder
- [ ] RECURRING tab can create folder-only rules (no tag)
- [ ] New rules appear in RULES tab immediately
- [ ] Folder operations sync with TranscriptsTab sidebar

### Code Quality Validation

- [ ] FoldersTab follows existing TabComponent patterns
- [ ] Icon handling uses getIconComponent/isEmojiIcon
- [ ] All Remix Icon imports use `-line` variants
- [ ] Button variants match brand guidelines
- [ ] Toast notifications for all CRUD operations
- [ ] Loading states with Skeleton components

### Design Compliance Validation

- [ ] Tab styling: 6px vibe orange underline, angular shape
- [ ] Typography: Montserrat Extra Bold for headers, Inter for body
- [ ] Spacing: 4px grid system (Tailwind defaults)
- [ ] Colors: Only vibe orange for tab underlines (not text/backgrounds)
- [ ] Table: Header row white/card background, horizontal borders only
- [ ] Dark mode: All components adapt correctly

---

## Anti-Patterns to Avoid

- ❌ Don't create new folder management patterns - reuse existing components
- ❌ Don't hardcode folder colors - use folder.color from database
- ❌ Don't skip hierarchy rendering - folders can be nested 3 levels deep
- ❌ Don't forget to handle empty states - show helpful messages
- ❌ Don't mix icon libraries - use Remix Icon exclusively
- ❌ Don't use vibe orange for anything except tab underlines
- ❌ Don't skip validation - rules need at least tag OR folder
- ❌ Don't forget to invalidate queries after mutations

---

## Confidence Score: 9/10

**High confidence** because:
- All components to reuse are identified and well-documented
- Database schema already supports the required functionality
- Patterns are established in existing code (RulesTab, FolderSidebar)
- No architectural changes needed - just reorganization and UI updates
- Clear file paths and specific code patterns provided

**Remaining risk (1 point deduction)**:
- Minor UI polish may need iteration after visual review
- Route rename may need additional redirects if deep links exist

---

## Implementation Time Estimate

- Task 1 (FoldersTab): 45-60 minutes
- Task 2 (RecurringTitlesTab): 20-30 minutes
- Task 3 (RulesTab copy): 5 minutes
- Task 4 (TagsTab copy): 5 minutes
- Task 5 (Page rename/restructure): 20-30 minutes
- Task 6 (App.tsx route): 5 minutes
- Task 7 (Layout.tsx nav): 10 minutes
- Task 8 (Verification): 30 minutes

**Total: 2.5-3 hours**
