# CALLVAULT FRONTEND - CLAUDE INSTRUCTIONS

**Last Updated:** 2026-01-14
**Status:** Frontend Development Guide
**Scope:** All frontend code under `/src`

---

## TABLE OF CONTENTS

1. [Layout Architecture](#layout-architecture)
2. [Component Architecture](#component-architecture)
3. [UI/UX Standards](#uiux-standards)
4. [State Management Patterns](#state-management-patterns)
5. [Visual Development Protocol](#visual-development-protocol)
6. [Common Patterns](#common-patterns)

---

# LAYOUT ARCHITECTURE

## Core Principle: AppShell is Mandatory

**CRITICAL: ALL pages MUST use AppShell for layout.**

AppShell provides the unified 3-4 pane layout system for all pages. It eliminates per-page duplication of sidebar and pane code.

### Reference Implementation

**Canonical Example:** `src/pages/SortingTagging.tsx`

This file demonstrates the correct AppShell usage pattern:

```tsx
import { AppShell } from "@/components/layout/AppShell";

export default function MyPage() {
  return (
    <AppShell
      config={{
        secondaryPane: <MySecondaryPane />,
        showDetailPane: true,
      }}
    >
      <MyMainContent />
    </AppShell>
  );
}
```

### Pane Architecture

```text
+----------------+-------------+------------------+---------------+
|   PANE 1       |   PANE 2    |     PANE 3       |    PANE 4     |
|   NavRail      |  Secondary  |   Main Content   |  Detail Panel |
|   (Sidebar)    |   Panel     |    (children)    |   (Outlet)    |
+----------------+-------------+------------------+---------------+
     220/72px        280px          flex-1            360px
```

**Pane Widths (MUST follow exactly):**

| Pane | Expanded | Collapsed |
|------|----------|-----------|
| NavRail (Sidebar) | 220px | 72px |
| Secondary Panel | 280px | 0px (hidden) |
| Main Content | flex-1 (fills remaining) | - |
| Detail Panel | 360px (desktop), 320px (tablet) | 0px (hidden) |

### Sidebar Toggle: Edge-Mounted Circular Button

**CRITICAL: The sidebar toggle MUST be an edge-mounted circular button, NOT a hamburger menu.**

**Correct Implementation:**

```tsx
// SidebarToggle.tsx - CORRECT
<button
  className={cn(
    // Position: Half outside the sidebar, vertically centered
    "absolute top-1/2 -translate-y-1/2 -right-3",
    // Size: 24x24px circular button
    "w-6 h-6 rounded-full",
    // Styling: Card background with border and shadow
    "bg-card border border-border shadow-sm",
    "flex items-center justify-center",
    "hover:bg-muted transition-colors"
  )}
>
  <ChevronIcon />
</button>
```

**Sidebar Toggle Specifications:**

- Position: Absolute, vertically centered, -12px from right edge (half outside)
- Size: 24x24px circular button
- Z-index: z-20 (above overlay at z-0 and content at z-10)
- Animation: Chevron rotates 180deg in 500ms
- MUST use stopPropagation() to prevent double-toggle with overlay

### Transitions: 500ms Standard

**CRITICAL: ALL layout transitions MUST use 500ms duration with ease-in-out timing.**

```tsx
// CORRECT - 500ms for premium feel
"transition-all duration-500 ease-in-out"

// INCORRECT - DO NOT use 300ms
"transition-all duration-300"  // BAD
```

**Where 500ms applies:**

- Sidebar expand/collapse
- Secondary panel open/close
- Detail panel slide-in/slide-out
- Chevron icon rotation

### Responsive Behavior

```text
Desktop (>1024px):  All panes visible, sidebar expanded
Tablet (768-1024):  Sidebar auto-collapsed, panes visible
Mobile (<768px):    Single-pane with overlays
```

### AppShell Configuration

```tsx
interface AppShellConfig {
  showNavRail?: boolean;        // Default: true
  secondaryPane?: ReactNode;    // Optional 2nd pane content
  showDetailPane?: boolean;     // Default: false
  onLibraryToggle?: () => void;
  onSettingsClick?: () => void;
  onSortingClick?: () => void;
  onSyncClick?: () => void;
}
```

## Anti-Patterns: Layout Mistakes to AVOID

### DO NOT: Build Custom Layout Without AppShell

```tsx
// BAD - Custom layout bypasses AppShell
export default function MyPage() {
  return (
    <div className="flex h-full">
      <Sidebar />         {/* BAD: Custom sidebar */}
      <main>Content</main>
    </div>
  );
}

// GOOD - Use AppShell
export default function MyPage() {
  return (
    <AppShell>
      <main>Content</main>
    </AppShell>
  );
}
```

### DO NOT: Use Hamburger Menu for Sidebar Toggle

```tsx
// BAD - Hamburger menu icon
<button className="...">
  <svg>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
</button>

// GOOD - Chevron in circular button
<SidebarToggle isExpanded={isExpanded} onToggle={toggle} />
```

### DO NOT: Use Wrong Transition Duration

```tsx
// BAD - 300ms transitions
"transition-all duration-300"

// GOOD - 500ms transitions
"transition-all duration-500 ease-in-out"
```

### DO NOT: Hardcode Wrong Pane Widths

```tsx
// BAD - Wrong width values
"w-[200px]"   // Wrong! Should be 220px or 72px
"w-[300px]"   // Wrong! Should be 280px
"w-[400px]"   // Wrong! Should be 360px

// GOOD - Correct widths
isSidebarExpanded ? "w-[220px]" : "w-[72px]"  // NavRail
"w-[280px]"  // Secondary panel
"w-[360px]"  // Detail panel (desktop)
"w-[320px]"  // Detail panel (tablet)
```

### DO NOT: Wrap AppShell in Layout.tsx Card Container

If your page uses AppShell, you MUST add it to the `usesCustomLayout` check in `src/components/Layout.tsx`:

```tsx
// In Layout.tsx - Add your route
const isMyPage = location.pathname.startsWith('/my-page');
const usesCustomLayout = ... || isMyPage;  // Add here
```

---

# COMPONENT ARCHITECTURE

## File Organization

```text
src/
  components/
    {domain}/              # Domain-specific components
      {ComponentName}.tsx  # Component file
      __tests__/           # Tests alongside components
    layout/                # Layout components (AppShell, etc.)
    panels/                # Detail panel components
    panes/                 # Secondary pane components
    ui/                    # Shared UI primitives (Button, etc.)
  hooks/                   # Custom hooks
  stores/                  # Zustand stores
  pages/                   # Page components (route entry points)
  lib/                     # Utility functions
  types/                   # TypeScript type definitions
```

## Naming Conventions

| Pattern | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `FolderDetailPanel.tsx` |
| Hooks | camelCase with `use` prefix | `useFolders.ts` |
| Stores | camelCase with `Store` suffix | `panelStore.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `Folder`, `PanelType` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |

## Component Structure

```tsx
/**
 * ComponentName - Brief description
 *
 * @pattern pattern-name (if applicable)
 * @brand-version v4.2
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ComponentNameProps {
  /** Prop description */
  propName: string;
}

export function ComponentName({ propName }: ComponentNameProps) {
  // Implementation
  return (
    <div className={cn("base-classes")}>
      {/* Content */}
    </div>
  );
}
```

## Import Patterns

**Use path aliases:**

```tsx
// GOOD - Path aliases
import { Button } from "@/components/ui/button";
import { useFolders } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";

// BAD - Relative paths
import { Button } from "../../components/ui/button";
```

**Import order:**

1. React and external libraries
2. Internal components (`@/components/`)
3. Hooks (`@/hooks/`)
4. Stores (`@/stores/`)
5. Utilities (`@/lib/`)
6. Types (`@/types/`)

---

# UI/UX STANDARDS

## Brand Guidelines Reference

**CRITICAL: The authoritative design system is `docs/design/brand-guidelines-v4.2.md`**

Before ANY UI/design work:

1. READ the relevant section of brand guidelines
2. VERIFY your implementation aligns with documented patterns
3. ASK USER before deviating from guidelines

## Button System (6 Variants)

```tsx
import { Button } from "@/components/ui/button";

// Primary - Slate gradient glossy (main CTAs)
<Button variant="default">Save</Button>

// Hollow - Plain bordered (secondary actions)
<Button variant="hollow">Cancel</Button>

// Destructive - Red gradient glossy (dangerous actions)
<Button variant="destructive">Delete</Button>

// Link - Text-only (tertiary actions)
<Button variant="link">Learn more</Button>

// Outline - Subtle bordered (toggleable items)
<Button variant="outline">Option</Button>

// Ghost - Transparent (icon toolbars)
<Button variant="ghost" size="icon">
  <RiMenuLine />
</Button>
```

**Dark Mode Rule:** Primary and destructive buttons NEVER change colors in dark mode. Only hollow/outline/ghost adapt.

## Icon System

**Library:** Remix Icon (`@remixicon/react`) - MANDATORY

```tsx
// GOOD - Remix Icon
import { RiFolderLine, RiSettingsLine } from "@remixicon/react";

<RiFolderLine className="h-4 w-4 text-cb-ink-muted" />

// BAD - Do NOT use other icon libraries
import { Folder } from "lucide-react";      // WRONG
import { FaFolder } from "react-icons/fa";  // WRONG
```

**Icon Standards:**

- Use `-line` (outlined) variants for consistency
- Default size: 16px (`h-4 w-4`)
- Default color: `text-cb-ink-muted` (#7A7A7A light / #6B6B6B dark)

## Vibe Orange (#FF8800) - 9 Approved Uses ONLY

**CRITICAL: Vibe orange may ONLY be used for these 9 specific purposes:**

1. **Active tab underlines** - 6px height, angular/parallelogram shape
2. **Left-edge indicators on metric cards** - 6px width x 56px height, angular
3. **Table column headers** - 3px underline on sortable columns only
4. **Focus states** - 3px left border on inputs, 2px outline on buttons
5. **Circular progress indicators** - Filled portion only
6. **Progress trackers** - Linear/circular for onboarding
7. **Wayfinding step indicators** - Current step marker
8. **Section dividers** - Onboarding/instructional content only
9. **Contextual info banners** - Subtle accent only

**NEVER use vibe orange for:**

- Text (fails WCAG contrast)
- Button backgrounds
- Card backgrounds
- Icons
- Large filled areas

## Typography

**Headings:**

- Font: Montserrat Extra Bold
- Case: ALL CAPS
- Usage: Page titles, section headers

**Body Text:**

- Font: Inter Light (300) or Regular (400)
- Usage: Paragraphs, descriptions

**Interactive Elements:**

- Font: Inter Medium (500)
- Usage: Buttons, labels, table headers

```tsx
// Heading
<h1 className="font-montserrat font-extrabold text-xl uppercase tracking-wide">
  PAGE TITLE
</h1>

// Body
<p className="font-inter font-light text-sm">
  Description text here
</p>

// Interactive
<span className="font-inter font-medium text-sm">
  Button Label
</span>
```

**Numbers:** Always use `tabular-nums` class for aligned numerical data.

---

# STATE MANAGEMENT PATTERNS

## Tanstack Query (React Query)

**Query Key Convention:** Use kebab-case arrays from `lib/query-config.ts`

```tsx
import { queryKeys } from "@/lib/query-config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Fetching data
const { data, isLoading } = useQuery({
  queryKey: queryKeys.folders.list(),  // ["folders", "list"]
  queryFn: async () => { /* fetch */ },
  staleTime: 1000 * 60 * 5,  // 5 minutes
});

// Mutations with optimistic updates
const mutation = useMutation({
  mutationFn: async (data) => { /* mutate */ },
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.folders.list() });

    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.folders.list());

    // Optimistically update
    queryClient.setQueryData(queryKeys.folders.list(), (old) => /* update */);

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKeys.folders.list(), context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.folders.list() });
  },
});
```

**Query Key Factory Pattern:**

```tsx
// lib/query-config.ts
export const queryKeys = {
  folders: {
    all: ['folders'] as const,
    list: () => ['folders', 'list'] as const,
    detail: (id: string) => ['folders', 'detail', id] as const,
    assignments: () => ['folder-assignments'] as const,
  },
  // ... other domains
};
```

## Zustand Stores

**Store Naming:** `{domain}Store.ts` in `/src/stores/`

**Panel Store Pattern (for detail panels):**

```tsx
// stores/panelStore.ts
import { create } from 'zustand';

