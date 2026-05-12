---
phase: 34
phase_name: Sidebar, Layout & Brand Polish
status: COMPLETE
completed: 2026-05-12
requirements: [BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, BRAND-07, BRAND-08, BRAND-09, BRAND-10, QA-06, QA-09, QA-10]
---

# Phase 34 — Sidebar, Layout & Brand Polish

## Outcome

Shipped 13 individually-specified visual fixes across the app shell. Most
critical: replaced sidebar emoji icons with Remix Icons (HARD-CONSTRAINT
violation per `src/CLAUDE.md`). Top-bar title now updates per route. All
primary titles UPPERCASE. Workspace pane visuals cleaned up.

## What Shipped

### QA-06 — Emoji → Remix Icons (CRITICAL HARD-CONSTRAINT)

`src/components/ui/sidebar-nav.tsx` no longer renders emoji glyphs. Mapping:

| Was | Now | Active variant |
|-----|-----|----------------|
| 📞 Calls | `RiPhoneLine` | `RiPhoneFill` |
| 👥 People | `RiGroupLine` | `RiGroupFill` |
| 🏢 Organization | `RiBuilding4Line` | `RiBuilding4Fill` |
| 📥 Import | `RiDownloadLine` | `RiDownloadFill` |
| 🔀 Rules | `RiRouteLine` | `RiRouteFill` |
| ❓ Take the tour | `RiQuestionLine` | — |
| ℹ️ How it works | `RiInformationLine` | — |
| ⚙️ Settings | `RiSettings3Line` | `RiSettings3Fill` |

`emoji: string` field removed from `NavItem` interface.

### BRAND-01 — Sidebar Order

Reordered `navItems` array: **CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION**.

### BRAND-02 — UPPERCASE Titles

Source-aligned UPPERCASE for every primary title:
- Sidebar nav: `CALLS`, `IMPORT`, `RULES`, `PEOPLE`, `ORGANIZATION`, `SETTINGS`
- `WorkspaceSidebarPane`: `NAVIGATION`, `WORKSPACE NAVIGATOR`, `PERSONAL`, `YOUR WORKSPACES`, `HOME`, `SHARED WITH ME`
- `OrganizationCategoryPane`: `ORGANIZATION`, `MANAGEMENT`

### BRAND-03 — Workspace Title Bold-Only

Removed `font-display italic` from active state on workspace rows, folder rows,
home button, personal folder rows, and shared-with-me button. Active titles
are now **bold-only** (no italic, no display font).

### BRAND-04 — Org Box Full Width + Equal Padding

`WorkspaceSidebarPane` and `OrganizationCategoryPane` headers now use
`px-3 py-4` outer padding with `w-full p-3` org-box wrapper — edge-to-edge
with 12px equal padding on all sides.

### BRAND-05 — Top-Bar Org Selector Width

`OrganizationSwitcher` trigger Button is now `w-full + justify-between`
(stretches inside its parent). `TopBar` wraps the switcher in
`<div className="w-[200px] hidden md:block">` to size it to ≈ the 2nd-pane
org-box width. Dropped `max-w-[150px]` cap on the org-name span.

### BRAND-06 — ALL Badge Darkened

`Badge` on the HOME button switched from `bg-cb-border/30` (v1 token, washed out)
to `bg-muted text-foreground`. Reads cleanly in both light and dark modes.

### BRAND-07 — Doubled X Close Button

**NO-REPRO.** Code scan across all `DialogContent` + custom-close patterns
turned up nothing. See `BRAND-07-AUDIT.md` for the search methodology and
inspected files.

### BRAND-08 — Global Search Modal Polish

`GlobalSearchModal`:
- `DialogContent` now uses `rounded-2xl border border-border` (brand-consistent dialog chrome)
- Search input wrapped in a `rounded-md` container with `bg-muted/30` idle and
  `focus-within:bg-card focus-within:border-vibe-orange/40 focus-within:ring-2 focus-within:ring-vibe-orange/20`
