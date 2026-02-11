# PRD-004: Settings Position in Sidebar

**Status:** Ready for Implementation
**Priority:** P3 - UI Polish
**Category:** Sidebar/Navigation
**Spec:** [SPEC-004](../../specs/spec-004-settings-position.md)
**Created:** 2026-01-14

---

## Overview

Move Settings to the very bottom of the sidebar navigation, making it the last nav item. This is the companion change to PRD-003.

## Problem Statement

Settings is currently positioned above Analytics, which doesn't match user expectations or standard UX patterns. Settings is a low-frequency destination that should be de-emphasized.

## Goals

1. Match standard UX pattern (Settings at bottom)
2. De-emphasize low-frequency destination
3. Prioritize frequently-used features in navigation

## User Stories

**US-004.1:** As a CallVault user, I want Settings at the bottom of the navigation so that it's in the expected location and doesn't distract from primary features.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Settings is the last item in main nav list | Must Have |
| FR-002 | Settings appears after Analytics | Must Have |
| FR-003 | No visual separation added | Must Have |

## Technical Approach

**File:** `src/components/ui/sidebar-nav.tsx`

Same change as PRD-003 - swap Analytics and Settings in the `navItems` array.

## Acceptance Criteria

- [ ] Settings is the last nav item
- [ ] Settings appears after Analytics
- [ ] All Settings functionality unchanged
- [ ] No visual separation from other nav items

## Out of Scope

- Separating Settings into its own section
- Changing Settings icon or styling
- Adding special treatment to Settings

## Implementation Notes

Implement together with PRD-003 as a single change to the `navItems` array order.

---

*PRD generated from SPEC-004*
