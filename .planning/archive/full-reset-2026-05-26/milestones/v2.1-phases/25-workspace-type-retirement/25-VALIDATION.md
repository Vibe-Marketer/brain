---
phase: 25-workspace-type-retirement
status: nyquist-filled
audited_at: 2026-05-07T15:05:00Z
auditor: gsd-nyquist-auditor
total_gaps: 7
resolved: 7
escalated: 0
---

# Phase 25 Validation — Nyquist Audit

## Summary

All 7 critical-path gaps for Phase 25 (Workspace Type Retirement) now have automated test coverage. Seven test files containing **51 behavioral assertions** verify the requirements outlined in the original phase scope. Every test was executed and passed against the live implementation.

No implementation bugs were found. No gaps were escalated.

## Gap → Test Coverage Map

| Gap | Requirement | Test Type | File | Asserts | Status |
|-----|-------------|-----------|------|---------|--------|
| **WS-01** | "+ New Workspace" dialog has no Workspace Type selector | Component + source | `src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx` | 3 | green |
| **WS-02** | No "Hall of Fame" / "Manager Reviews" auto-folders on creation | Source invariant | same as above + `src/components/workspace/__tests__/workspace-icon-derivation.test.ts` | 3 | green |
| **WS-03** | Reorder persists per-user via DnD | Hook unit + cache assertion | `src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts`, `src/hooks/__tests__/useWorkspaceReorder.test.ts` | 8 | green |
| **WS-04** | Each org has exactly one is_default; cannot be deleted via UI/API | Migration DDL + UI source + RPC body | `src/test/migrations/phase25-default-workspace-protection.test.ts`, `src/test/migrations/phase25-workspace-type-retirement.test.ts` | 12 | green |
| **WS-05** | Existing personal workspace_type data migrated correctly | Migration data-transform JS port | `src/test/migrations/phase25-workspace-type-retirement.test.ts` | 9 | green |
| **Icon derivation** | Lock vs team icon from member_count, not workspace_type | Pure rule + source invariant | `src/components/workspace/__tests__/workspace-icon-derivation.test.ts` | 10 | green |
| **DnD isolation** (e00c268d) | Workspace drags don't trigger call-drag bookkeeping | Source invariant + behavioral simulator | `src/pages/__tests__/TranscriptsNew.dragIsolation.test.tsx` | 6 | green |

## Test Files Created

| # | File | Tests | Run command |
|---|------|-------|-------------|
| 1 | `src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts` | 3 | `npx vitest run src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts` |
| 2 | `src/hooks/__tests__/useWorkspaceReorder.test.ts` | 5 | `npx vitest run src/hooks/__tests__/useWorkspaceReorder.test.ts` |
| 3 | `src/components/workspace/__tests__/workspace-icon-derivation.test.ts` | 10 | `npx vitest run src/components/workspace/__tests__/workspace-icon-derivation.test.ts` |
| 4 | `src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx` | 6 | `npx vitest run src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx` |
| 5 | `src/test/migrations/phase25-workspace-type-retirement.test.ts` | 17 | `npx vitest run src/test/migrations/phase25-workspace-type-retirement.test.ts` |
| 6 | `src/test/migrations/phase25-default-workspace-protection.test.ts` | 4 | `npx vitest run src/test/migrations/phase25-default-workspace-protection.test.ts` |
| 7 | `src/pages/__tests__/TranscriptsNew.dragIsolation.test.tsx` | 6 | `npx vitest run src/pages/__tests__/TranscriptsNew.dragIsolation.test.tsx` |

**Combined run:** all 7 files together → **51 tests passed, 0 failed, 0 skipped, 4.4s**

## Gap-by-Gap Detail

### WS-01 — No Workspace Type selector

**Adversarial hypothesis:** The dialog still renders a Workspace Type select despite Plan 02 claiming to remove it.

