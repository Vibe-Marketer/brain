# SortingTagging Pane Allocation Strategy

**Created:** January 2026
**Purpose:** Define how SortingTagging features map to the 4-pane architecture
**Reference Spec:** `.auto-claude/specs/006-ui-ux-for-settings-sorting-pages/spec.md`

---

## Executive Summary

This document defines the pane allocation strategy for migrating the SortingTagging page from tab-based to pane-based navigation. The strategy maps all 4 existing tabs (Folders, Tags, Rules, Recurring Titles) to the multi-pane architecture while reducing click counts and maintaining feature parity.

**Key Decisions:**
- 2nd Pane: Category navigation list (replaces tab bar)
- 3rd Pane: Primary management interface (list + actions)
- 4th Pane: Item detail editing (existing detail panels)
- Modal dialogs preserved for complex creation workflows (Rules)

---

## 1. Pane Architecture Overview

### 1.1 Four-Pane Layout for SortingTagging

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    APPLICATION HEADER                                │
├──────────────┬────────────────┬─────────────────────────────────┬───────────────────┤
│    SIDEBAR   │   2ND PANE     │           3RD PANE              │     4TH PANE      │
│    (1st)     │   Categories   │        Management Area          │   Detail Panel    │
│              │                │                                 │                   │
│   ~72/240px  │    ~260px      │          Flexible               │     ~340px        │
├──────────────┼────────────────┼─────────────────────────────────┼───────────────────┤
│              │                │                                 │                   │
│  [Library]   │ ORGANIZATION   │ ┌─────────────────────────────┐ │ ┌───────────────┐ │
│  [Dashboard] │                │ │  FOLDERS                    │ │ │ FOLDER DETAIL │ │
│  [Settings]  │ ○ Folders ───► │ │  ──────────────────         │ │ │               │ │
│  [Sorting]◄──┤ ○ Tags        │ │  + Create Folder             │ │ │ Icon: 📁      │ │
│  [Help]      │ ○ Rules       │ │  ┌─────────────────────────┐ │ │ │ Name: Work    │ │
│              │ ○ Recurring    │ │  │ 📁 Work           (12) │ │ │ │ Parent: None  │ │
│              │                │ │  │ 📁 Personal        (8) │ │ │ │               │ │
│              │ ──────────     │ │  │ 📁 Archive         (5) │ │ │ │ [Save] [Del]  │ │
│              │ ⓘ Quick Tips  │ │  └─────────────────────────┘ │ │ └───────────────┘ │
│              │                │ └─────────────────────────────┘ │                   │
│              │                │                                 │                   │
└──────────────┴────────────────┴─────────────────────────────────┴───────────────────┘
```

### 1.2 Pane Specifications

| Pane | Width | Behavior | Content |
|------|-------|----------|---------|
| 1st (Sidebar) | 72px collapsed / 240px expanded | Fixed, collapsible | Global app navigation |
| 2nd (Categories) | 260px | Always open when on SortingTagging | Category list + quick tips |
| 3rd (Management) | Flexible (fills remaining) | Always visible | List view + create actions |
| 4th (Detail) | 340px | Opens on item selection | Item editing form |

---

## 2. 2nd Pane: Category Navigation

### 2.1 Category List Design

The 2nd pane replaces the current tab bar with a vertical category list following Microsoft Loop patterns.

```
┌──────────────────────────┐
│  ORGANIZATION            │  ← Header
│ ─────────────────────────│
│                          │
│  ○ Folders          (25) │  ← Category item with count
│  ○ Tags             (12) │
│  ○ Rules             (8) │
│  ○ Recurring Titles (50) │
│                          │
│ ─────────────────────────│
│  ⓘ QUICK TIPS            │  ← Contextual help section
│                          │
│  Folders organize calls  │
│  for browsing. Tags      │
│  control AI behavior.    │
│                          │
└──────────────────────────┘
```

### 2.2 Category Items

| Category | Icon | Badge | Description |
|----------|------|-------|-------------|
| Folders | `RiFolderLine` | Count of folders | Manage folder hierarchy |
| Tags | `RiPriceTag3Line` | Count of custom tags | View and edit call tags |
| Rules | `RiFlowChart` | Count of active rules | Configure auto-sorting |
| Recurring Titles | `RiRepeatLine` | Top N count | Create rules from patterns |

### 2.3 Active State Styling

```typescript
// Category item component structure
interface CategoryItemProps {
  id: 'folders' | 'tags' | 'rules' | 'recurring';
  label: string;
  icon: RemixiconComponentType;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

// Active state CSS (following Loop patterns)
const categoryItemStyles = {
  base: "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-100",
  inactive: "hover:bg-muted/50",
  active: "bg-muted font-medium border-l-2 border-primary"
};
```

### 2.4 Quick Tips Section

The bottom of the 2nd pane includes contextual tips that change based on selected category:

| Category | Quick Tip Content |
|----------|-------------------|
| Folders | "Folders organize calls for browsing. They don't affect AI analysis." |
| Tags | "Tags classify calls and control AI behavior. System tags cannot be modified." |
| Rules | "Rules automatically tag and sort incoming calls. Higher priority rules run first." |
| Recurring | "Recurring titles show your most common calls. Create rules to automate sorting." |

---

## 3. 3rd Pane: Management Interface

### 3.1 Content by Category

Each category displays its management interface in the 3rd pane:

| Category | 3rd Pane Content | Primary Action |
|----------|------------------|----------------|
| Folders | Folder list table | + Create Folder button |
| Tags | Tags list table | (No create - view/edit only) |
| Rules | Rules list table | + Create Rule button |
| Recurring | Recurring titles table | Create Rule per-row |

### 3.2 Folders Management (3rd Pane)

```
┌───────────────────────────────────────────────────────────────┐
│  FOLDERS                                           + Create   │
│ ───────────────────────────────────────────────────────────── │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Icon │ Name              │ Calls │ Actions              │ │
│  ├──────┼───────────────────┼───────┼──────────────────────┤ │
│  │  📁  │ Work              │   12  │  ⋮  🗑               │ │
│  │  📁  │   └─ Projects     │    5  │  ⋮  🗑               │ │  ← Indented child
│  │  📁  │   └─ Meetings     │    7  │  ⋮  🗑               │ │
│  │  📁  │ Personal          │    8  │  ⋮  🗑               │ │
│  │  📁  │ Archive           │    5  │  ⋮  🗑               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Showing 5 folders                                            │
└───────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click row → Opens FolderDetailPanel in 4th pane
- Double-click name → Inline rename
- Context menu (⋮) → Rename, Duplicate, Delete
- Keyboard: Arrow nav, Cmd+N (create), Cmd+E (edit), Cmd+Backspace (delete)

### 3.3 Tags Management (3rd Pane)

```
┌───────────────────────────────────────────────────────────────┐
│  TAGS                                                         │
│ ───────────────────────────────────────────────────────────── │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Color │ Name        │ Type   │ Description │ Calls      │ │
│  ├───────┼─────────────┼────────┼─────────────┼────────────┤ │
│  │  🔵   │ Important   │ System │ Priority    │   24       │ │
│  │  🟢   │ Follow-up   │ System │ Needs action│   12       │ │
│  │  🟡   │ Sales Lead  │ Custom │ Potential   │    8       │ │
│  │  🟣   │ Support     │ Custom │ Help ticket │    5       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Showing 4 tags (2 system, 2 custom)                          │
└───────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click row → Opens TagDetailPanel in 4th pane
- Context menu → Edit, Duplicate, Delete (disabled for system tags)
- Keyboard: Arrow nav, Cmd+E (edit), Cmd+Backspace (delete)

**Note:** No "Create Tag" button exists in current implementation. This is preserved for feature parity.

### 3.4 Rules Management (3rd Pane)

```
┌───────────────────────────────────────────────────────────────┐
│  RULES                                     + Create    Apply  │
│ ───────────────────────────────────────────────────────────── │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Active │ Name          │ Type      │ Tag  │ Folder │ ×  │ │
│  ├────────┼───────────────┼───────────┼──────┼────────┼────┤ │
│  │  [✓]   │ Sales Calls   │ Contains  │ 🟡   │  📁    │ 🗑 │ │
│  │  [✓]   │ Support       │ Keyword   │ 🟣   │  📁    │ 🗑 │ │
│  │  [ ]   │ Weekly Sync   │ Day/Time  │ 🔵   │  -     │ 🗑 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  3 rules (2 active)                                           │
└───────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Toggle switch → Enable/disable rule inline
- Edit button → Opens CreateEditRuleDialog (modal preserved)
- Delete button → Confirmation dialog
- "Apply" button → Runs rules on untagged calls
- Keyboard: Cmd+N (create)

**Modal Preservation:** Rules use modal dialogs due to complex multi-field forms. This pattern is preserved.

### 3.5 Recurring Titles Management (3rd Pane)

```
┌───────────────────────────────────────────────────────────────┐
│  RECURRING TITLES                                             │
│ ───────────────────────────────────────────────────────────── │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Title                    │ Count │ Last Seen │ Status   │ │
│  ├──────────────────────────┼───────┼───────────┼──────────┤ │
│  │ Weekly Team Sync         │   24  │ Jan 5     │ Has Rule │ │
│  │ Sales Call with [Client] │   18  │ Jan 4     │ [Create] │ │
│  │ Support: Ticket #XXX     │   12  │ Jan 3     │ [Create] │ │
│  │ 1:1 with [Name]          │    8  │ Jan 2     │ Has Rule │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Top 50 recurring titles                                      │
└───────────────────────────────────────────────────────────────┘
```

**Interactions:**
- "Create" button → Opens simplified rule creation dialog
- Status column shows existing rule presence
- Read-only list (discovery/suggestion tool)

---

## 4. 4th Pane: Detail Panels

### 4.1 Panel Behavior

The 4th pane opens when an item is selected in the 3rd pane, displaying the appropriate detail panel.

| Category | 4th Pane Component | Trigger |
|----------|-------------------|---------|
| Folders | `FolderDetailPanel` | Click folder row |
| Tags | `TagDetailPanel` | Click tag row |
| Rules | N/A (uses modal) | - |
| Recurring | N/A (uses modal) | - |

### 4.2 FolderDetailPanel (4th Pane)

```
┌─────────────────────────────────────┐
│ FOLDER DETAILS               ✕  📌  │
├─────────────────────────────────────┤
│                                     │
│  Icon                               │
│  ┌─────────────────────────────┐   │
│  │        📁 (click to change) │   │
│  └─────────────────────────────┘   │
│                                     │
│  Name *                             │
│  ┌─────────────────────────────┐   │
│  │ Work Projects               │   │
│  └─────────────────────────────┘   │
│                                     │
│  Parent Folder                      │
│  ┌─────────────────────────────┐   │
│  │ Work                     ▼  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ☐ Show description field          │
│                                     │
│  ┌───────────┐  ┌─────────────┐    │
│  │   Save    │  │   Delete    │    │
│  └───────────┘  └─────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Features:**
- Icon picker (emoji selection)
- Name input (required)
- Parent folder dropdown
- Optional description toggle
- Save/Delete actions
- Pin toggle (keeps panel open on selection change)

### 4.3 TagDetailPanel (4th Pane)

```
┌─────────────────────────────────────┐
│ TAG DETAILS                  ✕  📌  │
├─────────────────────────────────────┤
│                                     │
│  ⚠️ System tags cannot be edited    │  ← Shown for system tags only
│                                     │
│  Color                              │
│  🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🩷     │
│                                     │
│  Name *                             │
│  ┌─────────────────────────────┐   │
│  │ Sales Lead                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  Description                        │
│  ┌─────────────────────────────┐   │
│  │ Potential sales opportunity │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌───────────┐  ┌─────────────┐    │
│  │   Save    │  │   Delete    │    │
│  └───────────┘  └─────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Features:**
- Color picker (10 options)
- Name input (required)
- Description input (optional)
- Save/Delete actions
- System tag notice (form disabled for system tags)

---

## 5. Navigation Flow Diagram

### 5.1 Complete Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        SORTING/TAGGING NAVIGATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  SIDEBAR              2ND PANE              3RD PANE              4TH PANE          │
│  (Level 1)            (Level 2)             (Level 3)             (Level 4)         │
│                                                                                     │
│  ┌─────────────┐     ┌──────────────┐      ┌────────────────┐    ┌──────────────┐  │
│  │             │     │ ORGANIZATION │      │                │    │              │  │
│  │  [Library]  │     │              │      │                │    │              │  │
│  │  [Dash]     │     │ ○ Folders ───┼──────┤► FOLDERS LIST  ├────┤► FOLDER      │  │
│  │  [Settings] │     │              │      │   + Create     │    │   DETAIL     │  │
│  │  [Sorting]──┼────►│ ○ Tags ──────┼──────┤► TAGS LIST     ├────┤► TAG         │  │
│  │  [Help]     │     │              │      │                │    │   DETAIL     │  │
│  │             │     │ ○ Rules ─────┼──────┤► RULES LIST    │    │              │  │
│  │             │     │              │      │   + Create     │    │  (N/A -      │  │
│  │             │     │ ○ Recurring ─┼──────┤► RECURRING     │    │   uses       │  │
│  │             │     │              │      │   TITLES       │    │   modal)     │  │
│  │             │     │              │      │                │    │              │  │
│  └─────────────┘     └──────────────┘      └────────────────┘    └──────────────┘  │
│                                                                                     │
│  Click "Sorting"     Click category        View & manage         Edit selected     │
│  in sidebar          to load content       items in list         item details      │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 State Transitions

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              STATE TRANSITION DIAGRAM                                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  INITIAL STATE (entering /sorting-tagging)                                           │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Sidebar: Sorting active | 2nd: Categories visible | 3rd: Folders | 4th: Closed │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  USER CLICKS "Tags" in 2nd Pane                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Sidebar: Sorting active | 2nd: Tags active | 3rd: Tags List | 4th: Closed      │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  USER CLICKS a tag row in 3rd Pane                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Sidebar: Sorting active | 2nd: Tags active | 3rd: Tags List | 4th: Tag Detail  │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  USER CLICKS "Rules" in 2nd Pane                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Sidebar: Sorting active | 2nd: Rules active | 3rd: Rules List | 4th: Closed    │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  USER PRESSES Escape (with 4th pane open)                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ 4th pane closes, selection cleared in 3rd pane                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Click Reduction Analysis

### 6.1 Current Tab-Based Click Counts

| Workflow | Current Clicks | Steps |
|----------|---------------|-------|
| Edit a folder | 3 | Navigate to Sorting → Click Folders tab → Click folder |
| Edit a tag | 3 | Navigate to Sorting → Click Tags tab → Click tag |
| Create a rule | 3 | Navigate to Sorting → Click Rules tab → Click Create |
| View recurring titles | 3 | Navigate to Sorting → Click Recurring tab → View |
| Delete a folder | 5 | Nav → Tab → Select → Delete → Confirm |

### 6.2 New Pane-Based Click Counts

| Workflow | New Clicks | Steps | Reduction |
|----------|------------|-------|-----------|
| Edit a folder | 2 | Click Sorting → Click folder (Folders is default) | 33% |
| Edit a tag | 3 | Click Sorting → Click Tags → Click tag | 0% |
| Create a rule | 3 | Click Sorting → Click Rules → Click Create | 0% |
| View recurring titles | 2 | Click Sorting → Click Recurring | 33% |
| Delete a folder | 4 | Sorting → Folder → Delete → Confirm | 20% |

### 6.3 Average Click Reduction

| Metric | Old | New | Improvement |
|--------|-----|-----|-------------|
| Average clicks (5 workflows) | 3.4 | 2.8 | **18%** |
| Most common workflow (edit folder) | 3 | 2 | **33%** |

**Note:** The reduction is smaller for SortingTagging than Settings because the current tab interface is already relatively efficient. The main benefits are:
1. **Persistent 2nd pane** - Category visible without clicking tabs
2. **Default category** - Folders loads immediately
3. **Consistent navigation** - Same pattern as Settings page

---

## 7. URL Routing & Deep Links

### 7.1 URL Structure

```
/sorting-tagging                    → 2nd: Categories, 3rd: Folders (default)
/sorting-tagging/folders            → 2nd: Categories, 3rd: Folders
/sorting-tagging/folders/:id        → 2nd: Categories, 3rd: Folders, 4th: FolderDetail
/sorting-tagging/tags               → 2nd: Categories, 3rd: Tags
/sorting-tagging/tags/:id           → 2nd: Categories, 3rd: Tags, 4th: TagDetail
/sorting-tagging/rules              → 2nd: Categories, 3rd: Rules
/sorting-tagging/recurring          → 2nd: Categories, 3rd: Recurring Titles
```

### 7.2 Route Parameters

| Route | Pane State |
|-------|------------|
| Base `/sorting-tagging` | 2nd open, 3rd shows Folders, 4th closed |
| Category `/sorting-tagging/:category` | 2nd open, 3rd shows category content, 4th closed |
| Item `/sorting-tagging/:category/:id` | 2nd open, 3rd shows category, 4th shows item detail |

### 7.3 Browser Navigation

- **Back button**: Closes 4th pane first, then changes category, then exits page
- **Forward button**: Restores previous pane state from history
- **Direct URL**: Opens all required panes in correct state

---

## 8. Keyboard Navigation

### 8.1 Global Shortcuts (SortingTagging Page)

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Escape` | Close 4th pane / deselect item | When 4th pane open |
| `Cmd+1` | Switch to Folders | Global |
| `Cmd+2` | Switch to Tags | Global |
| `Cmd+3` | Switch to Rules | Global |
| `Cmd+4` | Switch to Recurring | Global |

### 8.2 Category-Specific Shortcuts

| Category | Shortcut | Action |
|----------|----------|--------|
| Folders | `Cmd+N` | Create new folder |
| Folders | `Cmd+E` | Edit selected folder (inline) |
| Folders | `Cmd+Backspace` | Delete selected folder |
| Rules | `Cmd+N` | Create new rule |

### 8.3 Focus Management

```
Tab order: 2nd Pane Categories → 3rd Pane List → 3rd Pane Actions → 4th Pane (if open)

Arrow Up/Down: Navigate within current list
Enter: Select item / confirm action
Escape: Close 4th pane → Clear selection → Exit to previous page
```

---

## 9. Responsive Behavior

### 9.1 Breakpoint Behavior

| Breakpoint | 2nd Pane | 3rd Pane | 4th Pane |
|------------|----------|----------|----------|
| Desktop (>1280px) | Side-by-side (260px) | Flexible | Side-by-side (340px) |
| Large Tablet (1024-1280px) | Side-by-side (240px) | Flexible | Overlay (340px) |
| Tablet (768-1024px) | Collapsible drawer | Full width | Bottom sheet |
| Mobile (<768px) | Hidden (hamburger) | Full width | Full screen modal |

### 9.2 Mobile Navigation Flow

```
Mobile: Sorting/Tagging
┌─────────────────────────┐
│  ☰  Organization        │
├─────────────────────────┤
│                         │
│    ○ Folders       →    │
│    ○ Tags          →    │
│    ○ Rules         →    │
│    ○ Recurring     →    │
│                         │
└─────────────────────────┘

