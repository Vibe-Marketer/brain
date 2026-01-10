# SPEC: Table UI Consistency Repair

## What

Repair all table implementations across CallVault to match the gold standard table design found in `TranscriptTable.tsx`. Currently, multiple tables deviate from brand guidelines with inconsistent borders, header styling, and missing vibe orange underlines on sortable columns. This spec documents the exact styling that must be applied to every table in the application.

## Why

Visual consistency is a core principle of the CallVault brand. Tables are data-first components and inconsistent styling creates visual noise that distracts from the information. The brand guidelines (v4.1.3) specify exact table design rules, but many tables currently violate these rules with borders, backgrounds, and styling that don't match the documented standard.

## User Experience

Users will see:
- **Consistent table headers** across all pages with white backgrounds (#FFFFFF light / #202020 dark)
- **3px vibe orange underlines** ONLY on individual sortable column headers (not entire rows)
- **Clean horizontal borders** - 1px borders between rows, no vertical borders
- **Consistent hover states** - entire row background changes to #F8F8F8 (light) / #2A2A2A (dark)
- **Uniform typography** - 12px uppercase headers, consistent cell text sizing
- **No visual clutter** - tables wrapped in border containers removed where inappropriate

The visual experience will be unified - a table on the Settings page will look identical to a table on the Transcripts page.

## Scope

**Applies to:**
- All `<Table>` components using `src/components/ui/table.tsx`
- All files importing `TableHeader`, `TableRow`, `TableHead`, `TableCell`, `TableBody`

**Does NOT apply to:**
- Non-table layouts (grids, lists)
- Custom data visualizations
- Dialog/modal content that isn't tabular

## Gold Standard Specification

### Location
`/Users/Naegele/dev/brain/src/components/transcript-library/TranscriptTable.tsx` (lines 168-278)

### Header Row Styling

**Correct implementation:**

```tsx
<TableHeader>
  <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
    <TableHead className="min-w-[150px] h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
      <SortButton field="title">TITLE</SortButton>
    </TableHead>
    {/* Additional headers... */}
  </TableRow>
</TableHeader>
```

**Key attributes:**
- `TableRow`: `hover:bg-transparent` (disable hover on header row)
- `TableRow`: `border-b border-cb-gray-light dark:border-cb-gray-dark` (NOT `border-b-2`, NOT `border-cb-black`)
- `TableHead`: `h-10 md:h-12` (height consistency)
- `TableHead`: `text-xs md:text-sm` (responsive font sizing)
- `TableHead`: `whitespace-nowrap` (prevent text wrapping)
- Headers: Uppercase text (e.g., "TITLE", "DATE")

### Sortable Column Underline (Vibe Orange)

When a column header is sortable and active, apply 3px vibe orange underline:

```tsx
// This styling is typically applied within the SortButton component or similar
// The 3px underline should be applied to the INDIVIDUAL column header, not the entire row
// Implementation varies, but the visual result must be:
// - 3px solid #FF8800 underline
// - Only on the specific sortable column
// - NOT a border-b-2 or border-b-[3px] on the entire TableRow
```

**CRITICAL:** The vibe orange underline goes on individual sortable column headers, NOT the entire header row.

### Body Row Styling

**Correct implementation:**

```tsx
<TableRow className="group h-10 md:h-12 hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark">
  <TableCell className="py-0.5">
    {/* Cell content */}
  </TableCell>
</TableRow>
```

**Key attributes:**
- `TableRow`: `h-10 md:h-12` (match header height)
- `TableRow`: `hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark` (consistent hover state)
- `TableRow`: `group` (enables group-hover utilities if needed)
- `TableCell`: `py-0.5` (minimal vertical padding for compact rows)

### Table Container

**Correct - No outer border container:**

```tsx
<div className="overflow-x-auto">
  <Table>
    {/* Table content */}
  </Table>
</div>
```

**AVOID - Border containers (these create visual clutter):**

```tsx
<!-- WRONG -->
<div className="border border-cb-border dark:border-cb-border-dark rounded-lg overflow-hidden">
  <Table>
    {/* ... */}
  </Table>
</div>
```

**EXCEPTION:** Border containers are acceptable in certain contexts:
- Tables in dialog/modal content
- Settings tabs where tables need visual separation
- Tables that are part of a card component (per the 10% rule)

## Inventory of Tables Requiring Repair

### 1. UserTable Component
**File:** `/Users/Naegele/dev/brain/src/components/settings/UserTable.tsx`
**Lines:** 96-199

**Current issues:**
- Line 100: `border-t border-b-2 border-cb-black dark:border-cb-white` - WRONG
  - Should be: `border-b border-cb-gray-light dark:border-cb-gray-dark`
  - The `border-t` is unnecessary
  - The `border-b-2` creates visual weight
  - `border-cb-black/white` is too harsh

**Changes needed:**
```tsx
// BEFORE (line 100):
<TableRow className="hover:bg-transparent border-t border-b-2 border-cb-black dark:border-cb-white">

// AFTER:
<TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
```

**Priority:** HIGH (used in Settings > Users and Settings > Admin)

---

### 2. CoachesTab - RelationshipTable
**File:** `/Users/Naegele/dev/brain/src/components/settings/CoachesTab.tsx`
**Lines:** 363-430

**Current issues:**
- Line 364: Entire table wrapped in `border border-cb-border dark:border-cb-border-dark rounded-lg overflow-hidden`
  - This creates a border container which adds visual clutter
  - May be acceptable in Settings context (edge case), but should be reviewed

**Changes needed:**
```tsx
// BEFORE (line 364):
<div className="border border-cb-border dark:border-cb-border-dark rounded-lg overflow-hidden">

// AFTER (two options):
// Option 1 - Remove border (cleaner):
<div className="overflow-hidden">

// Option 2 - Keep minimal border (if visual separation needed in Settings):
<div className="border-t border-cb-gray-light dark:border-cb-gray-dark">
```

- Lines 367-372: TableRow needs consistent styling
  - No explicit border classes visible in the grep output, but should verify header row matches gold standard

**Priority:** MEDIUM (Settings > Coaches tab)

---

### 3. AccessLogViewer Component
**File:** `/Users/Naegele/dev/brain/src/components/sharing/AccessLogViewer.tsx`
**Lines:** 129-198

**Current issues:**
- Line 129: `border-t border-cb-gray-light dark:border-cb-gray-dark` - acceptable top border for context
- Line 133: `border-t border-b-2 border-cb-black dark:border-cb-white` - WRONG (same issue as UserTable)

**Changes needed:**
```tsx
// BEFORE (line 133):
<TableRow className="hover:bg-transparent border-t border-b-2 border-cb-black dark:border-cb-white">

// AFTER:
<TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
```

**Priority:** HIGH (Sharing feature)

---

### 4. TagsTab Component
**File:** `/Users/Naegele/dev/brain/src/components/tags/TagsTab.tsx`
**Lines:** 252-272

**Current issues:**
- Line 252: Table wrapped in `border border-cb-border dark:border-cb-border-dark rounded-sm overflow-hidden`
  - Adds unnecessary visual container
- Line 255: `bg-cb-white dark:bg-card hover:bg-cb-white dark:hover:bg-card`
  - Sets explicit background colors which may conflict with default table styling
  - Hover state prevents the header row from being "static" (should use `hover:bg-transparent`)

**Changes needed:**
```tsx
// BEFORE (line 252):
<div className="border border-cb-border dark:border-cb-border-dark rounded-sm overflow-hidden">

// AFTER:
<div className="overflow-hidden">

// BEFORE (line 255):
<TableRow className="bg-cb-white dark:bg-card hover:bg-cb-white dark:hover:bg-card">

// AFTER:
<TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
```

**Priority:** MEDIUM (Settings > Sorting & Tagging)

---

### 5. FoldersTab Component
**File:** `/Users/Naegele/dev/brain/src/components/tags/FoldersTab.tsx`
**Lines:** 419-427

**Current issues:**
- Line 419: Table wrapped in `border border-cb-border rounded-sm overflow-hidden`
- Line 422: `bg-cb-white dark:bg-card` - explicit background, no hover state specified

**Changes needed:**
```tsx
// BEFORE (line 419):
<div className="border border-cb-border rounded-sm overflow-hidden">

// AFTER:
<div className="overflow-hidden">

// BEFORE (line 422):
<TableRow className="bg-cb-white dark:bg-card">

// AFTER:
<TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
```

**Priority:** MEDIUM (Settings > Sorting & Tagging)

---

### 6. Base Table Component (Potential Update)
**File:** `/Users/Naegele/dev/brain/src/components/ui/table.tsx`
**Lines:** 1-73

**Current state (CORRECT - no changes needed):**
- Line 15: TableHeader applies `[&_tr]:border-b [&_tr]:border-cb-gray-dark/30 dark:[&_tr]:border-cb-gray-light/30`
  - This is a fallback border that can be overridden by explicit classes
- Line 37: TableRow applies default hover and border styling
  - `border-b border-cb-gray-dark/30 dark:border-cb-gray-light/30`
  - `hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark`

**Note:** The base component provides good defaults for body rows. The issue is that component implementations are overriding with incorrect borders (especially header rows).

**Priority:** N/A (base component is correct)

---

### 7. TranscriptTable Component (GOLD STANDARD)
**File:** `/Users/Naegele/dev/brain/src/components/transcript-library/TranscriptTable.tsx`
**Lines:** 168-278

**Status:** CORRECT - this is the gold standard all others must match.

**No changes needed.**

---

## Summary Table of Changes

| Component | File | Line(s) | Current Issue | Change Type |
|-----------|------|---------|---------------|-------------|
| **UserTable** | `settings/UserTable.tsx` | 100 | `border-b-2 border-cb-black/white` | Fix border weight/color |
| **AccessLogViewer** | `sharing/AccessLogViewer.tsx` | 133 | `border-b-2 border-cb-black/white` | Fix border weight/color |
| **CoachesTab** | `settings/CoachesTab.tsx` | 364, 367-372 | Border container + verify header row | Remove container or simplify |
| **TagsTab** | `tags/TagsTab.tsx` | 252, 255 | Border container + wrong bg/hover | Remove container + fix header row |
| **FoldersTab** | `tags/FoldersTab.tsx` | 419, 422 | Border container + wrong bg | Remove container + fix header row |

## Implementation Checklist

### Phase 1: Critical Fixes (HIGH Priority)
- [ ] Fix UserTable header row border (line 100)
- [ ] Fix AccessLogViewer header row border (line 133)
- [ ] Verify UserTable body rows match gold standard hover states
- [ ] Verify AccessLogViewer body rows match gold standard hover states

### Phase 2: Settings Tab Tables (MEDIUM Priority)
- [ ] Fix TagsTab border container (line 252)
- [ ] Fix TagsTab header row background/hover (line 255)
- [ ] Fix FoldersTab border container (line 419)
- [ ] Fix FoldersTab header row background (line 422)
- [ ] Review CoachesTab border container - determine if acceptable in Settings context
- [ ] Fix CoachesTab header row if needed

### Phase 3: Verification & Testing
- [ ] Visual regression test: Compare all tables against TranscriptTable
- [ ] Dark mode verification: All tables render correctly in dark mode
- [ ] Responsive verification: Tables render correctly at mobile/tablet/desktop breakpoints
- [ ] Hover state verification: Row hover states work consistently
- [ ] Sortable column verification: Vibe orange underlines appear only on sortable columns

### Phase 4: Documentation Update
- [ ] Update brand-guidelines-v4.1.md with Table Design Specification (see section below)
- [ ] Add code examples showing correct vs. incorrect table styling
- [ ] Document when border containers are acceptable (Settings tabs, modals)
- [ ] Increment brand guidelines version to v4.1.4 (patch update)
- [ ] Add changelog entry with date, time, and commit hash

## Brand Guidelines Additions

### New Section: Table Design Specification

Add this section to `/Users/Naegele/dev/brain/docs/design/brand-guidelines-v4.1.md` at line 1901 (after current "TABLE DESIGN SYSTEM" heading):

```markdown
## TABLE DESIGN SYSTEM

### Overview

Tables are data-first components following strict visual consistency rules. All tables must match the gold standard implementation in `TranscriptTable.tsx`.

### Table Header Row

**Required Classes:**

```tsx
<TableHeader>
  <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
    <TableHead className="h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
      COLUMN NAME
    </TableHead>
  </TableRow>
</TableHeader>
```

**Critical Rules:**

| Element | Rule | Classes |
|---------|------|---------|
| TableRow | Disable hover | `hover:bg-transparent` |
| TableRow | Bottom border only | `border-b border-cb-gray-light dark:border-cb-gray-dark` |
| TableRow | NO top border | Remove `border-t` |
| TableRow | NO heavy border | Never `border-b-2` or `border-b-[3px]` |
| TableRow | NO harsh colors | Never `border-cb-black` or `border-cb-white` on entire row |
| TableHead | Consistent height | `h-10 md:h-12` |
| TableHead | Prevent wrapping | `whitespace-nowrap` |
| TableHead | Responsive text | `text-xs md:text-sm` |
| TableHead | Uppercase text | Content should be "COLUMN NAME" not "Column Name" |

**Background:**
- Light mode: `#FFFFFF` (from default `bg-card` or `bg-white`)
- Dark mode: `#202020` (from default `bg-card`)
- **Never** set explicit `bg-cb-white dark:bg-card` on header row (redundant with defaults)

### Vibe Orange Column Underline

**Rule:** 3px vibe orange underline appears ONLY on individual sortable column headers.

**Implementation:** Applied to the specific `<TableHead>` element or inner button/div, NOT the entire `<TableRow>`.

```tsx
// Correct - underline on individual column
<TableHead className="border-b-[3px] border-vibe-orange">
  SORTABLE COLUMN
</TableHead>

// OR via inner element
<TableHead>
  <button className="border-b-[3px] border-vibe-orange">
    SORTABLE COLUMN
  </button>
</TableHead>

// WRONG - never on entire row
<TableRow className="border-b-[3px] border-vibe-orange">
  {/* ... */}
</TableRow>
```

**Color:** `#FF8800` (`border-vibe-orange`)

### Table Body Rows

**Required Classes:**

```tsx
<TableRow className="group h-10 md:h-12 hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark">
  <TableCell className="py-0.5">
    {/* Cell content */}
  </TableCell>
</TableRow>
```

**Critical Rules:**

| Element | Rule | Classes |
|---------|------|---------|
| TableRow | Consistent height | `h-10 md:h-12` (match header) |
| TableRow | Hover background | `hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark` |
| TableRow | Enable group utilities | `group` (optional but recommended) |
| TableCell | Minimal padding | `py-0.5` for compact single-line content |
| TableCell | Align numbers right | `text-right tabular-nums` for numeric columns |

**Hover Colors:**
- Light mode: `#F8F8F8` (`bg-cb-bg-gray`)
- Dark mode: `#2A2A2A` (`bg-cb-panel-dark`)

### Table Containers

**Default (No Border):**

```tsx
<div className="overflow-x-auto">
  <Table>
    {/* Table content */}
  </Table>
</div>
```

**When Border Containers Are Acceptable:**

- Tables in dialog/modal content
- Settings tabs where visual separation is needed
- Tables that are part of metric/stat cards (per 10% rule)

**If Using Border Container:**

```tsx
<!-- Minimal border only -->
<div className="border-t border-cb-gray-light dark:border-cb-gray-dark">
  <Table>
    {/* Table content */}
  </Table>
</div>
```

**Avoid:**
- Full border containers: `border border-cb-border rounded-lg`
- Heavy borders: `border-2` or `border-[3px]`
- Rounded corners on table containers (tables are data-first, not decorative)

### Typography

**Headers:**
- Font size: 12px (`text-xs`) on mobile, 14px (`text-sm`) on desktop
- Font weight: 500 Medium (`font-medium`)
- Transform: Uppercase
- Color: `#7A7A7A` (light) / `#6B6B6B` (dark) via `text-muted-foreground`

**Body Text:**
- Primary: 14px (`text-sm`), weight 500 Medium
- Secondary: 12px (`text-xs`), weight 300 Light or 500 Medium
- Color: `text-cb-ink` for primary, `text-cb-ink-muted` for secondary

**Numbers:**
- Always use `tabular-nums` class for alignment
- Right-align numeric columns: `text-right`

### Complete Example (Gold Standard)

```tsx
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export function ExampleTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark">
            <TableHead className="h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
              NAME
            </TableHead>
            <TableHead className="h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
              DATE
            </TableHead>
            <TableHead className="h-10 md:h-12 whitespace-nowrap text-xs md:text-sm text-right">
              COUNT
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={item.id}
              className="group h-10 md:h-12 hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark"
            >
              <TableCell className="py-0.5 font-medium text-sm">
                {item.name}
              </TableCell>
              <TableCell className="py-0.5 text-sm text-cb-ink-muted">
                {item.date}
              </TableCell>
              <TableCell className="py-0.5 text-sm text-right tabular-nums">
                {item.count}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Common Mistakes to Avoid

| ❌ WRONG | ✅ CORRECT |
|----------|-----------|
| `border-b-2 border-cb-black` on header row | `border-b border-cb-gray-light dark:border-cb-gray-dark` |
| `border-t border-b-2` on header row | `border-b` only (bottom border) |
| `border border-cb-border rounded-lg` container | `overflow-x-auto` only (no border) |
| `bg-cb-white dark:bg-card` on header row | Let default background apply (redundant) |
| `hover:bg-cb-white` on header row | `hover:bg-transparent` (disable hover) |
| Lowercase header text: "Name" | Uppercase header text: "NAME" |
| Vibe orange on entire header row | Vibe orange on individual sortable columns only |

### Code Review Checklist

When reviewing table implementations, verify:

- [ ] Header row uses `hover:bg-transparent`
- [ ] Header row has `border-b border-cb-gray-light dark:border-cb-gray-dark`
- [ ] NO `border-b-2` or `border-cb-black/white` on header rows
- [ ] NO `border-t` on header rows (unless in specific container context)
- [ ] TableHead elements have `h-10 md:h-12 whitespace-nowrap text-xs md:text-sm`
- [ ] Header text is UPPERCASE
- [ ] Body rows have `hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark`
- [ ] Body rows have `h-10 md:h-12` (match header height)
- [ ] Numeric columns have `text-right tabular-nums`
- [ ] Table is NOT wrapped in unnecessary border container
- [ ] Vibe orange underlines (if any) are on individual sortable columns, not entire row
```

**Version Update:**
- Increment from v4.1.3 → v4.1.4 (patch)
- Update title, DOCUMENT VERSION section, and END OF BRAND GUIDELINES
- Add changelog entry with date, time, and commit hash

## Future Prevention

### Linting Rules (Proposed)

Create ESLint rule to warn on common table anti-patterns:

```javascript
// .eslint-rules/table-styling.js
module.exports = {
  rules: {
    'no-table-border-containers': {
      // Warn on <div className="border ... rounded-lg"><Table>
      // Suggest removing unless in Settings context
    },
    'no-heavy-table-borders': {
      // Error on border-b-2, border-b-[3px] on TableRow
      // Suggest border-b instead
    },
    'no-harsh-table-border-colors': {
      // Error on border-cb-black, border-cb-white on entire TableRow
      // Suggest border-cb-gray-light/dark instead
    }
  }
};
```

### Component Patterns

**Create shared SortButton component:**

```tsx
// src/components/ui/table-sort-button.tsx
import { RiArrowUpDownLine } from "@remixicon/react";

interface SortButtonProps {
  field: string;
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

export function TableSortButton({ field, children, active, onClick }: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        h-8 px-2 inline-flex items-center justify-center gap-2
        hover:bg-muted/50 font-medium text-sm rounded-md
        transition-colors cursor-pointer
        ${active ? 'border-b-[3px] border-vibe-orange' : ''}
      `}
    >
      {children}
      <RiArrowUpDownLine className={`ml-2 h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );
}
```

**Usage in tables:**

```tsx
<TableHead className="h-10 md:h-12 whitespace-nowrap text-xs md:text-sm">
  <TableSortButton
    field="title"
    active={sortField === 'title'}
    onClick={() => handleSort('title')}
  >
    TITLE
  </TableSortButton>
</TableHead>
```

### Review Checklist for New Tables

When adding new tables or modifying existing ones:

1. **Compare to gold standard** - Open `TranscriptTable.tsx` side-by-side
2. **Check header row classes** - Must include `hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark`
3. **Verify no heavy borders** - No `border-b-2` or `border-cb-black/white` on header rows
4. **Check body row hover** - Must include `hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark`
5. **Verify heights match** - Both header and body rows use `h-10 md:h-12`
6. **Confirm uppercase headers** - All column names in UPPERCASE
7. **Review container** - Avoid border containers unless in Settings/modal context
8. **Test dark mode** - Visual verification in dark mode
9. **Test responsive** - Verify mobile/tablet rendering

### PR Review Template

```markdown
## Table Styling Checklist

If this PR adds or modifies tables, verify:

- [ ] Header row: `hover:bg-transparent border-b border-cb-gray-light dark:border-cb-gray-dark`
- [ ] Body rows: `hover:bg-cb-bg-gray dark:hover:bg-cb-panel-dark`
- [ ] Consistent heights: `h-10 md:h-12` on all rows
- [ ] Uppercase headers: All column names in CAPS
- [ ] No border containers (or justified in Settings/modal context)
- [ ] Dark mode tested
- [ ] Mobile responsive verified
- [ ] Matches gold standard: `TranscriptTable.tsx`
```

## Open Questions

None - specification is complete and ready for implementation.

## Priority

**Must have:**
- Fix all HIGH priority tables (UserTable, AccessLogViewer)
- Fix MEDIUM priority tables (TagsTab, FoldersTab, CoachesTab)
- Update brand guidelines with Table Design Specification
- Add code examples and common mistakes section to guidelines

**Nice to have:**
- Create shared TableSortButton component for consistency
- Add ESLint rules to prevent future violations
- Create visual regression tests for all tables
- Add Playwright screenshots comparing before/after for each table

---

**Gold Standard Reference:** `/Users/Naegele/dev/brain/src/components/transcript-library/TranscriptTable.tsx` lines 168-278

**Brand Guidelines:** `/Users/Naegele/dev/brain/docs/design/brand-guidelines-v4.1.md` section 11 (Table Design System)

**Priority:** HIGH - Visual consistency is a core brand principle and tables appear on nearly every page.