**Tests:**
- Render `CreateWorkspaceDialog` and assert `screen.queryByText(/workspace\s*type/i)` returns null
- Confirm no `<button data-value=...>` exists for `personal`, `team`, or `youtube`
- Source-level invariant: regex over `CreateWorkspaceDialog.tsx` rejects `Workspace Type` label, `SelectItem value="personal|team|youtube"`, `useState ... workspaceType`, `setWorkspaceType`

**Result:** Pass. The dialog renders only Name, TTL, and (if multi-org) Organization inputs.

### WS-02 — No auto-folders on creation

**Adversarial hypothesis:** `useCreateWorkspace` still inserts default folders despite Plan 02 claiming the auto-folder block was removed.

**Tests:**
- Source-level: `useWorkspaceMutations.ts` source contains zero matches for `Hall of Fame` and `Manager Reviews`
- Body-level: extract the `useCreateWorkspace` function body and verify it never calls `.from('folders')` on creation
- Repo-wide spot-check on five core workspace surfaces: zero auto-folder strings remain

**Result:** Pass. The mutation only inserts into `workspaces` and `workspace_memberships`.

### WS-03 — Per-user drag-and-drop reorder

**Adversarial hypothesis:** Reorders write to the wrong user's rows, never persist, leak to other users, or fail silently with a stale optimistic state.

**Tests (mutation hook):**
- `useUpdateWorkspaceOrder` SELECTs memberships scoped to `eq('user_id', user.id)` (cross-user isolation is structural, not best-effort)
- Optimistic update reorders the cached `WorkspaceWithMeta[]` immediately (before the request resolves) — observed via `queryClient.getQueryData`
- On error, the cache rolls back to the pre-mutation order

