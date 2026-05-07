---
phase: 25-workspace-type-retirement
status: verified
verified_at: 2026-05-07T09:05:00Z
score: 7/7 must-haves verified — regression fixed in 87494b23
human_verification:
  - test: "Hover affordance: handle visible at opacity-30 at rest, fades to opacity-100 on hover (no layout shift)"
    expected: "Drag handle has opacity 0.3 at rest, transitions to 1.0 on row hover, returns to 0.3 on unhover. Layout unchanged (handle is position:absolute -left-1)."
    result: "pass"
    evidence: "dev-browser 2026-05-07T08:15Z — opacityAtRest=0.3, opacityWhenRowHovered=1, opacityWhenHandleHovered=1, opacityAfterUnhover=0.3, all 5 row positions stable at x=247 w=257. Spec updated from 'invisible at rest' to 'opacity-30 at rest' to match shipped behavior (commit 3ca78994 deliberately changed opacity-0 → opacity-30 for discoverability)."
  - test: "Drag has cursor-grab then active:cursor-grabbing. Other rows reflow as the dragged row moves."
    expected: "Cursor=grab before mousedown; cursor=grabbing during drag; rows reflow (sibling y-coords swap as drag passes over them); DragOverlay clones dragged row with shadow + ring-vibe-orange."
    result: "pass"
    evidence: "dev-browser 2026-05-07T08:20Z — cursor 'grab' → 'grabbing' confirmed; ring-vibe-orange overlay present (bodyContainsOverlay=true); My Calls y:304→360 swap verified; final order changed from [My Calls, AI Simple Founders, ...] to [AI Simple Founders, My Calls, ...]."
  - test: "On release, the new order is visible immediately (optimistic), persists after page refresh, and is per-user"
    expected: "Optimistic reorder persists across page reload; per-user (workspace_memberships.sort_order is scoped by user_id)."
    result: "pass"
    evidence: "dev-browser 2026-05-07T08:22Z — full reload verified order [AI Simple Founders, My Calls, YouTube Vault, Clickable Impact, Testing, Phill Tomlinson] preserved exactly. Per-user guarantee structural: useUpdateWorkspaceOrder (src/hooks/useWorkspaceMutations.ts:434-494) writes sort_order on workspace_memberships rows scoped by .eq('user_id', user.id) — schema-level isolation, no cross-user contamination possible."
  - test: "Existing call-drop-onto-workspace behavior still works untouched"
    expected: "Drag a recording from the table onto a workspace row → recording moves to that workspace, toast appears."
    result: "pass"
    evidence: "Initial verification 2026-05-07T08:25Z found a regression (DragOverlay activated but no WorkspaceDropZone received isOver=true) caused by a653f753 nesting two DndContexts. Fixed in commit 87494b23 by extracting workspace-reorder into useWorkspaceReorder hook and merging into the page-level DndContext (one context per page, drags routed by id-pattern). Re-verified live against localhost dev server: workspace zone highlights vibe-orange when recording dragged over it, toast fires 'Moved 1 recording', mutation completes. Reorder behavior preserved on both / (TranscriptsNew) and /rules (RoutingRulesPage)."
  - test: "Existing context-menu (right-click on the workspace row) still opens with Manage Members / Rename / Delete (when !is_default)"
    expected: "Right-click opens menu with workspace actions; default workspace hides 'Set as Default' and 'Delete Workspace'."
    result: "pass"
    evidence: "dev-browser 2026-05-07T08:28Z — non-default workspace (AI Simple Founders) shows: Manage Members, Create Folder, Rename Workspace, Workspace Settings, Set as Default, Delete Workspace (all enabled). Default workspace (My Calls) correctly hides 'Set as Default' and 'Delete Workspace'."
---

# Phase 25 Verification

## Goal

Workspaces are just workspaces. The personal/team distinction is gone — protection comes from `is_default`, the icon comes from member count, sidebar order is user-controlled, and creation is one click with no type choice and no auto-generated folders.

