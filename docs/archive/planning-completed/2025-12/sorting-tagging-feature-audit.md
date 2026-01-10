# Sorting & Tagging Page Feature Audit

> Complete audit of the SortingTagging.tsx page and its 4 tab components.
> Generated for UX Research & Navigation Design phase.

## Overview

The SortingTagging page (`src/pages/SortingTagging.tsx`) is a settings page for managing call organization through folders, tags, and automated rules. It uses a tabbed interface with 4 distinct tabs.

### Page Layout Structure

| Pane | Component | Description | Visibility |
|------|-----------|-------------|------------|
| 1 | Navigation Rail (SidebarNav) | Main app navigation | Desktop/Tablet (collapsible) |
| 2 | Secondary Panel | Library panel placeholder | Hidden by default on settings pages |
| 3 | Main Content (Tabs) | Settings tabs with content | Always visible |
| 4 | Right Panel (Detail) | FolderDetailPanel / TagDetailPanel | Opens on item selection |

---

## Tab 1: FOLDERS (`FoldersTab.tsx`)

### Purpose
Create and manage folders to organize calls for browsing. Folders do NOT affect AI analysis.

### Features Inventory

| Feature | Type | Click Count | Description |
|---------|------|-------------|-------------|
| View folder list | Display | 0 | Table showing all folders with hierarchy |
| Create folder | Action | 1 | Button opens QuickCreateFolderDialog |
| Select folder | Action | 1 | Click row to open FolderDetailPanel |
| Inline rename | Action | 2 | Double-click name to edit inline |
| Delete folder | Action | 2 | Click delete icon + confirm dialog |
| Duplicate folder | Action | 2 | Context menu → Duplicate |
| Edit via panel | Action | 1 | Click row opens detail panel for editing |

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+N` | Open create folder dialog | Always on Folders tab |
| `Cmd+E` | Start inline rename | When folder selected |
| `Cmd+Backspace` | Delete folder | When folder selected |
| `Arrow Up/Down` | Navigate list | When table focused |
| `Enter` | Select focused folder | When folder focused |
| `Escape` | Close detail panel | When panel open |

### Data Displayed per Folder

- Icon (emoji or Remix icon)
- Name (with optional description)
- Hierarchy indentation (nested folders)
- Call count (# of calls in folder)
- Actions column (delete button)

### Context Menu Actions

1. **Rename** - Opens inline edit mode
2. **Duplicate** - Creates "Copy of {name}"
3. **Delete** - Opens confirmation dialog

### Detail Panel Features (FolderDetailPanel)

| Feature | Click Count | Description |
|---------|-------------|-------------|
| Edit name | 0 | Direct input field |
| Edit icon | 1-2 | Emoji picker inline (click to select) |
| Change parent folder | 1-2 | Dropdown select |
| Toggle description | 1 | Checkbox to show/hide description field |
| Save changes | 1 | Save button (requires changes) |
| Delete folder | 2 | Delete button + confirmation |
| Pin panel | 1 | Keeps panel open on selection change |
| Close panel | 1 | X button or Escape key |

### Empty State
- Icon: RiFolderLine (muted)
- Title: "No folders yet"
- Description: Explains folder purpose
- CTA: "Create Folder" button

### Technical Features
- **Virtualization**: Enabled for 50+ folders (useVirtualTable)
- **Keyboard Navigation**: Full arrow key support (useListKeyboardNavigationWithState)
- **Loading Skeleton**: Shimmer UI during data fetch
- **Optimistic Updates**: Via React Query mutations

---

## Tab 2: TAGS (`TagsTab.tsx`)

### Purpose
View and manage call tags. Tags classify calls and control AI behavior.

### Features Inventory

| Feature | Type | Click Count | Description |
|---------|------|-------------|-------------|
| View tags list | Display | 0 | Table showing all tags |
| Select tag | Action | 1 | Click row to open TagDetailPanel |
| Edit tag | Action | 1 | Opens detail panel (no inline edit) |
| Duplicate tag | Action | 2 | Context menu → Duplicate |
| Delete tag | Action | 3 | Context menu → Delete → Confirm |

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+E` | Open detail panel | When tag selected |
| `Cmd+Backspace` | Delete tag | When non-system tag selected |
| `Arrow Up/Down` | Navigate list | When table focused |
| `Enter` | Select focused tag | When tag focused |
| `Escape` | Close detail panel | When panel open |

### Data Displayed per Tag

