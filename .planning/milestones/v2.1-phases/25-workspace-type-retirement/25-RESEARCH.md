# Phase 25: Workspace Type Retirement - Research

**Researched:** 2026-05-07
**Domain:** DB schema migration + frontend behavior decoupling + per-user sortable list
**Confidence:** HIGH

## Summary

CONTEXT.md decisions are sound and verified against the codebase. This phase has three discrete concerns that slice cleanly into three sequential plans: (1) DB migration to drop the `workspace_type` CHECK and add `sort_order` + the partial unique index for `is_default`; (2) frontend cleanup to remove every `workspace_type` behavior branch and replace it with `is_default` / `member_count` derivations; (3) drag-and-drop reorder UI that writes the new `sort_order` column.

**Primary recommendation:** Slice as `25-01 DB migration` -> `25-02 frontend type-decoupling + dialog cleanup` -> `25-03 drag-and-drop sidebar reorder`. All three plans are independently shippable. @dnd-kit/sortable v10 is already a dependency. The `tr_ensure_home_workspace` trigger does NOT need updating (it already creates Home with `is_home=true, workspace_type='team'` — the migration just retro-flags those existing Home workspaces with `is_default=true` and the trigger keeps creating new ones the same way; we just add an UPDATE inside it to also set `is_default=true`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-01 | "+ New Workspace" dialog has no Workspace Type selector | `CreateWorkspaceDialog.tsx:131-146` is the type selector to delete; `useCreateWorkspace.workspaceType` parameter must be defaulted internally and removed from the input. |
| WS-02 | No "Hall of Fame" / "Manager Reviews" auto-folders on workspace create | `useWorkspaceMutations.ts:79-97` is the auto-folder block to delete. Verified: this is the only place auto-folders are created. |
| WS-03 | 2nd-pane workspace list reorderable per-user, persists across reloads + devices | `@dnd-kit/sortable@10.0.0` confirmed in `package.json`. New `sort_order INT` on `workspace_memberships` provides per-user persistence (already a per-user table). `useWorkspaces.ts:86` query needs `.order('sort_order')` added. |
| WS-04 | Each org has exactly one `is_default=true`; cannot be deleted via UI or API | DB-level: partial UNIQUE index `(organization_id) WHERE is_default` enforces "at most one." Frontend: replace all `workspace_type !== 'personal'` delete-guards with `!is_default`. RLS-level enforcement is explicitly deferred per CONTEXT.md `<deferred>`. |
| WS-05 | Existing `workspace_type='personal'` data migrated; original Home -> `is_default=true`, duplicates -> regular | Backfill SQL: deterministic ranking by `is_home DESC, workspace_type='personal' DESC, created_at ASC` per org -> oldest one wins `is_default`. Andrew's "AI Simple" org has multiple personals (per CONTEXT.md `<specifics>`); migration normalizes them. |
| (implied) | No frontend code branches on `workspace_type` for behavior | 8 files reference `workspace_type`; mapped below in pitfall #1. |
| (implied) | Lock vs team icon derived from `member_count` | `WorkspaceWithMeta.member_count` is already populated by `useWorkspaces` query (line 100-103). No new data fetching needed. |
</phase_requirements>

## Schema Migration (exact SQL)

Filename: `supabase/migrations/20260508000000_workspace_type_retirement.sql`

```sql
-- Phase 25: Retire workspace_type as a behavior switch
BEGIN;

-- 1. Drop the CHECK constraint so future writes are unrestricted.
--    (Defined in 20260301000001_rename_vaults_to_workspaces.sql:46)
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_workspace_type_check;

-- 2. Add per-user sort_order to workspace_memberships
ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 3. Backfill sort_order: rank by created_at per user.
--    Tie-break by membership.id (UUID) for determinism when two memberships
--    share the same created_at timestamp (rare but possible — see pitfall #5).
WITH ranked AS (
  SELECT id,
         (ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY created_at ASC, id ASC
          ) - 1)::INT AS new_order
  FROM workspace_memberships
)
UPDATE workspace_memberships wm
SET sort_order = ranked.new_order
FROM ranked
WHERE wm.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_sort
  ON workspace_memberships (user_id, sort_order);

-- 4. Backfill is_default per org.
--    Rule: prefer is_home=true; else workspace_type='personal'; else oldest workspace.
--    Idempotent — only sets is_default if the org currently has none.
WITH chosen AS (
  SELECT DISTINCT ON (organization_id) id, organization_id
  FROM workspaces
  ORDER BY organization_id,
           is_home DESC,
           (workspace_type = 'personal') DESC,
           created_at ASC,
           id ASC  -- final tie-break for determinism
)
UPDATE workspaces w
SET is_default = TRUE
FROM chosen
WHERE w.id = chosen.id
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w2
    WHERE w2.organization_id = chosen.organization_id
      AND w2.is_default = TRUE
  );

-- 5. Demote duplicates: any workspace_type='personal' that is NOT the chosen
--    is_default becomes a regular deletable workspace. We change workspace_type
--    to 'team' so it falls out of any legacy `=  'personal'` checks. Per CONTEXT
--    decisions, this column is now legacy data only — no new code reads it.
UPDATE workspaces
SET workspace_type = 'team'
WHERE workspace_type = 'personal'
  AND COALESCE(is_default, FALSE) = FALSE;

-- 6. Enforce "exactly one default per org" at the DB level.
--    Partial UNIQUE index: `(organization_id) WHERE is_default = true`.
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx
  ON workspaces (organization_id)
  WHERE is_default = TRUE;

-- 7. Update the home-workspace trigger so newly-created orgs ALSO get is_default=TRUE
--    on their Home workspace. Existing trigger lives in
--    20260306000000_personal_organization_and_home.sql and 20260308120000 (search_path fix).
CREATE OR REPLACE FUNCTION public.ensure_home_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO workspaces (organization_id, name, workspace_type, is_home, is_default)
  VALUES (NEW.id, 'Home Workspace', 'team', TRUE, TRUE)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

COMMIT;
```

**Notes:**
- The `recordings` and other tables that reference `workspace_type='personal'` in legacy SECURITY DEFINER helpers (`migrate_fathom_call_to_recording`, `ensure_personal_organization`) are **legacy migration paths**, not RLS — they still work; they just migrate to whatever workspace happens to be flagged personal. Out of scope to rewrite.
- No `recordings.organization_id` re-scoping needed — recordings are org-scoped, not workspace-scoped.
- `is_default` already exists as a boolean column on `workspaces` (verified `src/types/supabase.ts:3673`); we are NOT adding the column, only enforcing uniqueness and backfilling.

## Drag-and-Drop Integration

**Library confirmed:** `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` all present in `package.json`. No new deps.

**Existing context:** `WorkspaceDropZone` in `WorkspaceSidebarPane.tsx:641` uses `useDroppable` from `@dnd-kit/core` and works inside the page-level `DndContext` from `pages/TranscriptsNew.tsx:294`. That `DndContext` is for call-to-folder/workspace drag, NOT sortable. We need a **separate, nested `SortableContext`** wrapping just the workspace list, because:
- The page-level DndContext exists only on `TranscriptsNew`, but `WorkspaceSidebarPane` is rendered globally — so we can't rely on it.
- Sortable needs a different sensor activation distance and a different drag-end handler.

**Pattern (sketched, not for direct implementation):**

```tsx
// WorkspaceSidebarPane.tsx — replaces the .map() at line 640
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableWorkspaceItem({ workspace, ...props }: { workspace: WorkspaceWithMeta }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: workspace.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <WorkspaceDropZone workspaceId={workspace.id}>
        <WorkspaceListItem workspace={workspace} {...props} />
      </WorkspaceDropZone>
    </div>
  )
}

// In WorkspaceSidebarPane:
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
)
const updateOrder = useUpdateWorkspaceOrder()

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIdx = workspaces.findIndex(w => w.id === active.id)
  const newIdx = workspaces.findIndex(w => w.id === over.id)
  const reordered = arrayMove(workspaces, oldIdx, newIdx)
  updateOrder.mutate({
    orgId: activeOrgId,
    pairs: reordered.map((w, i) => ({ workspaceId: w.id, sortOrder: i })),
  })
}

return (
  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={workspaces.map(w => w.id)} strategy={verticalListSortingStrategy}>
      {workspaces.map(ws => <SortableWorkspaceItem key={ws.id} workspace={ws} ... />)}
    </SortableContext>
  </DndContext>
)
```

**Critical interaction:** the existing `WorkspaceDropZone` uses `useDroppable` and only takes effect when there is an outer `DndContext`. The new `DndContext` for sortable will satisfy that — but the drop-zone's `onDragEnd` for "drop a call onto a workspace" (handled in `TranscriptsNew.tsx`) lives in a DIFFERENT DndContext on a different page. So there is no conflict: when on `TranscriptsNew`, both contexts are active (call-drag is outer, sort is inner — sortable should NOT respond to non-workspace drag IDs because the items array is workspace-IDs only). Verify by checking that `useSortable({ id: workspace.id })` only activates on its own draggable handle.

**Recommendation:** Use a small drag handle (a dotted-grip icon at the left of each `WorkspaceListItem`) to attach the `listeners` to, instead of the entire row. This avoids fighting with the existing context-menu and click-to-select behavior on the workspace row.

## Mutation Hook Pattern (sketch)

Add to `useWorkspaceMutations.ts`. Follows the same `onMutate -> snapshot -> setQueryData -> onError rollback` pattern as `useUpdateWorkspace`.

```ts
// ─── Update Workspace Order ─────────────────────────────────────────────

export interface UpdateWorkspaceOrderInput {
  orgId: string
  pairs: Array<{ workspaceId: string; sortOrder: number }>
}

export function useUpdateWorkspaceOrder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateWorkspaceOrderInput) => {
      if (!user) throw new Error('Not authenticated')
      // Resolve workspace_id -> the current user's membership.id, then upsert sort_order.
      // Two-step: SELECT memberships, then bulk UPDATE via Promise.all of single updates,
      // OR call a server-side RPC `reorder_workspace_memberships(p_pairs jsonb)`.
      // For v1: client-side N updates (N <= ~10 typical).
      const { data: memberships, error: selErr } = await supabase
        .from('workspace_memberships')
        .select('id, workspace_id')
        .eq('user_id', user.id)
        .in('workspace_id', input.pairs.map(p => p.workspaceId))
      if (selErr) throw selErr

      const membershipByWs = new Map(memberships.map(m => [m.workspace_id, m.id]))

      await Promise.all(input.pairs.map(p => {
        const mid = membershipByWs.get(p.workspaceId)
        if (!mid) return Promise.resolve()
        return supabase
          .from('workspace_memberships')
          .update({ sort_order: p.sortOrder })
          .eq('id', mid)
          .throwOnError()
      }))
    },
    onMutate: async (input) => {
      const listKey = queryKeys.workspaces.list(input.orgId)
      await queryClient.cancelQueries({ queryKey: listKey })
      const previousList = queryClient.getQueryData<WorkspaceWithMeta[]>(listKey)

      // Reorder cache using input.pairs as the ordering source of truth.
      const orderMap = new Map(input.pairs.map(p => [p.workspaceId, p.sortOrder]))
      queryClient.setQueryData<WorkspaceWithMeta[]>(listKey, (old = []) =>
        [...old].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
      )

      return { previousList, listKey }
    },
    onError: (err: Error, _input, ctx) => {
      if (ctx?.previousList && ctx.listKey) {
        queryClient.setQueryData(ctx.listKey, ctx.previousList)
      }
      toast.error(`Failed to reorder workspaces: ${err.message}`)
    },
    onSettled: (_d, _e, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list(input.orgId) })
    },
  })
}
```

**Open server-side option:** For atomicity and fewer round-trips, a `reorder_workspace_memberships(p_pairs jsonb)` SECURITY DEFINER RPC would be cleaner. Recommend deferring to a follow-up if N gets large; client-side parallel is fine for typical N <= 10.

**Required cache change:** `useWorkspaces` query in `src/hooks/useWorkspaces.ts:68-86` does NOT currently order by `sort_order`. The query needs:
- Add `sort_order` to the inner `workspace_memberships` select (the outer wrapper select, not the nested count one). Currently it pulls `id, role, created_at`; add `sort_order`.
- Sort the resulting `orgWorkspaces` array by `m.sort_order` ascending (lower = earlier) before mapping to `WorkspaceWithMeta`.

## Pitfalls + Mitigations

### Pitfall 1: Every `workspace_type` consumer must be rewritten
Eight files outside the migration touch `workspace_type` for behavior. Map and fix each:

| File | Line(s) | Current behavior | Replace with |
|------|---------|------------------|--------------|
| `useOrganizationContext.ts` | 22, 95, 109 | `personalWorkspace = find(v => v.workspace_type === 'personal')` | `defaultWorkspace = find(v => v.is_default)` -- and ALIAS `personalWorkspace` to it for backward-compat (4 consumers below all use the `personalWorkspace` key) |
| `AddToWorkspaceMenu.tsx` | 52, 72, 79 | icon = lock if personal else team; unassign-guard = `personalWorkspace?.id === workspaceId` | icon = `member_count <= 1 ? lock : team`; guard = `workspace.is_default` |
| `WorkspaceSelector.tsx` | 49, 63, 74-75, 90-95, 158 | icon by type; auto-select personal first; sort personal-first | icon by member_count; auto-select `is_default` first; sort by `sort_order` |
| `WorkspaceBadgeList.tsx` | 88, 91-95, 99 | sort personal-first; `hidePersonal` filter | sort by `sort_order`; `hideDefault` filter (rename + key on `is_default`) |
| `WorkspaceSidebarPane.tsx` | 371 | `canManage && workspace.workspace_type !== 'personal'` (delete option) | `canManage && !workspace.is_default` |
| `EditWorkspaceDialog.tsx` | 147, 155 | shows type read-only; delete-guard `!== 'personal'` | drop the read-only display entirely; replace guard with `!workspace.is_default` |
| `WorkspaceDetailPanel.tsx` | 158, 230 | shows type as label | drop the type label; surface `is_default` badge instead if needed |
| `WorkspaceManagement.tsx` | 61, 92, 122, 314, 320, 380 | type field, default to `'team'` create, label "{count} member · {type}" | drop type field; default `'team'` for legacy column compat is fine; label becomes "{count} member" |
| `MembersOverviewDashboard.tsx` | 86-87 | `WORKSPACE_TYPE_BADGE[ws.workspace_type]` | drop the badge or replace with a simple "Default" badge keyed on `is_default` |
| `FolderSidebar.tsx` | 662, 669-675 | icon switch on workspace_type | derive from `member_count` (1 = lock, >1 = team); collapse the multi-branch |
| `TranscriptsTab.tsx` | 331 | query key includes `activeWorkspace?.workspace_type` | drop from query key (no behavior depends on it) |
| `useWorkspaces.ts` | 78, 109, 140, 166 | SELECT pulls `workspace_type` (still fine — keep as legacy data) | leave reads in place; just don't branch on the value |
| `useWorkspaceMutations.ts` | 50, 79-97, 104, 122, 200 | takes `workspaceType` input; auto-creates folders for `'team'` | drop `workspaceType` from input (default to `'team'` internally for column compat); delete folder block |
| `CreateWorkspaceDialog.tsx` | 49, 87, 94, 131-146 | type selector UI + state | delete the Select block + state; pass nothing to the mutation |
| `DestinationPicker.test.tsx` | 8-9 | mock fixture sets `workspace_type: 'team'` | leave mock data as-is (it's legacy field, still present in DB) — do NOT delete |

**Mitigation:** Plan 02 must be a single coordinated commit that touches all files in this table simultaneously, so the type system catches any missed consumer. The `personalWorkspace` field on `useOrganizationContext` should be ALIASED (not removed) to `defaultWorkspace`'s value for one phase to avoid breaking tests / callsites in flight.

### Pitfall 2: `tr_ensure_home_workspace` already runs on org INSERT
The trigger at `20260306000000_personal_organization_and_home.sql:140` creates `Home Workspace` with `workspace_type='team', is_home=TRUE` for every new org. After this migration, the trigger needs to ALSO set `is_default=TRUE` so newly-created orgs get the partial-unique index satisfied. The migration above (step 7) updates the trigger function. Verify: the existing `handle_new_user()` trigger for personal orgs (in `20260308130000`) ALREADY sets `is_default=TRUE` on `'My Calls'` for personal orgs — so personal flow is already correct.

### Pitfall 3: RLS policies keying on workspace_type
Verified: NO RLS policies reference `workspace_type`. Only SECURITY DEFINER helper functions (`migrate_fathom_call_to_recording`, `ensure_personal_organization`, the cleanup migrations) reference it, and they are migration-time / legacy paths. **Safe to drop the CHECK without RLS breakage.**

### Pitfall 4: Tests that mock workspace_type
`src/components/import/__tests__/DestinationPicker.test.tsx:8-9` is the only test referencing `workspace_type`. It sets `workspace_type: 'team'` on fixture data, which is fine — the column still exists, just isn't read for behavior. **No test changes required** (and fixture data should NOT be cleaned up — that field still exists in the DB row).

### Pitfall 5: Backfill ordering with overlapping created_at
Two memberships (or two workspaces) created within the same millisecond will have identical `created_at`. PostgreSQL's `ROW_NUMBER() OVER (... ORDER BY created_at)` is non-deterministic in that case. **Mitigation:** the migration above uses `ORDER BY created_at ASC, id ASC` — UUIDs are deterministic, so this guarantees stable backfill. Same trick applied to the is_default backfill (`DISTINCT ON ... ORDER BY ..., id ASC`).

### Pitfall 6: `personalWorkspace` consumers that depend on it being NOT-NULL
- `useWorkspaceAssignment.ts:26, 235` reads `personalWorkspace` and uses it as a fallback "always-assigned" workspace. If we alias `personalWorkspace -> defaultWorkspace`, the semantics shift: now this fallback assigns calls to the org's Home workspace instead of the user's personal workspace. **For business orgs this is the same thing** (Home is the only auto-flagged one). **For personal orgs**, the personal org's `'My Calls'` workspace already has `is_default=TRUE` (verified in `20260308130000:46-47`). So the alias is semantically equivalent. Document this in the plan.
- `WorkspaceSelector.tsx:74-75` auto-selects personal workspace as the import default. Same story: aliased `defaultWorkspace` is semantically equivalent.
- `OrganizationPage.tsx:194-232`: uses `isPersonalOrg` (org-level, not workspace-level — different concept). Not affected.

### Pitfall 7: The "delete via API" requirement (WS-04 success criterion)
CONTEXT.md `<deferred>` explicitly defers server-side RLS enforcement. WS-04 says "cannot be deleted via UI or API." Reading strictly, this phase only protects via UI. **Resolution:** the partial UNIQUE index actually does prevent breakage — even if a malicious client deletes `is_default=TRUE` workspace, the org would lose its default until another is promoted. To make the API-side fully bulletproof, the `delete_workspace` RPC (defined in `20260401120000_delete_workspace_rpc.sql`) should be patched to refuse `is_default=TRUE`. **Recommend including this as a small addendum to Plan 01** — it's a 5-line `IF` guard inside the RPC and aligns with WS-04 wording. Otherwise flag explicitly in Open Questions.

## Recommended Plan Slicing (3 plans)

### Plan 25-01: DB migration (1 commit, ~30 min)
**Single migration file** + RPC patch. No frontend changes.

Tasks:
1. Create `supabase/migrations/20260508000000_workspace_type_retirement.sql` per the SQL above (steps 1-7).
2. Patch `delete_workspace` RPC in a follow-up SQL block within the same migration: add `IF EXISTS (SELECT 1 FROM workspaces WHERE id = p_workspace_id AND is_default = TRUE) THEN RAISE EXCEPTION 'Cannot delete default workspace'; END IF;` near the top of the function.
3. Regenerate `src/types/supabase.ts` (or manually update the workspace_memberships Insert/Row to include `sort_order: number`).
4. `supabase db push` and verify the partial unique index, the trigger update, and the backfilled values via a SELECT.

Done when: `\d workspaces` shows no CHECK on workspace_type, partial unique index `workspaces_one_default_per_org_idx` exists, every org has exactly one `is_default=TRUE`, every membership has a `sort_order >= 0`, and the trigger creates new orgs' Home workspaces with `is_default=TRUE`.

### Plan 25-02: Frontend type-decoupling + dialog cleanup (1 commit, ~90 min)
Touches every file in Pitfall 1's table simultaneously.

Tasks:
1. `useOrganizationContext.ts` — add `defaultWorkspace` field; alias `personalWorkspace = defaultWorkspace`. Drop the `find(v => v.workspace_type === 'personal')` lookup.
2. `useWorkspaces.ts` — add `sort_order` to membership select; sort by it ascending before mapping.
3. `useWorkspaceMutations.ts` — drop `workspaceType` from `CreateWorkspaceInput`; hard-code `workspace_type: 'team'` in the INSERT (legacy column compat); delete the auto-folder block (lines 79-97); compute new `sort_order = MAX + 1` for the creator's membership.
4. `CreateWorkspaceDialog.tsx` — delete the Workspace Type Select (lines 131-146); remove `workspaceType` state.
5. Replace all `workspace_type !== 'personal'` checks with `!is_default` (WorkspaceSidebarPane:371, EditWorkspaceDialog:155).
6. Replace icon branches with `member_count <= 1 ? RiLockLine : RiTeamLine` (AddToWorkspaceMenu:71-76, WorkspaceSelector.WorkspaceIcon:48-53, FolderSidebar:669-675).
7. Drop `workspace_type` from query keys and sort fns (TranscriptsTab:331, WorkspaceSelector.sortedWorkspaces:88-95, WorkspaceBadgeList.sort:91-95).
8. EditWorkspaceDialog: drop the read-only "Workspace Type" display block (lines 143-152).
9. WorkspaceDetailPanel: drop `workspace_type` references (lines 158, 230); replace with "Default workspace" badge if `is_default`.
10. WorkspaceManagement.tsx: drop type column from the table view; drop the type input from the create form; default to `'team'` in the API call.
11. MembersOverviewDashboard.tsx: drop the WORKSPACE_TYPE_BADGE/LABELS lookups; replace with a single "Default" badge or no badge.
12. Run `npm run test` and `tsc --noEmit` to catch any consumer this list missed.

Done when: `grep -rn "workspace_type" src/ --include="*.tsx" --include="*.ts" | grep -v "supabase.ts\|test"` returns ONLY type/select-list mentions (no behavior branching).

### Plan 25-03: Drag-and-drop sidebar reorder (1 commit, ~60 min)
Builds the sortable UI on top of the now-clean foundation.

Tasks:
1. Add `useUpdateWorkspaceOrder` mutation to `useWorkspaceMutations.ts` per the sketch above.
2. In `WorkspaceSidebarPane.tsx`: import `DndContext`, `SortableContext`, `useSortable`, `arrayMove`, `verticalListSortingStrategy`, `CSS`.
3. Extract a `SortableWorkspaceItem` wrapper component (inside the file, near `WorkspaceListItem`) that calls `useSortable({ id: workspace.id })` and applies the transform/transition style.
4. Add a small grip-handle (e.g. `RiDraggable2Line` or just a 4-dot icon) on the left edge of each `WorkspaceListItem`, attached to `attributes` + `listeners`. NOT the whole row — that breaks click-to-select.
5. Wrap the `workspaces.map(...)` block (`WorkspaceSidebarPane.tsx:640-667`) in `<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={workspaces.map(w => w.id)} strategy={verticalListSortingStrategy}>...</SortableContext></DndContext>`.
6. `handleDragEnd` computes the reordered array, calls `updateOrder.mutate({ orgId, pairs })`.
7. Manual smoke test in dev-browser: reorder workspaces, refresh page, confirm order persists; switch device (incognito tab) with same user, confirm same order.

Done when: SC-3 ("reorderable per-user via drag-and-drop, persists across page reloads and devices") is verifiably true in dev-browser.

## Open Questions

1. **WS-04 "via API" enforcement.** CONTEXT.md defers server-side RLS. The `delete_workspace` RPC patch I proposed in Plan 01 is a low-cost middle ground. If the planner/discuss-phase wants strict no-API-deletion of `is_default` workspaces, include the RPC patch. Otherwise WS-04 is satisfied at the partial-unique-index level only (delete the row -> org has zero defaults -> next-page-load recovers via... actually, nothing recovers. Decision needed.).
2. **Migration of `WORKSPACE_TYPE_BADGE` / `WORKSPACE_TYPE_LABELS` constants.** Are these used anywhere else? `MembersOverviewDashboard.tsx:86-87` is the only direct consumer found. If they're unused elsewhere, delete the constants entirely; otherwise leave them as legacy lookups.
3. **Drag-handle vs whole-row.** Recommend grip-handle to avoid click-vs-drag conflicts. Final UX call.
4. **Atomic reorder via RPC.** Client-side `Promise.all(N updates)` works but isn't atomic. For typical N <= 10 this is fine; for larger workspace lists (50+) consider a `reorder_workspace_memberships(jsonb)` RPC. Defer to first user complaint.
