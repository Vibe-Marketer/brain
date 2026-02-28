---
phase: 18-import-routing-rules
plan: 02
subsystem: frontend
tags: [react, typescript, tanstack-query, zustand, dnd-kit, routing-rules]

# Dependency graph
requires:
  - phase: 18-01
    provides: import_routing_rules + import_routing_defaults tables, update_routing_rule_priorities RPC
  - phase: 16-workspace-redesign
    provides: useWorkspaces, useFolders hooks, Workspace/Folder types

provides:
  - RoutingRule, RoutingCondition, RoutingDefault, RoutingDestination TypeScript types
  - routingRules query key factory (list, defaults, preview)
  - routingRuleStore (Zustand) for slide-over open/close UI state
  - useRoutingRules, useRoutingDefault query hooks
  - useCreateRule, useUpdateRule, useDeleteRule, useToggleRule, useReorderRules, useUpsertRoutingDefault mutation hooks
  - DestinationPicker component (cascading workspace > folder select)
  - DefaultDestinationBar component (org default with auto-save)
  - RoutingRuleCard component (sortable card with drag handle, toggle, summary)
  - RoutingRulesList component (DnD container with vertical list strategy)

affects:
  - 18-03 (routing preview — can import useRoutingRules and RoutingRulesList)
  - 18-04 (routing slide-over — uses routingRuleStore, useCreateRule, useUpdateRule)

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/sortable@10.0.0 — SortableContext, useSortable, arrayMove, verticalListSortingStrategy"
    - "@dnd-kit/utilities@3.2.2 — CSS.Transform for transform/transition styling"
  patterns:
    - "Drag handle isolation: setActivatorNodeRef on handle button only — card body click does not trigger drag"
    - "Optimistic update pattern: cancel queries → snapshot → optimistic set → rollback on error → invalidate on settle"
    - "Handle-only drag with 8px activation constraint via PointerSensor to prevent accidental drags on clicks"
    - "activeOrgId from orgContextStore IS the bank_id — banks and organizations are the same concept"
    - "Auto-save on selection change for default destination — no explicit Save button (One-click Promise)"
    - "useReorderRules calls update_routing_rule_priorities RPC with ordered ID array"
    - "Local items state in RoutingRulesList synced from rules prop via useEffect for optimistic UX"

key-files:
  created:
    - callvault/src/types/routing.ts
    - callvault/src/stores/routingRuleStore.ts
    - callvault/src/hooks/useRoutingRules.ts
    - callvault/src/components/import/DestinationPicker.tsx
    - callvault/src/components/import/DefaultDestinationBar.tsx
    - callvault/src/components/import/RoutingRuleCard.tsx
    - callvault/src/components/import/RoutingRulesList.tsx
  modified:
    - callvault/src/lib/query-config.ts (added routingRules query key factory)
    - callvault/package.json (added @dnd-kit/sortable + @dnd-kit/utilities)
    - callvault/pnpm-lock.yaml

key-decisions:
  - "activeOrgId in orgContextStore serves as bank_id for routing queries — no new activeBankId field needed since banks = organizations"
  - "Handle-only drag via setActivatorNodeRef rather than card-wide drag to prevent toggle/edit click interference"
  - "PointerSensor activation constraint of 8px prevents accidental drag when users click the edit area"
  - "pnpm (not npm) is the package manager — npm install fails due to lockfile format mismatch"
  - "supabase cast to any for routing tables — DB types not yet regenerated after Plan 01 migration"

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 18 Plan 02: Routing Rules Data Layer and List UI Summary

**@dnd-kit/sortable powered drag-to-reorder rule list with 8 TanStack Query hooks, Zustand slide-over store, and 4 UI components: DestinationPicker (cascade), DefaultDestinationBar (auto-save), RoutingRuleCard (sortable + toggle), RoutingRulesList (DnD container)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T05:17:51Z
- **Completed:** 2026-02-28T05:22:30Z
- **Tasks:** 2
- **Files modified:** 9 (2 modified, 7 created)

## Accomplishments

- Installed `@dnd-kit/sortable@10.0.0` and `@dnd-kit/utilities@3.2.2` via pnpm (npm not compatible with pnpm lockfile)
- Created `src/types/routing.ts` with `RoutingRule`, `RoutingCondition`, `RoutingDefault`, and `RoutingDestination` types matching the DB schema from Plan 01
- Added `routingRules` query key factory (`list`, `defaults`, `preview`) to `query-config.ts` following existing factory pattern
- Created `routingRuleStore.ts` Zustand store for slide-over UI state (`isSlideOverOpen`, `activeRuleId`, `openSlideOver`, `closeSlideOver`) — null activeRuleId = create mode
- Created `useRoutingRules.ts` with 8 hooks: `useRoutingRules` (query by bank_id ordered by priority), `useRoutingDefault` (maybeSingle for null safety), `useCreateRule` (MAX priority + 1 append), `useUpdateRule`, `useDeleteRule`, `useToggleRule` (optimistic update with rollback), `useReorderRules` (RPC call with optimistic reorder + rollback), `useUpsertRoutingDefault` (bank_id conflict key)
- Created `DestinationPicker.tsx`: cascading two-step select using `useWorkspaces(orgId)` + `useFolders(vaultId)`, folder select only shown after workspace selected, folder resets to null on workspace change
- Created `DefaultDestinationBar.tsx`: card above rule list with "Unmatched calls go to:" label, auto-saves on DestinationPicker change via `useUpsertRoutingDefault`, amber prompt when no default set
- Created `RoutingRuleCard.tsx`: sortable card with `useSortable`, drag handle via `setActivatorNodeRef` (handle-only, not card-wide), `summarizeConditions()` helper generating "When field operator value AND/OR ..." text, enabled toggle using native button[role=switch] matching SourceCard pattern, edit click on card body
- Created `RoutingRulesList.tsx`: `DndContext` + `SortableContext(verticalListSortingStrategy)`, `PointerSensor` with 8px activation constraint, `KeyboardSensor` for accessibility, optimistic local state with `arrayMove`, `onReorder` callback with new ID array

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data layer** - `5d9eebe` (feat)
2. **Task 2: Create UI components** - `a29c295` (feat)

