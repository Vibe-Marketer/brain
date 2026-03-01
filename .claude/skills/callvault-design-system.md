---
name: callvault-design-system
description: >
  CallVault v2 design system rules for UI implementation. Reference when building or modifying
  any UI component, page, or layout in the callvault repo. Enforces brand consistency and
  prevents common visual mistakes. Derived from the actual v2 codebase and Phase 16.1 audit findings.
applies_to:
  - /Users/Naegele/dev/callvault/src/**
  - /Users/Naegele/dev/brain/src/**
canonical_reference: /Users/Naegele/dev/brain/docs/design/brand-guidelines-v4.4.md
last_updated: 2026-03-01
phase_audit: 16.1
---

# CallVault v2 Design System — Agent Quick Reference

This is a condensed, machine-optimized reference. Full canonical spec: `docs/design/brand-guidelines-v4.4.md`.

---

## 1. Quick Reference — 10 Rules

1. All pages use `AppShell` — never build custom shell layouts
2. Icons come from `@remixicon/react` only — no Lucide, Heroicons, Font Awesome
3. Vibe orange (`#FF8800`) is a structural accent — see Section 3 for approved uses. Never for text.
4. Animation: import from `motion/react`, not `framer-motion`
5. Spring config is `{ type: 'spring', stiffness: 260, damping: 28 }` — do not change
6. Primary CTA buttons use `variant="default"` (slate gradient) — not `bg-brand-400`
7. Dialogs use Radix Dialog — never `window.prompt()`
8. Dropdowns use Radix DropdownMenu — never hand-rolled div+state+ref
9. Toasts via `sonner` — `import { toast } from 'sonner'`
10. All panes: `rounded-2xl`, gap `gap-3` (12px), container padding `p-1`

---

## 2. Color System

### Background Hierarchy

| Token | Light | Dark | When to use |
|-------|-------|------|-------------|
| `bg-viewport` | `#FCFCFC` | `#161616` | AppShell root, gaps between panes, OrgSwitcherBar |
| `bg-card` | `#FFFFFF` | `#202020` | All 4 panes, dialogs, dropdowns |
| `bg-muted` | ~`#F4F4F5` | ~`#27272A` | Hover states, secondary inactive areas, settings nav active |
| `bg-muted/60` | (60% muted) | (60% muted) | Empty state icon containers |

**Rule:** Shell background is `bg-viewport`. Pane backgrounds are `bg-card`. Never hardcode colors.

### Text Colors

| Token | Use |
|-------|-----|
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/inactive text, icons in default state |
| `text-vibe-orange` | Active nav icons, active indicators only |

### Border Colors

| Token | When to use |
|-------|-------------|
| `border-border/60` | All 4 panes in AppShell (60% opacity) |
| `border-border/40` | Subtle section dividers within panes |
| `border-border` | Standard borders inside pane content |

### Vibe Orange — Structural Accent (V1 Visual Audit, 2026-03-01)

Source of truth: V1 production (app.callvaultai.com) light mode.

**Navigation (every page):**
1. Page header text — section name in orange ("HOME", "AI CHAT", etc.)
2. Active sidebar item — orange background highlight
3. Active secondary pane item — orange highlight + orange chevron
4. Nav left-edge pill indicator (`bg-vibe-orange`)
5. Nav active icon color (`text-vibe-orange`)
6. CallVault logo — play button icon, always orange

**Interactive Elements:**
7. Input focus rings — orange border on focus (`--btn-focus-ring: var(--vibe-orange)`)
8. Active tab underlines (6px rounded pill, `border-vibe-orange`)
9. Active filter pills — highlighted state on data filter buttons
10. IMPORT button — orange gradient CTA (`--gradient-premium`)
11. Send button (AI Chat) — orange
12. Create action buttons (Create Folder, etc.) — orange background

**Content/Data:**
13. Links — share links, timestamped section references
14. Content Hub stat icons — hooks, posts, emails count icons

**Theme behavior:** Orange is theme-invariant — same `hsl(32 100% 50%)` in light and dark mode. No dark-mode-specific orange tokens exist.

**NEVER:** full area fills, vibe orange body text (fails WCAG contrast).

### Brand Scale

V1 production CSS tokens (extracted 2026-03-01):
```css
--vibe-orange:       32 100% 50%;   /* #FF8800 — core brand orange */
--vibe-orange-dark:  14 100% 50%;   /* gradient darker end */
--vibe-orange-light: 55 100% 50%;   /* gradient lighter end */
--sidebar-primary:   32 100% 50%;   /* = vibe-orange (active sidebar) */
--accent-orange:     28 100% 50%;   /* separate accent, slightly different hue */
```

v2 globals.css brand scale:
```css
--color-brand-300: hsl(36 100% 55%);
--color-brand-400: hsl(32 100% 50%);   /* = vibe orange */
--color-brand-500: hsl(28 100% 45%);
--color-brand-600: hsl(24 100% 40%);
```

**Note:** `bg-brand-400` equals vibe orange. Using it as a page-level button background is a brand violation. Allowed inside dialogs only (Create Workspace submit uses `bg-brand-500/bg-brand-600`).

---

## 3. Layout Architecture — AppShell v2

### 4-Pane System

```
┌─────────────────────────────────────────────┐
│  OrgSwitcherBar (bg-viewport, no border-b)  │
├──────┬────────────┬──────────────┬───────────┤
│  P1  │     P2     │      P3      │    P4     │
│ Nav  │ Secondary  │    Main      │  Detail   │
│ 72px │   280px    │   flex-1     │  360px    │
│ or   │   or 0     │              │  or 0     │
│220px │            │              │           │
└──────┴────────────┴──────────────┴───────────┘
```

### Locked Values (from AppShell.tsx)

```typescript
const SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const

