---
phase: 18-import-routing-rules
plan: 04
subsystem: ui

tags: [react, typescript, tanstack-query, radix-ui, routing-rules, tab-navigation, badge, popover]

# Dependency graph
requires:
  - phase: 18-03
    provides: RoutingRuleSlideOver, RoutingConditionBuilder, RulePreviewCount, useRulePreview
  - phase: 18-02
    provides: useRoutingRules, routingRuleStore, DefaultDestinationBar, RoutingRulesList, DestinationPicker
  - phase: 18-01
    provides: import_routing_rules + import_routing_defaults tables, routing engine

provides:
  - Import Hub with Sources | Rules tabs (activeTab state, no regression on Sources)
  - RoutingRulesTab: DefaultDestinationBar + RoutingRulesList + guided empty state + RoutingRuleSlideOver
  - Guided empty state: RiRouteLine 48px icon, 'Route new calls automatically' headline, IMP-07 gate
  - RoutingTraceBadge: 'Routed by: [Rule Name]' badge + Popover popover on routed call rows
  - Integrated RoutingTraceBadge into folder view call rows

affects:
  - Phase 18 verification (human checkpoint — Task 3)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab navigation: local activeTab state ('sources' | 'rules'), existing content moved into Sources branch, Rules branch renders RoutingRulesTab"
    - "IMP-07 gate: hasDefault = !!routingDefault — CTA disabled and tooltip shown when no default set"
    - "RoutingTraceBadge: checks source_metadata.routed_by_rule_name — returns null when falsy (zero render cost)"
    - "Popover on hover: onMouseEnter/onMouseLeave toggles open state for hover behavior"
    - "Type cast pattern: recording.source_metadata as Record<string, unknown> | null for Json supabase type"

key-files:
  created:
    - callvault/src/components/import/RoutingRulesTab.tsx
    - callvault/src/components/import/RoutingTraceBadge.tsx
  modified:
    - callvault/src/routes/_authenticated/import/index.tsx
    - callvault/src/routes/_authenticated/folders/$folderId.tsx

key-decisions:
  - "Sources tab wraps all existing content in a conditional branch — zero regression risk"
  - "RoutingRulesTab uses useWorkspaces for workspace name resolution in RoutingRulesList display"
  - "folderNames left empty in RoutingRulesTab — DestinationPicker inside slide-over handles full display; card shows vault ID fallback which is acceptable"
  - "RoutingTraceBadge integrated into folder view (not deferred) — integration point was clear and straightforward"
  - "Popover uses onMouseEnter/onMouseLeave for hover behavior; onClick preventDefault stops navigation"
  - "Help sheet implemented as inline toggle (not a separate sheet/dialog) — simpler, no extra state complexity"

# Metrics
duration: ~3min
completed: 2026-02-28
---

# Phase 18 Plan 04: Import Hub Integration and Routing Trace Badge Summary

**Sources | Rules tab navigation in Import Hub, guided empty state with IMP-07 gate, and RoutingTraceBadge with Popover integrated in folder call rows**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T05:31:47Z
- **Completed:** 2026-02-28T05:35:00Z
- **Tasks:** 2 (Tasks 1-2 complete; Task 3 is checkpoint:human-verify — awaiting user approval)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Modified Import Hub page (`import/index.tsx`) to add Sources | Rules tab navigation using local `activeTab` state. All existing Sources tab content (source grid, file upload dropzone, FailedImportsSection, dialogs) moved into the Sources branch unchanged — zero regression.
- Created `RoutingRulesTab.tsx` assembling the full rules UI: DefaultDestinationBar at top, RoutingRulesList with drag-to-reorder when rules exist, "Create Rule" button (disabled without default, tooltip IMP-07), guided empty state with 48px RiRouteLine icon, "Route new calls automatically" headline (font-montserrat/extrabold/uppercase), subtext, "Create your first rule" CTA (IMP-07 gated), "Learn how routing works" toggle for inline help, and RoutingRuleSlideOver always rendered.
- Created `RoutingTraceBadge.tsx` that reads `routed_by_rule_name` and `routed_at` from `source_metadata`, renders null when absent, and shows a subtle gray badge with Radix UI Popover (w-64, side=top) displaying rule name bold + formatted date.
- Integrated `RoutingTraceBadge` directly into `/folders/$folderId.tsx` call rows (placed in the right column next to the source_app badge). Integration was clean and straightforward.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tab navigation to Import Hub and create Rules tab with empty state** - `02695fa` (feat)
2. **Task 2: Create routing trace badge for call list rows** - `c698b46` (feat)

## Files Created/Modified

- `callvault/src/components/import/RoutingRulesTab.tsx` — Full rules tab: DefaultDestinationBar, RoutingRulesList, empty state, slide-over (224 lines)
- `callvault/src/components/import/RoutingTraceBadge.tsx` — Conditional badge + Popover for routed call rows (119 lines)
- `callvault/src/routes/_authenticated/import/index.tsx` — Added Sources | Rules tabs, import of RoutingRulesTab (553 lines, +1 import + tab bar + conditional branches)
- `callvault/src/routes/_authenticated/folders/$folderId.tsx` — Added RoutingTraceBadge import + integration in call row right column

## Decisions Made

- Sources tab wraps all existing content in a single `{activeTab === 'sources' && ...}` branch — safest migration, zero risk of regression
- `folderNames` passed as empty `{}` to RoutingRulesList — DestinationPicker inside the slide-over handles full workspace/folder display; rule card falls back to vault ID which is acceptable for now
- RoutingTraceBadge integrated directly (not deferred) — the folder view call row was a clear, simple integration point with direct access to `recording.source_metadata`
- "Learn how routing works" implemented as an inline toggle showing a `<HelpContent>` panel — simpler than a full sheet/dialog, no extra dependencies
- Popover opened on `onMouseEnter`/`onMouseLeave` for hover behavior; `onClick` calls `e.preventDefault()` to prevent the Link from navigating when badge is clicked

## Deviations from Plan

None — plan executed exactly as written. RoutingTraceBadge integration was explicitly permitted by the plan ("If a clear integration point exists... integrate the badge directly"), and the folder view provided that clear point.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Task 3 (checkpoint:human-verify) is pending — user needs to verify the complete routing rules flow end-to-end
- All 4 Plans of Phase 18 are code-complete; human verification of the assembled feature is the final gate
- If verification passes, Phase 18 is complete
- If issues found, gap closure tasks will be created

## Self-Check: PASSED

- `/Users/Naegele/dev/callvault/src/components/import/RoutingRulesTab.tsx` — FOUND (224 lines)
- `/Users/Naegele/dev/callvault/src/components/import/RoutingTraceBadge.tsx` — FOUND (119 lines)
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/import/index.tsx` — FOUND (553 lines)
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/folders/$folderId.tsx` — FOUND (modified)
- Commit `02695fa` (Task 1) — FOUND
- Commit `c698b46` (Task 2) — FOUND
- `tsc --noEmit` — PASSED (zero errors)
- `activeTab` state 'sources' | 'rules' in ImportPage — CONFIRMED
- Sources tab wraps all existing content — CONFIRMED (no regression)
- Rules tab renders RoutingRulesTab — CONFIRMED
- IMP-07 gate: button disabled when !routingDefault — CONFIRMED
- RoutingTraceBadge returns null when no routed_by_rule_name — CONFIRMED
- Popover uses radix-ui Popover.Root/Trigger/Content — CONFIRMED
- Integration in folder call row right column — CONFIRMED

---
*Phase: 18-import-routing-rules*
*Completed: 2026-02-28 (Tasks 1-2; checkpoint pending)*