- Color swatch (6x6 rounded box)
- Name
- Description (or "-" if empty)
- Type badge (System / Custom)
- Call count (# of calls with tag)

### Context Menu Actions

1. **Edit** - Opens TagDetailPanel
2. **Duplicate** - Creates "Copy of {name}" (always custom)
3. **Delete** - Opens confirmation (disabled for system tags)

### Detail Panel Features (TagDetailPanel)

| Feature | Click Count | Description |
|---------|-------------|-------------|
| Edit name | 0 | Direct input field |
| Edit description | 0 | Direct input field |
| Change color | 1 | Click color swatch (10 options) |
| Save changes | 1 | Save button (requires changes) |
| Delete tag | 2 | Delete button + confirmation |
| Pin panel | 1 | Keeps panel open on selection change |
| Close panel | 1 | X button or Escape key |

### System Tags Behavior
- **Cannot edit**: Form hidden for system tags
- **Cannot delete**: Delete button hidden
- **Notice displayed**: Yellow info box explaining restrictions

### Empty State
- Icon: RiPriceTag3Line (muted)
- Title: "No tags yet"
- Description: Explains tag purpose

### Notable Limitations
- **No create button**: Tags are view/edit only (no in-tab creation)
- **No inline editing**: Must use detail panel

---

## Tab 3: RULES (`RulesTab.tsx`)

### Purpose
Create and manage rules for automatic sorting and tagging of incoming calls.

### Features Inventory

| Feature | Type | Click Count | Description |
|---------|------|-------------|-------------|
| View rules list | Display | 0 | Table showing all rules |
| Create rule | Action | 1 | "Create Rule" button opens dialog |
| Toggle rule active | Action | 1 | Switch in table row |
| Edit rule | Action | 1 | Edit button opens dialog |
| Delete rule | Action | 2 | Delete button + confirm dialog |
| Apply rules now | Action | 1 | Runs rules on untagged calls |

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+N` | Open create rule dialog | Always on Rules tab |

### Data Displayed per Rule

- Active status (Switch toggle)
- Name + optional description
- Rule type (Badge: Title Exact Match, Title Contains, etc.)
- Assigned tag (color swatch + name)
- Assigned folder (icon + name)
- Times applied count
- Action buttons (Edit, Delete)

### Rule Types

| Type | Conditions Fields |
|------|-------------------|
| `title_exact` | Exact title text |
| `title_contains` | Contains text |
| `title_regex` | Regex pattern |
| `transcript_keyword` | Keywords array + search chars limit |
| `day_time` | Day of week (0-6) + Hour (0-23) |

### Create/Edit Dialog Fields

1. **Rule Name** * (required)
2. **Description** (optional)
3. **Rule Type** (dropdown)
4. **Priority** (number, default 100)
5. **Assign Tag** (optional dropdown)
6. **Assign to Folder** (optional dropdown)
7. **Condition fields** (dynamic based on type)

### Rule Actions

| Action | Result |
|--------|--------|
| Toggle active | Enables/disables rule without deleting |
| Apply rules now | Runs `apply_tag_rules_to_untagged` RPC |

### Empty State
- Icon: RiFlowChart (muted)
- Title: "No rules yet"
- Description: Explains automation purpose
- CTA: "Create Rule" button

### Notable Characteristics
- **No detail panel**: Uses modal dialogs instead
- **Inline activation**: Toggle switch in table
- **Batch apply**: "Apply Rules Now" for retroactive tagging

---

## Tab 4: RECURRING TITLES (`RecurringTitlesTab.tsx`)

### Purpose
View most common call titles and quickly create sorting rules for them.

### Features Inventory

| Feature | Type | Click Count | Description |
|---------|------|-------------|-------------|
| View recurring titles | Display | 0 | Table of top 50 titles by count |
| Create rule from title | Action | 1 | "Create Rule" button per row |
| View existing rule status | Display | 0 | Badge shows "Has Rule" or "No Rule" |

### Data Displayed per Title

- Title text
- Occurrence count
- Last seen date
- Rule status (Badge: Has Rule / No Rule)
- Action button (Create Rule / Exists)

### Create Rule Dialog Fields

1. **Title Pattern** (read-only, pre-filled)
2. **Rule Name** (editable, auto-generated)
3. **Tag** (optional dropdown)
4. **Folder** (optional dropdown)
5. Validation: At least tag OR folder required

### Notable Characteristics
- **Discovery tool**: Helps identify patterns for automation
- **One-click rule creation**: Streamlined from recurring titles
- **Disabled for existing rules**: Can't create duplicate rules

### Empty State
- Uses default table empty state
- No dedicated empty state messaging

---

## Cross-Tab UX Analysis

### Click Count Summary by Common Actions

| Action | Folders | Tags | Rules | Recurring |
|--------|---------|------|-------|-----------|
| View items | 0 | 0 | 0 | 0 |
| Create new | 1 | N/A | 1 | 1 |
| Edit item | 1 (panel) | 1 (panel) | 1 (dialog) | N/A |
| Delete item | 2 | 3 | 2 | N/A |
| Duplicate | 2 | 2 | N/A | N/A |

### Interaction Pattern Inconsistencies

| Aspect | Folders | Tags | Rules | Recurring |
|--------|---------|------|-------|-----------|
| Detail editing | Right Panel | Right Panel | Modal Dialog | Modal Dialog |
| Inline editing | Yes (rename) | No | No | No |
| Create button | Top of tab | None | Top of tab | Per-row |
| Context menu | Yes | Yes | No | No |
| Keyboard shortcuts | Full | Partial | Minimal | None |

### Mobile Considerations

- **Navigation**: Mobile overlay (slide-in from left)
- **Detail panels**: Bottom sheet on mobile
- **Tables**: May have horizontal scroll issues on narrow screens

---

## Accessibility Features

### Present
- ARIA labels on navigation, panels, tables
- Keyboard navigation for lists
- Screen reader announcements for virtualization
- Role attributes on dialogs
- Focus management in modals
- Toggle button states (aria-pressed)

### Gaps
- No skip links
- Limited focus trapping in mobile overlays
- Some color-only indicators (tag colors)

---

## State Management

| Store/Hook | Purpose |
|------------|---------|
| `usePanelStore` | Right panel open/close, pin state |
| `useFolders` | Folder CRUD operations |
| React Query | Tags, rules, recurring titles data fetching |
| Local state | Form fields, dialogs, inline editing |

---

## Recommendations for Consolidation

### High Priority
1. **Add tag creation**: Currently no way to create tags in Tags tab
2. **Standardize edit UX**: Choose either panel or dialog consistently
3. **Add keyboard shortcuts to Rules/Recurring**: Currently minimal support

### Medium Priority
4. **Add context menus to Rules**: For edit/delete consistency
5. **Consolidate "Create Rule" flows**: Rules tab + Recurring tab have different dialogs
6. **Add virtualization to Tags**: Currently no virtualization

### Low Priority
7. **Unify empty states**: Consistent messaging and icons
8. **Add bulk operations**: Multi-select for delete/move
