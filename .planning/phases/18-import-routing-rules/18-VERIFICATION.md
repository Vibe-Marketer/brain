---
phase: 18-import-routing-rules
verified: 2026-02-28T12:44:43Z
status: human_needed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to Import Hub at /import, click the Rules tab"
    expected: "Two tabs 'Sources' and 'Rules' appear. Sources tab shows existing source cards unchanged. Rules tab shows DefaultDestinationBar at the top with a prompt to set the default destination."
    why_human: "Visual tab layout, regression check on Sources tab, and styled DefaultDestinationBar require browser rendering."
  - test: "Set a default destination using the DefaultDestinationBar"
    expected: "Workspace select appears. After selecting a workspace, an optional folder select appears. On selection change, a toast 'Default destination updated' fires immediately (no Save button needed). The 'Create your first rule' button becomes enabled."
    why_human: "Auto-save behavior, toast timing, and the IMP-07 gate (button enabled state) require live interaction."
  - test: "Click 'Create your first rule', create a rule named 'Test Rule' with Title contains 'review'"
    expected: "Slide-over opens from the right with spring animation. 'Rules apply to new imports only' banner is visible. Preview section shows 'This rule would match X of your last N calls'. See matching calls expander works. Save creates the rule, closes the slide-over, and shows toast 'Rule created'."
    why_human: "Spring animation, live preview update as conditions change, and end-to-end save flow require browser interaction."
  - test: "Create a second rule, then drag the second rule above the first using the drag handle icon"
    expected: "Cards reorder immediately (optimistic). Page refresh preserves the new order."
    why_human: "Drag-to-reorder interaction and persistence after refresh cannot be verified statically."
  - test: "Toggle a rule's enabled switch off, then back on"
    expected: "Disabled rule shows opacity-60 with strikethrough on the rule name. Re-enabling restores full opacity. Change is persisted."
    why_human: "Visual opacity/strikethrough states require browser rendering."
---

# Phase 18: Import Routing Rules Verification Report

