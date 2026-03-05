# Phase 18: Import Routing Rules

**Type:** Full feature build (4 plans)

**Goal:** Build an automated call-routing system on top of the Phase 17 connector pipeline. When a call is imported from any source, the routing engine evaluates an org-level ruleset and directs the call to a specific Workspace/Folder based on user-defined conditions.

**Mental model:** "The org has one rule list. Each rule sends calls to a specific workspace/folder. If no rule matches, calls go to the org default destination. If there's no default, fallback to personal vault (pre-Phase-18 behavior preserved)."

---

## Scope and Navigation

- [ ] Rules live inside Import Hub as a tab: `Import Hub > Sources | Rules`
- [ ] Rules are org-wide (one ruleset per org/bank_id), not per-workspace, but each rule can target any workspace/folder in the org
- [ ] Rules apply to future imports only — NOT retroactive (IMP-09 requirement)
- [ ] IMP-F-01 (AI-suggested routing rules) is explicitly deferred to v3+

---

## Plan 01 — Database Schema + Routing Engine (Backend)

### Create `import_routing_rules` Table

- [ ] Columns: `id` (UUID), `bank_id` (FK to banks), `name` (required text), `priority` (integer — IMP-10 requires this from the first migration), `enabled` (boolean, default true), `conditions` (JSONB array), `logic_operator` ('AND' | 'OR'), `target_vault_id` (FK to vaults), `target_folder_id` (FK to folders, nullable), `created_by` (FK to auth.users), `created_at`, `updated_at`
- [ ] Create compound partial index on `(bank_id, priority) WHERE enabled = true` — optimizes the first-match-wins query
- [ ] Create 4 RLS policies using `bank_memberships` JOIN pattern (SELECT/INSERT/UPDATE/DELETE)

### Create `import_routing_defaults` Table

- [ ] `bank_id` as PRIMARY KEY (schema-enforced one-per-org)
- [ ] `target_vault_id`, `target_folder_id` (nullable), `updated_by`, `updated_at`
- [ ] Create 3 RLS policies (SELECT/INSERT/UPDATE — no DELETE, default is upserted not deleted)

### Create Priority Reorder RPC

- [ ] `update_routing_rule_priorities(p_bank_id UUID, p_rule_ids UUID[])` — SECURITY DEFINER
- [ ] Accepts an ordered array of rule IDs, updates each rule's `priority` to its array index
- [ ] Must be atomic — all or nothing

### Build `routing-engine.ts`

- [ ] Export `resolveRoutingDestination(supabase, bankId, ConnectorRecord)` as the main entry point
- [ ] Implement first-match-wins logic: query all enabled rules for the bank ordered by `priority ASC`, loop through, return on first match
- [ ] Implement `evaluateRule(rule, record)` — checks all conditions with AND/OR logic
- [ ] Implement `evaluateCondition(condition, record)` — dispatches to type-specific evaluators
- [ ] Support 6 condition types with appropriate operators:
  - **title** — contains, equals, starts_with, doesnt_contain (string matching)
  - **source** — equals (exact match on source_app)
  - **duration** — greater_than, less_than (numeric comparison in seconds)
  - **participant** — contains, equals (searches participant names in source_metadata)
  - **tag** — contains, equals (searches tags array)
  - **date** — after, before (date comparison)
- [ ] Implement `extractParticipants(record)` — pulls participant names from various source_metadata formats

### Integrate into Connector Pipeline

- [ ] Add routing as a non-blocking pre-step in `runPipeline()` — between the dedup check and `insertRecording()`
- [ ] Fallback chain: matched rule destination -> org default destination -> personal vault (original behavior)
- [ ] **CRITICAL: Fail-open** — routing errors must log and continue, never block an import
- [ ] Add `folder_id` to `ConnectorRecord` interface so it flows through to `vault_entries` INSERT
- [ ] Do NOT modify `insertRecording()` signature — preserve the contract all connectors depend on
- [ ] Write routing trace into `source_metadata`: `routed_by_rule_id`, `routed_by_rule_name`, `routed_at`

---

## Plan 02 — Frontend Data Layer + Rule List UI

### Types

- [ ] Create `src/types/routing.ts` with: `RoutingRule`, `RoutingCondition`, `RoutingDefault`, `RoutingDestination`

### Zustand Store

- [ ] Create `src/stores/routingRuleStore.ts` with: `isSlideOverOpen`, `activeRuleId`, `openSlideOver(id | null)`, `closeSlideOver()`

### TanStack Query Hooks

- [ ] Create `src/hooks/useRoutingRules.ts` with 8 hooks:
  - `useRoutingRules()` — query all rules for active org
  - `useRoutingDefault()` — query default destination (`.maybeSingle()`)
  - `useCreateRule()` — mutation
  - `useUpdateRule()` — mutation
  - `useDeleteRule()` — mutation
  - `useToggleRule()` — optimistic toggle (flip `enabled` locally, revert on error)
  - `useReorderRules()` — calls RPC + optimistic reorder with rollback on error
  - `useUpsertRoutingDefault()` — upsert mutation

### Destination Picker Component

