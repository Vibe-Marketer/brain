---
phase: 18-import-routing-rules
plan: 03
subsystem: frontend

tags: [react, typescript, tanstack-query, motion-react, routing-rules, condition-builder, slide-over]

# Dependency graph
requires:
  - phase: 18-02
    provides: useRoutingRules hooks, routingRuleStore, DestinationPicker, RoutingRule types
  - phase: 18-01
    provides: import_routing_rules + import_routing_defaults tables

provides:
  - RoutingConditionBuilder: sentence-like "When [field] [op] [value]" rows, 6 field types, AND/OR toggle, 5-condition limit
  - useRulePreview: client-side evaluation against last 20 recordings, instant useMemo updates
  - useOverlapCheck: higher-priority rule overlap detection against same preview calls
  - RulePreviewCount: match count badge, expandable call list, zero-match warning, overlap info
  - RoutingRuleSlideOver: fixed z-50 panel from right, spring animation, full rule editor with preview

affects:
  - 18-04 (import hub page — integrates RoutingRuleSlideOver into the rules tab)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side rule preview: evaluateConditionsClientSide mirrors server routing-engine.ts logic in browser memory — zero server round trips for preview"
    - "Duration field: user inputs minutes, evaluated against DB duration (seconds) via *60 multiplier"
    - "Participant matching: checks source_metadata.calendar_invitees array (email/name strings) for case-insensitive includes"
    - "AND/OR toggle: global per-rule (not per-pair) — single pill badge between rows, click toggles all"
    - "First-rule suggestion: source=fathom pre-populated when no rules exist, user can change freely"
    - "motion/react AnimatePresence: slide-over x: '100%' -> 0 -> '100%', call list height: 0 -> auto"

key-files:
  created:
    - callvault/src/hooks/useRulePreview.ts
    - callvault/src/components/import/RoutingConditionBuilder.tsx
    - callvault/src/components/import/RulePreviewCount.tsx
    - callvault/src/components/import/RoutingRuleSlideOver.tsx

key-decisions:
  - "Client-side preview only — no server round trips for condition evaluation (research pitfall 4)"
  - "Duration field: user enters minutes, evaluator multiplies by 60 to compare against DB seconds"
  - "Zero-match warning is non-blocking — allows save anyway (locked decision from CONTEXT.md)"
  - "Overlap warning is informational only — higher-priority rules noted but do not block save"
  - "RoutingRuleSlideOver reads from routingRuleStore (not panelStore) — routing-specific UI concern"
  - "First-rule suggestion pre-populates source=fathom when no rules exist — suggestion only, not a pre-created rule"

# Metrics
duration: ~3min
completed: 2026-02-28
---

# Phase 18 Plan 03: Rule Editor Slide-Over, Condition Builder, and Live Preview Summary

**Sentence-like condition builder with 6 field types, client-side preview against last 20 calls, zero-match/overlap warnings, and spring-animated slide-over panel using motion/react**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T05:25:33Z
- **Completed:** 2026-02-28T05:28:26Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments

- Created `useRulePreview.ts` with `usePreviewCalls()` (fetches last 20 recordings, 5min staleTime), `useRulePreview()` (useMemo client-side evaluation returning matchingCount + matchingCalls), `useOverlapCheck()` (detects higher-priority rules matching same preview calls), and `evaluateConditionsClientSide()` handling all 6 field types
- Created `RoutingConditionBuilder.tsx` with `ROUTING_CONDITION_FIELDS` config (6 types: title, participant, source, duration, tag, date), sentence-like "When [field] [op] [value]" rows, global AND/OR pill toggle between rows, add-condition button (disabled at 5), delete per row (disabled when only 1 remains)
- Created `RulePreviewCount.tsx` showing "This rule would match X of your last N calls" badge, AnimatePresence expand/collapse call list with source_app badges, zero-match amber warning, overlap blue info box
- Created `RoutingRuleSlideOver.tsx` as fixed z-50 panel (480px, full width on mobile), motion/react spring animation x:'100%'→0→'100%', z-40 backdrop, IMP-09 "Rules apply to new imports only" banner, rule name input, RoutingConditionBuilder, DestinationPicker, RulePreviewCount live preview, Cancel/Save footer
- Edit mode loads existing rule from useRoutingRules() query cache; create mode initializes empty form (or first-rule source=fathom suggestion)
- Save calls useCreateRule or useUpdateRule based on mode, closes slide-over on success