**Phase Goal:** Users can create import routing rules with a condition builder, set priority order, preview match counts, and have a required default destination for unmatched calls.
**Verified:** 2026-02-28T12:44:43Z
**Status:** human_needed — all automated checks pass, 5 items require human browser verification
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Routing rules table exists with priority column from first migration (IMP-10) | VERIFIED | `20260228000003_create_import_routing_rules.sql` line 22: `priority INTEGER NOT NULL DEFAULT 0` |
| 2 | Default destination table exists for org-level fallback (IMP-07) | VERIFIED | Same migration: `import_routing_defaults` with `bank_id` as PK |
| 3 | Rules are org-scoped via bank_id with RLS enforcing bank membership | VERIFIED | Migration has 4 RLS policies on `import_routing_rules` using `bank_memberships` JOIN pattern |
| 4 | Routing engine evaluates conditions first-match-wins (IMP-06) | VERIFIED | `routing-engine.ts:90-99`: loop over priority-ordered rules, `return` on first match |
| 5 | Pipeline resolves routing destination before inserting recording | VERIFIED | `connector-pipeline.ts:274-334`: routing block runs between `checkDuplicate` and `insertRecording` |
| 6 | Routing trace stored in source_metadata | VERIFIED | `connector-pipeline.ts:305-310`: merges `routed_by_rule_id`, `routed_by_rule_name`, `routed_at` |
| 7 | User can see rule list ordered by priority with drag-to-reorder | VERIFIED | `RoutingRulesList.tsx` uses `DndContext` + `SortableContext(verticalListSortingStrategy)` + `arrayMove`; `useReorderRules` calls `rpc('update_routing_rule_priorities')` |
| 8 | Condition builder supports 6 condition types with live preview (IMP-05, IMP-08) | VERIFIED | `RoutingConditionBuilder.tsx:36-79`: 6 field configs (title, participant, source, duration, tag, date); `RulePreviewCount.tsx:72-74`: "This rule would match X of your last N calls" |
| 9 | "Rules apply to new imports only" is explicitly stated (IMP-09) | VERIFIED | `RoutingRuleSlideOver.tsx:261`: "Rules apply to new imports only. Existing calls are not re-routed." |
| 10 | Default destination is required before rule creation is possible (IMP-07) | VERIFIED | `RoutingRulesTab.tsx:82, 137, 182`: `hasDefault = !!routingDefault`, both CTAs `disabled={!hasDefault}` |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260228000003_create_import_routing_rules.sql` | DB schema with priority column, RLS, RPC | VERIFIED | 226 lines, both tables, 7 RLS policies, `update_routing_rule_priorities` SECURITY DEFINER RPC |
| `supabase/functions/_shared/routing-engine.ts` | `resolveRoutingDestination()`, 6 condition types | VERIFIED | 277 lines, exports `resolveRoutingDestination`, evaluates title/source/duration/participant/tag/date |
| `supabase/functions/_shared/connector-pipeline.ts` | `runPipeline()` with routing pre-step, `folder_id` on ConnectorRecord | VERIFIED | 344 lines, imports `resolveRoutingDestination`, routing block at line 274, `folder_id?: string` on interface |
| `callvault/src/types/routing.ts` | RoutingRule, RoutingCondition, RoutingDefault, RoutingDestination | VERIFIED | 43 lines, all 4 types defined |
| `callvault/src/hooks/useRoutingRules.ts` | 8 CRUD + reorder + default hooks | VERIFIED | 348 lines, all 8 hooks present with optimistic updates |
| `callvault/src/stores/routingRuleStore.ts` | Zustand slide-over state | VERIFIED | 37 lines, `isSlideOverOpen`, `activeRuleId`, `openSlideOver`, `closeSlideOver` |
| `callvault/src/components/import/RoutingRulesList.tsx` | DnD sortable list | VERIFIED | 103 lines, DndContext + SortableContext + verticalListSortingStrategy |
| `callvault/src/components/import/RoutingRuleCard.tsx` | Sortable card with drag handle, toggle, summary | VERIFIED | 182 lines, `useSortable`, `setActivatorNodeRef` handle isolation, enabled toggle |
| `callvault/src/components/import/DefaultDestinationBar.tsx` | Default destination bar with auto-save | VERIFIED | 65 lines, uses `useRoutingDefault` + `useUpsertRoutingDefault`, auto-saves via DestinationPicker onChange |
| `callvault/src/components/import/DestinationPicker.tsx` | Cascading workspace > folder select | VERIFIED | 103 lines, imports `useWorkspaces` + `useFolders`, cascading selection |
| `callvault/src/hooks/useRulePreview.ts` | Client-side preview, overlap check | VERIFIED | 226 lines, `useRulePreview` (useMemo client eval), `useOverlapCheck` (higher-priority rule detection) |
| `callvault/src/components/import/RoutingConditionBuilder.tsx` | 6 field types, AND/OR toggle, 5-condition limit | VERIFIED | 305 lines, 6 ROUTING_CONDITION_FIELDS, `MAX_CONDITIONS = 5`, AND/OR pill toggle |
| `callvault/src/components/import/RulePreviewCount.tsx` | IMP-08 text, expandable list, zero-match warning, overlap warning | VERIFIED | 144 lines, IMP-08 required text at line 72, zero-match amber warning, overlap blue info box |
| `callvault/src/components/import/RoutingRuleSlideOver.tsx` | Fixed-position slide-over, IMP-09 text, create/edit modes | VERIFIED | 331 lines, fixed z-50, motion/react spring, IMP-09 at line 261, create/edit mode branching |
| `callvault/src/components/import/RoutingRulesTab.tsx` | Full rules tab with empty state, IMP-07 gate, slide-over | VERIFIED | 198 lines, DefaultDestinationBar + RoutingRulesList + guided empty state + RoutingRuleSlideOver |
| `callvault/src/components/import/RoutingTraceBadge.tsx` | Routed by badge with Popover | VERIFIED | 105 lines, reads `routed_by_rule_name`, renders null when absent, Radix UI Popover |
| `callvault/src/routes/_authenticated/import/index.tsx` | Import Hub with Sources/Rules tabs | VERIFIED | Imports `RoutingRulesTab`, `activeTab` state, Sources/Rules conditional branches at lines 354/476 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `connector-pipeline.ts` | `routing-engine.ts` | `import resolveRoutingDestination` | WIRED | Line 11: `import { resolveRoutingDestination } from './routing-engine.ts'` |
| `routing-engine.ts` | `import_routing_rules` table | `supabase.from('import_routing_rules')` | WIRED | Line 73: `.from('import_routing_rules')` with `.eq('bank_id')` and `.order('priority')` |
| `connector-pipeline.ts` | `import_routing_defaults` table | `supabase.from('import_routing_defaults')` | WIRED | Line 314: fallback query for default destination |
| `useRoutingRules.ts` | `import_routing_rules` table | Supabase query | WIRED | Lines 45, 116, 126, 176, 210, 241 — all CRUD operations |
| `useRoutingRules.ts` | `update_routing_rule_priorities` RPC | `supabase.rpc(...)` | WIRED | Line 299: `.rpc('update_routing_rule_priorities', { p_bank_id, p_rule_ids })` |
| `RoutingRulesList.tsx` | `@dnd-kit/sortable` | SortableContext + useSortable + arrayMove | WIRED | Lines 17-29 imports; node_modules verified INSTALLED |
| `DestinationPicker.tsx` | `useWorkspaces` + `useFolders` | Hook imports | WIRED | Lines 15-16 imports, lines 42-43 hook calls |
| `RulePreviewCount.tsx` | `useRulePreview.ts` | `useRulePreview` hook | WIRED | `RoutingRuleSlideOver.tsx:127` calls `useRulePreview(form.conditions, form.logicOperator)` and passes result to `RulePreviewCount` |
| `useRulePreview.ts` | `recordings` table | `supabase.from('recordings')` | WIRED | Line 49: `.from('recordings').select(...)...limit(20)` |
| `RoutingRuleSlideOver.tsx` | `RoutingConditionBuilder.tsx` | Renders inside form | WIRED | Line 291: `<RoutingConditionBuilder .../>` |
| `RoutingRuleSlideOver.tsx` | `useCreateRule` / `useUpdateRule` | Hook calls | WIRED | Lines 72-73 imports, lines 153/162: `createRule.mutate` / `updateRule.mutate` |
| `RoutingRulesTab.tsx` | `RoutingRulesList.tsx` | Renders rule list | WIRED | Line 121: `<RoutingRulesList .../>` |
| `RoutingRulesTab.tsx` | `RoutingRuleSlideOver.tsx` | Always rendered | WIRED | Line 221: `<RoutingRuleSlideOver />` |
| `RoutingTraceBadge.tsx` | `source_metadata.routed_by_rule_name` | Reads routing trace | WIRED | Lines 57-61: extracts `routed_by_rule_name` from `sourceMetadata`, renders null when absent |
| `import/index.tsx` | `RoutingRulesTab.tsx` | Tab rendering | WIRED | Line 20 import, line 477: `<RoutingRulesTab />` in Rules tab branch |
| `folders/$folderId.tsx` | `RoutingTraceBadge.tsx` | Call row integration | WIRED | Line 14 import, lines 283-285: renders `<RoutingTraceBadge sourceMetadata={...}/>` in call rows |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| IMP-04: User can create import routing rule that auto-assigns calls | SATISFIED | Full create flow in `RoutingRuleSlideOver`, applied in `runPipeline()` |
| IMP-05: 5+ condition types | SATISFIED | 6 types: title, participant, source, duration, tag, date |
| IMP-06: First-match-wins priority, drag to reorder | SATISFIED | Routing engine loops by priority ASC; `RoutingRulesList` + `useReorderRules` RPC |
| IMP-07: Default destination required when creating rules | SATISFIED | `hasDefault = !!routingDefault`, both CTAs `disabled={!hasDefault}` |
| IMP-08: Rule preview shows "This rule would match X of your last 20 calls" | SATISFIED | Exact text in `RulePreviewCount.tsx:72-74`, evaluated client-side with no server round trips |
| IMP-09: "Rules apply to new imports only" explicitly stated | SATISFIED | Banner in `RoutingRuleSlideOver.tsx:261` |
| IMP-10: Rule priority stored from first migration | SATISFIED | `priority INTEGER NOT NULL DEFAULT 0` in the migration; compound index `(bank_id, priority)` |

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments found in key files. No stub return patterns in components. TypeScript compilation passes with zero errors.

The only `return null` found in `DefaultDestinationBar.tsx:27` is a correct guard (`if (!activeOrgId) return null`) — not a stub.

---

### Human Verification Required

#### 1. Sources/Rules Tab Navigation + Sources Tab Regression

**Test:** Navigate to Import Hub at `/import`. Verify two tabs appear labeled "Sources" and "Rules". Click Sources tab.
**Expected:** Sources tab renders all existing source cards exactly as before — no regression. Rules tab renders `DefaultDestinationBar` with amber prompt to set default destination.
**Why human:** Visual tab layout and regression check require browser rendering.

#### 2. Default Destination Auto-Save and IMP-07 Gate

**Test:** In the Rules tab, use the `DefaultDestinationBar` to select a workspace from the left select. Observe the folder select. Select a folder. Observe any toasts. Then observe the CTA button state.
**Expected:** Toast "Default destination updated" fires on selection change (no Save button). "Create your first rule" button transitions from disabled/muted to enabled.
**Why human:** Auto-save timing, toast appearance, and button enabled-state transition require live interaction.

#### 3. Rule Creation Flow — Condition Builder, Live Preview, Save

**Test:** Click "Create your first rule". In the slide-over: enter rule name "Test Rule", change the condition to Title contains "review". Observe the preview section. Click "See matching calls". Add a second condition and observe the AND/OR toggle. Select a destination. Click "Create rule".
**Expected:** Slide-over opens from right with spring animation. "Rules apply to new imports only" banner is visible. Preview updates immediately showing "This rule would match X of your last N calls". Expanding "See matching calls" shows call titles. AND/OR toggle pill appears between conditions. After save: toast "Rule created", slide-over closes, card appears in list.
**Why human:** Spring animation, real-time preview updates, and end-to-end save flow require browser interaction.

#### 4. Drag-to-Reorder Persistence (IMP-06)

**Test:** Create a second rule. Drag the second rule above the first using the drag handle (the grid icon on the left). Refresh the page.
**Expected:** Cards reorder immediately on drag (optimistic). After page refresh the new order is preserved — the dragged rule remains at the top.
**Why human:** Drag interaction and refresh-persistence of DB priority update cannot be verified statically.

#### 5. Enable/Disable Toggle Visual State

**Test:** Click the toggle switch on a rule card to disable it. Observe visual changes. Re-enable it.
**Expected:** Disabled rule shows `opacity-60` and the rule name has strikethrough text. Re-enabling restores full opacity and removes strikethrough. The change persists across page refresh.
**Why human:** CSS opacity/strikethrough rendering and persistence require browser visual check.

---

### Gaps Summary

No gaps found. All 10 observable truths verified, all 17 artifacts confirmed as substantive and wired, all 16 key links confirmed connected. TypeScript compiles with zero errors. No placeholder/stub patterns detected.

The remaining 5 human verification items cover visual, animation, and real-time behavior that grep cannot substitute for — they are not gaps, they are browser-required checks.

---

_Verified: 2026-02-28T12:44:43Z_
_Verifier: Claude (gsd-verifier)_
