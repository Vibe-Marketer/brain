---
phase: 25-workspace-type-retirement
type: context
status: ready-for-planning
gathered: 2026-05-07
---

# Phase 25: Workspace Type Retirement — Context

<domain>
## Phase Boundary

Eliminate the `workspace_type` distinction (`'personal' | 'team' | 'youtube'`) as a behavior switch. Replace personal-only behaviors with cleaner derivations:

- **"Cannot be deleted"** → derived from `is_default = true` (one per org = the org's Home workspace)
- **"Cannot be unassigned from a recording"** → derived from `is_default = true`
- **"Lock vs team icon"** → derived from `member_count` (1 = lock, >1 = team)
- **"One per org" assumption** → eliminated entirely (no special slot to be the only one)

Add per-user sidebar ordering via `sort_order` column on `workspace_memberships` and drag-and-drop reorder in `WorkspaceSidebarPane`.

Drop the type selector from `CreateWorkspaceDialog`. Stop auto-creating "Hall of Fame" / "Manager Reviews" folders when a workspace is created.

</domain>

<decisions>
## Implementation Decisions

### Migration strategy
- Keep the `workspace_type` column for now (legacy data preservation). New code never branches on it.
- Drop the `workspace_type` CHECK constraint so future writes are unrestricted.
- Add `sort_order INT NOT NULL DEFAULT 0` to `workspace_memberships`. Backfill with `created_at` rank per user.
- Backfill `is_default = true` on the oldest workspace per org that has `workspace_type = 'personal' OR is_home = true`. If neither exists, the oldest workspace per org wins.
- Add a partial UNIQUE index `(organization_id) WHERE is_default` to enforce "one default per org" at the DB level.

### Protection model
- `is_default = true` workspaces cannot be deleted (frontend hides delete; backend RLS could be added in a follow-up — out of scope here).
- `is_default = true` workspaces cannot be unassigned from a recording (frontend disables the unassign control on that one entry).

### Icon derivation
- `member_count >= 2` → `RiTeamLine`
- `member_count <= 1` → `RiLockLine`
- No more branching on `workspace_type`.

### Sort order — per-user
- Each user has their own preferred order. `sort_order` lives on `workspace_memberships`, not on `workspaces`.
- Lower `sort_order` = appears first. Default new memberships get `sort_order = MAX(existing for that user) + 1`.
- The org's `is_default` workspace is NOT pinned at the top — user controls fully via drag.

### Drag-and-drop
- Use `@dnd-kit` (already a dependency since `WorkspaceDropZone` uses it for folder drops).
- Reorder triggers a single `useUpdateWorkspaceOrder` mutation that writes the new array of `(workspace_membership_id, sort_order)` pairs.
- Optimistic update so the sidebar feels instant.

### Default folders
- Stop auto-creating "Hall of Fame" and "Manager Reviews" on workspace creation. Period. User-created folders only.

### Type selector
- Remove from `CreateWorkspaceDialog`. Every workspace is created without a type field set (or default to `'team'` for column compatibility — TBD in Plan 02).

### What stays
- The `workspace_type` column itself (legacy)
- The auto-created Home workspace per org (via `tr_ensure_home_workspace` trigger) — this becomes the `is_default` workspace
- `workspace_memberships` table structure (just adding `sort_order`)
- Roles/permissions model

</decisions>

<canonical_refs>
## Canonical References

### Schema
- `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql` — workspaces table + workspace_type CHECK constraint
- `supabase/migrations/20260306000000_personal_organization_and_home.sql` — `tr_ensure_home_workspace` trigger creating the Home workspace per org

### Frontend behavior to retire
- `src/components/dialogs/CreateWorkspaceDialog.tsx` — type selector to remove
- `src/hooks/useWorkspaceMutations.ts:80-97` — auto-folder creation to remove
- `src/components/panes/WorkspaceSidebarPane.tsx:371` — `workspace_type !== 'personal'` delete-option guard → swap to `!is_default`
- `src/components/dialogs/EditWorkspaceDialog.tsx:155` — same as above
- `src/components/workspace/AddToWorkspaceMenu.tsx:72,79` — icon and unassign guard → derive from member_count + is_default
- `src/components/workspace/WorkspaceSelector.tsx:49,88-95` — icon and personal-first sort → derive from member_count + use sort_order
- `src/components/workspace/WorkspaceBadgeList.tsx:99` — personal filter → drop or convert to is_default check
- `src/hooks/useOrganizationContext.ts:95` — `personalWorkspaceData` slot → rename to `defaultWorkspace` keyed on `is_default`
- `src/hooks/useWorkspaces.ts:68-86` — query to add `.order('sort_order')`

### Patterns to follow
- `WorkspaceDropZone` in `WorkspaceSidebarPane.tsx` already uses `@dnd-kit` — reuse that DndContext or wrap a SortableContext alongside
- Optimistic mutation pattern from `useWorkspaceMutations.ts` (`onMutate` + queryClient cancellation)

</canonical_refs>

<specifics>
## Specific Ideas

- The 2nd-pane "Your Workspaces" section (`WorkspaceSidebarPane.tsx:627-680`) is the only drag-and-drop surface needed. Other workspace selectors (import dropdown, etc.) can keep their alphabetical sort or pick up `sort_order` for free.
- Backfill the `is_default` flag deterministically — sort by `is_home DESC, workspace_type='personal' DESC, created_at ASC` per org, take the first.
- Andrew currently has multiple `workspace_type='personal'` workspaces in the AI Simple org (created during the bug demonstration). The migration should normalize this — only the oldest becomes `is_default`, the rest become regular deletable workspaces.

</specifics>

<deferred>
## Deferred Ideas

- Server-side RLS enforcement that `is_default` workspaces cannot be deleted (frontend-only guard for now)
- Removing the `workspace_type` column entirely (keep as legacy data, decommission in a future cleanup phase)
- Reordering of folders within a workspace (separate concern — folder reordering already partially exists via `WorkspaceDropZone`)
- Cross-device sync conflict resolution if two devices reorder concurrently (last-write-wins is fine for now)

</deferred>

---

*Phase: 25-workspace-type-retirement*
*Context gathered: 2026-05-07*