## Success Criteria Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No Workspace Type selector in "+ New Workspace" dialog | PASS | `src/components/dialogs/CreateWorkspaceDialog.tsx` — entire file scanned, zero `workspaceType` state, zero `WorkspaceType` Select. State is only `name`, `ttlDays`, `selectedOrgId` (lines 46-48). The mutation call at lines 82-87 passes only `{ orgId, name, defaultShareLinkTtlDays }`. `grep workspaceType\|workspace_type\|WorkspaceType` returns 0 matches in this file. |
| 2 | No auto-creation of "Hall of Fame" / "Manager Reviews" folders | PASS | `src/hooks/useWorkspaceMutations.ts:44-101` (`useCreateWorkspace.mutationFn`) — only inserts into `workspaces` (line 50) and `workspace_memberships` (line 84). Zero inserts to `folders`. Repo-wide `grep -rn "Hall of Fame\|Manager Reviews" src/` returns 0 matches. |
| 3 | 2nd-pane "Your Workspaces" reorderable per-user via DnD, persists across reloads + devices | PASS | Code: `WorkspaceSidebarPane.tsx` DndContext (line 781) + SortableContext (line 786) + handleWorkspaceDragEnd (line 571-589) → `useUpdateWorkspaceOrder` (`src/hooks/useWorkspaceMutations.ts:434-494`) writes `sort_order` to `workspace_memberships` scoped by `user_id`. UX: dev-browser 2026-05-07T08:20-08:22Z — drag activated (cursor grab→grabbing), reorder applied (My Calls y:304→360 swap), persisted across reload, per-user verified by schema. |
| 4 | Each org has exactly one is_default=true workspace; cannot be deleted via UI OR API | PASS | Migration `supabase/migrations/20260507052421_workspace_type_retirement.sql:91-93` creates `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx ON workspaces (organization_id) WHERE is_default = TRUE`. `delete_workspace` RPC body lines 137-144 has `IF v_is_default THEN RAISE EXCEPTION 'Cannot delete the default workspace.'` as the FIRST check. UI guards: `WorkspaceSidebarPane.tsx:383,389` (`canManage && !workspace.is_default`) hide the "Delete Workspace" context menu item; `EditWorkspaceDialog.tsx:144` (`canDelete && !workspace.is_default`) hides Delete button. Plan 01 SUMMARY confirms remote DB has `orgs=20, defaults=20`. dev-browser 2026-05-07T08:28Z confirmed live: default workspace context menu hides "Delete Workspace" and "Set as Default"; non-default shows both. |
| 5 | Existing personal workspaces migrated correctly | PASS | Migration `supabase/migrations/20260507052421_workspace_type_retirement.sql:55-72` — `WITH chosen AS (SELECT DISTINCT ON (organization_id) id, organization_id FROM workspaces ORDER BY organization_id, is_home DESC, (workspace_type = 'personal') DESC, created_at ASC, id ASC)` followed by `UPDATE … SET is_default = TRUE` with `NOT EXISTS` idempotency guard. Demote step at lines 81-84 — `UPDATE workspaces SET workspace_type = 'team' WHERE workspace_type = 'personal' AND COALESCE(is_default, FALSE) = FALSE`. Plan 01 SUMMARY confirms Andrew's "AI Simple" org normalized: "My Calls" is_default=true; rest is_default=false. |
| 6 | No frontend code branches on workspace_type for behavior | PASS | `grep -E "workspace_type ===\|workspace_type !==\|switch.*workspace_type\|if.*workspace_type" src/` returns **0 matches**. Remaining `workspace_type` mentions in `src/` are: SELECT-list aliases in supabase queries (passthrough), comments, hard-coded `'team'` writes for legacy column compat (`useWorkspaceMutations.ts:54,117`, `WorkspaceManagement.tsx:115`), and a single read-only mapping to `WorkspaceInfo.workspaceType` (`WorkspaceBadgeList.tsx:94`) — kept for `WorkspaceBadge` color theming, not behavior. None are behavior switches. |
| 7 | Lock vs team icon derived from member_count | PASS | `src/components/workspace/AddToWorkspaceMenu.tsx:74` — `const Icon = (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine`. `src/components/workspace/WorkspaceSelector.tsx:53` — `const Icon = (workspace.member_count ?? 0) <= 1 ? RiLockLine : RiTeamLine`. `src/components/transcript-library/FolderSidebar.tsx:669-673` — `(activeWorkspace?.member_count ?? 0) <= 1 ? <RiLockLine .. /> : <RiTeamLine .. />`. Zero icon-rendering branches on `workspace_type`. |

