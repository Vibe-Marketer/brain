# PRD-001: Import/Plus Button Position (Sidebar Open)

**Status:** Ready for Implementation
**Priority:** P2 - UI Polish
**Category:** Sidebar/Navigation
**Spec:** [SPEC-001](../../specs/spec-001-import-button-position.md)
**Created:** 2026-01-14

---

## Overview

Reposition the Import/Plus button from the bottom of the sidebar navigation to the very top, making it the first element users see when the sidebar is open.

## Problem Statement

The Import button is a primary CTA for onboarding new calls, but its current bottom position makes it easily missed. Users must scroll or scan past all navigation items to find the primary action.

## Goals

1. Increase discoverability of the Import action
2. Reduce friction in the onboarding flow
3. Align with One-Click Promise philosophy

## User Stories

**US-001.1:** As a CallVault user, I want the Import button at the top of the sidebar so that I can quickly access the primary action without searching.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Import button renders at top of sidebar when expanded | Must Have |
| FR-002 | Import button renders at top of sidebar when collapsed | Must Have |
| FR-003 | Separator visually separates Import from nav items | Should Have |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-001 | Transitions remain 500ms per brand guidelines | Must Have |
| NFR-002 | No regression in button click functionality | Must Have |

## Technical Approach

**File:** `src/components/ui/sidebar-nav.tsx`

Move the `onSyncClick` button block (lines 388-427) to immediately after the `<nav>` opening tag, before `navItems.map()`.

```tsx
// Move this block to the top of the nav section
{onSyncClick && (
  <div className="relative flex flex-col mt-1">
    <button ... />
  </div>
)}
// Add separator after
{onSyncClick && !isCollapsed && <div className="h-px bg-border my-2 mx-3" />}
```

## Acceptance Criteria

- [ ] Import button appears at top when sidebar expanded
- [ ] Import button appears at top when sidebar collapsed
- [ ] Visual separator between Import and nav items
- [ ] Click functionality unchanged
- [ ] 500ms transitions maintained

## Out of Scope

- Changing button styling or animation
- Modifying button functionality
- Changes to FolderSidebar.tsx

## Success Metrics

- Import button visible without scrolling
- No increase in time-to-first-import

---

*PRD generated from SPEC-001*
