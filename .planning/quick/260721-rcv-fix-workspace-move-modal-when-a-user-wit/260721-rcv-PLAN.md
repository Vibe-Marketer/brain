---
phase: quick-260721-rcv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/hooks/useWorkspaces.ts
  - src/services/data-movement.service.ts
  - src/hooks/useDataMovement.ts
  - src/services/__tests__/data-movement.service.test.ts
  - src/components/dialogs/MoveToWorkspaceDialog.tsx
  - src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx
autonomous: true
requirements: [RCV-MOVE-01]
must_haves:
  truths:
    - "A user who belongs to more than one org (e.g. personal org + an org joined via accepted invite) sees workspaces from ALL their orgs in the Move-to-Workspace picker, grouped by organization"
    - "Selecting a target workspace in the SAME org performs a workspace_entries move (cheap re-link), unchanged from today"
    - "Selecting a target workspace in a DIFFERENT org routes through the cross-org copy RPC (hard copy / optional source-delete), never a bare workspace_entries insert"
    - "The picker no longer shows an effectively-empty 'no workspaces' state when the user's active org has only the source workspace but they belong to other orgs"
  artifacts:
    - path: "src/hooks/useWorkspaces.ts"
      provides: "useAllUserWorkspaces() — every workspace the user is a member of across all orgs, each tagged with organization_id"
      contains: "useAllUserWorkspaces"
    - path: "src/services/data-movement.service.ts"
      provides: "moveRecordingsToTargetWorkspace() dispatcher: same-org vs cross-org routing"
      contains: "moveRecordingsToTargetWorkspace"
    - path: "src/components/dialogs/MoveToWorkspaceDialog.tsx"
      provides: "Picker sourced from all-org membership, grouped by org, routed correctly"
  key_links:
    - from: "src/components/dialogs/MoveToWorkspaceDialog.tsx"
      to: "useAllUserWorkspaces"
      via: "hook call replacing useWorkspaces(activeOrgId)"
      pattern: "useAllUserWorkspaces"
    - from: "src/services/data-movement.service.ts"
      to: "copy_recording_to_org"
      via: "cross-org branch RPC call"
      pattern: "copy_recording_to_org"
---

<objective>
Fix the "Move to Workspace" picker so it lists every workspace the user actually has access to across all organizations (including orgs joined via accepted invite), not just the currently-active org — and route each move to the correct backend operation.

Purpose: A user with membership in multiple orgs (their auto-created personal org + an org they accepted an invite into) opens the Move-to-Workspace dialog and sees "no workspaces" because the picker is scoped to `activeOrgId` and their active org holds only the source workspace. The data model already supports multi-org membership; the bug is UI/query scoping.

Output: A cross-org-aware move picker plus a service-layer dispatcher that keeps same-org moves cheap and correctly hard-copies cross-org moves via the existing RPC.
</objective>

<execution_context>
@/Users/admin/dev/brain/.claude/get-shit-done/workflows/execute-plan.md
@/Users/admin/dev/brain/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/admin/dev/brain/CLAUDE.md
@/Users/admin/dev/brain/src/CLAUDE.md

<root_cause>
Confirmed by investigation:

1. `MoveToWorkspaceDialog` (src/components/dialogs/MoveToWorkspaceDialog.tsx) sources its target list from `useWorkspaces(activeOrgId)` and filters out `currentWorkspaceId`. It is scoped to a SINGLE org (the active one).

2. `useWorkspaces(orgId)` (src/hooks/useWorkspaces.ts) already queries `workspace_memberships` for ALL of the user's memberships (`.eq('user_id', user.id)`), then filters client-side to `ws.organization_id === orgId`. So the "all orgs" data is already fetched and thrown away.

3. The DB fully supports multi-org membership: `accept_workspace_invite` (migration 20260312000000) upserts BOTH `organization_memberships` AND `workspace_memberships`. An accepted-invite user is a real member of the other org's workspace.

4. Recordings are org-scoped. Same-org move = `workspace_entries` insert/delete (data-movement.service.ts `moveRecordingsToWorkspace`). Cross-org transfer CANNOT be a bare `workspace_entries` insert — it requires the existing `copy_recording_to_org` RPC (hard copy, new recording rows, optional source delete). The RPC accepts `p_target_workspace_id` and self-guards: it verifies caller org membership and errors when source org == target org (migration 20260309200010).

Therefore the fix is a query-scope fix + correct mutation routing — NOT a schema change.
</root_cause>

<interfaces>
From src/hooks/useWorkspaces.ts — the existing membership query (reuse its shape, drop the org filter):
```
supabase.from('workspace_memberships').select(`
  id, role, created_at, sort_order,
  workspace:workspaces ( id, organization_id, name, slug, workspace_type,
    default_sharelink_ttl_days, is_default, created_at, updated_at,
    workspace_memberships ( count ) )
`).eq('user_id', user.id)
```
Returns WorkspaceWithMeta[] (type in src/types/workspace). Each row carries `organization_id`.