// Pane widths
sidebarWidth = isSidebarExpanded ? 220 : 72   // Pane 1
secondaryWidth = isSecondaryOpen ? 280 : 0    // Pane 2
detailWidth = isTablet ? 320 : 360            // Pane 4
```

### Pane Container

```tsx
// Root shell
<div className="h-full flex flex-col overflow-hidden bg-viewport">
  <OrgSwitcherBar />
  <div className="flex-1 flex gap-3 overflow-hidden p-1 min-h-0">
    {/* Panes here */}
  </div>
</div>

// Each pane
className="bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col h-full overflow-hidden"
```

### DetailPaneOutlet — Width-Only Animation

```tsx
// CORRECT — width-only, no x offset (same-plane push)
initial={{ width: 0, opacity: 0 }}
animate={{ width, opacity: 1 }}
exit={{ width: 0, opacity: 0 }}
transition={SPRING}
```

**Never add `x: 20` to initial/exit — creates drawer-slide feel.**

### OrgSwitcherBar

```tsx
// CORRECT: bg-viewport, no border-b, no backdrop-blur
className="bg-viewport ..."
// WRONG:
className="bg-card/80 backdrop-blur-sm border-b border-border ..."
```

### Close Button Pattern (Detail Pane)

```tsx
// CORRECT: close button in flex-flow header row
<div className="flex items-center justify-end px-3 pt-2 pb-0 flex-shrink-0">
  <button onClick={closePanel} aria-label="Close detail panel">
    <RiCloseLine size={14} />
  </button>
</div>
// WRONG: absolute positioning inside overflow-hidden — clips the button
```

---

## 4. Navigation Active States — 4-Layer System

From `SidebarNav.tsx` (v2 actual implementation):

```tsx
// NavItem interface
interface NavItem {
  id: string
  name: string
  icon: RemixiconComponentType      // -Line variant (inactive)
  iconActive: RemixiconComponentType // -Fill variant (active)
  to: string
}