export type PanelType =
  | 'folder-detail'
  | 'tag-detail'
  | 'setting-help'
  | null;

interface PanelState {
  isPanelOpen: boolean;
  panelType: PanelType;
  panelData: any;

  openPanel: (type: PanelType, data?: any) => void;
  closePanel: () => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  isPanelOpen: false,
  panelType: null,
  panelData: null,

  openPanel: (type, data = null) => {
    set({ isPanelOpen: true, panelType: type, panelData: data });
  },

  closePanel: () => {
    set({ isPanelOpen: false, panelType: null, panelData: null });
  },
}));
```

**Usage in Components:**

```tsx
import { usePanelStore } from "@/stores/panelStore";

function MyComponent() {
  const { openPanel, closePanel, isPanelOpen } = usePanelStore();

  return (
    <button onClick={() => openPanel('folder-detail', { folderId: '123' })}>
      Open Detail
    </button>
  );
}
```

---

# VISUAL DEVELOPMENT PROTOCOL

## Mandatory Verification After UI Changes

**CRITICAL: ALWAYS verify UI changes with browser automation immediately after implementing.**

### Step-by-Step Verification Workflow

1. **Identify Changed Pages**
   - Review which components/pages were modified
   - List all routes that need verification

2. **Start Dev Server (if not running)**
   ```bash
   npm run dev  # Runs on http://localhost:8080
   ```

3. **Navigate to Changed Pages**
   ```
   Use mcp__playwright__browser_navigate to visit each route
   ```

4. **Take Screenshots at Desktop Viewport (1440px)**
   ```
   Use mcp__playwright__browser_screenshot with width: 1440
   ```

5. **Check Console for Errors**
   ```
   Use mcp__playwright__browser_console_messages
   ```

6. **Verify Against Brand Guidelines**
   - Check color usage matches approved patterns
   - Verify button variants are correct
   - Confirm typography follows Montserrat/Inter rules
   - Ensure spacing uses 4px grid
   - Validate dark mode behavior

### Design Review Checklist

Before considering UI work complete:

- [ ] Screenshot captured at 1440px width
- [ ] No console errors present
- [ ] Colors match brand guidelines
- [ ] Correct button variants used
- [ ] Typography follows Montserrat (headings) / Inter (body) rules
- [ ] Spacing uses 4px grid (Tailwind defaults)
- [ ] Dark mode tested and working
- [ ] Focus states visible (vibe orange outline)
- [ ] Touch targets >= 44px on mobile

### When to Request Design Review

Use `/design-review` command for:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- When needing comprehensive accessibility testing

---

# COMMON PATTERNS

## Loading States (Skeleton Pattern)

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Table skeleton
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// Card skeleton
function CardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

// Usage with React Query
function MyComponent() {
  const { data, isLoading } = useQuery({ /* ... */ });

  if (isLoading) {
    return <CardSkeleton />;
  }

  return <ActualContent data={data} />;
}
```

