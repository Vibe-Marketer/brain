---
phase: 25-workspace-type-retirement
status: human_needed
verified_at: 2026-05-07T00:00:00Z
score: 7/7 must-haves verified (1 requires human spot-check on real DnD UX)
---

# Phase 25 Verification

## Goal

Workspaces are just workspaces. The personal/team distinction is gone — protection comes from `is_default`, the icon comes from member count, sidebar order is user-controlled, and creation is one click with no type choice and no auto-generated folders.

## Success Criteria Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No Workspace Type selector in "+ New Workspace" dialog | PASS | `src/components/dialogs/CreateWorkspaceDialog.tsx` — entire file scanned, zero `workspaceType` state, zero `WorkspaceType` Select. State is only `name`, `ttlDays`, `selectedOrgId` (lines 46-48). The mutation call at lines 82-87 passes only `{ orgId, name, defaultShareLinkTtlDays }`. `grep workspaceType\|workspace_type\|WorkspaceType` returns 0 matches in this file. |
| 2 | No auto-creation of "Hall of Fame" / "Manager Reviews" folders | PASS | `src/hooks/useWorkspaceMutations.ts:44-101` (`useCreateWorkspace.mutationFn`) — only inserts into `workspaces` (line 50) and `workspace_memberships` (line 84). Zero inserts to `folders`. Repo-wide `grep -rn "Hall of Fame\|Manager Reviews" src/` returns 0 matches. |
| 3 | 2nd-pane "Your Workspaces" reorderable per-user via DnD, persists across reloads + devices | PASS (UX needs human) | `src/components/panes/WorkspaceSidebarPane.tsx`: `DndContext` (line 727), `SortableContext` (line 732), `useSortable` (line 465), `handleWorkspaceDragEnd` (line 526) → calls `useUpdateWorkspaceOrder.mutate({ orgId, pairs: reordered.map((w, i) => ({ workspaceId: w.id, sortOrder: i })) })` (line 535-538). `useUpdateWorkspaceOrder` (`src/hooks/useWorkspaceMutations.ts:434-494`) writes `sort_order` to `workspace_memberships` scoped by `auth.uid()` (line 447, 463). `useWorkspaces` (`src/hooks/useWorkspaces.ts:74,100-104`) selects `sort_order` and sorts ascending. `src/types/supabase.ts:3663,3671,3679` confirms `sort_order: number` on Row/Insert/Update of `workspace_memberships`. **DnD UX feel needs human eyes** — Plan 03 SUMMARY documents Playwright drag synthesis is unreliable for dnd-kit (clauderic/dnd-kit#261). |
| 4 | Each org has exactly one is_default=true workspace; cannot be deleted via UI OR API | PASS | Migration `supabase/migrations/20260507052421_workspace_type_retirement.sql:91-93` creates `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx ON workspaces (organization_id) WHERE is_default = TRUE`. `delete_workspace` RPC body lines 137-144 has `IF v_is_default THEN RAISE EXCEPTION 'Cannot delete the default workspace.'` as the FIRST check. UI guards: `WorkspaceSidebarPane.tsx:383,389` (`canManage && !workspace.is_default`) hide the "Delete Workspace" context menu item; `EditWorkspaceDialog.tsx:144` (`canDelete && !workspace.is_default`) hides Delete button. Plan 01 SUMMARY confirms remote DB has `orgs=20, defaults=20`. |
| 5 | Existing personal workspaces migrated correctly | PASS | Migration `supabase/migrations/20260507052421_workspace_type_retirement.sql:55-72` — `WITH chosen AS (SELECT DISTINCT ON (organization_id) id, organization_id FROM workspaces ORDER BY organization_id, is_home DESC, (workspace_type = 'personal') DESC, created_at ASC, id ASC)` followed by `UPDATE … SET is_default = TRUE` with `NOT EXISTS` idempotency guard. Demote step at lines 81-84 — `UPDATE workspaces SET workspace_type = 'team' WHERE workspace_type = 'personal' AND COALESCE(is_default, FALSE) = FALSE`. Plan 01 SUMMARY confirms Andrew's "AI Simple" org normalized: "My Calls" is_default=true; rest is_default=false. |
| 6 | No frontend code branches on workspace_type for behavior | PASS | `grep -E "workspace_type ===\|workspace_type !==\|switch.*workspace_type\|if.*workspace_type" src/` returns **0 matches**. Remaining `workspace_type` mentions in `src/` are: SELECT-list aliases in supabase queries (passthrough), comments, hard-coded `'team'` writes for legacy column compat (`useWorkspaceMutations.ts:54,117`, `WorkspaceManagement.tsx:115`), and a single read-only mapping to `WorkspaceInfo.workspaceType` (`WorkspaceBadgeList.tsx:94`) — kept for `WorkspaceBadge` color theming, not behavior. None are behavior switches. |
| 7 | Lock vs team icon derived from member_count | PASS | `src/components/workspace/AddToWorkspaceMenu.tsx:74` — `const Icon = (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine`. `src/components/workspace/WorkspaceSelector.tsx:53` — `const Icon = (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine`. `src/components/transcript-library/FolderSidebar.tsx:669-673` — `(activeWorkspace?.member_count ?? 0) <= 1 ? <RiLockLine .. /> : <RiTeamLine .. />`. Zero icon-rendering branches on `workspace_type`. |

## Gaps Found

None. All seven success criteria are met by codebase evidence:
- Migration `20260507052421_workspace_type_retirement.sql` lands the DB layer.
- Plan 02 commit `c750620e` decouples 18 frontend files from `workspace_type` behavior.
- Plan 03 commit `a653f753` wires `@dnd-kit/sortable` into the sidebar with optimistic + per-user persisted reorder.
- TypeScript baseline preserved: 84 pre-existing errors, 0 new.

## Human Verification Items

### 1. Drag-and-drop UX feel in the live sidebar

**Test:** Open the app at http://localhost:3001 (or production), navigate to an org with 2+ workspaces in pane 2, hover over a workspace row to reveal the small drag-grip on the left, then drag a workspace up/down past at least one neighbor. Release. Refresh the page.
**Expected:**
- Hover affordance: handle is invisible at rest, fades in on hover (no layout shift).
- Drag has `cursor-grab` then `active:cursor-grabbing`. Other rows reflow as the dragged row moves.
- On release, the new order is visible immediately (optimistic), persists after page refresh, and is per-user (incognito tab on a different account shows that user's order, not yours).
- Existing call-drop-onto-workspace behavior (drag a recording from the table onto a workspace row) still works untouched.
- Existing context-menu (right-click on the workspace row) still opens with Manage Members / Rename / Delete (when `!is_default`).
**Why human:** Plan 03 SUMMARY documents that dnd-kit's `PointerSensor` does not reliably respond to Playwright-synthesized pointer events (clauderic/dnd-kit#261). Structural Playwright assertions pass (handles render, hover affordance works, row click still selects), but final UX feel — the actual drag motion, optimistic reorder smoothness, persistence across reload, and cross-device per-user verification — requires a real human GUI session. dev-browser can drive this if available.

### 2. CreateWorkspaceDialog on a fresh org

**Test:** Open the "+ New Workspace" button in pane 2. Confirm the dialog only shows: Workspace Name input, Default Share Link TTL input, and (if multiple orgs) Organization select. Type a name, click Create.
**Expected:** New workspace appears in the sidebar with **no** "Hall of Fame" or "Manager Reviews" folders auto-created underneath. Folder count is 0.
**Why human:** Final sanity check that the dialog UI matches the goal (one-click create, no type selector, no auto-folders). Codebase evidence is conclusive but visual confirmation closes the loop.

## Deferred Items

Per `25-CONTEXT.md` `<deferred>` section, these are intentionally NOT in scope for Phase 25:

1. **Server-side RLS enforcement** that `is_default` workspaces cannot be deleted (frontend + RPC guards only — RLS DELETE policy not added).
2. **Removing the `workspace_type` column** entirely (kept as legacy data; future cleanup phase).
3. **Reordering of folders within a workspace** (separate concern; folder DnD already partially exists via `WorkspaceDropZone`).
4. **Cross-device sync conflict resolution** if two devices reorder concurrently (last-write-wins is fine for now).

These are documented in CONTEXT.md and do not block Phase 25 closure.

## Recommendation

**human_needed** — All 7 success criteria are met by codebase evidence. The phase is structurally complete:

- DB migration `20260507052421_workspace_type_retirement.sql` applied to remote (verified by Plan 01 SUMMARY).
- 18 frontend files cleanly decoupled from `workspace_type` (Plan 02 commit `c750620e`).
- Drag-and-drop sidebar reorder wired with optimistic update + per-user persistence (Plan 03 commit `a653f753`).
- 0 new TypeScript errors. 0 behavioral branches on `workspace_type`. 0 "Hall of Fame"/"Manager Reviews" references in `src/`.

**Two human spot-checks** are recommended before shipping:
1. Open the app, drag a workspace in pane 2, refresh — confirm order persists and feels right.
2. Open the "+ New Workspace" dialog, create one — confirm no type selector and no auto-folders.

Both are quick (under 60 seconds total) and close the gap between Playwright structural verification and real-user UX.