         ↓ Tap Folders

┌─────────────────────────┐
│  ←  Folders      + Add  │
├─────────────────────────┤
│                         │
│  📁 Work           (12) │
│  📁 Personal        (8) │
│  📁 Archive         (5) │
│                         │
└─────────────────────────┘

         ↓ Tap folder

┌─────────────────────────┐
│  ←  Folder Detail       │
├─────────────────────────┤
│                         │
│  Icon: 📁               │
│  Name: Work             │
│  Parent: None           │
│                         │
│  [Save]  [Delete]       │
└─────────────────────────┘
```

---

## 10. Component Mapping

### 10.1 Existing Components to Reuse

| Component | Current Location | New Role |
|-----------|------------------|----------|
| `FoldersTab.tsx` | `src/components/sorting-tagging/` | 3rd Pane content for Folders |
| `TagsTab.tsx` | `src/components/sorting-tagging/` | 3rd Pane content for Tags |
| `RulesTab.tsx` | `src/components/sorting-tagging/` | 3rd Pane content for Rules |
| `RecurringTitlesTab.tsx` | `src/components/sorting-tagging/` | 3rd Pane content for Recurring |
| `FolderDetailPanel.tsx` | `src/components/` | 4th Pane for folder editing |
| `TagDetailPanel.tsx` | `src/components/` | 4th Pane for tag editing |

### 10.2 New Components to Create

| Component | Purpose | Location |
|-----------|---------|----------|
| `SortingCategoryPane` | 2nd Pane category list | `src/components/panes/` |
| `SortingManagementPane` | 3rd Pane wrapper with routing | `src/components/panes/` |

### 10.3 Panel Store Extensions

```typescript
// Extend panelStore for sorting-tagging navigation
interface SortingTaggingPaneState {
  // 2nd Pane
  sortingCategoryOpen: boolean;
  activeCategory: 'folders' | 'tags' | 'rules' | 'recurring';

