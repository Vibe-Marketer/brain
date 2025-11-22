# CONVERSION BRAIN BRAND GUIDELINES v3.3.8
## Authoritative Design System Reference

**Last Updated:** November 21, 2025
**Status:** Complete & Accurate - Supersedes ALL previous versions
**Purpose:** Single source of truth for all design and development decisions

> ⚠️ **CRITICAL: VERSIONING REQUIREMENT**
> When editing this document, you MUST:
> 1. Increment version in **3 places:**
>    - Title (line 1)
>    - DOCUMENT VERSION section
>    - END OF BRAND GUIDELINES (last line)
> 2. Add entry to [brand-guidelines-changelog.md](./brand-guidelines-changelog.md) with date, time, and git commit
> 3. Update "Last Updated" date/time if changed
> 4. **MINOR versions only:** Update filename (e.g., v3.3 → v3.4 = rename file)
>
> **Failure to version updates will result in lost change tracking.**

---

## TABLE OF CONTENTS

1. [Core Design Philosophy](#core-design-philosophy)
2. [Color System](#color-system)
3. [Layout Architecture](#layout-architecture)
4. [Button System](#button-system)
5. [Icon System](#icon-system)
6. [Tab Navigation](#tab-navigation)
7. [Typography](#typography)
8. [Table Design](#table-design)
9. [10 Percent Approved Card Usage](#10-percent-approved-card-usage)
10. [Vibe Green Usage Rules](#vibe-green-usage-rules)
11. [Conversation Dialogue UI Rule Exception](#conversation-dialogue-ui-rule-exception)
12. [Spacing and Grid](#spacing-and-grid)
13. [Component Specifications](#component-specifications)
14. [Dark Mode Implementation](#dark-mode-implementation)
15. [Responsive Behavior](#responsive-behavior)
16. [Accessibility](#accessibility)
17. [Animation Guidelines](#animation-guidelines)
18. [Microcopy & Quips](#microcopy--quips)
19. [Prohibited Patterns](#prohibited-patterns)
20. [CSS Variable Reference](#css-variable-reference)

---

## CORE DESIGN PHILOSOPHY

Conversion Brain embodies **Apple-level precision** in a professional data-first tool.

### Guiding Principles

1. **Data First** - Remove obstacles between user and information
2. **Whitespace Works** - Empty space clarifies, embrace it
3. **Monochromatic Foundation** - Color used sparingly, purposefully
4. **Professional, Not Playful** - Enterprise-grade aesthetic
5. **Functional Over Decorative** - Every element serves a purpose
6. **90% No Containers** - Content on white, separated by thin lines and space
7. **The 10%** - Cards/containers only for modals, dropdowns, search bars, metric cards

### Visual Hierarchy

```
Information > Structure > Style > Decoration
    ↓           ↓          ↓          ↓
  Always    Usually    Sometimes    Rarely
```

---

## COLOR SYSTEM

### Background Hierarchy (CRITICAL)

Conversion Brain uses **two-layer background system**:

**Light Mode:**
```
Layer 1: Viewport/Gutters  → #FCFCFC (very light gray)
Layer 2: Content Cards     → #FFFFFF (pure white)
```

**Dark Mode:**
```
Layer 1: Viewport/Gutters  → #161616 (near black)
Layer 2: Content Cards     → #202020 (off-black)
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

### Vibe Green (Structural Use Only)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Vibe Green** | #D9FC67 | 72 96% 70% | Active indicators only |
| **Vibe Green Light** | #E5FD9E | 72 100% 77% | Hover states |
| **Vibe Green Dark** | #C9E855 | 72 77% 60% | Active pressed |

**CRITICAL:** Vibe green appears in EXACTLY 5 contexts (see dedicated section below).

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

---

## LAYOUT ARCHITECTURE

### Card-on-Viewport System

**Structure:**
```
┌───────────────────────────────────────┐
│ AppShell (viewport bg)                │
│ ┌─────────────────────────────────┐   │
│ │ TopBar: 52px height             │   │ ← Full width
│ └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐  │ ← FLUSH (no gap)
│  │ MainCard (content bg)           │  │
│  │ [Tabs with vibe green line]     │  │
│  │ [Header]                        │  │
│  │ [Content - scrollable]          │  │
│  │  rounded-2xl, shadow-lg         │  │
│  │  px-10 (sides only for scroll)  │  │
│  └─────────────────────────────────┘  │
│   ← 8px right/bottom/left             │
└───────────────────────────────────────┘
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

### Future Multi-Card Support

Layout must support side-by-side cards:
```
┌─────────────────────────────────────────┐
│ Viewport                                │
│  ┌──────────────┐  ┌──────────────┐     │
│  │ MainCard     │  │ SideCard     │     │
│  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────┘
```

Both cards use `bg-card` and maintain consistent styling.

---

## BUTTON SYSTEM

### Overview

**4 standardized variants only:**
1. Primary (default) - Glossy slate gradient for main actions
2. Plain (hollow) - Simple border for secondary actions
3. Destructive - Red for dangerous actions
4. Link - Text-only for tertiary actions

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
  outline: 2px solid #d9fc67;  /* vibe green */
  outline-offset: 2px;
}

/* Focus (keyboard navigation) */
focus: {
  outline: 2px solid #d9fc67;  /* vibe green */
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
  outline: 2px solid #d9fc67;  /* vibe green ring */
  outline-offset: 2px;
}

/* Focus */
focus: {
  outline: 2px solid #d9fc67;  /* vibe green ring */
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
        'border border-cb-ink dark:border-cb-text-dark-primary',
        // Background and text
        'bg-cb-white text-cb-black dark:bg-cb-black dark:text-cb-white',
        // Hover: light gray in light mode, darker gray in dark
        'hover:bg-cb-hover dark:hover:bg-cb-border',
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

**Dark Mode Behavior:** Adapts to maintain contrast (white → #202020 bg)

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

**States:** Same as Primary (green ring on active/focus)

**Usage:**
```tsx
<Button variant="destructive">Delete Account</Button>
<Button variant="destructive">Remove Agent</Button>
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
  text-decoration-color: #D9FC67;  /* vibe green underline */
  text-decoration-thickness: 2px;
}

/* Focus */
focus: {
  text-decoration-color: #D9FC67;  /* vibe green underline */
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

### Button Usage Decision Tree

```
Is this the PRIMARY action on the screen?
├─ YES → variant="default"
└─ NO ↓

Is this a DESTRUCTIVE action?
├─ YES → variant="destructive"
└─ NO ↓

Is this inline with text / very low priority?
├─ YES → variant="link"
└─ NO ↓

Is this a secondary action / toolbar / table / mobile?
└─ YES → variant="hollow"
```

### Mobile Behavior (< 768px)

**Rule:** All `variant="default"` buttons automatically become `variant="hollow"`

**Rationale:** Smaller screens need simpler, less visually heavy buttons

---

## ICON SYSTEM

**Library:** Remix Icon (https://remixicon.com)
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

```
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

**Color:** Icons use `text-cb-ink-muted` (#7A7A7A light / #6B6B6B dark)

```tsx
import { RiEditLine, RiDeleteBinLine, RiDownloadLine } from "@remixicon/react";

// Standard inline icon
<RiEditLine className="h-4 w-4 text-cb-ink-muted" />

// Icon in button
<Button variant="hollow" size="icon">
  <RiDeleteBinLine className="h-4 w-4" />
</Button>

// Icon with text (use gap-2)
<button className="flex items-center gap-2">
  <RiDownloadLine className="h-4 w-4 text-cb-ink-muted" />
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

### Style Guidelines

**Preferred:** Use `-line` (outlined) style for consistency with minimal brand aesthetic

**When to use `-fill`:**
- Active/selected states (e.g., filled star for favorited)
- High-emphasis indicators
- Toggle states (line = off, fill = on)

### Prohibited

- **DO NOT** mix icon libraries (no Lucide, Font Awesome, Bootstrap Icons, etc.)
- **DO NOT** use custom SVGs when Remix Icon has an equivalent
- **DO NOT** change icon colors to vibe green (icons stay neutral)
- **DO NOT** use icons larger than 24px except in hero/empty states

### Migration from Other Libraries

If migrating existing code from other icon libraries:

| From (Lucide) | To (Remix Icon) |
|---------------|-----------------|
| `Save` | `RiSaveLine` |
| `X` | `RiCloseLine` |
| `Download` | `RiDownloadLine` |
| `RefreshCw` | `RiRefreshLine` |
| `AlertCircle` | `RiAlertLine` |
| `Pencil` | `RiPencilLine` |
| `ClipboardCheck` | `RiClipboardCheckLine` |

| From (React Icons) | To (Remix Icon) |
|--------------------|-----------------|
| `BsPersonVideo` | `RiVideoChatLine` |
| `TbCopyCheck` | `RiClipboardCheckLine` |
| `FaRegEdit` | `RiPencilLine` |

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
  <RiCheckLine className="h-4 w-4 text-cb-ink-muted" aria-hidden="true" />
  Completed
</span>
```

---

## TAB NAVIGATION

**Component:** `<Tabs>` / `<TabsList>` / `<TabsTrigger>` from `@/components/ui/tabs`

**Purpose:** Navigation between major sections. Use for both page-level tabs (e.g., TRANSCRIPTS / SYNC / ANALYTICS) and modal/dialog tabs. This is the same reusable component for all tab navigation throughout the application.

**Default Behavior (ENFORCED - Cannot Be Overridden):**
- Left-justified alignment (`justify-start`)
- 24px gap between tabs (`gap-6`)
- No padding/margin on triggers (`px-0 pb-3 pt-0 m-0`)
- UPPERCASE text automatically applied
- No background on TabsList

### Active Tab Underline

**Visual Specifications:**
- Height: 6px
- Color: Vibe green (#D9FC67)
- Shape: **Parallelogram/angular** (NOT rounded)
- Position: Bottom of tab, full width
- Clip-path: `polygon(5% 0, 95% 0, 100% 100%, 0 100%)` (trapezoid, narrow top)

**Full-Width Black Underline:**
- TabsList wrapped in div with `border-b border-cb-ink dark:border-white`
- Provides visual separation between tabs and content

**CSS Implementation:**
The clip-path is applied via global CSS in `src/index.css`:
```css
[data-state="active"]::after {
  clip-path: polygon(5% 0, 95% 0, 100% 100%, 0 100%);
}
```

**Note:** Horizontal tabs use 5% offset (subtle). Vertical markers use 10%.

**Typography:**
| State | Font | Size | Weight | Color |
|-------|------|------|--------|-------|
| **Inactive** | Inter | 14px | Light (300) | #7A7A7A (cb-ink-muted) |
| **Active** | Inter | 14px | Semibold (600) | #111111 (cb-ink) / #FFFFFF dark |

**Exact Component Implementation** (`src/components/ui/tabs.tsx`):

```tsx
// TabsList - Container with full-width black underline
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="w-full border-b border-cb-ink dark:border-white">
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
      "text-cb-ink-muted transition-all duration-200",
      // Active state - font weight and color
      "data-[state=active]:font-semibold",
      "data-[state=active]:text-cb-ink dark:data-[state=active]:text-white",
      // Active state - 6px vibe green underline (clip-path via CSS)
      "data-[state=active]:after:absolute",
      "data-[state=active]:after:bottom-0",
      "data-[state=active]:after:left-0",
      "data-[state=active]:after:right-0",
      "data-[state=active]:after:h-[6px]",
      "data-[state=active]:after:bg-vibe-green",
      "data-[state=active]:after:content-['']",
      // Hover state
      "hover:text-cb-ink dark:hover:text-white",
      // Focus state
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-green focus-visible:ring-offset-2",
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

**✅ ALWAYS:**
- Use clip-path polygon for angular aesthetic (applied via CSS in index.css)
- Use 6px height for the underline
- Use vibe green (#D9FC67) color
- Include full-width black underline wrapper div
- Horizontal tabs: trapezoid `polygon(5% 0, 95% 0, 100% 100%, 0 100%)`
- Vertical markers: needle `polygon(0 0, 100% 10%, 100% 90%, 0 100%)`

**❌ NEVER:**
- Use `grid` or `grid-cols-*` on TabsList (flex layout is enforced)
- Add padding/margin to TabsTrigger (enforced as px-0 m-0)
- Use `rounded-t-sm` or any border-radius on tab underlines
- Apply clip-path inline in Tailwind classes (use CSS)
- Use solid rectangles - must be angled
- Use rounded corners on the underline
- Apply to inactive tabs

**Visual Consistency:**
The angular underline matches the angled vibe green markers on metric cards, maintaining cohesive design language throughout the application.

**Visual Example:**
```
[Active Tab]  ← 6px vibe green angular underline
    ╱────╲
[Content Below]
```

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
- ✅ Page titles, section headers, subheads (H1, H2, H3) - Montserrat Extra Bold, ALL CAPS
- ✅ Tab names (TRANSCRIPTS, SYNC, ANALYTICS) - Inter Medium, ALL CAPS
- ✅ Table column headers - Inter Medium, UPPERCASE
- ✅ Button labels - Inter Medium, UPPERCASE
- ✅ Navigation items - ALL CAPS

**Body Text and Conversational Copy (Title/Sentence Case):**
- ✅ Body text, paragraphs - Inter Light (300) or Regular (400), normal case
- ✅ Helper/instructional text - Inter Light, sentence case
- ✅ Notifications and system feedback - Inter Regular, title or sentence case
- ✅ Empty states - Inter Light, sentence case
- ✅ Microcopy and tooltips - Inter Light, sentence case

**Rationale:** Data, navigation, and system/structure elements remain bold and ALL CAPS for hierarchy. Conversational, instructional, or feedback copy uses title/sentence case for easier reading and approachability.

**Additional Rules:**
- ✅ Numbers use tabular figures: `font-feature-settings: 'tnum'`
- ❌ NEVER mix Montserrat and Inter in same text element
- ❌ NEVER use Inter Medium for body text (only for UI elements)

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

**Vibe Green Underline (Active/Sortable Columns ONLY):**
```css
/* Only on sortable/active individual columns, NOT full header row */
border-bottom: 3px solid #D9FC67;
```

**Example:**
```
┌─────────────┬─────────────┬─────────────┐
│ NAME        │ DATE        │ STATUS      │  ← White bg
│   ▔▔▔       │             │             │  ← Green underline on "Name" only
├─────────────┼─────────────┼─────────────┤
│ Row 1...    │             │             │
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
    <div className="text-sm font-medium text-cb-ink">
      Primary content
    </div>
    <div className="text-xs font-light text-cb-ink-muted">
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

**✅ DO:**
- Use horizontal 1px borders only
- Align numbers right with tabular figures
- Use white header background (#FFFFFF light, #202020 dark)
- Apply vibe green underline ONLY to individual sortable columns
- Use hover state on entire row
- Structure two-line cells with `flex flex-col gap-1`

**❌ DON'T:**
- Use vertical borders (creates visual clutter)
- Use colored header backgrounds
- Apply vibe green across entire header row
- Use card/container around tables
- Mix cell heights within same table
- Use sentence case in headers

---

## THE 10% - APPROVED CARD USAGE

Cards/containers are used ONLY in these contexts:

### 1. Metric/Stat Cards ⭐ PRIMARY USE CASE

**Visual Specifications:**
```css
/* Card container */
background: #FFFFFF (light) / #202020 (dark)
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark)
border-radius: 8px (rounded-lg)
padding: 8px 16px (py-2 px-4)
position: relative

/* Vibe green left marker - STANDARDIZED DIMENSIONS */
position: absolute
left: 0
top: 50%
transform: translateY(-50%)
width: 6px (w-1.5)          ← STANDARDIZED
height: 56px (h-14)         ← STANDARDIZED
background-color: #D9FC67
clip-path: polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)  ← 10%/90% angle
```

**Complete Implementation:**
```tsx
<div className="relative py-2 px-4 bg-card border border-cb-border dark:border-cb-border-dark rounded-lg">
  {/* Vibe green angled marker - STANDARDIZED DIMENSIONS */}
  <div 
    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14" 
    style={{
      backgroundColor: "rgb(217, 252, 103)", 
      clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
    }}
  />
  
  {/* Card content */}
  <div className="flex items-center justify-between mb-1">
    <div className="text-xs font-medium text-cb-ink-muted">
      Total recording time
    </div>
    <div className="text-[10px] text-cb-ink-muted">current</div>
  </div>
  <div className="flex items-center justify-between">
    <div className="font-display text-2xl font-extrabold text-cb-ink">
      62h 7m
    </div>
    <div className="text-lg font-semibold text-cb-ink-soft">
      62h 7m
    </div>
  </div>
</div>
```

**Marker Dimensions - DO NOT DEVIATE:**
- Width: **6px** (w-1.5 in Tailwind)
- Height: **56px** (h-14 in Tailwind)
- Angle: **10%/90%** (sharper than alternatives)
- Color: Vibe green (#D9FC67)
- These dimensions were selected after testing three variants
- Reference: Analytics page, "Impact Overview" section

**Typography in Cards:**
- Label: 12px (text-xs), medium weight, muted color
- Value: 24px (text-2xl), extrabold, primary color
- Secondary value: 18px (text-lg), semibold, soft color

**When to Use Metric Cards:**
- ✅ Dashboard KPI displays
- ✅ Analytics summary metrics
- ✅ Stats needing visual emphasis
- ✅ When data requires hierarchy vs flat tables

**When NOT to Use:**
- ❌ Regular content sections (use no container)
- ❌ Form fields (different styling system)
- ❌ Table rows (NEVER use cards)
- ❌ Navigation elements
- ❌ "Because it looks nice" - cards are functional, not decorative

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
border-left: 3px solid #D9FC67;
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

### 6. Onboarding Tips (as of v3.3.7)

Contextual, step-by-step guidance for new users (may include checklists):
```css
background: #FFFFFF (light) / #202020 (dark);
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
border-radius: 8px;
padding: 16px;
```

### 7. Task/Status Banners (as of v3.3.7)

Prominent temporary indicators for sync, import/export, error status:
```css
background: #FFFFFF (light) / #202020 (dark);
border: 1px solid #E5E5E5 (light) / #3A3A3A (dark);
border-radius: 8px;
padding: 12px 16px;
```

### 8. Temporary Informational Callouts (as of v3.3.7)

Limited-duration alerts for new feature rollout, action-required messages during onboarding, or temporary product updates.

**ALL cards/containers must:**
- Use white as the background (no colored fills)
- Have a minimal border (1px, neutral gray or soft shadow ONLY if floating)
- Follow the standard component corner radius (12px for cards, 8px for inputs)
- Contain NO decoration, large icons, or illustration overuse
- Remain visually understated and not compete with table/data hierarchy

**That's it. Everything else: no containers, just content on white with lines and space.**

---

## VIBE GREEN USAGE RULES

**CRITICAL:** Vibe green (#D9FC67) is permitted in specific, functional contexts only.

### ✅ Core Approved Usage (5 Primary Uses)

#### 1. Active Tab Underlines
```tsx
<div 
  className="border-b-[6px] border-vibe-green"
  style={{ clipPath: "polygon(0 0, 100% 15%, 100% 85%, 0 100%)" }}
>
  Active Tab
</div>
```
- 6px angular line beneath active tab
- Uses clip-path for trapezoid shape
- Indicates current section in navigation

#### 2. Left-Edge Indicators (Metric Cards)
```tsx
<div 
  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-14"
  style={{
    backgroundColor: "rgb(217, 252, 103)",
    clipPath: "polygon(0px 0px, 100% 10%, 100% 90%, 0px 100%)"
  }}
/>
```
- 6px width, 56px height angular marker
- Used on left edge of metric cards
- NEVER fill entire background

#### 3. Table Column Headers (Individual Columns Only)
```tsx
<th className="border-b-3 border-vibe-green">
  Sortable Column
</th>
```
- 3px underline beneath specific sortable columns
- NOT a horizontal line across entire header row
- Example: "Name" column has underline, others don't

#### 4. Focus States
```tsx
<input className="focus:border-l-3 focus:border-l-vibe-green" />
<button className="focus:outline focus:outline-2 focus:outline-vibe-green" />
```
- 3px left border on input fields when focused
- 2px outline on buttons when focused/active
- Never change entire border color

#### 5. Circular Progress Indicators
```tsx
<CircularProgress
  value={75}
  color="vibe-green"  // Filled portion only
/>
```
- Filled portion of circular charts
- Progress bars (used sparingly)

### ✅ Additional Approved Uses (as of v3.3.7)

#### 6. Progress Trackers
Linear or circular progress bars for onboarding, setup, or feature completion journeys:
```tsx
<div className="h-1 bg-cb-border rounded-full">
  <div className="h-1 bg-vibe-green rounded-full" style={{ width: '60%' }} />
</div>
```

#### 7. Wayfinding and Step Indication
Active step markers or micro-dividers in onboarding flows, navigation progress, or section transitions:
```tsx
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-vibe-green" /> {/* Active step */}
  <div className="w-2 h-2 rounded-full bg-cb-border" />   {/* Inactive */}
</div>
```
- Ensure WCAG AA contrast when used

#### 8. Section Dividers (Onboarding/Instructional Only)
Vertical or horizontal lines on white/neutral backgrounds:
```tsx
<div className="w-full h-0.5 bg-vibe-green" />  {/* Horizontal */}
<div className="h-full w-0.5 bg-vibe-green" />  {/* Vertical */}
```
- NOT as a fill or main background

#### 9. Contextual Info Banners
In onboarding checklists or system alerts, as a subtle accent ONLY:
```tsx
<div className="border-l-3 border-l-vibe-green pl-4 bg-card">
  {/* Banner content */}
</div>
```
- Never as the primary surface color

#### 10. Top Status Indicator Bar
Horizontal status bar at the top of the page for system-wide states (syncing, processing, etc.):
```tsx
<div className="w-full h-1 bg-vibe-green" />  {/* Top status bar */}
```
- Full-width bar at top of page or section
- Height: 1-2px maximum
- Used for temporary status states (loading, syncing, processing)
- Disappears when action completes

### ❌ Prohibited Usage (NEVER)

| Never Use | Why | Use Instead |
|-----------|-----|-------------|
| Text color | Fails WCAG contrast (1.4:1) | Black (#111111) |
| Full button backgrounds | Creates visual noise | Slate gradient (primary) or white (plain) |
| Card backgrounds | Breaks monochromatic aesthetic | White (#FFFFFF) |
| Icon colors | Inconsistent with system | Gray (#7A7A7A) |
| Large filled areas | Overwhelming | Small structural indicators |
| Borders (except 5 approved) | Visual clutter | Gray borders |
| Decorative elements | Vibe green is functional only | Use neutrals |

### Visual Examples

**Correct Usage:**
```
[Active Tab]  ← 6px vibe green angular underline
    ╱────╲
[Content]

│ Active Item  ← 6px vibe green left marker
```

**Incorrect Usage:**
```
┌─────────────────────┐
│ ENTIRE CARD GREEN   │  ← WRONG: Full background
└─────────────────────┘

[BUTTON]  ← WRONG: Green button background
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
- Background: bg-cb-hover
- Text: text-cb-ink

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
className="bg-cb-hover text-cb-ink rounded-2xl p-3 border border-cb-border-soft"
```
- Light Mode: #F8F8F8 background (bg-cb-hover)
- Dark Mode: #2A2A2A background
- Text: #111111 (text-cb-ink)
- Border: Optional 1px border-cb-border-soft for extra definition
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
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cb-success-bg text-cb-success-text border border-cb-success-border">
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
- Text: #111111 → #7A7A7A
- Borders: #E5E5E5 → #F2F2F2
- Primary button: Slate gradient (no change)
- Plain button: White bg → Dark bg

**Dark Mode:**
- Viewport: #161616
- Content: #202020
- Text: #FFFFFF → #6B6B6B
- Borders: #3A3A3A → #2A2A2A
- Primary button: Slate gradient (no change)
- Plain button: White bg → #202020 bg

### CSS Class Strategy

**Use Tailwind dark: prefix:**
```tsx
<div className="bg-white dark:bg-[#202020]">
  <p className="text-cb-ink dark:text-cb-text-dark-primary">
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
- Vibe green color (exact same hex in both modes)
- Border radius values
- Spacing/padding values
- Typography sizes and weights

### Components That DO Change

- Plain buttons (white → #202020 background)
- Card backgrounds (white → #202020)
- Text colors (dark → light)
- Border colors (light gray → dark gray)
- Hover states (adapt to maintain contrast)
- Input backgrounds (white → #202020)

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
- All `variant="default"` → `variant="hollow"`
- Size stays same (40px height minimum for touch targets)
- Labels may truncate or icon-only in tight spaces

**Layout:**
- Card gutters reduce from 8px to 4px
- Card padding reduces from 40px to 16px
- Tables may scroll horizontally
- Dock/navigation adapts to mobile-friendly layout

**Typography:**
- H1: 32px → 24px
- H2: 24px → 20px
- Body: 14px stays same
- Touch targets: Minimum 44px × 44px always

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
| #111111 on #FFFFFF | 16.1:1 | AAA ✅ |
| #444444 on #FFFFFF | 9.7:1 | AAA ✅ |
| #7A7A7A on #FFFFFF | 4.6:1 | AA ✅ |
| #D9FC67 on #FFFFFF | 1.4:1 | FAILS ❌ (Never use for text) |

### Focus States

**All interactive elements show focus:**
```css
/* Buttons, inputs, links */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-vibe-green
focus-visible:ring-offset-2

/* Or for inputs */
focus:border-l-3
focus:border-l-vibe-green
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
  aria-label="Search transcripts"
  placeholder="Search..."
/>
```

### Touch Targets

**Minimum size: 44px × 44px**

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
```
"Nice job, automation's humming!"
"Nothing here yet—let's create some magic"
"Sync's smoother than a fresh vibe"
"You're all caught up—time for coffee?"
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
- ❌ Emojis (never use in any context)
- ❌ Exclamation overuse (one per message max)
- ❌ Overly casual or unprofessional slang
- ❌ Humor in error states that could frustrate users

**When to Stay Neutral:**
- Data-critical operations
- Destructive action confirmations
- Security-related messages
- Financial/billing information

### Implementation

```tsx
// Empty state
<div className="text-center py-12">
  <p className="text-cb-ink-soft font-light">
    Nothing here yet—let's create some magic
  </p>
</div>

// Success toast
toast.success("Sync complete. Automation's humming along nicely.");

// Onboarding tip
<p className="text-sm text-cb-ink-soft">
  Pro tip: Keyboard shortcuts make everything faster
</p>
```

---

## PROHIBITED PATTERNS

| Never Use | Why | Use Instead |
|-----------|-----|-------------|
| Emojis | Unprofessional | Minimal stroke icons from Remix Icon |
| Vibe green text | Fails WCAG contrast | Black text + structural indicators |
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
| `rounded-t-sm` on tab underlines | Wrong aesthetic | clip-path polygon for angular shape |

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
  --cb-white: 0 0% 100%;              /* #FFFFFF */
  --cb-black: 0 0% 7%;                /* #111111 */
  --cb-ink: 210 17% 7%;               /* #111111 - Primary text */
  --cb-ink-soft: 0 0% 27%;            /* #444444 - Secondary text */
  --cb-ink-muted: 0 0% 48%;           /* #7A7A7A - Tertiary text */
  --cb-border: 0 0% 90%;              /* #E5E5E5 - Borders */
  --cb-border-soft: 0 0% 95%;         /* #F2F2F2 - Light dividers */
  --cb-hover: 0 0% 97%;               /* #F8F8F8 - Hover states */

  /* ============================================
     VIBE GREEN (Structural indicators only)
     ============================================ */
  --vibe-green: 72 96% 70%;           /* #D9FC67 */
  --vibe-green-light: 72 100% 77%;    /* #E5FD9E */
  --vibe-green-dark: 72 77% 60%;      /* #C9E855 */

  /* ============================================
     SEMANTIC STATUS COLORS
     ============================================ */
  --cb-success-bg: 142 71% 96%;       /* #F0F9F4 */
  --cb-success-text: 142 76% 29%;     /* #166534 */
  --cb-success-border: 142 76% 84%;   /* #BBF7D0 */

  --cb-warning-bg: 48 100% 96%;       /* #FFFBEB */
  --cb-warning-text: 30 78% 27%;      /* #78350F */
  --cb-warning-border: 48 96% 77%;    /* #FDE68A */

  --cb-danger-bg: 0 86% 97%;          /* #FEF2F2 */
  --cb-danger-text: 0 74% 42%;        /* #B91C1C */
  --cb-danger-border: 0 91% 71%;      /* #FCA5A5 */

  --cb-info-bg: 199 89% 95%;          /* #E0F2FE */
  --cb-info-text: 199 89% 35%;        /* #0C4A6E */
  --cb-info-border: 199 89% 67%;      /* #5AC8FA */

  --cb-neutral-bg: 0 0% 97%;          /* #F8F8F8 */
  --cb-neutral-text: 0 0% 40%;        /* #666666 */
  --cb-neutral-border: 0 0% 90%;      /* #E5E5E5 */
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
  --cb-viewport-dark: 0 0% 9%;        /* #161616 */
  --cb-card-dark: 0 0% 13%;           /* #202020 */
  --cb-panel-dark: 0 0% 16%;          /* #2A2A2A */
  --cb-border-dark: 0 0% 23%;         /* #3A3A3A */
  --cb-text-dark-primary: 0 0% 100%;  /* #FFFFFF */
  --cb-text-dark-secondary: 0 0% 69%; /* #B0B0B0 */
  --cb-text-dark-muted: 0 0% 42%;     /* #6B6B6B */

  /* Vibe green stays same in dark mode */
  --vibe-green: 72 96% 70%;           /* #D9FC67 */
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

  // CB color system
  cb: {
    white: "hsl(var(--cb-white))",
    black: "hsl(var(--cb-black))",
    ink: "hsl(var(--cb-ink))",
    "ink-soft": "hsl(var(--cb-ink-soft))",
    "ink-muted": "hsl(var(--cb-ink-muted))",
    border: "hsl(var(--cb-border))",
    "border-soft": "hsl(var(--cb-border-soft))",
    "border-dark": "hsl(var(--cb-border-dark))",
    hover: "hsl(var(--cb-hover))",
    "text-dark-primary": "hsl(var(--cb-text-dark-primary))",
  },

  "vibe-green": {
    DEFAULT: "hsl(var(--vibe-green))",
    light: "hsl(var(--vibe-green-light))",
    dark: "hsl(var(--vibe-green-dark))",
  },
}
```

---

## QUALITY CHECKLIST

Before shipping any feature:

### Color
- [ ] Vibe green ONLY in 5 approved contexts
- [ ] No vibe green text anywhere
- [ ] No vibe green button backgrounds
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
- [ ] Only 4 variants used (default, hollow, destructive, link)
- [ ] Primary actions use variant="default"
- [ ] Secondary actions use variant="hollow"
- [ ] Icon buttons have border and correct hover state
- [ ] Green ring on active/focus states
- [ ] Sizes appropriate for context
- [ ] Mobile uses plain buttons

### Tabs
- [ ] Active underline is 6px height
- [ ] Angular shape using clip-path polygon (NOT rounded-t-sm)
- [ ] Vibe green color
- [ ] Matches metric card marker aesthetic

### Tables
- [ ] White header background
- [ ] Header text: 12px uppercase, gray
- [ ] 3px vibe green underline ONLY on sortable columns (not all)
- [ ] Appropriate row heights (30px single, 52-56px double)
- [ ] 1px horizontal borders only (no vertical)
- [ ] Numbers right-aligned with tabular figures
- [ ] Hover state on entire row

### Metric Cards
- [ ] Vibe green marker: w-1.5 h-14 (6px × 56px)
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

### Accessibility
- [ ] WCAG AA contrast met (4.5:1 minimum)
- [ ] Focus states with vibe green ring
- [ ] Touch targets ≥44px
- [ ] Keyboard navigation works
- [ ] ARIA labels on icon buttons
- [ ] Semantic HTML used

### Dark Mode
- [ ] Toggle switches themes correctly
- [ ] No hardcoded colors (use semantic tokens)
- [ ] Primary button stays same (doesn't invert)
- [ ] Plain button adapts (#202020 bg)
- [ ] Text maintains 7:1+ contrast
- [ ] No broken layouts or invisible text

---

## VERSIONING GUIDELINES

This document follows semantic versioning to track changes:

**Version Format:** `vX.Y` or `vX.Y.Z`
- Initial versions use two digits: v3.3 (not v3.3.0)
- After first patch, use three digits: v3.3.1, v3.3.2, etc.

| Change Type | Version Bump | Example | Who Decides |
|-------------|--------------|---------|-------------|
| **Patch** | X.Y → X.Y.1 or X.Y.Z → X.Y.Z+1 | v3.3 → v3.3.1 → v3.3.2 | Claude (automatic) |
| **Minor** | X.Y → X.Y+1 | v3.3.2 → v3.4 | Claude (flag to user if >3 sections updated) |
| **Major** | X → X+1 | v3.4 → v4.0 | **User only** - Never done by Claude |

**Patch Version (Claude does automatically):**
- Small fixes, clarifications, typo corrections
- Updates to 1-2 sections
- Code example corrections

**Minor Version (Claude flags to user):**
- Updates across 3+ sections
- New component documentation
- Significant specification changes

**Major Version (User decision only):**
- Complete rewrites
- Breaking changes
- Major restructuring
- Claude should NEVER increment major version

**When to Update:**
- ✅ Update version at TOP and BOTTOM of this document
- ✅ Add entry to [brand-guidelines-changelog.md](./brand-guidelines-changelog.md) with date, time, git commit
- ✅ Update "Last Updated" date/time in header
- ✅ **MINOR versions:** Also rename the file (v3.3 → v3.4)
- ❌ Never edit without incrementing version
- ❌ Claude never increments major version (X.0)
- ❌ **PATCH versions:** Do NOT rename file

**Examples:**
- Fixing a typo → v3.3.3 → v3.3.4 (no file rename)
- Updating tab section only → v3.3.4 → v3.3.5 (no file rename)
- Updates across 4 sections → v3.3.5 → v3.4 (rename to brand-guidelines-v3.4.md)
- Complete design system overhaul → v3.4 → v4.0 (user decision only)

---

## VERSION HISTORY

📋 **Full changelog:** [brand-guidelines-changelog.md](./brand-guidelines-changelog.md)

---

## DOCUMENT VERSION

**Current Version:** v3.3.8

This version reference must match the title at the top of the document.

---

## DOCUMENT USAGE

**This document is:**
- ✅ The single source of truth for all design decisions
- ✅ Required reading for all developers
- ✅ Reference for AI-assisted coding
- ✅ QA checklist before shipping
- ✅ Onboarding material for new team members

**This document supersedes:**
- All previous brand guideline versions
- Any conflicting component documentation
- Verbal instructions given during development
- Legacy component implementations

**When in doubt:**
1. Check this document first
2. Ask the design team if clarification needed
3. Update this document with the answer
4. Commit the update to version control

---

**END OF BRAND GUIDELINES v3.3.8**

This document is complete and accurate as of November 21, 2025.
All implementations must follow these specifications exactly.  