## Error Handling

```tsx
// Error boundary pattern for pages
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-4 text-center">
      <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={resetErrorBoundary} className="mt-4">
        Try again
      </Button>
    </div>
  );
}

// Wrap pages/sections
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <MyComponent />
</ErrorBoundary>
```

## Toast Notifications

```tsx
import { toast } from "sonner";

// Success
toast.success("Folder created successfully");

// Error
toast.error("Failed to delete folder");

// With description
toast.success("Changes saved", {
  description: "Your settings have been updated"
});
```

## Dark Mode Behavior

**Primary/Destructive buttons:** NEVER change colors in dark mode

```tsx
// Button stays the same in light/dark
<Button variant="default">Save</Button>     // Slate gradient - same
<Button variant="destructive">Delete</Button> // Red gradient - same
```

**Hollow/Ghost buttons:** Adapt to dark mode

```tsx
// These adapt
<Button variant="hollow">Cancel</Button>  // bg-white -> bg-card
<Button variant="ghost">Icon</Button>     // text adapts
```

**Background hierarchy:**

```tsx
// Light mode -> Dark mode
bg-viewport: #FCFCFC -> #161616  // Page background
bg-card:     #FFFFFF -> #202020  // Card/content background
```

## Keyboard Shortcuts

```tsx
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

function MyComponent() {
  const handleEscape = useCallback(() => {
    closePanel();
  }, [closePanel]);

  useKeyboardShortcut(handleEscape, {
    key: 'Escape',
    cmdOrCtrl: false,
    enabled: isPanelOpen
  });

  // Cmd/Ctrl + K for search
  useKeyboardShortcut(openSearch, {
    key: 'k',
    cmdOrCtrl: true,
    enabled: true
  });
}
```