// Active state rendering
<Link
  className={cn(
    'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
    isActive
      ? 'bg-vibe-orange/10 font-medium text-foreground'
      : 'text-muted-foreground hover:bg-muted/70',
  )}
>
  {/* Layer 4: Left-edge pill indicator */}
  {isActive && (
    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[65%] rounded-r-full bg-vibe-orange" />
  )}

  {/* Layer 2+3: Fill icon + vibe-orange color */}
  <Icon
    size={16}
    className={isActive ? 'text-vibe-orange' : 'text-muted-foreground'}
  />
  <span>{item.name}</span>
</Link>
```

### 4 Layers Summary

| Layer | Element | Active | Inactive |
|-------|---------|--------|----------|
| 1 (lowest) | Background | `bg-vibe-orange/10` | transparent |
| 2 | Icon variant | `-Fill` (`RiPhoneFill`) | `-Line` (`RiPhoneLine`) |
| 3 | Icon + text color | `text-vibe-orange` | `text-muted-foreground` |
| 4 (highest) | Left pill | `w-1 h-[65%] rounded-r-full bg-vibe-orange` | hidden |

### v2 Nav Items

| Route | Line Icon | Fill Icon |
|-------|-----------|-----------|
| `/` (All Calls) | `RiPhoneLine` | `RiPhoneFill` |
| `/workspaces` | `RiGroup2Line` | `RiGroup2Fill` |
| `/import` | `RiDownloadLine` | `RiDownloadFill` |
| `/settings` | `RiSettings3Line` | `RiSettings3Fill` |

### Settings Sidebar (Different Pattern)

Settings page uses `bg-muted` (not `bg-vibe-orange/10`) for active state — visually distinguishes settings-within-page nav from primary SidebarNav.

---

## 5. Typography

### Typefaces

- **Display/Headers:** `font-montserrat` (Montserrat ExtraBold 800)
- **Body/UI:** `font-inter` (Inter — default in v2)

### Heading Rules

```tsx
// Pane heading: font-montserrat font-extrabold uppercase tracking-wide
<h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
  WORKSPACE CONTENT
</h2>

// Section label (tiny): text-[10px] uppercase tracking-wide
<p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
  FOLDERS
</p>
```

### Size Hierarchy

| Context | Class | Size |
|---------|-------|------|
| Page/pane titles | `text-sm font-semibold uppercase` or montserrat | 14px |
| Body default | `text-sm` | 14px |
| Secondary/metadata | `text-xs` | 12px |
| Tiny labels | `text-[11px]` | 11px |
| Ultra-small | `text-[10px]` | 10px |
| Numbers | `tabular-nums` | inherit |

---

## 6. Button System

### Correct Variant Mapping

| Context | Variant | Notes |
|---------|---------|-------|
| Primary page CTA | `variant="default"` | Slate gradient, same in dark mode |
| Secondary action | `variant="hollow"` | Bordered, adapts to dark mode |
| Icon-only minimal | `variant="ghost"` | Transparent hover |
| Dialog form submit | `bg-foreground text-background` or `bg-brand-500` | Only inside dialog |
| Destructive | `variant="destructive"` | Red gradient |

### CTA Pattern (from workspaces/index.tsx)

```tsx
// Linear-style CTA — works in light/dark mode
<Button className="bg-foreground text-background hover:bg-foreground/90">
  Create Workspace
</Button>
// Not: <Button className="bg-brand-400"> — brand violation outside dialog
```

### Dialog Action Button

```tsx
// Inside Radix Dialog only — allowed exception
<Button
  type="submit"
  disabled={isPending || !name.trim()}
  className="bg-brand-500 hover:bg-brand-600 text-white"
>
  Create
