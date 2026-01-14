# PRD-003: Analytics Position in Sidebar

**Status:** Ready for Implementation
**Priority:** P3 - UI Polish
**Category:** Sidebar/Navigation
**Spec:** [SPEC-003](../../specs/spec-003-analytics-position.md)
**Created:** 2026-01-14

---

## Overview

Reorder sidebar navigation so Analytics appears above Settings instead of below it. Settings should be the last navigation item.

## Problem Statement

Analytics is a frequently accessed feature, while Settings is configured once and rarely revisited. Current order doesn't reflect usage patterns and buries Analytics below Settings.

## Goals

1. Improve discoverability of Analytics
2. Follow standard UX pattern (Settings at bottom)
3. Optimize navigation for common workflows

## User Stories

**US-003.1:** As a CallVault user, I want Analytics to appear before Settings in the sidebar so that I can access my call analytics more easily.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Analytics appears above Settings in nav list | Must Have |
| FR-002 | Settings appears at very bottom of nav items | Must Have |
| FR-003 | Keyboard navigation follows new order | Must Have |

## Technical Approach

**File:** `src/components/ui/sidebar-nav.tsx`

Swap the order in the `navItems` array (lines 144-201):

```tsx
const navItems: NavItem[] = [
  { id: 'home', ... },
  { id: 'chat', ... },
  { id: 'content', ... },
  { id: 'sorting', ... },
  { id: 'collaboration', ... },
  { id: 'analytics', ... },  // Moved UP
  { id: 'settings', ... },   // Now LAST
];
```

## Acceptance Criteria

- [ ] Analytics appears above Settings in nav
- [ ] Settings is the last nav item
- [ ] All nav functionality unchanged
- [ ] Keyboard navigation (ArrowDown/Up) follows new order

## Out of Scope

- Changing nav item properties (icons, paths)
- Adding visual separators between items
- Modifying callbacks or click handlers

## Implementation Notes

This PRD should be implemented together with PRD-004 (Settings Position) as they are related changes.

---

*PRD generated from SPEC-003*