  // 4th Pane (uses existing detail panel state)
  selectedFolderId: string | null;
  selectedTagId: string | null;

  // Actions
  setActiveCategory: (category: SortingTaggingPaneState['activeCategory']) => void;
  selectFolder: (id: string | null) => void;
  selectTag: (id: string | null) => void;
}
```

---

## 11. Implementation Checklist

### Phase 1: Add Pane Components (Dual Mode)
- [ ] Create `SortingCategoryPane` component
- [ ] Create `SortingManagementPane` wrapper
- [ ] Extend panelStore with sorting-tagging state
- [ ] Preserve existing tab navigation (parallel operation)

### Phase 2: Wire Navigation
- [ ] Connect 2nd pane categories to load 3rd pane content
- [ ] Connect 3rd pane item clicks to open 4th pane
- [ ] Implement URL routing for deep links
- [ ] Test full navigation flows

### Phase 3: Remove Tabs
- [ ] Remove Radix Tabs from SortingTagging.tsx
- [ ] Update page layout to use pane components
- [ ] Migrate keyboard shortcuts to new structure

### Phase 4: Polish
- [ ] Add pane transition animations
- [ ] Implement responsive breakpoints
- [ ] Verify keyboard navigation
- [ ] Test click reduction metrics

---

## 12. Risk Assessment

### 12.1 Potential Issues

| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature regression | High | Maintain dual mode until fully tested |
| Deep link breakage | Medium | Redirect old URLs to new structure |
| Keyboard shortcut conflicts | Low | Audit existing shortcuts before remapping |
| Mobile UX degradation | Medium | Test on real devices before removing tabs |

### 12.2 Rollback Strategy

If issues are discovered post-migration:
1. Revert to tab-based navigation via feature flag
2. Pane components remain in codebase but unused
3. URL routes redirect to tab-based equivalents

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Author:** Auto-Claude Agent
