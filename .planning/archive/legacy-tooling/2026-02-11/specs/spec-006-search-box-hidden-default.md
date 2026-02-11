# SPEC-006: Search Box Location & Behavior

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Home Screen/All Transcripts
**Priority:** UI Enhancement

---

## Summary

Hide the folder search box by default and add a magnifying glass icon to the header that toggles its visibility. This reduces visual clutter when search isn't needed.

## What

1. Hide the search input by default (regardless of folder count)
2. Add a search icon button to the header (next to the + button)
3. Clicking the search icon toggles search input visibility
4. Search collapses when empty and user clicks elsewhere

**Files affected:**
- `src/components/transcript-library/FolderSidebar.tsx`

**Current behavior:**
- Search always visible when >10 folders
- No way to hide it

**New behavior:**
- Search hidden by default
- Magnifying glass icon in header toggles visibility
- Search input appears below header when active
- Auto-hides when search is cleared and loses focus

## Why

- Current always-visible search clutters the UI
- Most users don't need to search folders frequently
- Icon toggle follows "progressive disclosure" principle
- Cleaner default state improves visual hierarchy
- Aligns with One-Click Promise: show only what's needed

## User Experience

1. User sees clean folder list without search clutter
2. User clicks magnifying glass icon → search input slides in
3. User types to filter folders
4. User clears search or clicks away → search hides
5. Magnifying glass always available for quick access

## Scope

**Includes:**
- Adding `isSearchOpen` state to FolderSidebar
- Adding RiSearchLine icon button to header
- Conditionally rendering search input
- Smooth slide-down animation for search appearance
- Auto-hide logic when search is cleared

**Excludes:**
- Changing search filtering logic
- Global/transcript search (this is folder-only)
- Keyboard shortcuts for search toggle

## Decisions Made

### Icon placement
Magnifying glass appears in header, to the left of the + (new folder) button.

### Animation
Search slides down with 200ms transition for smooth appearance.

### Auto-hide behavior
Search hides when: (1) search query is empty AND (2) input loses focus. This prevents accidental hiding while typing.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Click search icon | Search opens, input auto-focuses |
| Clear search and click away | Search hides |
| Type query, click away | Search stays open (has content) |
| Press Escape while in search | Clear query and hide search |

## Acceptance Criteria

- [ ] Search hidden by default (no folders threshold check)
- [ ] Magnifying glass icon in header
- [ ] Clicking icon toggles search visibility
- [ ] Search input auto-focuses when opened
- [ ] Search auto-hides when cleared and unfocused
- [ ] Smooth animation on open/close
- [ ] Works in both expanded and collapsed sidebar modes

## User Story

**As a** CallVault user
**I want** the folder search to be hidden until I need it
**So that** my sidebar stays clean and uncluttered

---

## Technical Notes

```tsx
// Add state
const [isSearchOpen, setIsSearchOpen] = React.useState(false);
const searchInputRef = React.useRef<HTMLInputElement>(null);

// Header button (add to header, before + button)
<Button
  variant="ghost"
  size="icon"
  className="h-6 w-6 flex-shrink-0"
  onClick={() => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }}
>
  <RiSearchLine className="h-4 w-4" />
</Button>

// Conditional search render with animation
{isSearchOpen && (
  <div className="px-4 py-3 animate-in slide-in-from-top-2 duration-200">
    <Input
      ref={searchInputRef}
      placeholder="Search folders..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onBlur={() => {
        if (!searchQuery.trim()) setIsSearchOpen(false);
      }}
      className="h-8 text-xs"
    />
  </div>
)}
```

---

*Spec ready for PRD generation.*