From src/services/data-movement.service.ts:
```
export async function moveRecordingsToWorkspace(recordingIds, targetWorkspaceId, options: { sourceWorkspaceId?, keepInSource? }): Promise<void>  // SAME-ORG: workspace_entries upsert (+ optional source delete)
export async function copyRecordingsToOrganization(recordingIds, targetOrgId, options: { removeSource?, onProgress? }): Promise<void>  // uses copy_recording_to_org RPC per recording, currently targets the org HOME workspace
```

copy_recording_to_org RPC params (migration 20260309200010):
p_recording_id UUID, p_target_org_id UUID, p_target_workspace_id UUID, p_delete_original BOOLEAN

From src/hooks/useDataMovement.ts:
```
export function useMoveToWorkspace()      // wraps moveRecordingsToWorkspace
export function useCopyToOrganization()   // wraps copyRecordingsToOrganization
```

From src/hooks/useOrganizations.ts: `useOrganizations()` -> OrganizationWithRole[] (id, name, membershipRole ...) for org display names.

From src/lib/query-config.ts: `queryKeys.workspaces` ({ all, list(orgId), detail, members, recordings }). Add a new key for the all-orgs list.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Data layer — all-org workspace list hook + same-vs-cross-org move dispatcher</name>
  <files>src/hooks/useWorkspaces.ts, src/services/data-movement.service.ts, src/hooks/useDataMovement.ts, src/services/__tests__/data-movement.service.test.ts</files>
  <behavior>
    - moveRecordingsToTargetWorkspace: when target workspace org === source org → calls the same-org workspace_entries path (upsert to target; delete from source unless keepInSource).
    - moveRecordingsToTargetWorkspace: when target workspace org !== source org → calls copy_recording_to_org RPC once per recording with p_target_workspace_id = target workspace and p_delete_original = !keepInSource. Never touches workspace_entries directly for cross-org.
    - Cross-org branch propagates the RPC error message on failure (does not silently swallow).
    - useAllUserWorkspaces: returns workspaces for EVERY org the user is a member of (no org filter), each carrying organization_id.
  </behavior>
  <action>
    In src/hooks/useWorkspaces.ts add and export `useAllUserWorkspaces()`. Reuse the EXACT `workspace_memberships` select shape already used by `useWorkspaces` (see <interfaces>) but REMOVE the `ws.organization_id === orgId` filter so all of the user's workspaces across all orgs are returned. Map to `WorkspaceWithMeta[]` exactly like `useWorkspaces` does (member_count from the nested count sub-select, user_role from membership role, keep `organization_id`, `is_default`, `workspace_type`). Sort by `sort_order` then `is_default`. Use a new query key: add `allForUser: () => ['workspaces', 'list', 'all-user'] as const` to `queryKeys.workspaces` in src/lib/query-config.ts. Enable only when `user` is present; staleTime 5 min. Do NOT modify the existing `useWorkspaces`/import-picker hooks.

    In src/services/data-movement.service.ts add `export async function moveRecordingsToTargetWorkspace(recordingIds: string[], target: { workspaceId: string; organizationId: string }, options: { sourceOrgId: string; sourceWorkspaceId?: string | null; keepInSource?: boolean; onProgress?: (current: number, total: number) => void }): Promise<void>`. If `target.organizationId === options.sourceOrgId`, delegate to the existing `moveRecordingsToWorkspace(recordingIds, target.workspaceId, { sourceWorkspaceId, keepInSource })` (unchanged behavior). Otherwise loop the recordings calling the `copy_recording_to_org` RPC via `untypedRpc(supabase, 'copy_recording_to_org', { p_recording_id, p_target_org_id: target.organizationId, p_target_workspace_id: target.workspaceId, p_delete_original: !keepInSource })`, throwing on the first RPC error with `Failed to move recording N of M: <msg>`, invoking `onProgress` after each. Reuse the pattern already in `copyRecordingsToOrganization`. Do not duplicate its membership pre-check — the RPC enforces membership itself.

    In src/hooks/useDataMovement.ts add `export function useMoveRecordings()` — a mutation hook wrapping `moveRecordingsToTargetWorkspace`. On success show a toast that says "Moved"/"Copied" based on `keepInSource`, and invalidate the same caches the existing move + copy hooks invalidate (`queryKeys.workspaces.all`, `queryKeys.workspaceEntries.all`, `queryKeys.calls.all`, `['tag-calls']`, source + target `workspaces.recordings`). On error toast the error message. Keep the existing `useMoveToWorkspace`/`useCopyToOrganization` exports intact.

    Extend src/services/__tests__/data-movement.service.test.ts with a describe block for `moveRecordingsToTargetWorkspace` covering: (a) same-org target calls the workspace_entries upsert/delete path and does NOT call the RPC; (b) cross-org target calls `copy_recording_to_org` with the right params and `p_delete_original` derived from `keepInSource`; (c) cross-org RPC error is thrown. Mock the supabase client the same way the existing tests in that file do.
  </action>
  <verify>
    <automated>cd /Users/admin/dev/brain && npx vitest run src/services/__tests__/data-movement.service.test.ts && npx tsc -p tsconfig.app.json --noEmit</automated>
  </verify>
  <done>useAllUserWorkspaces exported and returns cross-org workspaces; moveRecordingsToTargetWorkspace dispatches same-org vs cross-org correctly; useMoveRecordings hook exported; new service tests pass; type-check clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire MoveToWorkspaceDialog to the all-org picker and correct routing</name>
  <files>src/components/dialogs/MoveToWorkspaceDialog.tsx, src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx</files>
  <behavior>
    - Dialog lists workspaces from every org the user belongs to (excluding currentWorkspaceId), grouped/labeled by organization name.
    - Choosing a same-org workspace triggers the same-org move; choosing a workspace in another org triggers the cross-org copy path — both via useMoveRecordings.
    - When the user belongs to exactly one org with only the source workspace, the picker still offers "Create new workspace…" (no regression) but no longer misleadingly implies there are transferable targets when cross-org ones exist.
  </behavior>
  <action>
    In src/components/dialogs/MoveToWorkspaceDialog.tsx replace `useWorkspaces(activeOrgId)` with `useAllUserWorkspaces()`. Keep `useOrganizationContext()` for `activeOrgId` (the SOURCE org) and add `useOrganizations()` to resolve org display names. Build the Select options from all fetched workspaces, filtered to exclude `currentWorkspaceId`; group them by `organization_id` using Radix Select group labels (org name; suffix the active org's group with " (current)"). Store the chosen workspace's `organization_id` alongside its id in state (e.g. keep the selected `WorkspaceWithMeta` object, not just the id). Replace the `useMoveToWorkspace` call with `useMoveRecordings` and pass `target: { workspaceId, organizationId }`, `options: { sourceOrgId: activeOrgId, sourceWorkspaceId: currentWorkspaceId, keepInSource }`. Update the DialogDescription/info copy: it should no longer claim moves are always "within this organization" — state that moving to a workspace in another organization copies the call into that org (metadata like folders/local tags/scores does not travel), matching the CopyToOrganizationDialog wording. Keep the "Create new workspace…" item (still scoped to `activeOrgId` via CreateWorkspaceDialog). Preserve the keep-in-source (copy) checkbox and all existing button/pending states.

    Update src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx: replace the `useWorkspaces` mock with a `useAllUserWorkspaces` mock returning workspaces spanning two orgs (source org + another org), add mocks for `useOrganizations` (org names) and `useMoveRecordings` (replacing `useMoveToWorkspace`). Add a test asserting a cross-org workspace renders in the picker and that selecting it calls the mutation with the target's `organizationId` differing from `sourceOrgId`. Keep/adjust existing same-org and create-workspace assertions.
  </action>
  <verify>
    <automated>cd /Users/admin/dev/brain && npx vitest run src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx && npx tsc -p tsconfig.app.json --noEmit</automated>
  </verify>
  <done>Move dialog renders workspaces from all of the user's orgs grouped by org, routes same-org vs cross-org moves through useMoveRecordings, updated tests pass, type-check clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → Supabase (PostgREST/RPC) | Client picks a target workspace/org; server RLS + RPC must enforce that the user may write there |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rcv-01 | Elevation of Privilege | cross-org branch of moveRecordingsToTargetWorkspace | mitigate | Cross-org path uses `copy_recording_to_org`, which internally calls `is_organization_member(p_target_org_id, caller)` and errors on same-org; no client-trusted authority. useAllUserWorkspaces only surfaces workspaces the user has a `workspace_memberships` row for (RLS-scoped). |
| T-rcv-02 | Tampering | same-org workspace_entries write | accept | Unchanged existing path; `workspace_entries` RLS (restrict_member_insert_entries / home guards) already governs inserts. No new surface. |
| T-rcv-03 | Information Disclosure | useAllUserWorkspaces query | mitigate | Query filters `.eq('user_id', user.id)` and relies on `workspace_memberships` RLS — returns only the caller's memberships, never other users' workspaces. |
| T-rcv-SC | Tampering | npm/pip/cargo installs | mitigate | No new dependencies introduced by this plan. |
</threat_model>

<verification>
- `npx vitest run src/services/__tests__/data-movement.service.test.ts src/components/dialogs/__tests__/MoveToWorkspaceDialog.test.tsx` passes.
- `npx tsc -p tsconfig.app.json --noEmit` clean (root tsconfig is hollow — must use tsconfig.app.json).
- Manual sanity (dev-browser, optional): as a user in two orgs, open Move to Workspace and confirm the other org's workspace appears grouped under its org name.
</verification>

<success_criteria>
- Move-to-Workspace picker lists every workspace the user is a member of across all orgs, grouped by org, excluding the source workspace.
- Same-org selection performs the existing cheap workspace_entries move; cross-org selection performs a hard copy via `copy_recording_to_org` with correct source-delete semantics.
- No schema change; no new dependency; existing same-org behavior and CreateWorkspace flow preserved.
</success_criteria>

<output>
Create `.planning/quick/260721-rcv-fix-workspace-move-modal-when-a-user-wit/260721-rcv-SUMMARY.md` when done.
</output>
