# CALLVAULT BRAND GUIDELINES v4.2.1

## Authoritative Design System Reference

**Last Updated:** February 10, 2026
**Status:** Complete & Accurate - Supersedes ALL previous versions
**Purpose:** Single source of truth for all design and development decisions

> **CRITICAL: VERSIONING REQUIREMENT**
> When editing this document, you MUST:
>
> 1. Increment version in **3 places:**
>    - Title (line 1)
>    - DOCUMENT VERSION section
>    - END OF BRAND GUIDELINES (last line)
> 2. Add entry to [brand-guidelines-changelog.md](./brand-guidelines-changelog.md) with date, time, and git commit
> 3. Update "Last Updated" date/time if changed
> 4. **MINOR versions only:** Update filename (e.g., v4.0 -> v4.1 = rename file)
>
> **Failure to version updates will result in lost change tracking.**

---

## TABLE OF CONTENTS

1. [Core Design Philosophy](#core-design-philosophy)
2. [Brand Identity & Logo](#brand-identity--logo)
3. [Color System](#color-system)
4. [Layout Architecture](#layout-architecture)
5. [Button System](#button-system)
6. [Icon System](#icon-system)
7. [Tab Navigation](#tab-navigation)
8. [Navigation & Selection States](#navigation--selection-states)
9. [Sidebar UX Patterns](#sidebar-ux-patterns)
10. [Typography](#typography)
11. [Table Design](#table-design-system)
12. [The 10 Percent - Approved Card Usage](#the-10-percent---approved-card-usage)
13. [Vibe Orange Usage Rules](#vibe-orange-usage-rules)
14. [Conversation Dialogue UI Rule Exception](#conversation-dialogue-ui-rule-exceptions)
15. [Spacing and Grid](#spacing--grid)
16. [Component Specifications](#component-specifications)
17. [Dark Mode Implementation](#dark-mode-implementation)
18. [Responsive Behavior](#responsive-behavior)
19. [Accessibility](#accessibility)
20. [Animation Guidelines](#animation-guidelines)
21. [Microcopy & Quips](#microcopy--quips)
22. [Prohibited Patterns](#prohibited-patterns)
23. [CSS Variable Reference](#css-variable-reference)

---

## CORE DESIGN PHILOSOPHY

Call Vault embodies **Apple-level precision** in a professional data-first tool.

### Guiding Principles

1. **Data First** - Remove obstacles between user and information
2. **Whitespace Works** - Empty space clarifies, embrace it
3. **Monochromatic Foundation** - Color used sparingly, purposefully
4. **Professional, Not Playful** - Enterprise-grade aesthetic
5. **Functional Over Decorative** - Every element serves a purpose
6. **90% No Containers** - Content on white, separated by thin lines and space
7. **The 10%** - Cards/containers only for modals, dropdowns, search bars, metric cards

### Visual Hierarchy

```text
Information > Structure > Style > Decoration

    |           |          |          |

  Always    Usually    Sometimes    Rarely
```

---

## BRAND IDENTITY & LOGO

### Brand Names

| Context | Name | Usage |
|---------|------|-------|
| **Product Name** | Call Vault | Primary product reference |
| **AI Reference** | Call Vault AI | When referencing AI capabilities |
| **Logo Text** | CALLVAULT | One word, all caps in logo |

### Logo Assets

**Primary Logo Versions:**

1. **Full Logo** - Glassy play button icon + "CALLVAULT" wordmark
   - Use: Primary branding, headers, marketing materials
   - File: `Call Vault (FULL LOGO).png`

2. **Wordmark Only** - "CALLVAULT" text without icon
   - Use: When icon space is limited, inline references
   - File: `Call Vault (WORDMARK).png`

3. **Icon Only** - Glassy play button with molten waveform
   - Use: Favicons, app icons, small spaces
   - File: `Call Vault (VAULT).png` or `CALL VAULT [LOGO].png`

### Logo Specifications

**Icon Design:**

- Shape: Triangular play button with rounded corners
- Material: Glassy/crystalline container
- Interior: Molten orange waveform representing audio/call visualization
- Gradient direction: Yellow (#FFEB00) at peaks transitioning to deep orange (#FF3D00) at base

**Wordmark Design:**

- "CALL" - Dark metallic finish (near-black with metallic sheen)
- "VAULT" - Orange gradient finish (#FF8800 to #FF3D00)
- Typography: Bold, condensed sans-serif
- No space between words (one unit: CALLVAULT)

### Logo Clear Space

Minimum clear space around logo = height of the "A" in CALL

### Logo Misuse

**DO NOT:**

- Rotate or skew the logo
- Apply drop shadows not in original
- Change the gradient colors
- Separate icon and wordmark with excessive space
- Use low-resolution versions
- Place on busy backgrounds
- Alter proportions between icon and wordmark

---

## COLOR SYSTEM

### Background Hierarchy (CRITICAL)

Call Vault uses **two-layer background system**:

**Light Mode:**

```text
Layer 1: Viewport/Gutters  -> #FCFCFC (very light gray)
Layer 2: Content Cards     -> #FFFFFF (pure white)
```

**Dark Mode:**

```text
Layer 1: Viewport/Gutters  -> #161616 (near black)
Layer 2: Content Cards     -> #202020 (off-black)
```

**CSS Variables:**

```css
/* Light Mode */
--viewport: 0 0% 99%;       /* #FCFCFC */
--background: 0 0% 100%;    /* #FFFFFF */
--card: 0 0% 100%;          /* #FFFFFF */

/* Dark Mode */
--viewport: 0 0% 9%;        /* #161616 */
--background: 0 0% 13%;     /* #202020 */
--card: 0 0% 13%;           /* #202020 */
```

**Tailwind Usage:**

```tsx
<div className="bg-viewport">     {/* Gutters/body */}
  <div className="bg-card">       {/* Content area */}
    {children}
  </div>
</div>
```

### Primary Neutrals (Monochromatic Palette)

| Color Name | Light Mode | Dark Mode | Usage |
|------------|------------|-----------|-------|
| **Viewport** | #FCFCFC (0 0% 99%) | #161616 (0 0% 9%) | Body background, gutters |
| **Content** | #FFFFFF (0 0% 100%) | #202020 (0 0% 13%) | Cards, main content area |
| **Ink** | #111111 (210 17% 7%) | #FFFFFF (0 0% 100%) | Primary text |
| **Ink Soft** | #444444 (0 0% 27%) | #B0B0B0 (0 0% 69%) | Secondary text |
| **Ink Muted** | #7A7A7A (0 0% 48%) | #6B6B6B (0 0% 42%) | Tertiary text, icons |
| **Border** | #E5E5E5 (0 0% 90%) | #3A3A3A (0 0% 23%) | Dividers, borders |
| **Border Soft** | #F2F2F2 (0 0% 95%) | #2A2A2A (0 0% 16%) | Very light dividers |
| **Hover** | #F8F8F8 (0 0% 97%) | #2A2A2A (0 0% 16%) | Row hover states |

**Tailwind Usage:**

```tsx
{/* Text colors */}
<p className="text-ink">Primary text</p>
<p className="text-ink-soft">Secondary text</p>
<p className="text-ink-muted">Tertiary text, icons</p>

{/* Borders */}
<div className="border border-border">Standard border</div>
<div className="border border-border-soft">Subtle border</div>

{/* Hover states */}
<tr className="hover:bg-hover">Hoverable row</tr>
```

### Vibe Orange (Structural Use Only)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Vibe Orange** | #FF8800 | 32 100% 50% | Active indicators, primary accent |
| **Vibe Orange Dark** | #FF3D00 | 14 100% 50% | Pressed states, gradient end |
| **Vibe Orange Light** | #FFEB00 | 55 100% 50% | Gradient highlights only |

**CRITICAL:** Vibe Orange appears in EXACTLY 5 structural contexts (see dedicated section below).

**Gradient Usage:**
When gradients are required (rare), use the "White Hot to Lava" direction:

```css
/* Gradient for special emphasis (rarely used) */
background: linear-gradient(180deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%);
```

### Semantic Status Colors

Professional indicators with subtle backgrounds (2-3% opacity):

| Status | Background | Text | Border | Usage |
|--------|------------|------|--------|-------|
| **Success** | #F0F9F4 | #166534 | #BBF7D0 | Active, completed, successful |
| **Warning** | #FFFBEB | #78350F | #FDE68A | Pending, attention needed |
| **Danger** | #FEF2F2 | #991B1B | #FECACA | Errors, critical issues |
| **Info** | #F0F9FF | #1E40AF | #BFDBFE | Informational messages |
| **Neutral** | #F9FAFB | #4B5563 | #E5E7EB | Inactive, archived, offline |

**Design Principle:** Backgrounds barely perceptible, text provides 7:1+ contrast.

**Tailwind Usage:**

```tsx
{/* Status badges */}
<span className="bg-success-bg text-success-text border border-success-border">
  Active
</span>
<span className="bg-warning-bg text-warning-text border border-warning-border">
  Pending
</span>
<span className="bg-danger-bg text-danger-text border border-danger-border">
  Error
</span>
<span className="bg-info-bg text-info-text border border-info-border">
  Info
</span>
<span className="bg-neutral-bg text-neutral-text border border-neutral-border">
  Offline
</span>
```

---

## LAYOUT ARCHITECTURE

### Card-on-Viewport System

**Structure:**

```text
+---------------------------------------+

| AppShell (viewport bg)                |
| +-------------------------------------+   |
| | TopBar: 52px height             |   | <- Full width
| +-------------------------------------+   |
|  +-------------------------------------+  | <- FLUSH (no gap)
|  | MainCard (content bg)           |  |
|  | [Tabs with vibe orange line]    |  |
|  | [Header]                        |  |

|  | [Content - scrollable]          |  |
|  |  rounded-2xl, shadow-lg         |  |
|  |  px-10 (sides only for scroll)  |  |
|  +-------------------------------------+  |
|   <- 8px right/bottom/left             |

+---------------------------------------+
```

**Implementation:**

```tsx
<div className="min-h-screen w-full bg-viewport relative">
  <TopBar /> {/* 52px height, full width */}
  <main className="fixed inset-2 top-[52px]">
    {/* inset-2 = 8px right/bottom/left, top-[52px] = flush with header */}
    <div className="bg-card rounded-2xl px-10 shadow-lg border border-border h-full overflow-auto">
      {children}
    </div>
  </main>
</div>
```

### Measurements

**CRITICAL - CORRECTED VALUES:**

- **TopBar height:** 52px (full width, no side gutters)
- **MainCard gutters:** 8px right/bottom/left (via `inset-2` = 0.5rem)
- **MainCard top:** 52px (via `top-[52px]`) - **FLUSH with TopBar, no gap**
- **Card border radius:** 16px (rounded-2xl)
- **Card padding:** See Content Padding Rules below
- **Card shadow:** `shadow-lg` (Tailwind default)
- **Max content width:** 1320px (centered)

**Note:** `inset-2` means `0.5rem` which equals **8px**, NOT 48px.

### Content Padding Rules

**SCROLLABLE Data Pages** (Analytics, Transcripts, Library):

```tsx
<div className="bg-card rounded-2xl px-10 shadow-lg border border-border h-full overflow-auto">
  {/* Content scrolls flush to top/bottom edges */}
</div>
```

- **Horizontal:** 40px (px-10) - creates margin from viewport edges
- **Vertical:** 0px - content scrolls edge-to-edge for maximum space
- **Use for:** Tables, charts, data lists requiring vertical scrolling

**STATIC Content Pages** (Settings, Forms, Modals):

```tsx
<div className="bg-card rounded-2xl px-10 pb-10 pt-2 shadow-lg border border-border h-full overflow-auto">
  {/* Has vertical padding */}
</div>
```

- **Horizontal:** 40px (px-10)
- **Top:** 8px (pt-2)
- **Bottom:** 40px (pb-10)
- **Use for:** Forms, configuration screens, single-page content without scrolling

### Multi-Card and Sidebar Layouts

Layout supports side-by-side cards with collapsible sidebars:

```text
┌─────────────────────────────────────────────────┐
│  ChatOuterCard (BG-CARD-MAIN)                   │
│  ┌──────────┬──────────────────────────────┐    │
│  │ Sidebar  │  ChatInnerCard (BG-CARD-INNER)│    │
│  │ 280px    │  - Header with toggle        │    │
│  │ expanded │  - Content area              │    │
│  │ ───or─── │                              │    │
│  │ 56px     │                              │    │
│  │ collapsed│                              │    │
│  └──────────┴──────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

Both cards use `bg-card` and maintain consistent styling.

### Sidebar Layout Pattern

When implementing collapsible sidebar navigation alongside main content:

**Sidebar Structure Hierarchy:**

The sidebar follows a specific vertical structure:

1. **Navigation Icons** (top) - 4 glossy 3D icons for main navigation
2. **Separator Line** - Thin border dividing nav from content
3. **Content Area** (folder list, etc.) - Takes remaining vertical space

**Container Structure:**

```tsx
import { SidebarCollapseToggle } from '@/components/ui/sidebar-collapse-toggle';
import { SidebarNav } from '@/components/ui/sidebar-nav';
import { FolderSidebar } from '@/components/transcript-library/FolderSidebar';

{/* Full height flex container - sidebar + main content side by side */}
<div className="h-full flex gap-2.5 overflow-hidden">
  {/* Mobile overlay backdrop when sidebar expanded */}
  {sidebarState === 'expanded' && (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
      onClick={() => setSidebarState('collapsed')}
    />
  )}

  {/* SIDEBAR - Edge-mounted collapse toggle */}
  <div
    className={`
      relative flex-shrink-0 transition-all duration-200 h-full flex flex-col
      ${sidebarState === 'expanded'
        ? 'fixed inset-y-0 left-0 z-50 shadow-2xl md:relative md:shadow-none w-[280px]'
        : 'w-[56px]'}
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

    {/* Navigation icons at top */}
    <SidebarNav isCollapsed={sidebarState === 'collapsed'} />

    {/* Folder sidebar takes remaining space */}
    <FolderSidebar isCollapsed={sidebarState === 'collapsed'} />
  </div>

  {/* MAIN CONTENT */}
  <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
    <Content />
  </div>
</div>
```

**Required Specifications:**

| Property | Expanded | Collapsed |
|----------|----------|-----------|
| Width | 280px (`w-[280px]`) | 56px (`w-[56px]`) |
| Nav Icons | Horizontal row with labels | Vertical column, icons only |
| Content | Full navigation with text labels | Icons only (44x44px touch targets) |
| Transition | `transition-all duration-200` | `transition-all duration-200` |
| Background | `bg-card` with `rounded-2xl` | `bg-card` with `rounded-2xl` |
| Border | `border border-border` | `border border-border` |

**State Management:**

```tsx
// Two states only: 'expanded' or 'collapsed'
const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed'>('expanded');

const toggleSidebar = () => {
  setSidebarState(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
};
```

### Edge-Mounted Collapse Toggle

**IMPORTANT:** The collapse/expand toggle is now edge-mounted on the sidebar itself, NOT in the header.

**Toggle Specifications:**

| Property | Value |
|----------|-------|
| Position | Absolute, right edge (-12px), vertically centered |
| Size | 24x24px circle (`w-6 h-6 rounded-full`) |
| Z-index | 10 (above sidebar content, below modals) |
| Background | `bg-card` (matches sidebar) |
| Border | `border border-border` |
| Shadow | `shadow-sm` |
| Hover | `bg-hover` |

**Icon Behavior:**

- **When collapsed:** Right chevron (`RiArrowRightSLine`) - indicates expand action
- **When expanded:** Left chevron (`RiArrowLeftSLine`) - indicates collapse action
- Icon color: `text-ink-muted`
- Icon size: `w-4 h-4`

```tsx
import { SidebarCollapseToggle } from '@/components/ui/sidebar-collapse-toggle';

// Usage - must be inside a relative-positioned parent
<div className="relative">
  <SidebarCollapseToggle
    isCollapsed={sidebarState === 'collapsed'}
    onToggle={toggleSidebar}
  />
  {/* Sidebar content */}
</div>
```

### Sidebar Navigation Icons (SidebarNav)

The sidebar includes 4 primary navigation icons at the top, styled with a glossy 3D effect similar to macOS dock icons.

**Navigation Items:**

| ID | Name | Icon | Path | Match Paths |
|----|------|------|------|-------------|
| home | Home | `RiHome4Fill` | `/` | `/`, `/transcripts` |
| chat | AI Chat | `RiChat1Fill` | `/chat` | `/chat` |
| sorting | Sorting | `RiPriceTag3Fill` | `/sorting-tagging` | `/sorting-tagging` |
| settings | Settings | `RiSettings3Fill` | `/settings` | `/settings` |

**Glossy 3D Icon Styling:**

```tsx
// Light mode
'bg-gradient-to-br from-white to-gray-200',
'border border-gray-300/80',
'shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),inset_0_-4px_6px_rgba(0,0,0,0.08),0_10px_20px_rgba(0,0,0,0.08)]',

// Dark mode
'dark:from-gray-700 dark:to-gray-800',
'dark:border-gray-600/80',
'dark:shadow-[inset_0_4px_6px_rgba(255,255,255,0.1),inset_0_-4px_6px_rgba(0,0,0,0.2),0_10px_20px_rgba(0,0,0,0.3)]',
```

**Icon Button Specifications:**

| Property | Value |
|----------|-------|
| Button size | 44x44px (`w-11 h-11`) |
| Border radius | `rounded-xl` (12px) |
| Icon size | 20x20px (`w-5 h-5`) |
| Icon color (light) | `text-ink` |
| Icon color (dark) | `text-white` |
| Hover effect | `scale-105` |
| Active state | `ring-2 ring-vibe-orange/50` |

**Active Indicator:**

- Small orange dot below active icon
- Size: 6x6px (`w-1.5 h-1.5`)
- Color: `bg-vibe-orange`
- Position: Centered, -2px below button

**Layout Behavior:**

- **Expanded sidebar:** Icons in horizontal row, centered with 8px gap
- **Collapsed sidebar:** Icons in vertical column, centered
- Separator line below: `border-t border-border` with 12px horizontal margin

```tsx
import { SidebarNav } from '@/components/ui/sidebar-nav';

<SidebarNav isCollapsed={sidebarState === 'collapsed'} />
```

**Mobile Responsive Behavior:**

On screens < 768px (`md` breakpoint):

- Sidebar becomes **fixed overlay** when expanded
- **Backdrop blur** appears behind sidebar (`bg-black/50 backdrop-blur-sm`)
- Clicking backdrop **closes sidebar**
- Sidebar has elevated shadow (`shadow-2xl`)
- Edge-mounted toggle is **hidden** on mobile (toggle via backdrop tap)
- On desktop (`md:` and up), sidebar returns to normal relative positioning

**Reference Implementation:**

- Collapse Toggle: [sidebar-collapse-toggle.tsx](src/components/ui/sidebar-collapse-toggle.tsx)
- Navigation: [sidebar-nav.tsx](src/components/ui/sidebar-nav.tsx)
- Folder Sidebar: [FolderSidebar.tsx](src/components/transcript-library/FolderSidebar.tsx)
- Page usage: [TranscriptsNew.tsx](src/pages/TranscriptsNew.tsx)

---

## BUTTON SYSTEM

### Overview

**6 standardized variants:**

1. Primary (default) - Glossy slate gradient for main actions
2. Plain (hollow) - Simple border for secondary actions
3. Destructive - Red for dangerous actions
4. Link - Text-only for tertiary actions
5. Outline - Subtle bordered for toggleable/selectable items
6. Ghost - Transparent with hover for minimal UI contexts

**Single component:** `<Button>` from `@/components/ui/button`

### 1. PRIMARY BUTTON (Main Actions)

**Variant:** `variant="default"`

**Visual Specifications:**

```css
/* Slate gradient (same in light and dark mode) */
background: linear-gradient(160deg, #627285 0%, #394655 100%);
color: #FFFFFF;
border: 1px solid rgba(57, 70, 85, 0.8);
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);

/* Multi-layer shadow system (scales with size) */
box-shadow:
  0 4px 6px rgba(255, 255, 255, 0.25) inset,
  0 -4px 6px rgba(0, 0, 0, 0.35) inset,
  0 10px 20px rgba(61, 74, 91, 0.2);
```

**Sizes:**

| Size | Height | Padding | Font Size | Border Radius | Min Width |
|------|--------|---------|-----------|---------------|--------------|
| sm | 36px | 0 20px | 14px | 12px | 100px |
| default | 40px | 0 24px | 16px | 12px | 120px |
| lg | 44px | 0 28px | 17px | 12px | 135px |
| icon | 32px | 8px | 16px | 8px (rounded-md) | 32x32px |

**Icon Button Size Note:** Size was intentionally reduced from 40x40px to 32x32px for a cleaner aesthetic.

**States:**

```css
/* Hover - No transform, stays in place */
hover: { /* slight shadow enhancement possible */ }

/* Active (pressed) */
active: {
  transform: translateY(1px) scale(0.98);
  outline: 2px solid #FF8800;  /* vibe orange */
  outline-offset: 2px;
}

/* Focus (keyboard navigation) */
focus: {
  outline: 2px solid #FF8800;  /* vibe orange */
  outline-offset: 2px;
}

/* Disabled */
disabled: {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Usage:**

```tsx
<Button variant="default">Save Changes</Button>
<Button variant="default" size="sm">Submit</Button>
<Button variant="default" size="lg">Get Started</Button>
```

**When to use:**

- Primary call-to-action
- Form submissions (Save, Submit, Create)
- Critical operations
- Single most important action on screen
- Search, Fetch, Sync actions
- Modal confirmations

**Where NOT to use:**

- Table row actions (use Plain)
- Pagination (use Plain)
- Icon-only toolbars (use Plain or icon size)
- Mobile (auto-converts to Plain)

**Dark Mode Behavior:** **NO CHANGE** - Button stays identical in dark mode

---

### 2. PLAIN BUTTON (Secondary Actions)

**Variant:** `variant="hollow"`

**Visual Specifications:**

**Light Mode:**

```css
background: #FFFFFF;
color: #111111;
border: 1px solid #E5E5E5;
border-radius: 12px;
```

**Dark Mode:**

```css
background: #202020;
color: #FFFFFF;
border: 1px solid #3A3A3A;
border-radius: 12px;
```

**Sizes:** Same as Primary (sm, default, lg, icon)

**States:**

```css
/* Hover */
hover: {
  background: #F8F8F8 (light) / #2A2A2A (dark);
  border-color: #D1D1D1 (light) / #4A4A4A (dark);
}

/* Active */
active: {
  outline: 2px solid #FF8800;  /* vibe orange ring */
  outline-offset: 2px;
}

/* Focus */
focus: {
  outline: 2px solid #FF8800;  /* vibe orange ring */
  outline-offset: 2px;
}

/* Disabled */
disabled: {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Icon Button Implementation (CORRECTED):**

```typescript
if (size === 'icon') {
  return (
    <Comp
      ref={ref}
      className={cn(
        'h-8 w-8 inline-flex items-center justify-center gap-1',
        'whitespace-nowrap rounded-md text-sm font-medium',
        // Border: black in light mode, white in dark mode
        'border border-ink dark:border-white',
        // Background and text
        'bg-white text-ink dark:bg-black dark:text-white',
        // Hover: light gray in light mode, darker gray in dark
        'hover:bg-hover dark:hover:bg-border',
        'ring-offset-background transition-colors',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      {...props}
    />
  );
}
```

**Key Icon Button Specifications:**

- Size: **32x32px** (h-8 w-8) - reduced from 40x40px
- Padding: **8px** (not 12px)
- Border: **Required** - black in light, white in dark
- Hover: **Light gray (#F8F8F8)** NOT pure black

**Usage:**

```tsx
<Button variant="hollow">Cancel</Button>
<Button variant="hollow" size="icon">
  <IconComponent />
</Button>
```

**When to use:**

- Secondary actions (Cancel, Back, Skip)
- Table row actions
- Pagination buttons
- Toolbar icon buttons
- Mobile - ALL buttons (replaces Primary)
- Less critical operations

**Dark Mode Behavior:** Adapts to maintain contrast (white -> #202020 bg)

---

### 3. DESTRUCTIVE BUTTON (Dangerous Actions)

**Variant:** `variant="destructive"`

**Visual Specifications:**

```css
/* Red gradient (same in light and dark mode) */
background: linear-gradient(160deg, #E54D4D 0%, #C93A3A 100%);
color: #FFFFFF;
border: 1px solid rgba(190, 50, 50, 0.8);
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);

/* Shadow system (similar to primary, adjusted colors) */
box-shadow:
  0 4px 6px rgba(255, 255, 255, 0.25) inset,
  0 -4px 6px rgba(0, 0, 0, 0.3) inset,
  0 10px 20px rgba(0, 0, 0, 0.15);
```

**Sizes:** Same as Primary (sm, default, lg)

**States:** Same as Primary (orange ring on active/focus)

**Usage:**

```tsx
<Button variant="destructive">Delete Account</Button>
<Button variant="destructive">Remove Recording</Button>
```

**When to use:**

- Delete operations
- Remove/revoke actions
- Account cancellation
- Destructive operations requiring confirmation

**Dark Mode Behavior:** **NO CHANGE** - Stays identical

---

### 4. LINK BUTTON (Tertiary Actions)

**Variant:** `variant="link"`

**Visual Specifications:**

```css
background: transparent;
color: #1a1a1a (light) / #FFFFFF (dark);
border: none;
text-decoration: underline;
text-underline-offset: 4px;
padding: 0;
height: auto;
```

**States:**

```css
/* Hover */
hover: {
  text-decoration-color: #FF8800;  /* vibe orange underline */
  text-decoration-thickness: 2px;
}

/* Focus */
focus: {
  text-decoration-color: #FF8800;  /* vibe orange underline */
  text-decoration-thickness: 2px;
}
```

**Usage:**

```tsx
<Button variant="link">Learn more</Button>
<Button variant="link">View details</Button>
```

**When to use:**

- Inline text actions
- "Learn more" / "View details" links
- Tertiary navigation
- Footer links
- Non-critical actions within text

**Dark Mode Behavior:** Text color inverts, underline behavior same

---

### 5. OUTLINE BUTTON (Toggleable/Selectable Items)

**Variant:** `variant="outline"`

**Visual Specifications:**

**Light Mode:**

```css
background: transparent;
color: #6B6B6B;  /* ink-soft */
border: 1px solid #E8E8E8;  /* border-soft */
border-radius: 8px;
```

**Dark Mode:**

```css
background: transparent;
color: #9A9A9A;  /* ink-muted in dark mode */
border: 1px solid #3A3A3A;  /* border in dark mode */
border-radius: 8px;
```

**Sizes:**

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 32px | 0 12px | 12px |
| default | 36px | 0 16px | 14px |
| lg | 40px | 0 20px | 14px |
| icon | 32px/24px | - | 16px |

**States:**

```css
/* Hover */
hover: {
  background: #F8F8F8 (light) / #2A2A2A (dark);
  color: #111111 (light) / #FFFFFF (dark);
  border-color: #E5E5E5 (light) / #4A4A4A (dark);
}

/* Focus */
focus: {
  outline: 2px solid #FF8800;  /* vibe orange ring */
  outline-offset: 2px;
}
```

**Usage:**

```tsx
{/* For toggleable filters - pairs with default for selected state */}
<Button variant={isSelected ? 'default' : 'outline'}>Category</Button>

{/* For suggestion chips */}
<Button variant="outline" size="sm">Sales objections</Button>

{/* For date presets */}
<Button variant="outline" size="sm">This month</Button>
```

**When to use:**

- Filter toggles (unselected state)
- Tag/category selection (pairs with `default` for selected)
- Suggestion chips
- Date range presets
- Multi-select options
- Low-emphasis selectable items

**Key Pattern:** Use `variant={isSelected ? 'default' : 'outline'}` for toggle buttons

**Dark Mode Behavior:** Colors adapt to maintain contrast

---

### 6. GHOST BUTTON (Minimal UI)

**Variant:** `variant="ghost"`

**Visual Specifications:**

**Light Mode:**

```css
background: transparent;
color: #7A7A7A;  /* ink-muted */
border: none;
border-radius: 8px;
```

**Dark Mode:**

```css
background: transparent;
color: #9A9A9A;  /* ink-muted in dark mode */
border: none;
border-radius: 8px;
```

**Sizes:**

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| sm | 32px | 0 12px | 12px |
| default | 36px | 0 16px | 14px |
| lg | 40px | 0 20px | 14px |
| icon | 32px/24px | - | 16px |

**States:**

```css
/* Hover */
hover: {
  background: #F8F8F8 (light) / #2A2A2A (dark);
  color: #111111 (light) / #FFFFFF (dark);
}

/* Focus */
focus: {
  outline: 2px solid #FF8800;  /* vibe orange ring */
  outline-offset: 2px;
}
```

**Usage:**

```tsx
{/* Code block copy button */}
<Button variant="ghost" size="icon">
  <RiFileCopyLine />
</Button>

{/* Toolbar icons with minimal chrome */}
<Button variant="ghost" size="sm">
  <RiMoreLine /> More
</Button>
```

**When to use:**

- Icon toolbars with minimal UI
- Code block actions (copy, expand)
- Inline actions that should be subtle
- Secondary icon actions
- When you need clickable area but minimal visual presence

**Note:** For icon buttons, `ghost` is the default behavior when no variant is specified with `size="icon"`

**Dark Mode Behavior:** Colors adapt to maintain contrast

---

### Button Usage Decision Tree

```text
Is this the PRIMARY action on the screen?
|- YES -> variant="default"
+- NO |

Is this a DESTRUCTIVE action?
|- YES -> variant="destructive"
+- NO |

Is this inline with text / very low priority?
|- YES -> variant="link"
+- NO |

Is this a TOGGLEABLE/SELECTABLE item (filter, tag, preset)?
|- YES -> variant="outline" (unselected) / variant="default" (selected)
+- NO |

Is this a MINIMAL UI context (code block, subtle toolbar)?
|- YES -> variant="ghost"
+- NO |

Is this a secondary action / toolbar / table / mobile?
+- YES -> variant="hollow"
```

### Mobile Behavior (< 768px)

**Rule:** All `variant="default"` buttons automatically become `variant="hollow"`

**Rationale:** Smaller screens need simpler, less visually heavy buttons

---

## ICON SYSTEM

**Library:** [Remix Icon](https://remixicon.com)
**Package:** `@remixicon/react`
**License:** Apache 2.0 (free for commercial use)

### Why Remix Icon

1. **3,100+ icons** - Comprehensive coverage for all UI needs
2. **Neutral style** - Clean, professional aesthetic matching brand philosophy
3. **Consistent design** - All icons share same stroke weight and 24x24 grid
4. **Dual styles** - Both outlined (`-line`) and filled (`-fill`) variants
5. **Active maintenance** - Continuously updated library

### Installation

```bash
npm install @remixicon/react
```

### Naming Convention

Remix Icon uses a consistent naming pattern:

```text
Ri{IconName}{Style}
```

- `Ri` - Prefix for all Remix Icons
- `{IconName}` - PascalCase icon name
- `{Style}` - `Line` (outlined) or `Fill` (filled)

**Examples:**

- `RiEditLine` - Outlined edit/pencil icon
- `RiEditFill` - Filled edit/pencil icon
- `RiCheckLine` - Outlined checkmark
- `RiCloseLine` - Outlined X/close

### Standard Styling

**Color:** Icons use `text-ink-muted` (#7A7A7A light / #6B6B6B dark)

```tsx
import { RiEditLine, RiDeleteBinLine, RiDownloadLine } from "@remixicon/react";

// Standard inline icon
<RiEditLine className="h-4 w-4 text-ink-muted" />

// Icon in button
<Button variant="hollow" size="icon">
  <RiDeleteBinLine className="h-4 w-4" />
</Button>

// Icon with text (use gap-2)
<button className="flex items-center gap-2">
  <RiDownloadLine className="h-4 w-4 text-ink-muted" />
  <span>Download</span>
</button>
```

### Size Specifications

| Context | Size | Tailwind Class |
|---------|------|----------------|
| Inline with text | 16px | `h-4 w-4` |
| Icon buttons | 16px | `h-4 w-4` |
| Large standalone | 20px | `h-5 w-5` |
| Hero/empty states | 24px | `h-6 w-6` |

### Common Icon Mappings

| Use Case | Icon Name | Component |
|----------|-----------|-----------|
| Edit/Pencil | `ri-pencil-line` | `RiPencilLine` |
| Delete | `ri-delete-bin-line` | `RiDeleteBinLine` |
| Download | `ri-download-line` | `RiDownloadLine` |
| Upload | `ri-upload-line` | `RiUploadLine` |
| Save | `ri-save-line` | `RiSaveLine` |
| Close | `ri-close-line` | `RiCloseLine` |
| Check | `ri-check-line` | `RiCheckLine` |
| Search | `ri-search-line` | `RiSearchLine` |
| Settings | `ri-settings-line` | `RiSettingsLine` |
| User | `ri-user-line` | `RiUserLine` |
| Copy | `ri-file-copy-line` | `RiFileCopyLine` |
| Clipboard check | `ri-clipboard-check-line` | `RiClipboardCheckLine` |
| Video chat | `ri-video-chat-line` | `RiVideoChatLine` |
| Refresh | `ri-refresh-line` | `RiRefreshLine` |
| Alert | `ri-alert-line` | `RiAlertLine` |
| Info | `ri-information-line` | `RiInformationLine` |
| Arrow right | `ri-arrow-right-line` | `RiArrowRightLine` |
| Arrow left | `ri-arrow-left-line` | `RiArrowLeftLine` |
| Chevron down | `ri-arrow-down-s-line` | `RiArrowDownSLine` |
| More (dots) | `ri-more-line` | `RiMoreLine` |
| External link | `ri-external-link-line` | `RiExternalLinkLine` |
| Phone/Call | `ri-phone-line` | `RiPhoneLine` |
| Vault/Safe | `ri-safe-line` | `RiSafeLine` |

### Style Guidelines

**Preferred:** Use `-line` (outlined) style for consistency with minimal brand aesthetic

**When to use `-fill`:**

- Active/selected states (e.g., filled star for favorited)
- High-emphasis indicators
- Toggle states (line = off, fill = on)

### Icon Fill/Line Variant Pattern (Navigation)

For navigation components, icons dynamically switch between `-Line` (inactive) and `-Fill` (active) variants to provide clear visual feedback for selection state. This pattern is used in sidebar navigation, category panes, and folder navigation.

**Pattern Summary:**

| State | Icon Variant | Color | Example |
|-------|-------------|-------|---------|
| **Inactive** | `-Line` suffix | `text-muted-foreground` | `RiHome4Line` |
| **Active** | `-Fill` suffix | `text-vibe-orange` | `RiHome4Fill` |

**Navigation Icon Mappings:**

| Component | Line Icon (Inactive) | Fill Icon (Active) |
|-----------|---------------------|-------------------|
| Home | `RiHome4Line` | `RiHome4Fill` |
| AI Chat | `RiSparklingLine` | `RiSparklingFill` |
| Sorting | `RiPriceTag3Line` | `RiPriceTag3Fill` |
| Settings | `RiSettings3Line` | `RiSettings3Fill` |
| Account | `RiUserLine` | `RiUserFill` |
| Users | `RiTeamLine` | `RiTeamFill` |
| Billing | `RiWalletLine` | `RiWalletFill` |
| Integrations | `RiPlugLine` | `RiPlugFill` |
| AI | `RiRobot2Line` | `RiRobot2Fill` |
| Admin | `RiShieldLine` | `RiShieldFill` |
| Folders | `RiFolderLine` | `RiFolderFill` |
| Tags | `RiPriceTag3Line` | `RiPriceTag3Fill` |
| Recurring | `RiRepeatLine` | `RiRepeatFill` |

*Note: Some icons (e.g., `RiFlowChart`) have no fill variant. Use line variant with orange color for active state.*

**Implementation Pattern:**

```tsx
// Define navigation item with both icon variants
interface NavItem {
  id: string;
  label: string;
  iconLine: React.ComponentType<{ className?: string }>;
  iconFill: React.ComponentType<{ className?: string }>;
  path: string;
}

// Example navigation items
const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    iconLine: RiHome4Line,
    iconFill: RiHome4Fill,
    path: '/',
  },
  {
    id: 'settings',
    label: 'Settings',
    iconLine: RiSettings3Line,
    iconFill: RiSettings3Fill,
    path: '/settings',
  },
];

// Render with conditional icon selection
const NavItem = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
  const IconComponent = isActive ? item.iconFill : item.iconLine;

  return (
    <button className={cn(
      "flex items-center gap-2",
      isActive && "text-vibe-orange"
    )}>
      <IconComponent className={cn(
        "h-5 w-5",
        isActive ? "text-vibe-orange" : "text-muted-foreground"
      )} />
      <span>{item.label}</span>
    </button>
  );
};
```

**Visual State Combination:**

When a navigation item is active, it combines:

1. **Fill icon** - Replaces line icon with filled variant
2. **Vibe orange color** - Icon changes from muted to orange (#FF8800)
3. **Pill indicator** - Orange vertical bar on left edge (see Sidebar Layout Pattern)
4. **Background highlight** - Subtle orange tint (`bg-vibe-orange/10 dark:bg-vibe-orange/20`)

**Transition Timing:**

- Icon swap: Instant (no transition)
- Color transition: 200ms ease-in-out
- Background transition: 200ms ease-in-out

### Prohibited

- **DO NOT** mix icon libraries (no Lucide, Font Awesome, Bootstrap Icons, etc.)
- **DO NOT** use custom SVGs when Remix Icon has an equivalent
- **DO NOT** change icon colors to vibe orange in content areas (icons stay neutral) - *Exception: Navigation active states use vibe orange per Icon Fill/Line Variant Pattern*
- **DO NOT** use icons larger than 24px except in hero/empty states

### Accessibility

- Icon-only buttons MUST have `aria-label`
- Decorative icons should have `aria-hidden="true"`

```tsx
// Icon button with label
<Button variant="hollow" size="icon" aria-label="Edit item">
  <RiEditLine className="h-4 w-4" />
</Button>

// Decorative icon (text provides meaning)
<span className="flex items-center gap-2">
  <RiCheckLine className="h-4 w-4 text-ink-muted" aria-hidden="true" />
  Completed
</span>
```

---

## TAB NAVIGATION

**Component:** `<Tabs>` / `<TabsList>` / `<TabsTrigger>` from `@/components/ui/tabs`

**Purpose:** Navigation between major sections. Use for both page-level tabs (e.g., RECORDINGS / SYNC / ANALYTICS) and modal/dialog tabs. This is the same reusable component for all tab navigation throughout the application.

**Default Behavior (ENFORCED - Cannot Be Overridden):**

- Left-justified alignment (`justify-start`)
- 24px gap between tabs (`gap-6`)
- No padding/margin on triggers (`px-0 pb-3 pt-0 m-0`)
- UPPERCASE text automatically applied
- No background on TabsList

### Active Tab Indicator (Pill)

**Visual Specifications:**

- Height: 6px
- Color: Vibe Orange (#FF8800)
- Shape: **Rounded pill** (NOT angular)
- Position: Bottom of tab, full width

**Full-Width Black Underline:**

- TabsList wrapped in div with `border-b border-ink dark:border-white`
- Provides visual separation between tabs and content

**Implementation Note:**
Use a simple rounded pseudo-element (`rounded-full`) for active tab indicators. Do not apply clip-path shapes to tabs.

**Typography:**

| State | Font | Size | Weight | Color |
|-------|------|------|--------|-------|
| **Inactive** | Inter | 14px | Light (300) | #7A7A7A (ink-muted) |
| **Active** | Inter | 14px | Semibold (600) | #111111 (ink) / #FFFFFF dark |

**Exact Component Implementation** (`src/components/ui/tabs.tsx`):

```tsx
// TabsList - Container with full-width black underline
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="w-full border-b border-ink dark:border-white">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex items-center",
        className,
        // ENFORCED: Always left-justified with 24px gap - cannot be overridden
        "justify-start gap-6",
      )}
      {...props}
    />
  </div>
));

// TabsTrigger - Individual tab button
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base styles
      "relative inline-flex items-center justify-center whitespace-nowrap",
      "text-sm font-light uppercase",
      // Inactive state
      "text-ink-muted transition-all duration-200",
      // Active state - font weight and color
      "data-[state=active]:font-semibold",
      "data-[state=active]:text-ink dark:data-[state=active]:text-white",
      // Active state - 6px vibe orange pill indicator
      "data-[state=active]:after:absolute",
      "data-[state=active]:after:bottom-0",
      "data-[state=active]:after:left-0",
      "data-[state=active]:after:right-0",
      "data-[state=active]:after:h-[6px]",
      "data-[state=active]:after:bg-vibe-orange",
      "data-[state=active]:after:rounded-full",
      "data-[state=active]:after:content-['']",
      // Hover state
      "hover:text-ink dark:hover:text-white",
      // Focus state
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
      // ENFORCED: No horizontal padding, only bottom padding for underline space
      "px-0 pb-3 pt-0 m-0",
    )}
    {...props}
  />
));
```

**Usage Example:**

```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">OVERVIEW</TabsTrigger>
    <TabsTrigger value="transcript">TRANSCRIPT</TabsTrigger>
    <TabsTrigger value="participants">PARTICIPANTS</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="transcript">...</TabsContent>
  <TabsContent value="participants">...</TabsContent>
</Tabs>
```

### CRITICAL RULES

**ALWAYS:**

- Use rounded pill indicator on active tabs (`rounded-full`)
- Use 6px height for the underline
- Use vibe orange (#FF8800) color
- Include full-width black underline wrapper div

**NEVER:**

- Use `grid` or `grid-cols-*` on TabsList (flex layout is enforced)
- Add padding/margin to TabsTrigger (enforced as px-0 m-0)
- Apply clip-path-based shapes to tabs
- Reintroduce legacy angular/trapezoid tab underlines
- Apply to inactive tabs

**Visual Consistency:**
Tabs now use rounded orange pills for active state consistency across current navigation patterns.

**Visual Example:**

```text
[Active Tab]  <- 6px vibe orange rounded pill
    (----)
[Content Below]
```

---

## NAVIGATION & SELECTION STATES

This section documents the unified selection state pattern used across all navigation components including main sidebar, category panes, and folder navigation. The pattern provides clear visual feedback through multiple coordinated indicators.

### Selection State Visual Pattern

When a navigation item is selected/active, it displays a combination of visual indicators working together:

**Complete Selection State:**

```text
┌─────────────────────────────────────┐
│▌                                    │  <- Pill indicator (left edge)
│▌  [●]  Item Label                   │  <- Fill icon + text
│▌                                    │
└─────────────────────────────────────┘
      ^-- Orange tinted background
```

| Indicator | Specification | CSS/Tailwind |
|-----------|---------------|--------------|
| **Pill Indicator** | 4px wide, 80% height, flush left | `absolute left-0 w-1 h-[80%] rounded-r-full bg-vibe-orange` |
| **Fill Icon** | Switches from `-Line` to `-Fill` variant | See Icon System section |
| **Icon Color** | Vibe Orange (#FF8800) | `text-vibe-orange` |
| **Background** | Subtle orange tint | `bg-vibe-orange/10 dark:bg-vibe-orange/20` |
| **Text** | Semibold weight | `font-semibold text-vibe-orange` |

### Pill Indicator Pattern

The pill indicator is a vertical bar that marks the active item. It provides a strong visual anchor for the current selection.

**Specifications:**

| Property | Value |
|----------|-------|
| Width | 4px (`w-1`) |
| Height | 80% of parent (`h-[80%]`) |
| Position | Absolute, left edge (`absolute left-0`) |
| Border radius | Right side only (`rounded-r-full`) |
| Color | Vibe Orange (`bg-vibe-orange`) |
| Shape | Rounded pill |

**Shape Rule:**
Use rounded pill markers for active navigation states. Do not use clip-path needle/trapezoid styling.

**Implementation:**

```tsx
{/* Pill indicator - only rendered when active */}
{isActive && (
  <div
    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[80%] rounded-r-full bg-vibe-orange"
  />
)}
```

### Icon State Changes

Icons dynamically switch between outline (`-Line`) and filled (`-Fill`) variants based on selection state. This reinforces the selection beyond just color changes.

**State Behavior:**

| State | Icon Variant | Icon Color |
|-------|-------------|------------|
| **Inactive/Default** | `-Line` (outlined) | `text-muted-foreground` |
| **Active/Selected** | `-Fill` (filled) | `text-vibe-orange` |
| **Hover** | `-Line` (outlined) | `text-foreground` |

**Implementation Pattern:**

```tsx
// Navigation item definition
interface NavItem {
  id: string;
  label: string;
  iconLine: React.ComponentType<{ className?: string }>;
  iconFill: React.ComponentType<{ className?: string }>;
}

// Conditional rendering
const IconComponent = isActive ? item.iconFill : item.iconLine;

<IconComponent
  className={cn(
    "h-5 w-5 transition-colors duration-200",
    isActive ? "text-vibe-orange" : "text-muted-foreground"
  )}
/>
```

**Fallback for Icons Without Fill Variants:**

Some icons (e.g., `RiFlowChart`) do not have a fill variant. In these cases:

```tsx
// Use line variant with orange color
const IconComponent = category.iconFill ?? category.icon;

<IconComponent
  className={cn(
    "h-4 w-4",
    isActive ? "text-vibe-orange" : "text-muted-foreground"
  )}
/>
```

### Visual Hierarchy Layers

Selection states use a layered approach for clear visual hierarchy:

```text
Layer 1: Background highlight (lowest emphasis)
         └── Subtle orange tint for context

Layer 2: Icon state change (medium emphasis)
         └── Fill variant + orange color

Layer 3: Text styling (medium-high emphasis)
         └── Semibold weight + orange color

Layer 4: Pill indicator (highest emphasis)
         └── Strong orange bar for anchoring
```

All layers work together, but the pill indicator provides the primary visual anchor for "where am I?" orientation.

### Animation & Transitions

Selection state changes are animated for smooth visual feedback:

| Element | Duration | Timing | Property |
|---------|----------|--------|----------|
| Pill indicator | 200ms | ease-in-out | opacity, scale |
| Icon color | 200ms | ease-in-out | color |
| Background | 200ms | ease-in-out | background-color |
| Text color | 200ms | ease-in-out | color |
| Icon swap | Instant | - | No transition (immediate) |

**CSS Variables:**

```css
--selection-transition: 200ms ease-in-out;
```

**Note:** The icon component swap (Line to Fill) happens instantly. Only the color transition is animated.

### Component-Specific Implementations

**Main Sidebar Navigation:**

- Uses glossy 3D icon buttons when collapsed
- Small orange dot indicator below active icon when collapsed
- Full pill + fill icon + background when expanded

**Category Panes (Settings/Sorting):**

- Full selection state with pill, fill icon, background
- Categories arranged vertically in list
- Each category shows selection state independently

**Folder Navigation:**

- Folder icon switches to `RiFolderFill` when selected
- Nested folders inherit same selection pattern
- Custom user icons do not switch variants (no fill available)

### Dark Mode Considerations

Selection states adjust for dark mode visibility:

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background tint | `bg-vibe-orange/10` | `bg-vibe-orange/20` |
| Pill color | `bg-vibe-orange` | `bg-vibe-orange` |
| Icon color | `text-vibe-orange` | `text-vibe-orange` |
| Text color | `text-vibe-orange` | `text-vibe-orange` |

The background opacity doubles in dark mode (10% → 20%) to maintain equivalent visual weight.

### Keyboard Navigation

Selection states must work with keyboard navigation:

- **Arrow keys:** Move focus between items
- **Enter/Space:** Select focused item
- **Tab:** Move to next focusable element

Focus states should be visually distinct from selection states:

```tsx
<button
  className={cn(
    "relative w-full",
    // Selection state
    isActive && "bg-vibe-orange/10 dark:bg-vibe-orange/20",
    // Focus state (ring, not background)
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange"
  )}
>
```

### CRITICAL RULES

**ALWAYS:**

- Use all four selection indicators together (pill, icon, background, text)
- Position pill flush to left edge (`left-0`)
- Use 200ms transition timing for smooth animations
- Handle icons without fill variants gracefully
- Double background opacity for dark mode
- Support keyboard navigation

**NEVER:**

- Use only one selection indicator (e.g., just color change)
- Position pill away from edge (maintains visual anchor)
- Skip transition animations (feels jarring)
- Mix selection state patterns across components
- Forget accessible focus states

### Pane Headers (Vaults and Adjacent Detail Panes)

Pane headers for HUB flows (secondary pane + middle pane + adjacent detail panes) must use a shared structure and tokenized surface treatment.

**Required Composition:**

- Secondary pane header: icon-led HUB label, workspace context line, bank/workspace name, and non-overlapping actions.
- Middle pane header: HUB icon + uppercase title, optional type badge, right-side utility actions.
- Adjacent detail headers (for settings-style panes): same border/background/typography family as the middle pane.

**Required Styles:**

- Surface: `bg-card/*` tokenized backgrounds only (no hardcoded grayscale literals)
- Divider: `border-b border-border`
- Heading: `font-montserrat font-extrabold uppercase tracking-wide`
- Supporting text: `text-muted-foreground`

**Layout Rule:**
Header actions and context controls must wrap/stack as needed to avoid overlap or truncation in constrained pane widths.

---

## SIDEBAR UX PATTERNS

This section documents the Loop-style sidebar collapse/expand interaction pattern used across Call Vault. The pattern is inspired by Microsoft Loop's navigation rail behavior and provides an intuitive, discoverable way to manage sidebar state.

### Loop-Style Collapse/Expand Behavior

The sidebar supports two interaction methods for toggling its expanded/collapsed state:

**1. Click-Anywhere Toggle:**

Users can click anywhere on the sidebar's empty space to toggle between expanded and collapsed states. This provides a large, forgiving target for quick state changes.

**2. Dedicated Edge Button:**

A circular toggle button on the right edge provides a precise, always-visible control. The button uses a chevron icon that rotates to indicate direction.

**Interaction Flow:**

```text
┌─────────────────────────────┐
│                             │
│   [Content]                 │◀── Click here toggles
│                             │    (entire empty area)
│                         ○ ◀─┼─── Circular button
│                             │    (also toggles)
│   [Content]                 │
│                             │
└─────────────────────────────┘
```

### Z-Index Hierarchy (CRITICAL)

The sidebar uses a layered z-index system to ensure proper interaction behavior:

| Layer | Z-Index | Element | Purpose |
|-------|---------|---------|---------|
| **Overlay** | z-0 | Click-to-toggle background | Catches clicks on empty space |
| **Content** | z-10 | Navigation items, text, icons | Remains interactive above overlay |
| **Button** | z-20 | Edge-mounted circular toggle | Always accessible, stops propagation |
| **Main Content** | z-0 | Content pane to the right | Below sidebar elements |

**Implementation:**

```tsx
{/* Navigation Rail Container */}
<div className="relative flex-shrink-0 bg-card rounded-2xl ... transition-all duration-500 ease-in-out">

  {/* Click-to-toggle background overlay (z-0) */}
  <div
    className="absolute inset-0 cursor-pointer z-0"
    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
  />

  {/* Floating collapse/expand toggle on right edge (z-20) */}
  <button
    onClick={(e) => {
      e.stopPropagation();  // Prevents double-toggle from overlay
      setIsSidebarExpanded(!isSidebarExpanded);
    }}
    className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm"
  >
    <svg className={cn(
      "transition-transform duration-500",
      isSidebarExpanded ? "rotate-0" : "rotate-180"
    )}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>

  {/* Content with z-10 to remain interactive */}
  <div className="relative z-10">
    <SidebarNav isCollapsed={!isSidebarExpanded} />
  </div>
</div>
```

**Key Implementation Details:**

- `stopPropagation()` on the button prevents the overlay click handler from also firing
- Content elements need explicit `z-10` to remain clickable above the overlay
- The overlay uses `inset-0` to cover the entire sidebar container

### Transition Timing

Sidebar width changes use a **500ms ease-in-out** transition for smooth, premium-feeling animation:

| Property | Duration | Timing Function | CSS |
|----------|----------|-----------------|-----|
| **Sidebar width** | 500ms | ease-in-out | `transition-all duration-500 ease-in-out` |
| **Chevron rotation** | 500ms | default | `transition-transform duration-500` |
| **Content opacity** | 500ms | ease-in-out | (inherited from container) |

**Width Values:**

| State | Width | Tailwind |
|-------|-------|----------|
| **Expanded** | 220px | `w-[220px]` |
| **Collapsed** | 72px | `w-[72px]` |

**Note:** The 500ms duration is intentionally longer than most UI transitions (150-200ms) to create a deliberate, smooth collapse/expand motion that draws attention to the significant layout change.

### Edge-Mounted Toggle Button

**Specifications:**

| Property | Value | Tailwind/CSS |
|----------|-------|--------------|
| Position | Absolute, right edge, vertically centered | `absolute top-1/2 -translate-y-1/2 -right-3` |
| Size | 24x24px circle | `w-6 h-6 rounded-full` |
| Background | Card background | `bg-card` |
| Border | 1px standard border | `border border-border` |
| Shadow | Subtle elevation | `shadow-sm` |
| Hover | Muted background | `hover:bg-muted` |
| Z-index | Above content | `z-20` |

**Icon Behavior:**

- **Expanded state:** Left-pointing chevron (rotate-0)
- **Collapsed state:** Right-pointing chevron (rotate-180)
- Icon rotates 180° during transition with same 500ms timing

**Visual:**

```text
Expanded:                    Collapsed:
┌──────────────┐             ┌──────┐
│              │             │      │
│              │◀            │      │▶
│              │             │      │
└──────────────┘             └──────┘
```

### Mobile Considerations

On mobile (screens < 768px), the Loop-style pattern is replaced with overlay navigation:

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Sidebar | Inline, collapsible | Hidden by default |
| Toggle | Edge-mounted button | Menu button in header |
| Expanded View | Inline push layout | Fixed overlay with backdrop |
| Dismiss | Click anywhere on sidebar | Tap backdrop or close button |
| Animation | Width transition | Slide-in from left |

**Mobile Overlay Pattern:**

```tsx
{/* Mobile overlay backdrop */}
{isMobile && showMobileNav && (
  <div
    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
    onClick={() => setShowMobileNav(false)}
  />
)}

{/* Mobile Navigation Overlay */}
{isMobile && showMobileNav && (
  <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-card ... z-50 animate-in slide-in-from-left duration-300">
    {/* Navigation content */}
  </div>
)}
```

### CRITICAL RULES

**ALWAYS:**

- Use 500ms ease-in-out for sidebar width transitions
- Include click-anywhere overlay at z-0
- Position content at z-10 for interactivity
- Position toggle button at z-20
- Use `stopPropagation()` on the toggle button
- Match transition timing between width and chevron rotation

**NEVER:**

- Use shorter transitions (feels abrupt for layout changes)
- Forget z-index layering (breaks click handling)
- Skip `stopPropagation()` (causes double-toggle)
- Use different timing for width vs. icon animation (feels disconnected)
- Show edge-mounted toggle on mobile (use overlay pattern instead)

---

## TYPOGRAPHY

### Typefaces

**Display/Headers:** Montserrat Extra Bold (800)
**Body/UI:** Inter (300, 400, 500)

**Loading:**

```html
<!-- In index.html for performance -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Montserrat:wght@800&display=swap" rel="stylesheet">
```

### Type Scale

| Element | Font | Size | Weight | Line Height | Case | Usage |
|---------|------|------|--------|-------------|------|-------|
| **Page Title (H1)** | Montserrat | 32px | 800 | 1.2 | ALL CAPS | Main page headings |
| **Section Header (H2)** | Montserrat | 24px | 800 | 1.3 | ALL CAPS | Section divisions |
| **Subheader (H3)** | Montserrat | 18px | 800 | 1.4 | ALL CAPS | Subsections |
| **Body Text** | Inter | 14px | 300 | 1.6 | Normal | Paragraphs, descriptions |
| **Table Header** | Inter | 12px | 500 | 1.4 | UPPERCASE | Column headers |
| **Table Cell Primary** | Inter | 14px | 500 | 1.5 | Normal | Main cell content |
| **Table Cell Secondary** | Inter | 12px | 300 | 1.4 | Normal | Metadata, timestamps |
| **Button Label** | Inter | 13px | 500 | 1.4 | UPPERCASE | All button text |
| **Tab Label (Inactive)** | Inter | 14px | 300 | 1.4 | UPPERCASE | Inactive tab names |
| **Tab Label (Active)** | Inter | 14px | 600 | 1.4 | UPPERCASE | Active tab name |
| **Metric Number (XL)** | Inter | 28px | 300 | 1.1 | Normal | Dashboard metrics |
| **Metric Label** | Inter | 12px | 400 | 1.3 | Normal | Metric descriptions |
| **Caption/Meta** | Inter | 11px | 300 | 1.4 | Normal | Footnotes, timestamps |

### Typography Rules

**Headers, Headlines, and UI Labels (ALL CAPS):**

- Page titles, section headers, subheads (H1, H2, H3) - Montserrat Extra Bold, ALL CAPS
- Tab names (RECORDINGS, SYNC, ANALYTICS) - Inter Medium, ALL CAPS
- Table column headers - Inter Medium, UPPERCASE
- Button labels - Inter Medium, UPPERCASE
- Navigation items - ALL CAPS

**Body Text and Conversational Copy (Title/Sentence Case):**

- Body text, paragraphs - Inter Light (300) or Regular (400), normal case
- Helper/instructional text - Inter Light, sentence case
- Notifications and system feedback - Inter Regular, title or sentence case
- Empty states - Inter Light, sentence case
- Microcopy and tooltips - Inter Light, sentence case

**Rationale:** Data, navigation, and system/structure elements remain bold and ALL CAPS for hierarchy. Conversational, instructional, or feedback copy uses title/sentence case for easier reading and approachability.

**Additional Rules:**

- Numbers use tabular figures: `font-feature-settings: 'tnum'`
- NEVER mix Montserrat and Inter in same text element
- NEVER use Inter Medium for body text (only for UI elements)

**Tailwind Classes:**

```tsx
// Headings
<h1 className="font-display text-4xl font-extrabold uppercase tracking-wider">

// Body text
<p className="font-sans text-sm font-light leading-relaxed">

// Table headers
<th className="font-sans text-xs font-medium uppercase">

// Button labels
<button className="font-sans text-[13px] font-medium uppercase">

// Numbers
<span className="font-sans text-sm font-light tabular-nums">
```

---

## TABLE DESIGN SYSTEM

### Table Header

**Visual:**

```css
background: #FFFFFF (light) / #202020 (dark);
color: #7A7A7A (light) / #6B6B6B (dark);
font-size: 12px;
font-weight: 500;
text-transform: uppercase;
padding: 10px 16px;  /* py-2.5 px-4 */
border-bottom: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
```

**Vibe Orange Underline (Active/Sortable Columns ONLY):**

```css
/* Only on sortable/active individual columns, NOT full header row */
border-bottom: 3px solid #FF8800;
```

**Example:**

```text
+-----------------+-----------------+-----------------+

| NAME            | DATE            | STATUS          |  <- White bg
|   --            |                 |                 |  <- Orange underline on "Name" only

+-----------------+-----------------+-----------------+

| Row 1...        |                 |                 |

```

### Table Rows

**Single-Line Rows (30px height):**

```css
height: 30px;  /* py-2 */
font-size: 14px;
font-weight: 500;
color: #111111 (light) / #FFFFFF (dark);
border-bottom: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
```

**Two-Line Rows (52-56px height):**

```tsx
<td className="py-2.5">
  <div className="flex flex-col gap-1">
    <div className="text-sm font-medium text-ink">
      Primary content
    </div>
    <div className="text-xs font-light text-ink-muted">
      Secondary metadata
    </div>
  </div>
</td>
```

**Hover State:**

```css
background: #F8F8F8 (light) / #2A2A2A (dark);
/* Entire row background changes */
```

### Table Cell Content

**Primary Text:**

- Size: 14px
- Weight: 500 (Medium)
- Color: #111111 (light) / #FFFFFF (dark)

**Secondary Text (metadata):**

- Size: 12px
- Weight: 300 (Light) or 500 (Medium)
- Color: #7A7A7A (light) / #6B6B6B (dark)

**Numbers:**

```tsx
<td className="text-right tabular-nums">
  1,234.56
</td>
```

**IDs (monospace):**

```tsx
<span className="font-mono uppercase tabular-nums text-xs">
  ABC123DEF
</span>
```

### Table Structure Rules

**DO:**

- Use horizontal 1px borders only
- Align numbers right with tabular figures
- Use white header background (#FFFFFF light, #202020 dark)
- Apply vibe orange underline ONLY to individual sortable columns
- Use hover state on entire row
- Structure two-line cells with `flex flex-col gap-1`

**DON'T:**

- Use vertical borders (creates visual clutter)
- Use colored header backgrounds
- Apply vibe orange across entire header row
- Use card/container around tables
- Mix cell heights within same table
- Use sentence case in headers

---

## THE 10 PERCENT - APPROVED CARD USAGE

Cards/containers are used ONLY in these contexts:

### 1. Metric/Stat Cards - PRIMARY USE CASE

**Visual Specifications:**

```css
/* Card container */
background: #FFFFFF (light) / #202020 (dark)
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark)
border-radius: 8px (rounded-lg)
padding: 8px 16px (py-2 px-4)
position: relative

/* Vibe orange left marker - STANDARDIZED DIMENSIONS */
position: absolute
left: 0
top: 50%
transform: translateY(-50%)
width: 6px (w-1.5)          <- STANDARDIZED
height: 56px (h-14)         <- STANDARDIZED
background-color: #FF8800
clip-path: polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)  <- 10%/90% angle
```

**Complete Implementation:**

```tsx
<div className="relative py-2 px-4 bg-card border border-border dark:border-border rounded-lg">
  {/* Vibe orange angled marker - STANDARDIZED DIMENSIONS */}
  <div
    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14"
    style={{
      backgroundColor: "rgb(255, 136, 0)",
      clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
    }}
  />

  {/* Card content */}
  <div className="flex items-center justify-between mb-1">
    <div className="text-xs font-medium text-ink-muted">
      Total recording time
    </div>
    <div className="text-[10px] text-ink-muted">current</div>
  </div>
  <div className="flex items-center justify-between">
    <div className="font-display text-2xl font-extrabold text-ink">
      62h 7m
    </div>
    <div className="text-lg font-semibold text-ink-soft">
      62h 7m
    </div>
  </div>
</div>
```

**Marker Dimensions - DO NOT DEVIATE:**

- Width: **6px** (w-1.5 in Tailwind)
- Height: **56px** (h-14 in Tailwind)
- Angle: **10%/90%** (sharper than alternatives)
- Color: Vibe Orange (#FF8800)
- These dimensions were selected after testing three variants
- Reference: Analytics page, "Impact Overview" section

**Typography in Cards:**

- Label: 12px (text-xs), medium weight, muted color
- Value: 24px (text-2xl), extrabold, primary color
- Secondary value: 18px (text-lg), semibold, soft color

**When to Use Metric Cards:**

- Dashboard KPI displays
- Analytics summary metrics
- Stats needing visual emphasis
- When data requires hierarchy vs flat tables

**When NOT to Use:**

- Regular content sections (use no container)
- Form fields (different styling system)
- Table rows (NEVER use cards)
- Navigation elements
- "Because it looks nice" - cards are functional, not decorative

**Visual Consistency:**
The angular marker matches the tab underline aesthetic, maintaining cohesive design language.

### 2. Modals/Dialogs

**Container:**

```css
background: #FFFFFF (light) / #202020 (dark);
border-radius: 12px;
padding: 32px;
max-width: 600px;
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
```

**Overlay:**

```css
background: rgba(0, 0, 0, 0.5);
backdrop-filter: blur(4px);
```

**When to use:**

- Confirmation dialogs
- Forms requiring focus
- Critical user decisions
- Multi-step workflows

### 3. Dropdown Menus

**Container:**

```css
background: #FFFFFF (light) / #202020 (dark);
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
border-radius: 8px;
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
```

**Items:**

```css
padding: 8px 12px;
font-size: 14px;
hover: background #F8F8F8 (light) / #2A2A2A (dark);
```

### 4. Search Input Fields

**Light Mode:**

```css
background: #FFFFFF;
border: 1px solid #E5E5E5;
border-radius: 8px;
padding: 8px 16px;
font-size: 14px;
```

**Dark Mode:**

```css
background: #202020;
border: 1px solid #3A3A3A;
/* Other properties same */
```

**Focus State:**

```css
border-left: 3px solid #FF8800;
outline: none;
```

### 5. Toast Notifications

**Container:**

```css
background: #FFFFFF (light) / #202020 (dark);
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
border-radius: 8px;
padding: 12px 16px;
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
```

**When to use:**

- Temporary feedback messages
- System notifications
- Success/error confirmations

### 6. Onboarding Tips

Contextual, step-by-step guidance for new users (may include checklists):

```css
background: #FFFFFF (light) / #202020 (dark);
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
border-radius: 8px;
padding: 16px;
```

### 7. Task/Status Banners

Prominent temporary indicators for sync, import/export, error status:

```css
background: #FFFFFF (light) / #202020 (dark);
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
border-radius: 8px;
padding: 12px 16px;
```

### 8. Temporary Informational Callouts

Limited-duration alerts for new feature rollout, action-required messages during onboarding, or temporary product updates.

**ALL cards/containers must:**

- Use white as the background (no colored fills)
- Have a minimal border (1px, neutral gray or soft shadow ONLY if floating)
- Follow the standard component corner radius (12px for cards, 8px for inputs)
- Contain NO decoration, large icons, or illustration overuse
- Remain visually understated and not compete with table/data hierarchy

**That's it. Everything else: no containers, just content on white with lines and space.**

---

## VIBE ORANGE USAGE RULES

**CRITICAL:** Vibe Orange (#FF8800) is permitted in specific, functional contexts only.

### Core Approved Usage (5 Primary Uses)

#### 1. Active Tab Underlines

```tsx
<div
  className="relative after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[6px] after:rounded-full after:bg-vibe-orange"
>
  Active Tab
</div>
```

- 6px rounded pill beneath active tab
- Uses `rounded-full` marker styling
- Indicates current section in navigation

#### 2. Left-Edge Indicators (Metric Cards)

```tsx
<div
  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14"
  style={{
    backgroundColor: "rgb(255, 136, 0)",
    clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
  }}
/>
```

- 6px width, 56px height angular marker
- Used on left edge of metric cards
- NEVER fill entire background

#### 3. Table Column Headers (Individual Columns Only)

```tsx
<th className="border-b-3 border-vibe-orange">
  Sortable Column
</th>
```

- 3px underline beneath specific sortable columns
- NOT a horizontal line across entire header row
- Example: "Name" column has underline, others don't

#### 4. Focus States

```tsx
<input className="focus:border-l-3 focus:border-l-vibe-orange" />
<button className="focus:outline focus:outline-2 focus:outline-vibe-orange" />
```

- 3px left border on input fields when focused
- 2px outline on buttons when focused/active
- Never change entire border color

#### 5. Circular Progress Indicators

```tsx
<CircularProgress
  value={75}
  color="vibe-orange"  // Filled portion only
/>
```

- Filled portion of circular charts
- Progress bars (used sparingly)

### Additional Approved Uses

#### 6. Progress Trackers

Linear or circular progress bars for onboarding, setup, or feature completion journeys:

```tsx
<div className="h-1 bg-border rounded-full">
  <div className="h-1 bg-vibe-orange rounded-full" style={{ width: '60%' }} />
</div>
```

#### 7. Wayfinding and Step Indication

Active step markers or micro-dividers in onboarding flows, navigation progress, or section transitions:

```tsx
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-vibe-orange" /> {/* Active step */}
  <div className="w-2 h-2 rounded-full bg-border" />      {/* Inactive */}
</div>
```

- Ensure WCAG AA contrast when used

#### 8. Section Dividers (Onboarding/Instructional Only)

Vertical or horizontal lines on white/neutral backgrounds:

```tsx
<div className="w-full h-0.5 bg-vibe-orange" />  {/* Horizontal */}
<div className="h-full w-0.5 bg-vibe-orange" />  {/* Vertical */}
```

- NOT as a fill or main background

#### 9. Contextual Info Banners

In onboarding checklists or system alerts, as a subtle accent ONLY:

```tsx
<div className="border-l-3 border-l-vibe-orange pl-4 bg-card">
  {/* Banner content */}
</div>
```

- Never as the primary surface color

#### 10. Top Status Indicator Bar

Horizontal status bar at the top of the page for system-wide states (syncing, processing, etc.):

```tsx
<div className="w-full h-1 bg-vibe-orange" />  {/* Top status bar */}
```

- Full-width bar at top of page or section
- Height: 1-2px maximum
- Used for temporary status states (loading, syncing, processing)
- Disappears when action completes

### Prohibited Usage (NEVER)

| Never Use | Why | Use Instead |
|-----------|-----|-------------|
| Text color | Fails WCAG contrast on white | Black (#111111) |
| Full button backgrounds | Creates visual noise | Slate gradient (primary) or white (plain) |

| Card backgrounds | Breaks monochromatic aesthetic | White (#FFFFFF) |
| Icon colors | Inconsistent with system | Gray (#7A7A7A) |
| Large filled areas | Overwhelming | Small structural indicators |
| Borders (except 5 approved) | Visual clutter | Gray borders |
| Decorative elements | Vibe orange is functional only | Use neutrals |

### Visual Examples

**Correct Usage:**

```text
[Active Tab]  <- 6px vibe orange angular underline
    /----\
[Content]

| Active Item  <- 6px vibe orange left marker
```

**Incorrect Usage:**

```text
+---------------------+

| ENTIRE CARD ORANGE  |  <- WRONG: Full background

+---------------------+

[BUTTON]  <- WRONG: Orange button background
```

### Orange Gradient (Special Cases Only)

The "White Hot to Lava" gradient should ONLY be used:

- In the logo itself
- In marketing/hero imagery
- NEVER in UI components

```css
/* Marketing use only */
background: linear-gradient(180deg, #FFEB00 0%, #FF8800 50%, #FF3D00 100%);
```

---

## CONVERSATION DIALOGUE UI RULE EXCEPTIONS

### Message Bubbles

### Conversation/Dialogue UI Exception

**User/Host Messages:**

- Background: #007AFF (both light and dark modes)
- Text: #FFFFFF
- Rationale: Clear visual distinction, consistent across themes

**Other Participants:**

- Background: bg-hover
- Text: text-ink

**User/Host Messages (Exception to Monochromatic Rule):**

```tsx
className="bg-[#007AFF] dark:bg-[#0A84FF] text-white rounded-2xl p-3"
```

- Light Mode: #007AFF background
- Dark Mode: #0A84FF background
- Text: White (#FFFFFF)
- Border-radius: 16px (rounded-2xl)
- Rationale: Clear visual distinction for user's own messages in conversation interfaces

**Other Participant Messages:**

```tsx
className="bg-hover text-ink rounded-2xl p-3 border border-border-soft"
```

- Light Mode: #F8F8F8 background (bg-hover)
- Dark Mode: #2A2A2A background
- Text: #111111 (text-ink)
- Border: Optional 1px border-border-soft for extra definition
- Border-radius: 16px (rounded-2xl)

**When to Use:**

- Conversation/transcript views
- Chat interfaces
- Message threads
- Call dialogue displays

**When NOT to Use:**

- Comments sections (use standard card/content styling)
- Notifications (use badges/alerts)
- Email threads (use standard layout patterns)

---

## SPACING & GRID

### 4px Base Grid

All spacing uses 4px increments (Tailwind's default):

| Tailwind | px | rem | Use Case |
|----------|----|----|----------|
| `gap-1` | 4px | 0.25rem | Tight spacing (icons) |
| `gap-2` | 8px | 0.5rem | Icon + text, button groups |
| `gap-3` | 12px | 0.75rem | Button pairs, form fields |
| `gap-4` | 16px | 1rem | Section elements |
| `gap-6` | 24px | 1.5rem | Section divisions |
| `gap-8` | 32px | 2rem | Major sections |
| `gap-12` | 48px | 3rem | Page sections |

### Common Patterns

**Button Groups:**

```tsx
<div className="flex gap-3">  {/* 12px between buttons */}
  <Button>Cancel</Button>
  <Button>Save</Button>
</div>
```

**Icon + Text:**

```tsx
<button className="flex items-center gap-2">  {/* 8px gap */}
  <Icon />
  <span>Label</span>
</button>
```

**Section Spacing:**

```tsx
<div className="space-y-6">  {/* 24px vertical spacing */}
  <Section1 />
  <Section2 />
</div>
```

**Page Gutters:**

- Viewport inset: 8px right/bottom/left (via `inset-2`)
- TopBar: 52px height, flush with main card
- Card padding: 40px horizontal (px-10), varies by page type

---

## COMPONENT SPECIFICATIONS

### Status Pills/Badges

**Structure:**

```tsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success-text border border-success-border">
  Active
</span>
```

**Colors:** Use semantic color system (success, warning, danger, info, neutral)

**When to use:**

- Status indicators
- Tags
- Labels
- Count badges

### Floating Action Shadows

Floating action buttons (FABs) and floating quick-action controls may use a soft shadow for elevation:

```css
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
```

**Rules:**

- Shadows are used for orientation/elevation only
- Never for decorative layering or on data containers
- Use sparingly - most UI should remain flat

```tsx
<button className="rounded-full p-3 bg-card shadow-md hover:shadow-lg">
  <RiAddLine className="h-5 w-5" />
</button>
```

---

## DARK MODE IMPLEMENTATION

### Theme Toggle Behavior

**Light Mode (Default):**

- Viewport: #FCFCFC
- Content: #FFFFFF
- Text: #111111 -> #7A7A7A
- Borders: #E5E5E5 -> #F2F2F2
- Primary button: Slate gradient (no change)
- Plain button: White bg -> Dark bg

**Dark Mode:**

- Viewport: #161616
- Content: #202020
- Text: #FFFFFF -> #6B6B6B
- Borders: #3A3A3A -> #2A2A2A
- Primary button: Slate gradient (no change)
- Plain button: White bg -> #202020 bg

### CSS Class Strategy

**Use Tailwind dark: prefix:**

```tsx
<div className="bg-white dark:bg-[#202020]">
  <p className="text-ink dark:text-white">
    Text content
  </p>
</div>
```

**Or use semantic tokens:**

```tsx
<div className="bg-card">  {/* Auto-adapts to theme */}
  <p className="text-foreground">  {/* Auto-adapts */}
    Text content
  </p>
</div>
```

### Components That DON'T Change

- Primary buttons (slate gradient stays same)
- Destructive buttons (red gradient stays same)
- Vibe orange color (exact same hex in both modes)
- Border radius values
- Spacing/padding values
- Typography sizes and weights

### Components That DO Change

- Plain buttons (white -> #202020 background)
- Card backgrounds (white -> #202020)
- Text colors (dark -> light)
- Border colors (light gray -> dark gray)
- Hover states (adapt to maintain contrast)
- Input backgrounds (white -> #202020)

---

## RESPONSIVE BEHAVIOR

### Breakpoints

Follow Tailwind default breakpoints:

| Breakpoint | Size | Usage |
|------------|------|-------|
| **sm** | 640px | Mobile landscape |
| **md** | 768px | Tablets |
| **lg** | 1024px | Laptops |
| **xl** | 1280px | Desktop |
| **2xl** | 1536px | Large desktop |

### Mobile Adaptations (< 768px)

**Buttons:**

- All `variant="default"` -> `variant="hollow"`
- Size stays same (40px height minimum for touch targets)
- Labels may truncate or icon-only in tight spaces

**Layout:**

- Card gutters reduce from 8px to 4px
- Card padding reduces from 40px to 16px
- Tables may scroll horizontally
- Dock/navigation adapts to mobile-friendly layout

**Typography:**

- H1: 32px -> 24px
- H2: 24px -> 20px
- Body: 14px stays same
- Touch targets: Minimum 44px x 44px always

**Implementation:**

```tsx
<Button
  variant="default"
  className="hidden md:flex"  // Desktop only
/>
<Button
  variant="hollow"
  className="flex md:hidden"  // Mobile only
/>
```

---

## ACCESSIBILITY

### WCAG AA Compliance

**Minimum contrast ratios:**

- Primary text on background: 7:1 (AAA)
- Secondary text on background: 4.5:1 (AA)
- UI elements: 3:1 (minimum)

**Current ratios:**

| Combination | Ratio | Status |
|-------------|-------|--------|
| #111111 on #FFFFFF | 16.1:1 | AAA |
| #444444 on #FFFFFF | 9.7:1 | AAA |
| #7A7A7A on #FFFFFF | 4.6:1 | AA |
| #FF8800 on #FFFFFF | 2.9:1 | FAILS (Never use for text) |

### Focus States

**All interactive elements show focus:**

```css
/* Buttons, inputs, links */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-vibe-orange
focus-visible:ring-offset-2

/* Or for inputs */
focus:border-l-3
focus:border-l-vibe-orange
```

**Keyboard navigation:**

- Tab: Move focus forward
- Shift+Tab: Move focus backward
- Enter/Space: Activate focused element
- Escape: Close modals/dropdowns

### Screen Reader Support

**Semantic HTML:**

```tsx
<button>  {/* Not <div onClick> */}
<nav>
<main>
<header>
<table>
```

**ARIA labels:**

```tsx
<button aria-label="Close dialog">
  <XIcon />
</button>

<input
  aria-label="Search recordings"
  placeholder="Search..."
/>
```

### Touch Targets

#### Touch Target Specifications

Minimum size: 44px x 44px

All interactive elements meet this:

- Buttons: 40px+ height (meets requirement)
- Icon buttons: 32x32px (still meets with padding)
- Table row actions: 40px minimum height
- Links: Adequate padding around text

---

## ANIMATION GUIDELINES

### Principles

1. **Fast** - Nothing over 300ms
2. **Subtle** - Confirm actions, don't distract
3. **Purposeful** - Only animate meaningful state changes

### Standard Durations

| Action | Duration | Easing |
|--------|----------|--------|
| Hover | 150ms | ease-out |
| Focus | 150ms | ease-out |
| Button press | 100ms | ease-out |
| Modal open | 200ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| Dropdown | 150ms | ease-out |
| Panel slide | 200ms | cubic-bezier(0.2, 0.8, 0.2, 1) |

### Implementation

**Buttons:**

```css
transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);

/* Active state is fast */
active: {
  transition-duration: 0.1s;
}
```

**Modals:**

```css
/* Overlay */
animation: fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1);

/* Content */
animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
```

**What NOT to animate:**

- Layout shifts
- Text reflow
- Table sorting
- Data updates

---

## MICROCOPY & QUIPS

### Tone Guidelines

System microcopy, notifications, onboarding messages, empty states, and system feedback should employ a **clever, human, and encouraging tone** wherever possible.

**Encouraged:**

- Puns and wit
- Positive encouragement
- Warm, approachable language
- "Quips" that add personality

**Examples of Good Microcopy:**

```text
"Nice job, your calls are syncing!"
"Nothing here yet-let's record some magic"
"Vault's filling up nicely"
"You're all caught up-time for coffee?"
"First recording? This is gonna be good."
```

### Usage Rules

| Context | Tone | Case |
|---------|------|------|
| Empty states | Warm, encouraging | Sentence case |
| Success confirmations | Celebratory, brief | Sentence case |
| Onboarding tips | Helpful, friendly | Sentence case |
| Error messages | Clear, supportive | Sentence case |
| Tooltips | Concise, informative | Sentence case |

**What to Avoid:**

- Emojis (never use in any context)
- Exclamation overuse (one per message max)
- Overly casual or unprofessional slang
- Humor in error states that could frustrate users

**When to Stay Neutral:**

- Data-critical operations
- Destructive action confirmations
- Security-related messages
- Financial/billing information

### Implementation Example

```tsx
// Empty state
<div className="text-center py-12">
  <p className="text-ink-soft font-light">
    Nothing here yet-let's record some magic
  </p>
</div>

// Success toast
toast.success("Sync complete. Your vault is up to date.");

// Onboarding tip
<p className="text-sm text-ink-soft">
  Pro tip: Keyboard shortcuts make everything faster
</p>
```

---

## PROHIBITED PATTERNS

| Never Use | Why | Use Instead |
|-----------|-----|-------------|
| Emojis | Unprofessional | Minimal stroke icons from Remix Icon |
| Vibe orange text | Fails WCAG contrast | Black text + structural indicators |
| Multiple border radii | Inconsistent | 12px (buttons/cards), 8px (inputs) |
| Gradients (except buttons) | Visual noise | Solid colors + subtle shadows |
| Card containers around tables | Unnecessary hierarchy | Tables on white with separators |
| Vertical table borders | Visual clutter | Horizontal 1px lines only |
| Sentence case headings | Breaks typography system | ALL CAPS Montserrat |
| Animations >300ms | Feels sluggish | 150-200ms max |
| Colored section backgrounds | Competes with data | White + spacing + thin borders |
| Drop shadows everywhere | Dated, heavy | Shadows only on modals/dropdowns |
| Rounded corners everywhere | Inconsistent | Specific radii per component type |
| Colored icons | Inconsistent | Gray (#7A7A7A) for all icons |
| clip-path/angular tab underlines | Legacy pattern drift | Rounded pill indicator (`rounded-full`) |
| Orange gradients in UI | Reserved for logo/marketing | Solid #FF8800 |

---

## CSS VARIABLE REFERENCE

### Complete Variable List

**Copy this into `src/index.css`:**

```css
:root {
  /* ============================================
     VIEWPORT & CONTENT BACKGROUNDS
     ============================================ */
  --viewport: 0 0% 99%;               /* #FCFCFC - Viewport/gutters */
  --background: 0 0% 100%;            /* #FFFFFF - Content/cards */
  --card: 0 0% 100%;                  /* #FFFFFF - Same as background */

  /* ============================================
     PRIMARY NEUTRALS (Light Mode)
     ============================================ */
  --white: 0 0% 100%;                 /* #FFFFFF */
  --black: 0 0% 7%;                   /* #111111 */
  --ink: 210 17% 7%;                  /* #111111 - Primary text */
  --ink-soft: 0 0% 27%;               /* #444444 - Secondary text */
  --ink-muted: 0 0% 48%;              /* #7A7A7A - Tertiary text */
  --border: 0 0% 90%;                 /* #E5E5E5 - Borders */
  --border-soft: 0 0% 95%;            /* #F2F2F2 - Light dividers */
  --hover: 0 0% 97%;                  /* #F8F8F8 - Hover states */

  /* ============================================
     VIBE ORANGE (Structural indicators only)
     ============================================ */
  --vibe-orange: 32 100% 50%;         /* #FF8800 - Primary accent */
  --vibe-orange-dark: 14 100% 50%;    /* #FF3D00 - Darker variant */
  --vibe-orange-light: 55 100% 50%;   /* #FFEB00 - Gradient highlights only */

  /* ============================================
     SEMANTIC STATUS COLORS
     ============================================ */
  --success-bg: 142 71% 96%;          /* #F0F9F4 */
  --success-text: 142 76% 29%;        /* #166534 */
  --success-border: 142 76% 84%;      /* #BBF7D0 */

  --warning-bg: 48 100% 96%;          /* #FFFBEB */
  --warning-text: 30 78% 27%;         /* #78350F */
  --warning-border: 48 96% 77%;       /* #FDE68A */

  --danger-bg: 0 86% 97%;             /* #FEF2F2 */
  --danger-text: 0 74% 42%;           /* #B91C1C */
  --danger-border: 0 91% 71%;         /* #FCA5A5 */

  --info-bg: 199 89% 95%;             /* #E0F2FE */
  --info-text: 199 89% 35%;           /* #0C4A6E */
  --info-border: 199 89% 67%;         /* #5AC8FA */

  --neutral-bg: 0 0% 97%;             /* #F8F8F8 */
  --neutral-text: 0 0% 40%;           /* #666666 */
  --neutral-border: 0 0% 90%;         /* #E5E5E5 */
}

.dark {
  /* ============================================
     VIEWPORT & CONTENT BACKGROUNDS (Dark)
     ============================================ */
  --viewport: 0 0% 9%;                /* #161616 - Viewport/gutters */
  --background: 0 0% 13%;             /* #202020 - Content/cards */
  --card: 0 0% 13%;                   /* #202020 - Same as background */

  /* ============================================
     DARK MODE NEUTRALS
     ============================================ */
  --viewport-dark: 0 0% 9%;           /* #161616 */
  --card-dark: 0 0% 13%;              /* #202020 */
  --panel-dark: 0 0% 16%;             /* #2A2A2A */
  --border-dark: 0 0% 23%;            /* #3A3A3A */
  --text-dark-primary: 0 0% 100%;     /* #FFFFFF */
  --text-dark-secondary: 0 0% 69%;    /* #B0B0B0 */
  --text-dark-muted: 0 0% 42%;        /* #6B6B6B */

  /* Vibe orange stays same in dark mode */
  --vibe-orange: 32 100% 50%;         /* #FF8800 */
}
```

### Tailwind Config Mapping

**Add to `tailwind.config.ts` colors:**

```typescript
colors: {
  // Background hierarchy
  viewport: "hsl(var(--viewport))",
  background: "hsl(var(--background))",
  card: "hsl(var(--card))",

  // Semantic color system (unprefixed)
  white: "hsl(var(--white))",
  black: "hsl(var(--black))",
  ink: "hsl(var(--ink))",
  "ink-soft": "hsl(var(--ink-soft))",
  "ink-muted": "hsl(var(--ink-muted))",
  border: "hsl(var(--border))",
  "border-soft": "hsl(var(--border-soft))",
  "border-dark": "hsl(var(--border-dark))",
  hover: "hsl(var(--hover))",
  "text-dark-primary": "hsl(var(--text-dark-primary))",

  "vibe-orange": {
    DEFAULT: "hsl(var(--vibe-orange))",
    light: "hsl(var(--vibe-orange-light))",
    dark: "hsl(var(--vibe-orange-dark))",
  },

  // Status colors (unprefixed)
  success: {
    bg: "hsl(var(--success-bg))",
    text: "hsl(var(--success-text))",
    border: "hsl(var(--success-border))",
  },
  warning: {
    bg: "hsl(var(--warning-bg))",
    text: "hsl(var(--warning-text))",
    border: "hsl(var(--warning-border))",
  },
  danger: {
    bg: "hsl(var(--danger-bg))",
    text: "hsl(var(--danger-text))",
    border: "hsl(var(--danger-border))",
  },
  info: {
    bg: "hsl(var(--info-bg))",
    text: "hsl(var(--info-text))",
    border: "hsl(var(--info-border))",
  },
  neutral: {
    bg: "hsl(var(--neutral-bg))",
    text: "hsl(var(--neutral-text))",
    border: "hsl(var(--neutral-border))",
  },
}
```

**Usage examples with unprefixed classes:**

```tsx
// Text colors
<p className="text-ink">Primary text</p>
<p className="text-ink-soft">Secondary text</p>
<p className="text-ink-muted">Tertiary/muted text</p>

// Backgrounds
<div className="bg-viewport">Viewport background</div>
<div className="bg-card">Card background</div>
<div className="bg-hover">Hover state</div>

// Borders
<div className="border border-border">Standard border</div>
<div className="border border-border-soft">Light divider</div>

// Status badges
<span className="bg-success-bg text-success-text border-success-border">Success</span>
<span className="bg-warning-bg text-warning-text border-warning-border">Warning</span>
<span className="bg-danger-bg text-danger-text border-danger-border">Error</span>

// Dark mode (automatic with CSS variables)
<p className="text-ink dark:text-text-dark-primary">Adapts to theme</p>
```

---

## QUALITY CHECKLIST

Before shipping any feature:

### Color

- [ ] Vibe orange ONLY in approved structural contexts
- [ ] No vibe orange text anywhere
- [ ] No vibe orange button backgrounds
- [ ] Backgrounds use viewport/card semantic tokens
- [ ] Components use bg-card, not hardcoded colors

### Typography

- [ ] Headings in Montserrat Extra Bold, ALL CAPS

- [ ] Body text in Inter Light/Regular
- [ ] Interactive elements in Inter Medium
- [ ] Table headers uppercase, Inter Medium
- [ ] No font mixing in same element
- [ ] Numbers use tabular figures

### Buttons

- [ ] Only 6 variants used (default, hollow, destructive, link, outline, ghost)
- [ ] Primary actions use variant="default"
- [ ] Secondary actions use variant="hollow"
- [ ] Toggleable/selectable items use variant="outline" (unselected) / variant="default" (selected)
- [ ] Minimal UI contexts use variant="ghost"
- [ ] Icon buttons have appropriate variant (hollow=bordered, ghost=transparent)

- [ ] Orange ring on active/focus states
- [ ] Sizes appropriate for context
- [ ] Mobile uses plain buttons

### Tabs

- [ ] Active underline is 6px height
- [ ] Rounded pill indicator on active tabs (no clip-path)
- [ ] Vibe orange color (#FF8800)
- [ ] No legacy angular/trapezoid tab marker styles

### Tables

- [ ] White header background
- [ ] Header text: 12px uppercase, gray
- [ ] 3px vibe orange underline ONLY on sortable columns (not all)
- [ ] Appropriate row heights (30px single, 52-56px double)

- [ ] 1px horizontal borders only (no vertical)
- [ ] Numbers right-aligned with tabular figures
- [ ] Hover state on entire row

### Metric Cards

- [ ] Vibe orange marker: w-1.5 h-14 (6px x 56px)
- [ ] Angle: 10%/90% clip-path
- [ ] Position: absolute left-0 top-1/2 -translate-y-1/2

- [ ] Used only for KPI/stat displays
- [ ] NOT used decoratively

### Layout

- [ ] Content on white card, not floating in space
- [ ] Viewport uses bg-viewport
- [ ] Card uses bg-card
- [ ] No card containers around tables (90% rule)
- [ ] Proper gutters (8px, not 48px)
- [ ] TopBar 52px flush with main card
- [ ] Correct padding per page type (scrollable vs static)
- [ ] Thin gray separators + white space for divisions

### Accessibility Checklist

- [ ] WCAG AA contrast met (4.5:1 minimum)
- [ ] Focus states with vibe orange ring
- [ ] Touch targets >= 44px
- [ ] Keyboard navigation works
- [ ] ARIA labels on icon buttons
- [ ] Semantic HTML used

### Dark Mode

- [ ] Toggle switches themes correctly
- [ ] No hardcoded presentation values when token/utilities exist (color, border, spacing, typography)
- [ ] Allowed hardcoded exceptions are documented semantic badges, runtime dimensions, and external brand marks only
- [ ] Primary button stays same (doesn't invert)
- [ ] Plain button adapts (#202020 bg)
- [ ] Text maintains 7:1+ contrast
- [ ] No broken layouts or invisible text

---

## VERSIONING GUIDELINES

This document follows semantic versioning to track changes:

**Version Format:** `vX.Y` or `vX.Y.Z`

- Initial versions use two digits: v4.0 (not v4.0.0)
- After first patch, use three digits: v4.0.1, v4.0.2, etc.

| Change Type | Version Bump | Example | Who Decides |
|-------------|--------------|---------|-------------|
| **Patch** | X.Y -> X.Y.1 or X.Y.Z -> X.Y.Z+1 | v4.0 -> v4.0.1 -> v4.0.2 | Claude (automatic) |
| **Minor** | X.Y -> X.Y+1 | v4.0.2 -> v4.1 | Claude (flag to user if >3 sections updated) |
| **Major** | X -> X+1 | v4.1 -> v5.0 | **User only** - Never done by Claude |

### Patch Version (Claude does automatically)

- Small fixes, clarifications, typo corrections
- Updates to 1-2 sections
- Code example corrections

### Minor Version (Claude flags to user)

- Updates across 3+ sections
- New component documentation
- Significant specification changes

### Major Version (User decision only)

- Complete rewrites
- Breaking changes
- Major restructuring
- Claude should NEVER increment major version

### When to Update

- Update version at TOP and BOTTOM of this document
- Add entry to [brand-guidelines-changelog.md](./brand-guidelines-changelog.md) with date, time, git commit
- Update "Last Updated" date/time in header
- **MINOR versions:** Also rename the file (v4.0 -> v4.1)
- Never edit without incrementing version
- Claude never increments major version (X.0)
- **PATCH versions:** Do NOT rename file

---

## VERSION HISTORY

### v4.0 - December 4, 2025

- Major rebrand from "CallVault" to "Call Vault"
- Color system changed from Vibe Green (#D9FC67) to Vibe Orange (#FF8800)
- Added new Vibe Orange variants: Dark (#FF3D00) and Light (#FFEB00)
- Added Brand Identity & Logo section with new logo specifications
- Updated all CSS variables from `cb-` prefix to semantic names (e.g., `ink`, `border`, `hover`)
- Updated all component examples to use new color system
- Added gradient usage guidelines (White Hot to Lava)
- Updated microcopy examples to reflect new brand voice

Full changelog: [brand-guidelines-changelog.md](./brand-guidelines-changelog.md)

---

## DOCUMENT VERSION

**Current Version:** v4.2.1

This version reference must match the title at the top of the document.

---

## DOCUMENT USAGE

**This document is:**

- The single source of truth for all design decisions
- Required reading for all developers
- Reference for AI-assisted coding
- QA checklist before shipping
- Onboarding material for new team members

**This document supersedes:**

- All previous brand guideline versions (including CallVault v3.3.9)
- Any conflicting component documentation
- Verbal instructions given during development
- Legacy component implementations

**When in doubt:**

1. Check this document first
2. Ask the design team if clarification needed
3. Update this document with the answer
4. Commit the update to version control

---

*END OF BRAND GUIDELINES v4.2.1*

This document is complete and accurate as of January 14, 2026.
All implementations must follow these specifications exactly.
