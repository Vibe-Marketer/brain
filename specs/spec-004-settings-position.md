# SPEC-004: Settings Position in Sidebar

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sidebar/Navigation
**Priority:** UI Polish

---

## Summary

Move Settings to the very bottom of the sidebar navigation, making it the last nav item before any action buttons.

## What

This spec is effectively covered by SPEC-003 (Analytics Position) which reorders the nav items. This spec documents the explicit requirement that Settings be at the absolute bottom of the navigation list.

**Files affected:**
- `src/components/ui/sidebar-nav.tsx` (same as SPEC-003)

**Current position:** 6th of 7 items (before Analytics)
**New position:** 7th of 7 items (last nav item, after Analytics)

## Why

- Settings is a low-frequency destination (configure once, rarely revisit)
- Standard UX pattern: Settings/Preferences always at the bottom
- Prevents Settings from competing for attention with more frequently used features
- Matches user expectations from other applications

## User Experience

- User scrolls to bottom of nav → finds Settings in expected location
- Settings remains easily accessible but de-emphasized
- Visual hierarchy prioritizes frequently-used features

## Scope

**Includes:**
- Moving Settings entry to last position in `navItems` array

**Excludes:**
- Separating Settings visually from other nav items
- Changing Settings icon, label, or behavior
- Adding any special styling to Settings

## Decisions Made

### Settings in nav list, not separated
Settings should remain in the main nav list, just at the bottom. No need for a separate section or divider.

### Relationship to SPEC-003
This spec and SPEC-003 should be implemented together as they're both about nav order.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Keyboard nav End key | Focuses Settings (last item) |
| New nav items added in future | Settings should remain last |

## Acceptance Criteria

- [ ] Settings is the last item in the main nav list
- [ ] Settings appears after Analytics
- [ ] All Settings functionality unchanged
- [ ] No visual separation added (stays in main nav flow)

## User Story

**As a** CallVault user
**I want** Settings at the bottom of the navigation
**So that** it's in the expected location and doesn't distract from primary features

---

## Technical Notes

This is effectively a duplicate/companion to SPEC-003. Implementation:

```tsx
const navItems: NavItem[] = [
  { id: 'home', ... },
  { id: 'chat', ... },
  { id: 'content', ... },
  { id: 'sorting', ... },
  { id: 'collaboration', ... },
  { id: 'analytics', ... },  // Moved up
  { id: 'settings', ... },   // Now last
];
```

---

*Spec ready for PRD generation.*
