---
phase: 33
phase_name: Selection State System
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 33: Selection State System — Context

<domain>
## Phase Boundary

Apply one canonical selection-state pattern consistently across 5 surfaces:

1. **VIS-01** — Sidebar nav items
2. **VIS-02** — 2nd-pane workspace selector
3. **VIS-03** — Settings tab list (Account / Billing / Organizations / AI Integrations / Admin)
4. **VIS-04** — Call Detail modal tabs (Overview / Transcript / Invitees / Participants)
5. **VIS-05** — Settings > Organizations: REPLACE the horizontal tab strip ("AI SIMPLE | BUSINESS | GOVIBEY") with a vertical list of canonical-selection-pattern cards in the 2nd pane

**Canonical pattern (locked in REQUIREMENTS.md):**
- Vertical orange pill on the left edge
- Gray rounded highlight as background
- BOLD title (not bold-italic — that's a separate BRAND-03 issue)
- Icon in rounded square with orange ring around the icon
- White bg on the icon square in light mode, black bg in dark mode

Out of scope: sidebar order (BRAND-01 — Phase 34), uppercase title rules (BRAND-02 — Phase 34), bold-italic removal (BRAND-03 — Phase 34), any non-selection-state visual polish (Phase 34).
</domain>

<decisions>
## Implementation Decisions

### One Shared Component, Used Everywhere

Build a single `<SelectionButton>` (or `<CanonicalSelection>` — plan-phase picks the name) primitive. Every consuming surface imports and uses it. Per-surface inline classes are forbidden — the pattern is the component.

Location: `src/components/ui/selection-button.tsx` (shadcn-style primitive). Variants exposed via component props, not via Tailwind class drift.

**Required component props:**
- `selected: boolean` — toggles orange pill, gray bg, bold, ring
- `icon: ReactElement` — wraps in the rounded-square icon container with orange ring
- `label: string`
- `onClick: () => void`
- `description?: string` — optional secondary line (used by org cards)
- `size?: 'sm' | 'md'` — sidebar item vs full org card density
- `as?: 'button' | 'a' | 'div'` — render-as polymorphism for nav anchors vs modal tabs

### VIS-05 — Org Selector Replaces Tab Strip with Canonical Cards

User's call: replace the horizontal `AI SIMPLE | BUSINESS | GOVIBEY` tab strip with a **vertical list of canonical-selection cards** in the 2nd pane (Settings > Organizations).

Rendering:
- Each card uses `<SelectionButton>` with the org's icon, name, and a small description (member count + role).
- The "selected" org card shows the orange pill + gray bg + bold name + orange-ring icon.
- Click-target is the whole card (not a chevron).
- Clicking selects the org and renders its detail content in the main pane (or in Pane 4 — match the existing layout convention).

This is intentionally inconsistent with the top-bar org switcher (which is a dropdown popover). Andrew's call: the 2nd pane is where users dwell for org config, so the canonical pattern goes there. The top-bar switcher stays as-is.

### Dark Mode — Both Light & Dark Tokens Applied

Per Andrew's call: codify both modes using the current dark tokens. The light/dark variants of the canonical pattern are:

| Token usage | Light | Dark |
|---|---|---|
| Selected pill | `bg-vibe-orange` | `bg-vibe-orange` (constant) |
| Selected card bg | `bg-muted` (gray rounded) | `bg-muted` (current dark token) |
| Icon container bg | `bg-background` (white) | `bg-foreground/0` (black) — or whatever current dark token gives a black square |
| Icon ring | `ring-vibe-orange` | `ring-vibe-orange` (constant) |
| Title weight | `font-bold` | `font-bold` |

**Trade-off note:** Andrew's memory says dark mode is NOT yet visually approved as final. Codifying dark mode here is fine because the canonical selection pattern uses semantic tokens (`bg-muted`, `bg-card`, etc.) — if the dark-mode approval changes the token values later, the selection pattern automatically adapts. The pattern is locked at the structural level, not the hex level.

### Test Strategy — Visual Regression + Dev-Browser

- **Visual regression**: capture before/after screenshots of each of the 5 surfaces in light AND dark mode using dev-browser. Commit to `.planning/phases/33-selection-state-system/screenshots/`.
- **Live verification**: dev-browser on `app.callvaultai.com` after deploy — click through each surface, confirm canonical pattern renders, confirm selection state changes on click.
- **Snapshot tests**: existing Vitest snapshot tests should be updated, not deleted (to detect future drift).
- No new integration tests needed — this is paint-by-numbers visual work, not behavior.

### Migration Strategy — Surface by Surface

Order of implementation:
1. Build `<SelectionButton>` primitive first (no existing surface depends on it yet).
2. VIS-01 sidebar — highest-visibility surface, hits every page. Ship + verify.
3. VIS-02 workspace selector in 2nd pane — same component, simple wrap.
4. VIS-04 Call Detail modal tabs — replaces orange-underline-pill with canonical.
5. VIS-03 Settings tab list — same fix.
6. VIS-05 Settings > Organizations — biggest UI change (removes tab strip, adds card list). Final.

Each VIS-N gets its own atomic commit. Plan-phase may split into multiple plans if needed.

### Coordination with Phase 34

Phase 34 polishes adjacent visual concerns (sidebar order, caps, bold-only, doubled X, padding). Phase 33 ships **before** Phase 34. Phase 34 builds on top — it does not touch the canonical-selection pattern this phase introduces.
</decisions>

<code_context>
## Existing Code Insights

**Current selection-state implementations to replace:**
- `src/components/layout/SidebarNav.tsx` (or similar) — sidebar nav items, likely uses inline classes for active state.
- `src/components/panes/SecondaryPane*.tsx` — workspace selector cards in 2nd pane.
- `src/pages/Settings.tsx` + tab list — currently uses orange-underline-pill.
- `src/components/panels/CallDetailPanel.tsx` — Call Detail modal tabs.
- `src/pages/OrganizationPage.tsx` — the tab strip to replace with card list.

**Reusable foundations:**
- `src/components/ui/button.tsx` — variants pattern (`default`, `hollow`, `ghost`) — model for `<SelectionButton>` variants.
- shadcn `class-variance-authority` (cva) — variant composition.
- `@remixicon/react` — icons (rounded-square wrapper goes around the icon, not the icon itself).

**Design tokens (per src/CLAUDE.md):**
- `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-vibe-orange` / `bg-vibe-orange` — all semantic, no hardcoded hex.

**Reference for canonical pattern visual spec:**
- `docs/design/brand-guidelines-v4.4.md` — selection-state subsection
- Phase 29 sweep screenshots — actual current state of each surface, useful for before/after comparison
</code_context>

<specifics>
## Specific Requirements (from REQUIREMENTS.md)

- **VIS-01** — Sidebar canonical selection state
- **VIS-02** — 2nd pane workspace selector canonical pattern
- **VIS-03** — Settings tab list canonical pattern (replace orange-underline-pill)
- **VIS-04** — Call Detail modal tabs canonical pattern (replace orange-underline-pill)
- **VIS-05** — Org-tab strip replaced with 2nd-pane card list (canonical pattern)
- **QA-04** — (per requirements mapping) likely related to a selection-state observation; verify in plan-phase

## Success Criteria (from ROADMAP.md)

1. Sidebar nav uses canonical pattern.
2. 2nd-pane workspace selector uses canonical pattern.
3. Settings tabs use canonical pattern.
4. Call Detail modal tabs use canonical pattern.
5. Settings > Organizations replaced with canonical-card list.

## Verification Strategy

- Dev-browser screenshots of each surface, light + dark mode, before/after.
- Visual regression check: snapshot tests pass / updated correctly.
- Live verification on `app.callvaultai.com`: every surface renders the canonical pattern.
- No console errors, no accessibility regressions (button vs a/role, focus-visible ring).
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 33 section
- `.planning/REQUIREMENTS.md` — VIS-01..05, QA-04
- `docs/design/brand-guidelines-v4.4.md` — canonical pattern spec
- `.planning/phases/29-qa-sweep-regression-catalog/` — Phase 29 screenshots of current state
- `src/CLAUDE.md` — design tokens, button variants
- `src/components/ui/button.tsx` — variants pattern (model for SelectionButton)
- `src/components/layout/SidebarNav.tsx` — current sidebar
- `src/pages/Settings.tsx` — current tab list
- `src/pages/OrganizationPage.tsx` — current org tab strip
- callvault-design-system skill (loads on demand) — full design system context
</canonical_refs>

<deferred>
## Deferred Ideas

- **Animation on selection change** — subtle slide-in of the orange pill / fade of gray bg. Currently no animation. Could use `motion/react` springs. Polish item, not blocking.
- **Selection-state for table rows** — table rows in the 3rd pane (call list) have their own selection treatment. Out of scope for this phase; revisit if drift becomes visible.
- **Dark-mode visual approval** — when Andrew approves dark mode formally, audit the canonical pattern in dark mode and codify any token adjustments needed. Tracked as a separate pass.
- **`<SelectionButton>` storybook entry** — would help future contributors. Not required for v2.2 ship.
</deferred>
