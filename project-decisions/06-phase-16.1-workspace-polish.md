# Phase 16.1: Workspace Polish & Brand Guidelines

**Type:** Visual polish + brand guidelines codification

**Goal:** Polish all Phase 16 surfaces to Linear-quality standard, fix the Pane 4 "drawer feel" animation bug, replace window.prompt() stubs with proper dialogs, build the brand guidelines skill for Claude agents, and bump brand guidelines to v4.3.

---

## Plan 01 — AppShell Animation Fix + Visual Cohesion

### Fix the Drawer-Feel Bug (Priority #1)

- [ ] The `DetailPaneOutlet` uses `initial={{ width: 0, opacity: 0, x: 20 }}` — the `x: 20` makes Pane 4 feel like a drawer sliding in from the right instead of a same-plane push
- [ ] Remove `x: 20` from both `initial` and `exit` properties — this is the complete fix
- [ ] Move the close button into a flex-flow header inside the pane
- [ ] Replace the HTML entity close icon with `RiCloseLine` from Remix Icons

### Surface Cohesion

- [ ] Change AppShell root container background to `bg-viewport`
- [ ] Change Pane 3 border from `border-border` to `border-border/60` (softer divider)
- [ ] Change OrgSwitcherBar to `bg-viewport` and remove `border-b` — it should blend as shell chrome, not look like a separate bar

---

## Plan 02 — SidebarNav Polish + CreateWorkspaceDialog

### Build the 4-Layer Nav Active State

- [ ] Layer 1: `bg-vibe-orange/10` background tint on active item
- [ ] Layer 2: Fill icon variant in `text-vibe-orange`
- [ ] Layer 3: `font-semibold` text weight
- [ ] Layer 4: Absolute left pill — `absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[65%] rounded-r-full bg-vibe-orange`

### Replace window.prompt() with CreateWorkspaceDialog

- [ ] Build `CreateWorkspaceDialog.tsx` using Radix Dialog (Dialog.Root/Portal/Overlay/Content/Title/Description/Close)
- [ ] autoFocus on the name input
- [ ] Enter key submits the form
- [ ] Submit button disabled when input is empty or mutation is pending
- [ ] Show sonner error toast on failure
- [ ] Wire this into WorkspaceSidebarPane to replace the `window.prompt()` stub

### Fix workspaces/index.tsx Button

- [ ] Change `bg-brand-400` to `bg-foreground text-background` — this adapts correctly in both light and dark mode instead of using a hardcoded brand color

---

## Plan 03 — Visual Audit + Remaining Polish

### Fix Import Tab Active State

- [ ] Change active tab indicator from `border-foreground` (black) to `border-vibe-orange` — consistent with the vibe orange accent system

### Rewrite CallActionMenu

- [ ] The current implementation is a hand-rolled div with useState + useRef — fragile and doesn't match project patterns
- [ ] Rewrite using Radix `DropdownMenu.Root/Trigger/Content`
- [ ] Add `DropdownMenu.Sub/SubTrigger/SubContent` for the folder picker submenu
- [ ] This gives proper keyboard navigation, focus management, and accessibility for free

### Settings Polish

- [ ] Add `SettingsEmptyState` component for settings categories with no content yet
- [ ] Add sidebar icons to each settings navigation item

---

## Plan 04 — Brand Guidelines Skill + v4.3 Update

### Build the Design System Skill

- [ ] Create `.claude/skills/callvault-design-system.md` (~550 lines, 12 sections):
  1. Quick Reference — one-glance summary of key values
  2. Color System — all tokens, vibe orange usage rules
  3. Layout Architecture — AppShell pane dimensions, behavior
  4. Nav Active States — the 4-layer system with exact classes
  5. Typography — Montserrat headings, Inter body, weight scale
  6. Button System — variants, sizes, interaction states
  7. Icon Rules — Remix Icons only, fill vs line icon states
  8. Component Patterns — dialogs, dropdowns, cards, badges
  9. Animation Rules — spring constants, motion/react patterns
  10. Tab Navigation — pill underline, Radix Tabs configuration
  11. Anti-Patterns — things to never do (vibe orange on body text, CSS transitions instead of springs, etc.)
  12. Dark Mode — current state and rules (light mode approved, dark mode pending)
- [ ] Purpose: Claude agents load this skill on demand instead of bloating CLAUDE.md

### Update Brand Guidelines to v4.3

- [ ] Create `docs/design/brand-guidelines-v4.3.md` with 5 updated sections:
  - v2 AppShell pane architecture documentation
  - Spring animation system (replacing CSS transition references)
  - Nav pill height standardized at h-[65%]
  - Custom button-tab pattern
  - Dialog button exception rules
- [ ] Archive v4.2: move to `docs/archive/brand-guidelines-v4.2.md`
- [ ] Add v4.3 entry to `docs/design/brand-guidelines-changelog.md`
- [ ] Update `canonical_reference` in the design system skill to point to v4.3 (not v4.2)