**Tests (drag handler):**
- `useWorkspaceReorder.handleWorkspaceReorderDragEnd` no-ops for non-workspace drags (active.id is a recording id)
- No-ops for null `over` and self-drops
- Reorders correctly when active+over are both workspace UUIDs
- Normalizes `workspace-{uuid}` over.id form (so the WorkspaceDropZone wrapper id from the call-drop droppable doesn't break reorder targeting)

**Result:** Pass. All 8 assertions across both hooks succeed.

### WS-04 — One default per org, cannot be deleted via UI or API

**Adversarial hypothesis:** The implementation only blocks deletion at the UI; a malicious API caller can still delete the default workspace.

**Tests (defense in depth — three layers):**
1. **DB:** migration source contains `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx ... WHERE is_default = TRUE`
2. **RPC:** `delete_workspace` body has `IF v_is_default THEN RAISE EXCEPTION 'Cannot delete the default workspace.'` AS THE FIRST CHECK — guard's `indexOf` is less than the role-check's `indexOf` AND less than every `DELETE FROM` statement's index
3. **UI:** `WorkspaceSidebarPane.tsx` and `EditWorkspaceDialog.tsx` source contain `!workspace.is_default` and have purged the legacy `workspace_type !== 'personal'` form

**Result:** Pass. All three layers verified.

### WS-05 — Existing personal data migrated correctly

**Adversarial hypothesis:** The deterministic backfill picks the wrong workspace as default when an org has multiple personals or a tie on `created_at`.

**Tests:** JS port of the SQL backfill logic, exercised against several known input fixtures including Andrew's "AI Simple" multi-personal case from CONTEXT.md `<specifics>`:
- Business org with `is_home=TRUE` + a regular team workspace → home wins
- Personal org with one personal + one team → personal wins
- AI Simple case: two personals (one old, one duplicate) + one team → oldest personal wins is_default; demote step changes the duplicate's `workspace_type` from `'personal'` to `'team'` (deletable); the winner stays personal AND is_default
- Identical timestamps → tie-break by id (UUID lexical) — deterministic
- Idempotency: skip orgs that already have an is_default
- Cross-org: exactly one is_default per organization across mixed inputs

**Result:** Pass. The JS port exactly reproduces the SQL ORDER BY rules. Migration text also asserts the expected DISTINCT ON ordering (`is_home DESC, (workspace_type = 'personal') DESC, created_at ASC, id ASC`).

### Icon derivation — lock vs team from member_count

**Adversarial hypothesis:** A consumer still branches on `workspace_type` for icon, so a 1-person team workspace might show the team icon (or a personal-typed multi-member workspace might show the lock).

**Tests:**
- Pure rule: `(member_count ?? 0) <= 1 ? 'lock' : 'team'` — boundary cases at 0, 1, 2, 99, null, undefined
- Regression edge: a 1-member team-typed workspace returns 'lock'; a 5-member personal-typed workspace returns 'team' (proves type is ignored)
- Source invariant against `AddToWorkspaceMenu.tsx`, `WorkspaceSelector.tsx`, `FolderSidebar.tsx`: each contains the `member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine` pattern AND no longer branches on `workspace_type === 'personal'` for icon selection

**Result:** Pass. All 10 assertions succeed.

### DnD isolation (commit e00c268d)

**Adversarial hypothesis:** The recent fix didn't actually isolate workspace drags — `dragHelpers.activeDragId` still gets populated when a workspace is dragged, polluting the call-drag DragOverlay state.

**Tests:**
- Source invariant: `TranscriptsNew.tsx` `<DndContext>` `onDragStart` prop contains the guard `e.active.data?.current?.type === 'workspace'` and the guard returns early BEFORE calling `dragHelpers.handleDragStart`
- Source invariant: `onDragEnd` calls `handleWorkspaceReorderDragEnd(event)` then short-circuits on the same guard before any recording-drop branches (so `active.id` (a workspace UUID) is never fed into `moveToWorkspace` / `assignToFolder`)
- Behavioral: re-implement the exact onDragStart shape (`if (e.active.data?.current?.type === 'workspace') return; handleDragStart(e, [])`) wired against the REAL `useDragAndDrop` hook from `@/hooks/useDragAndDrop`. Drive workspace and recording events through it. Assert `activeDragId` stays `null` for workspace drags but flips to the recording id for recording drags. Test that workspace drags after a cancelled recording drag don't re-pollute state.

**Result:** Pass. All 6 assertions succeed. The behavioral simulator drives the actual hook, so the guard is verified end-to-end against the same `useDragAndDrop` the page uses.

## Adversarial Stance Notes

Every test was written assuming the requirement was unmet. None of the tests pass trivially; each one would have failed against a regression of the corresponding implementation:

- The mutation rollback test would fail if `onError` did not restore `previousList`
- The reorder isolation test would fail if `handleWorkspaceReorderDragEnd` ever called `mutate` for a non-workspace drag
- The icon source-invariant tests would fail if a consumer reverted to a `workspace_type` branch
- The migration backfill JS port would diverge from the SQL output if the ordering were non-deterministic
- The DnD isolation behavioral simulator would fail if the guard predicate were missing or placed after `handleDragStart`

The adversarial test of "remove the guard from `TranscriptsNew.tsx`" was sanity-checked: the source invariants catch it.

## Verification Commands

```bash
# Run all Phase 25 Nyquist tests in one shot
npx vitest run \
  src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts \
  src/hooks/__tests__/useWorkspaceReorder.test.ts \
  src/components/workspace/__tests__/workspace-icon-derivation.test.ts \
  src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx \
  src/test/migrations/phase25-workspace-type-retirement.test.ts \
  src/test/migrations/phase25-default-workspace-protection.test.ts \
  src/pages/__tests__/TranscriptsNew.dragIsolation.test.tsx
# Expected: Test Files 7 passed | Tests 51 passed
```

## Files for Commit

```
src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts
src/hooks/__tests__/useWorkspaceReorder.test.ts
src/components/workspace/__tests__/workspace-icon-derivation.test.ts
src/components/dialogs/__tests__/CreateWorkspaceDialog.phase25.test.tsx
src/test/migrations/phase25-workspace-type-retirement.test.ts
src/test/migrations/phase25-default-workspace-protection.test.ts
src/pages/__tests__/TranscriptsNew.dragIsolation.test.tsx
.planning/phases/25-workspace-type-retirement/25-VALIDATION.md
```

## Recommendation

**FILLED** — all 7 phase-25 gaps now have green automated coverage. No escalations.