</Button>
```

---

## 7. Icon Rules

### Core Rules

- **Import from:** `@remixicon/react` only
- **Default state:** `-Line` suffix, `size={16}`, `text-muted-foreground`
- **Active/selected state:** `-Fill` suffix, `text-vibe-orange`
- **Decorative icons:** `aria-hidden="true"`
- **Icon buttons:** must have `aria-label`

### Common v2 Icons

| Use | Line | Fill |
|-----|------|------|
| Calls | `RiPhoneLine` | `RiPhoneFill` |
| Workspaces | `RiGroup2Line` | `RiGroup2Fill` |
| Import | `RiDownloadLine` | `RiDownloadFill` |
| Settings | `RiSettings3Line` | `RiSettings3Fill` |
| Close | `RiCloseLine` | — |
| Folder | `RiFolderLine` | `RiFolderFill` |
| Add | `RiAddLine` | — |
| Edit | `RiPencilLine` | — |
| Delete | `RiDeleteBinLine` | — |
| More | `RiMore2Line` | — |
| Question | `RiQuestionLine` | — |
| Layout | `RiLayoutColumnLine` | — |
| Download | `RiDownload2Line` | — |

---

## 8. Component Patterns

### Dialogs — Always Radix

```tsx
// Reference: CreateWorkspaceDialog.tsx, CreateOrganizationDialog.tsx
import { Dialog } from 'radix-ui'

<Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-xl border border-border shadow-lg p-6 w-full max-w-md z-50">
      <Dialog.Title className="text-sm font-semibold text-foreground mb-1">
        Create Workspace
      </Dialog.Title>
      <Dialog.Description className="text-xs text-muted-foreground mb-4">
        Give your workspace a name
      </Dialog.Description>
      <input autoFocus ... />
      <div className="flex justify-end gap-2 mt-4">
        <Dialog.Close asChild>
          <Button variant="hollow">Cancel</Button>
        </Dialog.Close>
        <Button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white">
          Create
        </Button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### Dropdowns — Always Radix DropdownMenu

```tsx
// Reference: OrgSwitcherBar.tsx, CallActionMenu (index.tsx)
import { DropdownMenu } from 'radix-ui'

<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button>...</button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content className="bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer outline-none">
        Item
      </DropdownMenu.Item>
      {/* Nested submenu */}
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger className="...">
          Move to folder <RiArrowRightSLine />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent className="...">
            {/* Folder items */}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

### Collapsible — Radix Collapsible

```tsx
// Reference: WorkspaceSidebarPane.tsx
import { Collapsible } from 'radix-ui'

<Collapsible.Root open={open} onOpenChange={setOpen}>
  <Collapsible.Trigger>Toggle</Collapsible.Trigger>
  <Collapsible.Content>...</Collapsible.Content>
</Collapsible.Root>
```

### Toasts — Sonner

```tsx
import { toast } from 'sonner'

toast.error('Failed to create workspace')
toast.success('Workspace created')
```

### Empty States — Standard Pattern

```tsx
// Reference: settings/$category.tsx
<div className="flex flex-col items-center justify-center h-full gap-3 text-center">
  <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
    <RiSettings3Line size={24} className="text-muted-foreground" />
  </div>
  <div>
    <p className="text-sm font-medium text-foreground">No integrations yet</p>
    <p className="text-xs text-muted-foreground mt-1">Connect your first integration to get started</p>
  </div>
</div>
```

---

## 9. Animation Rules

### Import

```tsx
// CORRECT
import { motion, AnimatePresence } from 'motion/react'