- [ ] Build `DestinationPicker.tsx` — cascading workspace -> folder select dropdowns
- [ ] Uses `useWorkspaces()` for first dropdown, `useFolders(selectedWorkspaceId)` for second
- [ ] Folder is optional (route to workspace root if no folder selected)

### Default Destination Bar

- [ ] Build `DefaultDestinationBar.tsx` — prominent bar above the rule list (not a rule card)
- [ ] Auto-saves on selection change via `useUpsertRoutingDefault` (no Save button — One-Click Promise)
- [ ] Show amber prompt when no default is set: "Set a default destination for unmatched calls"
- [ ] Default destination is required before any rules can be created (IMP-07)

### Routing Rule Card

- [ ] Build `RoutingRuleCard.tsx` as a sortable card using @dnd-kit/sortable
- [ ] Drag handle via `setActivatorNodeRef` (handle-only drag, not whole-card)
- [ ] `summarizeConditions()` helper — generates sentence summary of rule conditions for the card view
- [ ] Enabled/disabled toggle on each card
- [ ] Install `@dnd-kit/sortable` and `@dnd-kit/utilities` (extends the already-installed `@dnd-kit/core`)

### Routing Rules List

- [ ] Build `RoutingRulesList.tsx` with `DndContext` + `SortableContext(verticalListSortingStrategy)`
- [ ] `PointerSensor` with 8px activation constraint (prevents accidental drags)
- [ ] `KeyboardSensor` for accessibility
- [ ] On reorder: call `useReorderRules` with new priority order

---

## Plan 03 — Condition Builder, Live Preview, Slide-Over Editor

### Rule Preview (Client-Side)

- [ ] Build `useRulePreview` hook:
  - `usePreviewCalls()` — fetches last 20 recordings from Supabase (5min staleTime)
  - `useRulePreview(conditions, logicOperator)` — `useMemo` client-side evaluation, returns `matchingCount`, `matchingCalls`, `totalChecked`
  - `useOverlapCheck(ruleId, matchingCalls)` — detects higher-priority rules matching same preview calls
  - `evaluateConditionsClientSide()` — mirrors server-side routing-engine logic exactly

### Preview Count Component

- [ ] Build `RulePreviewCount.tsx`:
  - Display exact text: "This rule would match X of your last N calls" (IMP-08 requirement)
  - `AnimatePresence` expand/collapse to show matching call list
  - Amber zero-match warning (non-blocking — rules may target future imports)
  - Blue overlap info box when higher-priority rules match same calls

### Condition Builder Component

- [ ] Build `RoutingConditionBuilder.tsx`:
  - 6-field config (`ROUTING_CONDITION_FIELDS`) mapping each field to its valid operators
  - Sentence-like row layout: "[field dropdown] [operator dropdown] [value input]"
  - Global AND/OR toggle as clickable pill badge between condition rows
  - "Add condition" button — disabled at 5 conditions maximum
  - Delete button per condition row

### Slide-Over Editor

- [ ] Build `RoutingRuleSlideOver.tsx`:
  - Fixed panel at z-50, 480px width, full-width on mobile
  - motion/react spring animation: x:'100%' -> 0 -> '100%'
  - z-40 backdrop overlay
  - "Rules apply to new imports only" banner at top (IMP-09 requirement)
  - Rule name input
  - Condition builder component
  - Destination picker component
  - Live preview component
  - Cancel / Save footer
  - Edit mode: loads existing rule from query cache
  - Create mode: initializes with source=fathom suggestion when no rules exist yet

---

## Plan 04 — Import Hub Integration + Routing Trace Badge

### Add Rules Tab to Import Hub

- [ ] Modify `import/index.tsx` to add `activeTab: 'sources' | 'rules'` local state
- [ ] Move all existing Sources content into a Sources branch
- [ ] Rules branch renders `RoutingRulesTab`

### Build RoutingRulesTab

- [ ] Build `RoutingRulesTab.tsx` assembling:
  - DefaultDestinationBar at top
  - RoutingRulesList below
  - Guided empty state when no rules exist: `RiRouteLine` 48px icon, "Route new calls automatically" headline, CTA button gated on default destination being set (IMP-07)
  - RoutingRuleSlideOver (mounted, visibility controlled by store)

### Build Routing Trace Badge

- [ ] Build `RoutingTraceBadge.tsx`:
  - Reads `routed_by_rule_name` + `routed_at` from `source_metadata` on each recording
  - Renders null when routing metadata is absent (pre-routing-rules imports)
  - Shows subtle gray "Routed by: [Rule Name]" badge
  - Hover/click opens Radix UI Popover (w-64, side=top) with rule name + timestamp
- [ ] Integrate badge into call rows on the folder view (`folders/$folderId.tsx`)

### Verification Checks

- [ ] Sources/Rules tab navigation renders correctly with no regression on Sources tab
- [ ] Default destination auto-save fires a toast confirmation
- [ ] "Create your first rule" button enables only after default destination is set
- [ ] Slide-over opens with spring animation
- [ ] Live preview updates as conditions are edited
- [ ] AND/OR toggle appears between condition rows
- [ ] Rule saves with a toast confirmation
- [ ] Drag-to-reorder persists after page refresh
- [ ] Disabled rule shows opacity-60 + strikethrough styling
- [ ] Re-enabling a rule restores full opacity
