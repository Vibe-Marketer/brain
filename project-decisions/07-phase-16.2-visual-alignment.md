# Phase 16.2: V2 Visual Alignment with V1

**Type:** Visual alignment + component infrastructure

**Goal:** Close every remaining visual gap between V2 and V1's approved light mode. V1 production (app.callvaultai.com) is the source of truth. Light mode only — dark mode is pending user approval and should not be codified as final.

---

## Why This Phase Exists

A CLAUDE.md audit revealed V2 has drifted from V1's approved visual look. 124 CSS tokens were extracted from V1's live DOM. 14 vibe orange structural contexts were documented. The key gaps: no Button or Tabs components exist, page titles are black instead of orange, collapsed nav icons are flat instead of glossy, and active text uses the wrong color.

---

## Plan 01 — Build UI Component Infrastructure (Button + Tabs)

### Button Component

- [ ] Create `callvault/src/components/ui/button.tsx` using `cva` (class-variance-authority) + `cn()` utility
- [ ] Define 6 variants:
  - `default` — slate gradient (primary action)
  - `hollow` — outlined, transparent background
  - `destructive` — red danger actions
  - `ghost` — no background, subtle hover
  - `link` — text-only, underline on hover
  - `outline` — bordered, visible boundary
- [ ] Define 4 sizes: `sm`, `default`, `lg`, `icon`
- [ ] Support `asChild` prop via `Slot.Root` from Radix — import as `import { Slot } from 'radix-ui'` (flat import, Slot exposed as `Slot.Root` namespace, NOT a direct named export)
- [ ] Focus-visible state: vibe orange ring (`focus-visible:ring-vibe-orange`)
- [ ] Active state: `active:translate-y-px` (subtle press feedback)

### Tabs Component

- [ ] Create `callvault/src/components/ui/tabs.tsx` using Radix Tabs from `'radix-ui'` (flat import)
- [ ] Active tab indicator: 6px vibe-orange pill underline via `data-[state=active]:after:*` Tailwind utilities
- [ ] Enforce `justify-start gap-6` alignment

---

## Plan 02 — Nav Active States Alignment

### SidebarNav — Expanded State

- [ ] Change active text color from `text-foreground` to `text-vibe-orange`
- [ ] Change active text weight from `font-medium` to `font-semibold`
- [ ] Apply full 4-layer active state system (tint + fill icon + orange text + pill)

### SidebarNav — Collapsed State

- [ ] Wrap each collapsed icon in a glossy 3D gradient container:
  - `bg-gradient-to-br from-white to-gray-200`
  - Triple-layer box shadow for depth
  - `border-gray-300/80`
- [ ] Active collapsed icon: add `ring-2 ring-vibe-orange/50` + 1.5px orange dot positioned below the icon

### Settings Sidebar

- [ ] Apply the full 4-layer active state to settings sidebar items
- [ ] Create a `cv-side-indicator-pill` utility class for reuse across settings, workspace, and org sidebars

### WorkspaceSidebarPane + OrgSidebar

- [ ] Apply pill + `text-vibe-orange` + `bg-vibe-orange/10` for all active items in both sidebars
- [ ] Ensure consistent active state treatment across all navigation surfaces

---

## Plan 03 — Page Title Colors + Typography + Empty States

### Set Montserrat as Heading Base

- [ ] In `globals.css`, set Montserrat as the primary heading font (was Inter)
- [ ] Set base heading font-weight to 700
- [ ] Components can add `font-extrabold` (800) via Tailwind for emphasis
- [ ] Remove dead V1 token `border-soft` from both `:root` and `.dark` in globals.css

### Apply Vibe Orange to All Page Titles

Change `text-foreground` to `text-vibe-orange` on h1 elements for all 9 authenticated routes:

- [ ] Home / All Calls
- [ ] Import Calls
- [ ] Workspaces
- [ ] Workspace Detail
- [ ] Shared With Me
- [ ] Settings (all category pages)
- [ ] Call Detail (call title)

Plus non-authenticated routes:

- [ ] Join Workspace error states ("Invite Expired", "Invite Revoked", "Invite Not Found")
- [ ] Folder rename input — `text-vibe-orange` for visual continuity with display state

**Exception — Login page:**
- [ ] Login h1 "CallVault" intentionally stays `text-foreground` — this is the brand logo wordmark (identity), not a page title (wayfinding)

### Add Warm Empty States

- [ ] All Calls — empty state when user has no recordings
- [ ] Call Not Found — when navigating to a deleted/invalid call
- [ ] Workspace List — empty state when no workspaces beyond personal
- [ ] Folder View — empty state when folder has no calls
- [ ] Settings categories — empty states for categories with no content

### Cleanup

- [ ] Remove sharing page debug marker `<p>/sharing</p>`

---

## Plan 04 — Visual Verification + Design System Skill Sync

### Authenticate Dev-Browser for Screenshots

- [ ] Use dev-browser to take authenticated screenshots of all V2 pages
- [ ] Auth method: inject the Supabase auth token from production localStorage into localhost (Google OAuth cannot be automated via dev-browser)
- [ ] The token key is `sb-vltmrnjsubfzrgrtdqey-auth-token`

### Screenshot Every Page and Verify

For each of these 11 pages, take a screenshot and verify:

| Page | Expected h1 Color | Expected Nav Active State |
|------|-------------------|--------------------------|
| Login | text-foreground (black) — intentional | N/A |
| Home / All Calls | text-vibe-orange | 4-layer: pill + fill icon + orange text + tinted bg |
| Import Calls | text-vibe-orange | 4-layer; "Sources" tab shows orange pill underline |
| Workspaces | text-vibe-orange | 4-layer + OrgSidebar active |
| Settings Account | text-vibe-orange | Settings sidebar 4-layer |
| Settings Organizations | text-vibe-orange | Settings sidebar 4-layer |
| Shared With Me | text-vibe-orange | N/A |
| Join Workspace (error) | text-vibe-orange | N/A |
| Call Detail | text-vibe-orange | N/A |
| Workspace Detail | text-vibe-orange | WorkspaceSidebar active |

### Sync Design System Skill

- [ ] Update `.claude/skills/callvault-design-system.md` with all new patterns:
  - Document button.tsx variants and usage
  - Document tabs.tsx configuration
  - Update SidebarNav active state code to match new implementation
  - Update settings/workspace/org sidebar patterns
  - Add page title h1 wayfinding pattern
  - Clarify vibe orange anti-pattern: body text forbidden, page h1s + nav labels approved
  - Remove any reference to dead `border-soft` token

### User Visual Approval

- [ ] Present screenshots to user for visual sign-off
- [ ] After approval, Phase 16.2 closes and Phase 19 can begin
