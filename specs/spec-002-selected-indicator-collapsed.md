# SPEC-002: Selected Item Indicator (Sidebar Collapsed)

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Sidebar/Navigation
**Priority:** UI Consistency

---

## Summary

Replace the bottom dot indicator for selected items in collapsed sidebar mode with an orange left-side marker that matches the style used elsewhere in the application.

## What

Change the active state indicator in collapsed sidebar mode from a centered bottom dot to a left-edge vertical orange pill/marker.

**Files affected:**
- `src/components/ui/sidebar-nav.tsx` (lines 346-349 contain the dot indicator)

**Current implementation (line 346-349):**
```tsx
{active && isCollapsed && (
  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-vibe-orange" />
)}
```

**Desired implementation:**
Left-side vertical pill marker matching the expanded mode indicator style.

## Why

- Current dot at bottom is inconsistent with Loop-inspired design language
- Expanded mode uses left-side pill indicator - collapsed should match
- Other selected items throughout app use left-side markers
- Bottom dot is hard to see and doesn't communicate "selected" clearly

## User Experience

- User clicks nav item → Orange left marker appears on selected item
- Marker matches the pill style used in expanded mode
- Consistent visual language across collapsed/expanded states

## Scope

**Includes:**
- Removing the bottom dot indicator (lines 346-349)
- Adding left-side vertical pill indicator for collapsed mode
- Ensuring pill is visible with 44x44px icon buttons

**Excludes:**
- Changing expanded mode indicator (already correct)
- Modifying icon styling or sizing
- Changes to FolderSidebar collapsed indicators

## Decisions Made

### Indicator style should match expanded mode
The collapsed indicator should use the same pill shape and vibe-orange color as expanded mode, just positioned for the 44x44px icon button.

### Position: left edge of button
Indicator appears on the absolute left edge of the nav item button.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Multiple items selected | Only current route shows indicator |
| Hover + selected | Both hover bg and indicator visible |
| Transitions between items | Indicator animates (scale-y transition) |

## Acceptance Criteria

- [ ] Collapsed sidebar shows left-side orange pill on active item
- [ ] No bottom dot visible anywhere
- [ ] Indicator matches expanded mode styling
- [ ] Smooth transition when selecting new item
- [ ] Works for all nav items (Home, Chat, Content, etc.)

## User Story

**As a** CallVault user using collapsed sidebar
**I want** a consistent left-side indicator showing which section I'm in
**So that** I can quickly identify my location regardless of sidebar state

---

## Technical Notes

```tsx
// Remove this (lines 346-349):
{active && isCollapsed && (
  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-vibe-orange" />
)}

// Add inside button for collapsed mode:
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

---

*Spec ready for PRD generation.*
