---
phase: 11-org-segregation-4-pane
plan: "03"
subsystem: frontend/import-page
tags: [import, 4-pane, pane2, secondary-pane, appshell]
dependency_graph:
  requires: [11-01, 11-02]
  provides: [import-pane2-nav, import-overview-dashboard]
  affects: [src/pages/ImportPage.tsx, src/components/panes/ImportSourcePane.tsx, src/components/import/ImportOverviewDashboard.tsx]
tech_stack:
  added: []
  patterns: [AppShell secondaryPane, conditional Pane 3 rendering, Pane 2 vertical nav]
key_files:
  created:
    - src/components/panes/ImportSourcePane.tsx
    - src/components/import/ImportOverviewDashboard.tsx
  modified:
    - src/pages/ImportPage.tsx
decisions:
  - "ImportSourcePane placed in panes/ directory (not import/) to match project structure conventions"
  - "Zoom shown unconditionally — removed showZoom/beta_zoom feature flag per plan instruction (IMPORT-06 Phase 12)"
  - "YouTube now inline in Pane 3 (no Dialog wrapper) — more natural in 4-pane layout"
  - "Import History view reuses FailedImportsSection — full history is Phase 12 scope"
metrics:
  duration: "3m"
  completed: "2026-03-30"
  tasks_completed: 2
  files_changed: 3
---

# Phase 11 Plan 03: Import Page 4-Pane Layout Summary

Import page converted from tabs-based single-pane layout to proper 4-pane AppShell layout with Pane 2 source navigation and Pane 3 contextual content.

## What Was Built

**ImportSourcePane** (`src/components/panes/ImportSourcePane.tsx`) — Pane 2 vertical nav with:
- 4 primary sources (Fathom, Zoom, YouTube, File Upload) with Remix icons and connection status indicators
- Green dot (`bg-emerald-500`) = connected, empty circle (`border-muted-foreground/40`) = not connected
- Divider separating sources from secondary nav
- Secondary nav: Routing Rules and Import History
- Correct shadcn tokens throughout (no stale `text-ink`/`bg-cb-card` from old component)
- `font-montserrat font-extrabold uppercase` pane heading per design system

**ImportOverviewDashboard** (`src/components/import/ImportOverviewDashboard.tsx`) — Pane 3 default view with:
- Summary cards grid (one per source) showing connected/error/setup-needed status
- Call counts per source (tabular-nums)
- Failed imports alert (amber banner, shown when failedImports.length > 0)
- Visual hint: "Select a source from the sidebar to manage imports"
- Cards are clickable and call `onSelectSource`

**ImportPage restructure** (`src/pages/ImportPage.tsx`):
- `selectedSource: ImportSourceId | null` state replaces `activeTab`
- AppShell with `secondaryPane={<ImportSourcePane ... />}` — proper Pane 2 injection
- Conditional Pane 3 rendering: null → overview, 'fathom' → SourceCard, 'zoom' → SourceCard, 'youtube' → inline form, 'file-upload' → dropzone, 'routing-rules' → RoutingRulesTab, 'import-history' → FailedImportsSection
- Tabs/TabsList/TabsTrigger/TabsContent fully removed
- YouTube Dialog wrapper removed (inline Pane 3 now)
- `showZoom`/`beta_zoom` feature flag removed — Zoom visible unconditionally

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ImportSourcePane and ImportOverviewDashboard | 7058da24 | 2 new files |
| 2 | Restructure ImportPage to use AppShell secondaryPane | d82db113 | ImportPage.tsx |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- An older `ImportSourcePane.tsx` existed in `src/components/import/` (not `panes/`) using stale token names (`text-ink`, `bg-cb-card`). The new canonical component was created in `src/components/panes/` with correct shadcn tokens. The old file in `import/` was left untouched as it may still be referenced elsewhere — plan did not scope its removal.

## Known Stubs

- **Import History view**: Shows `FailedImportsSection` only. Full import history table (all past imports, pagination, timestamps) is Phase 12 scope. The current view is functional but minimal.

## Self-Check: PASSED

All created files exist on disk. Both task commits verified in git log.