## Task Commits

Each task was committed atomically:

1. **Task 1: Create condition builder and rule preview hook** - `3154e6a` (feat)
2. **Task 2: Create rule editor slide-over with preview and save** - `d927b03` (feat)

## Files Created/Modified

- `callvault/src/hooks/useRulePreview.ts` — useRulePreview + useOverlapCheck + evaluateConditionsClientSide (206 lines)
- `callvault/src/components/import/RoutingConditionBuilder.tsx` — 6-field sentence-like builder (237 lines)
- `callvault/src/components/import/RulePreviewCount.tsx` — match count + expandable list + warnings (145 lines)
- `callvault/src/components/import/RoutingRuleSlideOver.tsx` — fixed-position slide-over editor (259 lines)

## Decisions Made

- Client-side preview uses `useMemo` to re-evaluate whenever conditions or recordings change — zero server round trips, instant feedback
- Duration field: user-entered minutes multiplied by 60 before comparing against DB duration (stored in seconds) — mirrors server routing-engine.ts logic
- AND/OR toggle is global for the rule (not per-pair between conditions) — matches locked CONTEXT.md decision, implemented as clickable pill badge
- Zero-match yellow warning shown but save is not blocked — per locked decision from CONTEXT.md allowing future-import use case
- Overlap detection checks higher-priority rules (lower priority number) against the same preview calls — informational only
- `routingRuleStore.useRoutingRuleStore` provides `isSlideOverOpen`, `activeRuleId`, `closeSlideOver` — slide-over is fully decoupled from panelStore
- First-rule suggestion pre-populates `source=fathom` when `allRules.length === 0` in create mode — suggestion only, user can change it freely

## Deviations from Plan

None — plan executed exactly as written. All 6 condition types implemented, all warnings implemented, motion/react used (not framer-motion), routingRuleStore used (not panelStore), IMP-08 required text exact, IMP-09 banner present.

## Self-Check: PASSED

- `/Users/Naegele/dev/callvault/src/hooks/useRulePreview.ts` — FOUND (206 lines)
- `/Users/Naegele/dev/callvault/src/components/import/RoutingConditionBuilder.tsx` — FOUND (237 lines)
- `/Users/Naegele/dev/callvault/src/components/import/RulePreviewCount.tsx` — FOUND (145 lines)
- `/Users/Naegele/dev/callvault/src/components/import/RoutingRuleSlideOver.tsx` — FOUND (259 lines)
- Commit `3154e6a` (Task 1) — FOUND
- Commit `d927b03` (Task 2) — FOUND
- `tsc --noEmit` — PASSED (zero errors)
- `motion/react` used (not framer-motion) — CONFIRMED
- `useRoutingRuleStore` reads from routingRuleStore — CONFIRMED
- IMP-08 text "This rule would match X of your last N calls" — CONFIRMED
- IMP-09 "Rules apply to new imports only" — CONFIRMED
- `useCreateRule` / `useUpdateRule` based on mode — CONFIRMED
- `position: fixed` on both backdrop (z-40) and panel (z-50) — CONFIRMED

## Next Phase Readiness

- `RoutingRuleSlideOver` is ready to be rendered in the Import Hub rules tab (Plan 04)
- `RoutingRulesList` can call `routingRuleStore.openSlideOver(rule.id)` to open the edit slide-over
- `DefaultDestinationBar` + `RoutingRulesList` + `RoutingRuleSlideOver` form the complete routing rules UI (Plan 04 assembles them)

---
*Phase: 18-import-routing-rules*
*Completed: 2026-02-28*
