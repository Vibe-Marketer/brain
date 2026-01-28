# PRD-006: Search Box Location & Behavior

**Status:** Ready for Implementation
**Priority:** P2 - UI Enhancement
**Category:** Home Screen/All Transcripts
**Spec:** [SPEC-006](../../specs/spec-006-search-box-hidden-default.md)
**Created:** 2026-01-14

---

## Overview

Hide the folder search box by default and add a magnifying glass icon to the header that toggles its visibility. This reduces visual clutter when search isn't needed.

## Problem Statement

The search box is always visible when folders exceed 10, cluttering the UI for users who rarely search. Most users don't need to search folders frequently.

## Goals

1. Reduce visual clutter in default state
2. Follow progressive disclosure principle
3. Maintain quick access to search when needed

## User Stories

**US-006.1:** As a CallVault user, I want the folder search to be hidden until I need it so that my sidebar stays clean and uncluttered.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Search hidden by default (no folder count threshold) | Must Have |
| FR-002 | Magnifying glass icon in header toggles visibility | Must Have |
| FR-003 | Search input auto-focuses when opened | Must Have |
| FR-004 | Search auto-hides when cleared and unfocused | Should Have |
| FR-005 | Smooth slide-down animation on open | Should Have |

## Technical Approach

**File:** `src/components/transcript-library/FolderSidebar.tsx`

1. Add state:
```tsx
const [isSearchOpen, setIsSearchOpen] = React.useState(false);
const searchInputRef = React.useRef<HTMLInputElement>(null);
```

2. Add icon button to header (before + button):
```tsx
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
```

3. Conditional search render:
```tsx
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

## Acceptance Criteria

- [ ] Search hidden by default
- [ ] Magnifying glass icon visible in header
- [ ] Clicking icon toggles search visibility
- [ ] Input auto-focuses when opened
- [ ] Search auto-hides when cleared and unfocused
- [ ] Smooth animation on open/close
- [ ] Works in both expanded and collapsed sidebar modes

## Out of Scope

- Changing search filtering logic
- Global/transcript search
- Keyboard shortcuts for search toggle

---

*PRD generated from SPEC-006*