- Icon scale tightened from `w-5` to `w-4`, text from `text-base` to `text-sm`
  to match shadcn Input scale

### BRAND-09 — Memberships Section Borders

`WorkspaceDetailPanel` Memberships section's outer
`border border-border/40 rounded-2xl bg-card/20` wrapper removed. The nested
`WorkspaceMemberPanel` handles its own visual chrome — no double-wrapping.

### BRAND-10 — Settings > Organizations Header

`OrganizationsTab` H2 + paragraph now bind to `selectedOrg.name` and a
type-derived description (`'Your personal organization for private recordings'`
for personal orgs, `'Business organization for team collaboration'` for business
orgs). Falls back to the prior generic copy when no org selected.

### QA-09 — Top-Bar Title Per Route

`Layout.tsx` `getPageLabel()` resolves every primary nav route:

| Path | Title |
|------|-------|
| `/`, `/transcripts*` | `CALLS` |
| `/import*` | `IMPORT` |
| `/rules*` | `RULES` |
| `/people*` | `PEOPLE` |
| `/organization*` | `ORGANIZATION` |
| `/settings*` | `SETTINGS` |
| `/analytics*` | `ANALYTICS` |
| `/call/*` | `CALL DETAIL` |
| `/sorting-tagging*` | `SORTING & TAGGING` |
| other | `HOME` |

Prior bug: every unhandled route fell through to `HOME`.

### QA-10 — ORGANIZATION Standardization

`OrganizationCategoryPane` header `<h2>Org</h2>` → `<h2>ORGANIZATION</h2>`.
Full word everywhere in the org route surface.

## Files Modified

```
src/components/Layout.tsx
src/components/header/OrganizationSwitcher.tsx
src/components/panels/WorkspaceDetailPanel.tsx
src/components/panes/OrganizationCategoryPane.tsx
src/components/panes/WorkspaceSidebarPane.tsx
src/components/search/GlobalSearchModal.tsx
src/components/settings/OrganizationsTab.tsx
src/components/ui/sidebar-nav.tsx
src/components/ui/top-bar.tsx
```

Plus audit doc: `.planning/phases/34-sidebar-layout-brand-polish/BRAND-07-AUDIT.md`.

## Commits

1. `fix(34-01,34-02,34-03): sidebar emoji→Remix icons + reorder + UPPERCASE (QA-06, BRAND-01, BRAND-02)`
2. `fix(34-03,34-05): UPPERCASE 2nd-pane titles + workspace bold-only + org box full-width (BRAND-02, BRAND-03, BRAND-04, BRAND-06)`
3. `fix(34-04): wire top-bar title per route (QA-09)`
4. `fix(34-05): top-bar org selector matches 2nd-pane org box width (BRAND-05)`
5. `fix(34-06): drop redundant border wrapper on Memberships section (BRAND-09)`
6. `fix(34-06): global search modal — rounded input + brand-consistent chrome (BRAND-08)`
7. `fix(34-06): Settings > Organizations header reflects selected org (BRAND-10)`
8. `docs(34-06): document BRAND-07 doubled-X close button audit — NO-REPRO`

## Verification

- `npx tsc --noEmit` exits 0 (clean).
- `grep -E "emoji|📞|👥|🏢|📥|🔀|❓|ℹ️|⚙️" src/components/ui/sidebar-nav.tsx` returns no matches.
- `grep "font-display italic" src/components/panes/WorkspaceSidebarPane.tsx` returns no matches.
- `grep "bg-cb-border/30" src/components/panes/WorkspaceSidebarPane.tsx` returns no matches.
- See `34-VERIFICATION.md` for the full per-fix grep/visual checklist.

## Deferred / Out of scope

- Sidebar collapse animation — not touched (works as-is via `usePreferencesStore`)
- Mobile sidebar drawer polish — out of milestone scope
- QA-11 "Copy And_remove" enum leak — deferred to Phase 36 critical bug sweep
