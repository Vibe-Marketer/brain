# SPEC-001: Import/Plus Button Position (Sidebar Open)

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sidebar/Navigation
**Priority:** UI Polish

---

## Summary

Reposition the Import/Plus button from the bottom of the sidebar navigation to the very top, making it the first element users see when the sidebar is open.

## What

Move the vibe orange gradient "Import" button (with RiAddLine icon) from its current position at the bottom of the `SidebarNav` component to the very top of the navigation section.

**Files affected:**
- `src/components/ui/sidebar-nav.tsx` (lines 388-427 contain the button)

**Current order:**
1. Main Nav Items (Home, Chat, Content, Sorting, Collaboration, Settings, Analytics)
2. Separator
3. Library Toggle
4. Import button (bottom)

**New order:**
1. Import button (TOP)
2. Separator
3. Main Nav Items (Home, Chat, Content, Sorting, Collaboration, Settings, Analytics)
4. Library Toggle

## Why

- The Import button is a primary CTA for new users onboarding calls
- Current bottom position is easily missed, especially with many nav items
- Top position follows the "One-Click Promise" - primary actions should be immediately visible
- Aligns with common UX patterns where primary CTAs appear at the top

## User Experience

- User opens sidebar → Import button is immediately visible at the top
- Vibe orange gradient draws attention to primary action
- In collapsed mode: Import button still appears at top as orange gradient icon
- No change to button behavior, only position

## Scope

**Includes:**
- Moving the Import button JSX block in `sidebar-nav.tsx`
- Adjusting spacing/separator placement for visual flow
- Both expanded and collapsed sidebar states

**Excludes:**
- Changing button styling or animation
- Modifying button functionality
- Changes to FolderSidebar.tsx (different component)

## Decisions Made

### Button should be ABOVE nav items, not just "higher"
The button goes at the very top, before Home/Chat/etc., not just moved up within the existing structure.

### Separator placement
Add separator between Import button and main nav items for visual separation.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Sidebar collapsed | Import button appears at top (already has collapsed styling) |
| onSyncClick not provided | No button rendered (existing behavior unchanged) |
| Mobile view | Follows same top positioning in mobile sidebar |

## Acceptance Criteria

- [ ] Import button renders at top of sidebar when expanded
- [ ] Import button renders at top of sidebar when collapsed
- [ ] Separator visually separates Import from nav items
- [ ] No regression in button click functionality
- [ ] Transitions remain 500ms as per brand guidelines

## User Story

**As a** CallVault user
**I want** the Import button to be at the top of the sidebar
**So that** I can quickly access the primary action without scrolling or searching

---

## Technical Notes

```tsx
// Current location (lines 388-427 in sidebar-nav.tsx)
{onSyncClick && (
  <div className="relative flex flex-col mt-1">
    <button ... />
  </div>
)}

// Move to: immediately after <nav> opening tag, before navItems.map()
```

---

*Spec ready for PRD generation.*
