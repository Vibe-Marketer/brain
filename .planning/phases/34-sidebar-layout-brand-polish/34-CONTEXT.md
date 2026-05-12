---
phase: 34
phase_name: Sidebar, Layout & Brand Polish
gathered: 2026-05-11
status: Ready for planning
mode: Auto-generated from REQUIREMENTS.md (all items fully specified, no gray areas)
---

# Phase 34: Sidebar, Layout & Brand Polish — Context

<domain>
## Phase Boundary

Apply 13 individually-specified visual fixes to the app shell, all building on the canonical selection pattern locked in Phase 33. Includes critical CLAUDE.md HARD-CONSTRAINT violation (emoji icons in sidebar) and inconsistent top-bar title behavior.

Out of scope: selection-state-pattern application (Phase 33), table/filter/DND cleanup (Phase 35), bug fixes (Phase 36).
</domain>

<decisions>
## Implementation Decisions

All items are fully specified in REQUIREMENTS.md and Phase 29 sweep findings. No grey areas surfaced.

### Sidebar — Order, Caps, Icons

- **BRAND-01** — Sidebar order: **CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION**
- **BRAND-02** — All sidebar/2nd-pane primary titles UPPERCASE: CALLS, PEOPLE, ORGANIZATION, IMPORT, RULES, NAVIGATION, MY CALLS, etc.
- **QA-06** — Sidebar currently uses EMOJI icons (📞 👥 🏢 📥 🔀 ❓ ℹ️ ⚙️). HARD-CONSTRAINT violation per `CLAUDE.md`: "Remix Icons ONLY — no Lucide, FontAwesome, or others". **CRITICAL FIX.** Map each item to its Remix Icon equivalent:
  - 📞 Calls → `RiPhoneLine`
  - 👥 People → `RiUserLine` or `RiTeamLine`
  - 🏢 Organization → `RiBuilding3Line`
  - 📥 Import → `RiDownloadLine` or `RiInboxLine`
  - 🔀 Rules → `RiArrowLeftRightLine` or `RiShuffleLine`
  - ❓ Take the tour → `RiQuestionLine`
  - ℹ️ How it works → `RiInformationLine`
  - ⚙️ Settings → `RiSettings3Line`
  Plan-phase confirms exact icon choices against `@remixicon/react` v4+ availability.

### Workspace / Organization Visuals

- **BRAND-03** — Workspace title in 2nd pane is BOLD ONLY (currently bold+italic). Remove `italic` class.
- **BRAND-04** — Organization box at top of 2nd pane fills full width with equal padding (left / right / bottom). Currently flex-sized.
- **BRAND-05** — Top-bar org selector width matches the 2nd-pane org box width.
- **BRAND-06** — "ALL" link in Home 2nd pane darkened for legibility. Change from current light gray to `text-foreground` (or at minimum `text-muted-foreground` instead of `/60` variant).

### Top-Bar Title Behavior

- **QA-09** — Top-bar central title shows "HOME" on every page where it should show the actual route. Fix the title binding so each route updates the top-bar title (RULES, ORGANIZATION, IMPORT, etc.).
- **QA-10** — `/organization` page shows "ORG" in 2nd pane but main pane has "OVERVIEW" header. Standardize on **"ORGANIZATION"** (full word everywhere — per BRAND-02 UPPERCASE rule the abbreviated "ORG" was likely an old shorthand). Plan-phase audits for any other abbreviated route titles.

### Cleanup Items

