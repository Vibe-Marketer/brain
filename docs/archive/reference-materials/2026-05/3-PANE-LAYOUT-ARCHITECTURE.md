# 3-Pane Layout Architecture

This document defines the 3-pane layout architecture for CallVault, providing guidelines for consistent UI structure across all pages.

## Overview

CallVault uses a flexible 3-pane layout system based on the `CallVaultLayout` component. This architecture provides:

- **Pane 1 (Navigation Rail)**: App-wide navigation, always present
- **Pane 2 (Secondary Panel)**: Optional contextual content (e.g., session lists, folder browsers)
- **Pane 3 (Main Content)**: Primary content area, always visible

## Core Components

### CallVaultLayout

**Location**: `src/components/layout/CallVaultLayout.tsx`

The main container component that orchestrates the 3-pane layout with responsive behavior.

```tsx
import { CallVaultLayout } from "@/components/layout/CallVaultLayout";

<CallVaultLayout
  // Pane 1 configuration
  isNavExpanded={true}
  onNavExpandedChange={(expanded) => setExpanded(expanded)}
  navTitle="Menu"

  // Pane 2 configuration
  secondaryPanel={<YourSidebarContent />}
  isSecondaryPanelOpen={true}
  onSecondaryPanelOpenChange={(open) => setOpen(open)}
  showLibraryToggle={true}

  // Additional options
  onSyncClick={() => handleSync()}
  className="h-full"
>
  {/* Pane 3: Main Content */}
  <YourMainContent />
</CallVaultLayout>
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | Required | Main content (Pane 3) |
| `secondaryPanel` | `ReactNode` | `undefined` | Secondary panel content (Pane 2) |
| `isNavExpanded` | `boolean` | Responsive default | Control nav rail expansion |
| `onNavExpandedChange` | `(expanded: boolean) => void` | - | Callback when nav expansion changes |
| `isSecondaryPanelOpen` | `boolean` | Responsive default | Control secondary panel visibility |
| `onSecondaryPanelOpenChange` | `(open: boolean) => void` | - | Callback when panel visibility changes |
| `showLibraryToggle` | `boolean` | `true` | Show library toggle in nav |
| `onSyncClick` | `() => void` | - | Callback for sync button click |
| `navTitle` | `string` | `"Menu"` | Title shown in nav header |
| `className` | `string` | - | Additional container classes |

### SidebarNav

**Location**: `src/components/ui/sidebar-nav.tsx`

Navigation component used in Pane 1 with consistent styling and behavior.

```tsx
import { SidebarNav } from "@/components/ui/sidebar-nav";

<SidebarNav
  isCollapsed={!isNavExpanded}
  onLibraryToggle={() => setLibraryOpen(!libraryOpen)}
  onSyncClick={() => handleSync()}
/>
```

### useBreakpoint Hook

**Location**: `src/hooks/useBreakpoint.ts`

Hook for responsive breakpoint detection.

```tsx
import { useBreakpoint, useBreakpointFlags } from "@/hooks/useBreakpoint";

// Get breakpoint string: 'mobile' | 'tablet' | 'desktop'
const breakpoint = useBreakpoint();

// Get boolean flags
const { isMobile, isTablet, isDesktop } = useBreakpointFlags();
```

## Architecture Rules

### Rule 1: Navigation Rail (Pane 1) - Always Present

| Aspect | Specification |
|--------|---------------|
| **Visibility** | Always visible on all pages |
| **Default State** | Expanded on desktop, collapsed on tablet, overlay on mobile |
| **Content** | SidebarNav component with app-wide navigation |
| **Toggle** | Button in nav header to expand/collapse |
| **Width** | Expanded: 240px, Collapsed: 72px |
| **Transition** | 300ms ease-in-out |

### Rule 2: Secondary Panel (Pane 2) - Conditional

| Section | 2nd Pane Content | Default Visibility |
|---------|------------------|-------------------|
| **Transcripts/Loop** | Folder library | Open |
| **Chat** | Session list (ChatSidebar) | Open on desktop |
| **Sorting/Tagging** | None | N/A (no panel) |
| **Settings** | None | N/A (no panel) |

**When to use Pane 2:**
1. Section has navigable sub-items (e.g., sessions, folders)
2. Context switching benefits from persistent list
3. Screen real estate allows for additional panel

**When to skip Pane 2:**
1. Settings/configuration pages with tabs
2. Content requires maximum screen width
3. No contextual navigation needed

| Aspect | Specification |
|--------|---------------|
| **Width** | 280px when visible, 0px when hidden |
| **Transition** | 500ms ease-in-out |
| **Toggle** | Library toggle button in SidebarNav |

### Rule 3: Main Content (Pane 3) - Always Present

| Aspect | Specification |
|--------|---------------|
| **Visibility** | Always visible, takes remaining width |
| **Content** | Section-specific main content |
| **Responsiveness** | Expands as Pane 2 closes |
| **Scrolling** | Handles its own scroll areas |

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| **Desktop** | ≥1024px | All 3 panes visible, nav expanded by default |
| **Tablet** | 768-1023px | Nav collapsed by default, secondary panel visible |
| **Mobile** | <768px | Nav and secondary panel as slide-in overlays |

### Mobile Overlay Pattern

On mobile (<768px):
- Navigation rail shown as slide-in drawer from left
- Secondary panel shown as slide-in drawer from left
- Backdrop overlay when drawer is open
- Touch-friendly button sizes (h-8 w-8 minimum)

```tsx
// Mobile overlay behavior is automatic in CallVaultLayout
// Just provide the content, responsiveness is handled
<CallVaultLayout
  secondaryPanel={<ChatSidebar />}
