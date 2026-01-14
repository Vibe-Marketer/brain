# SPEC-003: Analytics Position in Sidebar

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sidebar/Navigation
**Priority:** UI Polish

---

## Summary

Reorder sidebar navigation so Analytics appears above Settings instead of below it.

## What

Change the order of navigation items in the `navItems` array in `sidebar-nav.tsx` so Analytics precedes Settings.

**Files affected:**
- `src/components/ui/sidebar-nav.tsx` (lines 144-201, `navItems` array)

**Current order:**
1. Home
2. AI Chat
3. Content
4. Sorting
5. Collaboration
6. **Settings** (line 185-192)
7. **Analytics** (line 193-200)

**New order:**
1. Home
2. AI Chat
3. Content
4. Sorting
5. Collaboration
6. **Analytics** (moved up)
7. **Settings** (moved to bottom)

## Why

- Analytics is a frequently accessed feature for reviewing call performance
- Settings is a low-frequency destination (configure once, rarely revisit)
- Common UX pattern: Settings always at the very bottom of navigation
- Improves discoverability of Analytics feature

## User Experience

- User sees Analytics before Settings in nav order
- Settings remains accessible but in expected "bottom" position
- No change to functionality, only visual order

## Scope

**Includes:**
- Reordering entries in the `navItems` array

**Excludes:**
- Changing any nav item properties (icons, paths, etc.)
- Modifying callbacks or click handlers
- Changes to FolderSidebar or other sidebar components

## Decisions Made

### Settings should be last
Settings is commonly placed at the very bottom of navigation UIs. This is the expected location.

### No need for visual separator
Analytics and Settings don't need a separator between them - they're both regular nav items.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Keyboard navigation | Order changes (ArrowDown from Collaboration → Analytics → Settings) |
| Active state | Both items still highlight correctly based on route |

## Acceptance Criteria

- [ ] Analytics appears above Settings in nav list
- [ ] Settings appears at the very bottom of nav items
- [ ] All nav functionality unchanged
- [ ] Keyboard navigation follows new order

## User Story

**As a** CallVault user
**I want** Analytics to appear before Settings in the sidebar
**So that** I can access my call analytics more easily

---

## Technical Notes

```tsx
// Current order in navItems array:
{ id: 'settings', ... },  // line 185
{ id: 'analytics', ... }, // line 193

// Swap to:
{ id: 'analytics', ... }, // Move up
{ id: 'settings', ... },  // Move down (last)
```

---

*Spec ready for PRD generation.*
