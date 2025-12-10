# Sidebar Collapse/Expand Pattern

**Status:** Production Ready  
**Last Updated:** 2025-12-09  
**Reference Implementation:** TranscriptsNew.tsx + FolderSidebar.tsx

---

## Overview

This document describes the standardized sidebar pattern with edge-mounted collapse/expand toggle used in CallVault.

## Key Components

### 1. SidebarCollapseToggle (`src/components/ui/sidebar-collapse-toggle.tsx`)

A reusable component for the edge-mounted collapse/expand button.

**Props:**
- `isCollapsed: boolean` - Current collapse state
- `onToggle: () => void` - Toggle callback
- `className?: string` - Additional CSS classes
- `label?: string` - Accessible label override

**Design Specifications:**
- **Position:** Absolute, right edge (`-right-3`), vertically centered (`top-1/2 -translate-y-1/2`)
- **Size:** 24x24px circle (`w-6 h-6 rounded-full`)
- **Icon:** Chevron left `<` when expanded, Chevron right `>` when collapsed
- **Colors:** `bg-card` background, `border-border`, `shadow-sm`
- **Hover:** `bg-cb-hover`
- **Z-index:** 10 (above sidebar content, below modals)
- **Mobile:** Hidden with `hidden md:block`

### 2. Sidebar Wrapper Structure

```tsx
<div
  className={`
    relative flex-shrink-0 transition-all duration-200 h-full
    ${sidebarState === 'expanded'
      ? 'fixed inset-y-0 left-0 z-50 shadow-2xl md:relative md:shadow-none w-[280px]'
      : 'w-[44px]'
    }
    bg-card rounded-2xl border border-border
  `}
>
  {/* Edge-mounted collapse toggle - hidden on mobile */}
  <div className="hidden md:block">
    <SidebarCollapseToggle
      isCollapsed={sidebarState === 'collapsed'}
      onToggle={toggleSidebar}
    />
  </div>

  {/* Sidebar content component */}
  <FolderSidebar ... />
</div>
```

## State Management

```tsx
// Sidebar visibility state
const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed'>('expanded');

// Toggle function
const toggleSidebar = () => {
  setSidebarState(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
};
```

## Width Specifications

- **Expanded:** 280px
- **Collapsed:** 44px (enough for icons + padding)

## Mobile Behavior

- Sidebar opens as overlay (fixed positioning with backdrop)
- Toggle button hidden on mobile (`hidden md:block`)
- Clicking folder collapses sidebar on mobile only
- Backdrop click closes sidebar

## Layout Context

The sidebar sits in a flex container with gap:
```tsx
<div className="h-full flex gap-2.5 overflow-hidden">
  {/* Sidebar */}
  {/* Main content card */}
</div>
```

## Card Styling

Both sidebar and main content use matching card styling:
- `bg-card` background
- `rounded-2xl` border radius
- `border border-border` thin border

## Accessibility

- Button has `aria-label` that changes based on state ("Expand sidebar" / "Collapse sidebar")
- Focus visible ring using `focus-visible:ring-2 focus-visible:ring-cb-vibe-orange`
- Keyboard accessible (focusable, activates on Enter/Space)

## Files Modified in This Implementation

1. `src/components/ui/sidebar-collapse-toggle.tsx` - NEW: Reusable toggle component
2. `src/pages/TranscriptsNew.tsx` - Updated sidebar wrapper structure
3. `src/components/transcripts/TranscriptsTab.tsx` - Removed gray border under filters

## Replication Checklist

To add a collapsible sidebar to a new page:

1. Import `SidebarCollapseToggle` from `@/components/ui/sidebar-collapse-toggle`
2. Add state: `const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed'>('expanded')`
3. Add toggle function
4. Wrap sidebar in relative container with card styling
5. Add `SidebarCollapseToggle` inside wrapper (hidden on mobile)
6. Pass `isCollapsed` prop to sidebar content component
7. Handle mobile overlay behavior if needed
