# PRD-002: Selected Item Indicator (Sidebar Collapsed)

**Status:** Ready for Implementation
**Priority:** P2 - UI Consistency
**Category:** Sidebar/Navigation
**Spec:** [SPEC-002](../../specs/spec-002-selected-indicator-collapsed.md)
**Created:** 2026-01-14

---

## Overview

Replace the bottom dot indicator for selected items in collapsed sidebar mode with an orange left-side vertical marker that matches the Loop-inspired design language used elsewhere.

## Problem Statement

The current bottom dot indicator in collapsed mode is inconsistent with the left-side pill indicator used in expanded mode and throughout the app. This inconsistency creates a disjointed visual experience.

## Goals

1. Consistent visual language across collapsed/expanded states
2. Improved clarity of selected state
3. Alignment with Loop-inspired design patterns

## User Stories

**US-002.1:** As a CallVault user using collapsed sidebar, I want a consistent left-side indicator showing which section I'm in, so that I can quickly identify my location regardless of sidebar state.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Collapsed sidebar shows left-side orange pill on active item | Must Have |
| FR-002 | No bottom dot visible in any state | Must Have |
| FR-003 | Indicator matches expanded mode styling | Must Have |
| FR-004 | Smooth transition when selecting new item | Should Have |

## Technical Approach

**File:** `src/components/ui/sidebar-nav.tsx`

1. Remove bottom dot (lines 346-349):
```tsx
// DELETE THIS:
{active && isCollapsed && (
  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-vibe-orange" />
)}
```

2. Add left-side indicator inside button for collapsed mode:
```tsx
{isCollapsed && (
  <div
    className={cn(
      "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[60%] bg-vibe-orange rounded-full",
      "transition-all duration-200 ease-in-out",
      active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
    )}
  />
)}
```

## Acceptance Criteria

- [ ] Collapsed sidebar shows left-side orange pill on active item
- [ ] No bottom dot visible anywhere
- [ ] Indicator matches expanded mode styling
- [ ] Smooth scale-y transition when selecting
- [ ] Works for all nav items (Home, Chat, Content, etc.)

## Out of Scope

- Changing expanded mode indicator
- Modifying icon styling
- Changes to FolderSidebar indicators

---

*PRD generated from SPEC-002*