## Files Created/Modified

- `callvault/src/types/routing.ts` — RoutingRule, RoutingCondition, RoutingDefault, RoutingDestination types (42 lines)
- `callvault/src/stores/routingRuleStore.ts` — Zustand slide-over UI store (37 lines)
- `callvault/src/hooks/useRoutingRules.ts` — 8 CRUD/reorder/default hooks with optimistic updates (394 lines)
- `callvault/src/components/import/DestinationPicker.tsx` — Cascading workspace > folder select (113 lines)
- `callvault/src/components/import/DefaultDestinationBar.tsx` — Default destination bar with auto-save (73 lines)
- `callvault/src/components/import/RoutingRuleCard.tsx` — Sortable rule card with handle + toggle (200 lines)
- `callvault/src/components/import/RoutingRulesList.tsx` — DnD container with SortableContext (116 lines)
- `callvault/src/lib/query-config.ts` — Added routingRules query key factory
- `callvault/package.json` + `pnpm-lock.yaml` — Added @dnd-kit/sortable + @dnd-kit/utilities

## Decisions Made

- `activeOrgId` from `orgContextStore` is used as `bank_id` for all routing queries — no new store field needed since the `banks` table IS the organization table (established in Phase 16 architecture)
- `supabase as any` cast for routing tables since the `supabase.ts` types file was generated before the Plan 01 migration; will resolve when types are regenerated
- Drag handle isolation uses `setActivatorNodeRef` so only the `RiDraggable` icon initiates drag, preventing click-on-card from accidentally starting a drag
- `PointerSensor` activation constraint set to 8px movement to distinguish intentional drags from clicks in areas near the drag handle
- `pnpm` used for package install (npm fails with "Cannot read properties of null (reading 'matches')" due to pnpm lockfile format incompatibility)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched from npm to pnpm for package installation**
- **Found during:** Task 1 (installing @dnd-kit/sortable)
- **Issue:** `npm install @dnd-kit/sortable @dnd-kit/utilities` failed with "Cannot read properties of null (reading 'matches')" — the project uses pnpm lockfile format which npm cannot parse
- **Fix:** Used `/Users/Naegele/.npm-global/bin/pnpm add @dnd-kit/sortable @dnd-kit/utilities` which correctly installed both packages
- **Files modified:** `package.json`, `pnpm-lock.yaml`

**2. [Rule 2 - Missing critical] No shadcn/ui Select available — used native `<select>` in DestinationPicker**
- **Found during:** Task 2 (creating DestinationPicker)
- **Issue:** Plan spec said "Use shadcn/ui Select components" but the project has no `src/components/ui/` directory and no shadcn/ui dependency — it uses Radix UI primitives directly
- **Fix:** Used native `<select>` elements with consistent Tailwind styling matching the project's existing pattern (SourceCard uses native button[role=switch], not Radix Switch)
- **No files affected** — this was a design decision during creation, not a post-creation fix

---

**Total deviations:** 2 auto-fixed (1 blocking install issue, 1 missing dependency resolved via native element)
**Impact on plan:** Zero impact on functionality — pnpm produced the same packages, native select provides the same cascading UX

## Self-Check: PASSED

- `/Users/Naegele/dev/callvault/src/types/routing.ts` — FOUND (42 lines)
- `/Users/Naegele/dev/callvault/src/hooks/useRoutingRules.ts` — FOUND (394 lines)
- `/Users/Naegele/dev/callvault/src/stores/routingRuleStore.ts` — FOUND (37 lines)
- `/Users/Naegele/dev/callvault/src/components/import/RoutingRulesList.tsx` — FOUND (116 lines)
- `/Users/Naegele/dev/callvault/src/components/import/RoutingRuleCard.tsx` — FOUND (200 lines)
- `/Users/Naegele/dev/callvault/src/components/import/DefaultDestinationBar.tsx` — FOUND (73 lines)
- `/Users/Naegele/dev/callvault/src/components/import/DestinationPicker.tsx` — FOUND (113 lines)
- Commit `5d9eebe` (Task 1) — FOUND
- Commit `a29c295` (Task 2) — FOUND
- `@dnd-kit/sortable` node_modules — FOUND
- `@dnd-kit/utilities` node_modules — FOUND
- `tsc --noEmit` — PASSED (zero errors)
- `routingRules` in query-config.ts — FOUND
- `update_routing_rule_priorities` RPC call in useRoutingRules.ts — FOUND
- `SortableContext` + `verticalListSortingStrategy` in RoutingRulesList.tsx — FOUND

## Next Phase Readiness

- `useRoutingRules()` and all CRUD hooks are ready for Plan 03 (routing preview)
- `routingRuleStore.openSlideOver(ruleId)` is ready for Plan 03/04 (slide-over + condition builder)
- `RoutingRulesList` + `DefaultDestinationBar` are ready to be integrated into the Import Hub Rules tab
- `DestinationPicker` is ready to be used inside the rule creation/edit slide-over in Plan 03

---
*Phase: 18-import-routing-rules*
*Completed: 2026-02-28*
