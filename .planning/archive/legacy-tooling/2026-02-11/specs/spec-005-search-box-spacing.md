# SPEC-005: Search Box Spacing

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Home Screen/All Transcripts
**Priority:** UI Polish

---

## Summary

Add proper spacing between the "Library" header and the search box in the folder sidebar so the search input doesn't feel cramped against the top element.

## What

Add padding/margin between the header section and the search input in `FolderSidebar.tsx`.

**Files affected:**
- `src/components/transcript-library/FolderSidebar.tsx` (lines 610-620)

**Current implementation:**
```tsx
{/* Header with no bottom margin */}
<header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-cb-card/50">
  ...
</header>

{/* Search immediately follows */}
{folders.length > 10 && (
  <div className="px-4 pb-2">
    <Input ... />
  </div>
)}
```

**Issue:** `pb-2` provides bottom padding but no top padding, making search feel cramped against the header border.

## Why

- Current design feels cramped and rushed
- No visual breathing room between header and interactive element
- Violates 4px grid spacing principles
- Poor visual hierarchy

## User Experience

- User sees Library header → comfortable gap → search box
- Search box has room to breathe
- Improved visual hierarchy and scanability

## Scope

**Includes:**
- Adding `pt-3` or `py-3` to the search container div
- Ensuring consistent spacing with rest of sidebar

**Excludes:**
- Changing search functionality
- Modifying header styling
- Changing when search appears (>10 folders threshold)

## Decisions Made

### Spacing amount
Use `py-3` (12px vertical padding) to match sidebar padding patterns.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| <10 folders (no search) | No impact - search not rendered |
| >10 folders | Search has proper spacing from header |

## Acceptance Criteria

- [ ] Search box has visible gap from header border
- [ ] Spacing uses Tailwind standard (py-3 or similar)
- [ ] Consistent with other sidebar spacing
- [ ] No layout shift or overflow issues

## User Story

**As a** CallVault user with many folders
**I want** proper spacing around the search box
**So that** the interface feels polished and easy to scan

---

## Technical Notes

```tsx
// Change from:
<div className="px-4 pb-2">

// To:
<div className="px-4 py-3">
```

---

*Spec ready for PRD generation.*