## Responsive Breakpoints

```tsx
import { useBreakpointFlags } from "@/hooks/useBreakpoint";

function MyComponent() {
  const { isMobile, isTablet, isDesktop } = useBreakpointFlags();

  if (isMobile) {
    return <MobileLayout />;
  }

  return <DesktopLayout />;
}
```

**Breakpoint Values:**

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

# QUICK REFERENCE

## Must-Use Libraries

| Purpose | Library | Import |
|---------|---------|--------|
| Icons | Remix Icon | `@remixicon/react` |
| State (server) | Tanstack Query | `@tanstack/react-query` |
| State (client) | Zustand | `zustand` |
| Toasts | Sonner | `sonner` |
| Styling utility | cn helper | `@/lib/utils` |

## Critical Rules Summary

1. **ALL pages use AppShell** - No exceptions
2. **Sidebar toggle is circular button** - NOT hamburger
3. **Transitions are 500ms** - NOT 300ms
4. **Icons from Remix Icon ONLY** - No Lucide/FontAwesome
5. **Vibe orange for 9 uses ONLY** - Never for text/backgrounds
6. **Verify UI with browser** - After every change
7. **Query keys in kebab-case** - Use queryKeys factory

---

**END OF FRONTEND CLAUDE INSTRUCTIONS**