- **BRAND-07** — Doubled X close button (per Phase 29 Image #7) — remove the redundant close. Plan-phase locates which dialog/sheet has the duplicate.
- **BRAND-08** — Global search modal: rounded corners on search input, brand-consistent styling matches Cmd+K dialog elsewhere. Use shadcn `Input` primitive with `rounded-md` and consistent border tokens.
- **BRAND-09** — "MEMBERSHIPS" / "WORKSPACE MEMBERS | TESTING" headings in Workspace Detail panel don't have stray box-creating borders. Audit for orphan `border` / `bg-card` wrappers on section headings.
- **BRAND-10** — Settings > Organizations page header shows selected org's name + description (e.g. "AI Simple — Your personal organization for private recordings") instead of generic "Workspaces / Manage your organizational structure and collaboration workspaces". Wire the header to the active org from store.

### Test Strategy

- **Dev-browser screenshots** of each fix (before/after) committed to `.planning/phases/34-sidebar-layout-brand-polish/screenshots/`.
- **Live verification** on `app.callvaultai.com` after deploy — every route's top-bar title correct, sidebar uses Remix Icons, no emoji.
- **Snapshot tests** for sidebar nav component updated.
- No new behavioral tests — pure visual / wiring changes.

### Migration Order

1. **Critical first**: QA-06 emoji → Remix Icons (HARD-CONSTRAINT)
2. BRAND-01 sidebar order
3. BRAND-02 UPPERCASE titles
4. QA-09 + QA-10 top-bar title routing
5. BRAND-03..06 workspace visuals
6. BRAND-07..10 cleanup items

Atomic commits per BRAND-NN. Plan-phase may bundle small items.
</decisions>

<code_context>
## Existing Code Insights

**Likely target files:**
- `src/components/layout/SidebarNav.tsx` — sidebar nav items (emoji removal + Remix Icons + order)
- `src/components/layout/TopBar.tsx` (or similar) — top-bar title binding (QA-09, QA-10)
- `src/components/panes/SecondaryPane*.tsx` — workspace title + org box layout
- `src/components/dialogs/GlobalSearchModal.tsx` — search modal styling (BRAND-08)
- `src/components/panels/WorkspaceDetailPanel.tsx` — Memberships borders (BRAND-09)
- `src/pages/OrganizationPage.tsx` or settings sub-page — header text (BRAND-10)
- `src/App.tsx` or routing config — top-bar title source of truth (QA-09)

**Reusable foundations:**
- `@remixicon/react` icons (already a dependency per `src/CLAUDE.md`)
- `src/components/ui/input.tsx` shadcn Input primitive
- `useActiveOrganization` / store hook for the active org's name + description (BRAND-10)
- `react-router-dom` `useLocation()` or per-route `<Outlet>` config for top-bar title

**Critical reference:**
- `src/CLAUDE.md` HARD CONSTRAINTS section — Remix Icons ONLY
- Phase 33's `<SelectionButton>` primitive — sidebar should use it (Phase 33 ships first)
</code_context>

<specifics>
## Requirements (from REQUIREMENTS.md / Phase 29 sweep)

- **BRAND-01** Sidebar order
- **BRAND-02** UPPERCASE titles
- **BRAND-03** Bold-only workspace title (remove italic)
- **BRAND-04** Org box full-width + equal padding
- **BRAND-05** Top-bar org selector = 2nd-pane org box width
- **BRAND-06** "ALL" link darkened
- **BRAND-07** Doubled X close button removed
- **BRAND-08** Global search rounded + brand polish
- **BRAND-09** Memberships section: no stray box borders
- **BRAND-10** Settings > Organizations header shows org name + description
- **QA-06** Sidebar emoji → Remix Icons (HARD CONSTRAINT)
- **QA-09** Top-bar title updates per route
- **QA-10** ORG → ORGANIZATION (consistent)

## Success Criteria (from ROADMAP.md)

1. Sidebar sections in order: CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION, all UPPERCASE titles.
2. Workspace title bold-only (no italic).
3. Org box + top-bar org selector share same width + equal padding.
4. No doubled X close button anywhere; global search input rounded + brand-consistent.
5. Settings > Organizations header shows selected org name + description.

## Verification Strategy

- Dev-browser per-route screenshots (sidebar in order with Remix Icons, top-bar title correct, no emoji anywhere).
- Visual diff vs Phase 29 screenshots — every flagged surface improved.
- No console errors, accessibility checks pass.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 34 section
- `.planning/REQUIREMENTS.md` — BRAND-01..10, QA-06, QA-09, QA-10
- `.planning/phases/29-qa-sweep-regression-catalog/` — Phase 29 screenshots (especially QA-06, QA-09, QA-10)
- `.planning/phases/33-selection-state-system/33-CONTEXT.md` — Phase 33 SelectionButton primitive (used by sidebar)
- `docs/design/brand-guidelines-v4.4.md` — design system
- `src/CLAUDE.md` — HARD CONSTRAINT (Remix Icons only)
- `@remixicon/react` package docs — icon name lookup
</canonical_refs>

<deferred>
## Deferred Ideas

- **Sidebar collapse animation** — already exists per Zustand `usePreferencesStore`. Don't touch.
- **Mobile sidebar drawer** — separate concern; out of milestone scope.
- **QA-11 raw enum leak ("Copy And_remove")** — surface adjacent to Settings > Organizations. Track as separate Phase 34 sub-task OR bump to Phase 36 critical bug sweep.
</deferred>