>
  <ChatInterface />
</CallVaultLayout>
```

## Section Reference

### Transcripts (LoopLayoutDemo)

**File**: `src/pages/LoopLayoutDemo.tsx`

Reference implementation with full 3-pane layout:
- Pane 2: Folder library (open by default)
- Pane 3: Transcript viewer with tabs

### Chat

**File**: `src/pages/Chat.tsx`

- Pane 2: ChatSidebar (session list, pinned, archived)
- Pane 3: Chat interface with messages and input
- Additional mobile handling for sidebar overlay

### Sorting/Tagging

**File**: `src/pages/SortingTagging.tsx`

- Pane 2: Not used (settings-style page)
- Pane 3: Full-width tabbed interface (Folders, Tags, Rules, Recurring)

### Settings

**File**: `src/pages/Settings.tsx`

- Pane 2: Not used (settings-style page)
- Pane 3: Full-width settings with category navigation

## Implementation Patterns

### State Management

Each page manages its own panel state using local component state:

```tsx
// In your page component
const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
const [isLibraryOpen, setIsLibraryOpen] = useState(true);
```

For pages that need custom mobile handling:

```tsx
const { isMobile } = useBreakpointFlags();
const [showMobileNav, setShowMobileNav] = useState(false);

// Auto-close overlays when breakpoint changes
useEffect(() => {
  if (!isMobile) {
    setShowMobileNav(false);
  }
}, [isMobile]);
```

### Styling Guidelines

Use `CardShell` for consistent panel styling:

**Location**: `src/components/layout/CardShell.tsx`

```tsx
<div className={cn(
  "bg-card rounded-2xl border border-border/60 shadow-sm",
  "flex flex-col overflow-hidden relative z-0"
)}>
  {children}
</div>
```

Key styling patterns:
- Rounded corners: `rounded-2xl` (16px)
- Border: `border-border/60` (60% opacity)
- Shadow: `shadow-sm` for depth
- Background: `bg-card` (theme-aware)

### Transition Classes

```tsx
// Nav rail width transition
"transition-all duration-300 ease-in-out"

// Secondary panel visibility transition
"transition-all duration-500 ease-in-out"

// Mobile overlay slide-in
"animate-in slide-in-from-left duration-300"
```

## Implementation Checklist

When adding 3-pane layout to a new page:

- [ ] Import `CallVaultLayout` from `@/components/layout/CallVaultLayout`
- [ ] Import `SidebarNav` from `@/components/ui/sidebar-nav`
- [ ] Add state hooks for panel visibility
- [ ] Wrap content in `CallVaultLayout`
- [ ] Pass navigation to `navRail` slot (or use default SidebarNav)
- [ ] Pass contextual content to `secondaryPanel` (if applicable)
- [ ] Main content goes in `children`
- [ ] Test responsive behavior at all breakpoints
- [ ] Verify nav rail toggle works
- [ ] Verify library toggle works (if secondary panel exists)
- [ ] Test mobile overlay behavior

## Common Code Patterns

### Basic Page with Secondary Panel

```tsx
import { useState } from "react";
import { CallVaultLayout } from "@/components/layout/CallVaultLayout";
import { SidebarNav } from "@/components/ui/sidebar-nav";

export function MyPage() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  return (
    <CallVaultLayout
      isNavExpanded={isSidebarExpanded}
      onNavExpandedChange={setIsSidebarExpanded}
      isSecondaryPanelOpen={isLibraryOpen}
      onSecondaryPanelOpenChange={setIsLibraryOpen}
      secondaryPanel={<MySidebar />}
    >
      <MyMainContent />
    </CallVaultLayout>
  );
}
```

### Settings-Style Page (No Secondary Panel)

```tsx
import { useState } from "react";
import { CallVaultLayout } from "@/components/layout/CallVaultLayout";

export function MySettingsPage() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <CallVaultLayout
      isNavExpanded={isSidebarExpanded}
      onNavExpandedChange={setIsSidebarExpanded}
      showLibraryToggle={false}
    >
      <Tabs>
        {/* Full-width tabbed content */}
      </Tabs>
    </CallVaultLayout>
  );
}
```

### Custom Nav Rail with Mobile Override

```tsx
import { useState, useEffect } from "react";
import { useBreakpointFlags } from "@/hooks/useBreakpoint";

export function MyPage() {
  const { isMobile } = useBreakpointFlags();
  const [showMobileNav, setShowMobileNav] = useState(false);

  useEffect(() => {
    if (!isMobile) setShowMobileNav(false);
  }, [isMobile]);

  // Custom implementation with both desktop and mobile nav
  return (
    <div className="h-full flex gap-3 overflow-hidden p-1">
      {/* Desktop Nav Rail */}
      {!isMobile && (
        <nav className="w-[240px] ...">
          <SidebarNav />
        </nav>
      )}

      {/* Mobile Nav Overlay */}
      {isMobile && showMobileNav && (
        <div className="fixed inset-0 z-50 ...">
          <SidebarNav />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {isMobile && (
          <button onClick={() => setShowMobileNav(true)}>
            Menu
          </button>
        )}
        <Content />
      </main>
    </div>
  );
}
```

---

*Architecture documented: 2025-12-30*
*Based on: LoopLayoutDemo.tsx, CallVaultLayout.tsx, Chat.tsx, SortingTagging.tsx, Settings.tsx*