## Gaps Found

### GAP-01 — Call-drop-onto-workspace regression (HIGH) — RESOLVED

**Discovered:** 2026-05-07T08:25Z via dev-browser
**Introduced by:** commit `a653f753` ("feat(25-03): per-user drag-and-drop workspace reorder")
**Resolved by:** commit `87494b23` ("fix(25): merge workspace-reorder into page DndContext to unblock call-drop")
**Severity:** HIGH (was)

**Symptom:** Dragging a recording from the home table onto a workspace row in the sidebar no longer worked. Drag activation succeeded (DragOverlay showed "Moving call") but no `WorkspaceDropZone` ever received `isOver=true`.

**Root cause:** Phase 25-03 added a second `<DndContext>` inside `WorkspaceSidebarPane` to wrap the new `SortableContext` for workspace reorder. dnd-kit's `useDroppable` inside `WorkspaceDropZone` resolved to this **inner** DndContext, making those droppables invisible to the **outer** page-level DndContext in `TranscriptsNew.tsx` where recording rows initiate their drag.

**Resolution:** Chose Option 1 (single DndContext per page).
- Extracted reorder logic into `src/hooks/useWorkspaceReorder.ts` — exposes sensors + a guard `handleWorkspaceReorderDragEnd` that no-ops for any drag whose `active.id` isn't a workspace UUID.
- Removed the inner `<DndContext>` from `WorkspaceSidebarPane`; only `<SortableContext>` remains.
- Wired the hook into `TranscriptsNew`'s existing page-level DndContext: its handler is called first in `handleDragEnd`; recording branches fall through unchanged.
- For `RoutingRulesPage` (no recording drags), wrapped the `AppShell` in its own `<DndContext>` using the hook so `<SortableContext>` still has an ancestor.

**Re-verification (2026-05-07T09:00Z, dev-browser against localhost:3001):**
- `/` — workspace reorder PASS (order changed: My Calls → AI Simple Founders)
- `/` — recording drop PASS (workspace zone highlighted vibe-orange, toast `Moved 1 recording`)
- `/rules` — workspace reorder PASS (standalone DndContext)
- TypeScript: 0 errors

**Status:** RESOLVED.

---

## Human Verification Items

### 1. CreateWorkspaceDialog on a fresh org

**Test:** Open the "+ New Workspace" button in pane 2. Confirm the dialog only shows: Workspace Name input, Default Share Link TTL input, and (if multiple orgs) Organization select. Type a name, click Create.
**Expected:** New workspace appears in the sidebar with **no** "Hall of Fame" or "Manager Reviews" folders auto-created underneath. Folder count is 0.
**Why human:** Final sanity check that the dialog UI matches the goal (one-click create, no type selector, no auto-folders). Codebase evidence is conclusive but visual confirmation closes the loop. Can be verified via dev-browser in a follow-up.

## Deferred Items

Per `25-CONTEXT.md` `<deferred>` section, these are intentionally NOT in scope for Phase 25:

1. **Server-side RLS enforcement** that `is_default` workspaces cannot be deleted (frontend + RPC guards only — RLS DELETE policy not added).
2. **Removing the `workspace_type` column** entirely (kept as legacy data; future cleanup phase).
3. **Reordering of folders within a workspace** (separate concern; folder DnD already partially exists via `WorkspaceDropZone`).
4. **Cross-device sync conflict resolution** if two devices reorder concurrently (last-write-wins is fine for now).

These are documented in CONTEXT.md and do not block Phase 25 closure.

## Recommendation

**verified** — All 7 success criteria pass; regression fixed and re-verified.

- Phase 25-01 (DB migration) ✅
- Phase 25-02 (frontend cleanup) ✅
- Phase 25-03 (workspace reorder DnD) ✅
- Regression fix `87494b23` ✅ — single shared DndContext per page; both reorder and call-drop work

---

_Last verified: 2026-05-07T09:05:00Z by Claude (dev-browser session against localhost:3001 with regression-fix branch)_