// WRONG
import { motion } from 'framer-motion'  // Never use
```

### Spring Config (Locked)

```tsx
const SPRING = { type: 'spring', stiffness: 260, damping: 28 } as const
// Do NOT change these values
```

### Panel Enter/Exit

```tsx
<AnimatePresence initial={false}>
  {isVisible && (
    <motion.div
      key="panel"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: targetWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={SPRING}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

**Width-only animation** — no `x` offset in initial/exit.

---

## 10. Tab Navigation

### Import Page Pattern (from import/index.tsx)

```tsx
// Custom button-based tabs (not Radix Tabs) — used on Import page
<button
  onClick={() => setActiveTab('sources')}
  className={cn(
    'px-1 pb-2 text-sm font-medium transition-colors',
    activeTab === 'sources'
      ? 'border-b-2 border-vibe-orange text-foreground'  // Active
      : 'text-muted-foreground hover:text-foreground'     // Inactive
  )}
>
  Sources
</button>
```

### Active Tab State

| State | Classes |
|-------|---------|
| Active | `border-b-2 border-vibe-orange text-foreground` |
| Inactive | `text-muted-foreground hover:text-foreground` |

---

## 11. Anti-Patterns — Never Do These

| Anti-Pattern | Why Wrong | Correct Alternative |
|--------------|-----------|---------------------|
| `window.prompt()` for user input | Blocks UI thread, hideous UX | Radix Dialog with controlled input |
| `bg-brand-400` on page buttons | Brand violation (vibe orange buttons) | `variant="default"` or `bg-foreground text-background` |
| Hand-rolled dropdown menus | No keyboard nav, no outside-click, no a11y | Radix DropdownMenu |
| `import { motion } from 'framer-motion'` | Wrong package | `import { motion } from 'motion/react'` |
| Vibe orange for text | Fails WCAG 2.9:1 contrast | `text-foreground` or `text-muted-foreground` |
| `x: 20` in panel animation | Creates drawer-slide feel | Width-only animation |
| `absolute` close button inside `overflow-hidden` | Gets clipped | Flex-flow header row with `justify-end` |
| `bg-card/80 backdrop-blur-*` on OrgSwitcherBar | Makes it look like a pane | `bg-viewport` (shell chrome) |
| `border-border` on Pane 3 (not `/60`) | Inconsistent with other panes | `border-border/60` |
| CSS transitions on panes (e.g., `duration-500`) | Wrong animation system | Motion spring |

---

## 12. Dark Mode — PENDING USER APPROVAL

> Light mode is the approved visual standard (V1 visual audit, 2026-03-01).
> Dark mode has NOT been reviewed/approved by the user. Do NOT codify dark mode as final.
> When dark mode is ready for review, do a visual audit with the user before locking rules.

### Known Facts (from V1 + v2 code)

| Token | Light | Dark |
|-------|-------|------|
| `bg-viewport` | `#FCFCFC` | `#161616` |
| `bg-card` | `#FFFFFF` | `#202020` |
| `text-foreground` | `#111111` | `#FFFFFF` |
| `text-muted-foreground` | `#7A7A7A` | `#6B6B6B` |
| `border-border` | `#E5E5E5` | `#3A3A3A` |
| `bg-vibe-orange` | `#FF8800` | `#FF8800` (unchanged) |

### Technical Notes

- Primary (`variant="default"`) and destructive buttons: NO CHANGE in dark mode
- Vibe orange: exact same hex in both modes — theme-invariant
- Use semantic tokens (`bg-card`, `text-foreground`) — never hardcode colors for themed surfaces
- `@custom-variant dark (&:is(.dark *))` — Tailwind v4 syntax in globals.css

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/components/layout/AppShell.tsx` | Pane system, spring config, widths |
| `src/components/layout/SidebarNav.tsx` | 4-layer active state, nav items |
| `src/components/layout/DetailPaneOutlet.tsx` | Width-only animation, close button |
| `src/components/layout/OrgSwitcherBar.tsx` | Shell chrome pattern |
| `src/components/layout/CreateWorkspaceDialog.tsx` | Radix Dialog pattern |
| `src/routes/_authenticated/index.tsx` | Radix DropdownMenu + Sub pattern |
| `src/routes/_authenticated/settings/$category.tsx` | Empty state pattern |
| `src/globals.css` | Full CSS variable definitions |
| `docs/design/brand-guidelines-v4.4.md` | Canonical full spec (2900+ lines) |
