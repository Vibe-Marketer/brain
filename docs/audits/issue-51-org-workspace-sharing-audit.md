# Audit: Organizations/Workspaces/Sharing Implementation Status

**Issue:** #51
**Date:** 2026-03-07
**Audited by:** Claude (automated codebase audit)
**Scope:** brain repo (Supabase migrations, edge functions) + callvault repo (v2 frontend)

---

## Summary

The Organizations/Workspaces/Sharing system is **substantially implemented** at the database and backend layer, with a functional v2 frontend. However, the architecture **diverges significantly** from the issue's checklist because the checklist describes a different design (HOME workspace, `call_workspace_links`, `personal_folders`/`personal_tags` tables) than what was actually built (Organization > Workspace > workspace_entries, shared folders/tags within workspaces).

**Key finding:** The issue's checklist appears to describe a *proposed* design that was never implemented. The *actual* implementation uses a Bank/Vault architecture (renamed to Organization/Workspace in Phase 16) that achieves the same goals through a different data model.

---

## Database Layer (Phases 1-3)

### organizations table with hard tenant boundary
**DONE** — Originally created as `banks` in migration `20260131000005_create_banks_tables.sql`, renamed to `organizations` in `20260301000001_rename_vaults_to_workspaces.sql`.

- Columns: `id`, `name`, `type` (personal/business), `cross_bank_default`, `logo_url`, `created_at`, `updated_at`
- Hard tenant boundary enforced: recordings belong to exactly ONE organization, cross-org movement is always COPY
- RLS enabled with membership-based isolation

### workspaces table with is_home boolean
**PARTIAL (different design)** — Table exists (originally `vaults`, renamed to `workspaces`). Uses `is_default` boolean instead of `is_home`. Functionally equivalent — marks the undeletable personal workspace per org.

- Column: `is_default BOOLEAN NOT NULL DEFAULT FALSE` (added in `20260228000001_workspace_redesign_schema.sql`)
- Backfilled: all existing personal vaults marked `is_default = TRUE`
- Protected by `prevent_default_workspace_delete()` trigger

### call_workspace_links join table
**MISSING (different design)** — No `call_workspace_links` table exists. Instead, the system uses `workspace_entries` (originally `vault_entries`) which serves the same purpose but with richer metadata.

- `workspace_entries` has: `workspace_id`, `recording_id`, `folder_id`, `local_tags`, `scores`, `notes`
- UNIQUE constraint on `(workspace_id, recording_id)` — same recording can appear in multiple workspaces
- This is a **superset** of what `call_workspace_links` would provide

### personal_folders / personal_folder_calls tables
**MISSING (different design)** — No separate `personal_folders` or `personal_folder_calls` tables exist. Instead, the existing `folders` table was extended with `workspace_id` FK (migration `20260228000001`) to scope folders to workspaces.

- Folders can be personal (user_id match) or workspace-scoped (workspace_id set)
- RLS policy: `user_id = auth.uid() OR (workspace_id IS NOT NULL AND is_workspace_member(...))`
- `folder_calls` table (pre-existing) handles the folder-call association

### personal_tags / personal_call_tags tables
**MISSING (different design)** — No separate personal tag tables. The existing `call_tags` table was extended with `organization_id` column (migration `20260210170000_add_bank_id_to_folders_and_tags.sql`). Tags are scoped to organizations, not personal.

- `workspace_entries.local_tags` provides workspace-specific tagging per recording
- `recordings.global_tags` provides org-wide tags

### RLS policies enforcing org isolation
**DONE** — Comprehensive RLS policies exist across all tables. Recreated in `20260301000002_recreate_rls_policies.sql` after the rename.

Key policies:
- `organizations`: SELECT via `is_organization_member()`, UPDATE via `is_organization_admin_or_owner()`
- `workspaces`: SELECT via `is_workspace_member()` + org admin override
- `workspace_entries`: SELECT via workspace membership + org admin override
- `recordings`: SELECT via `is_organization_member()`, DELETE only if no workspace_entries exist
- `folders`: Personal ownership OR workspace membership
- `workspace_invitations`: Admin-only management, invited user can view own

### Workspace membership table
**DONE** — `workspace_memberships` table (originally `vault_memberships`).

- Columns: `workspace_id`, `user_id`, `role`
- UNIQUE constraint on `(workspace_id, user_id)`
- Role hierarchy: `workspace_owner > workspace_admin > manager > member > guest`
- RLS: members can view, admins can manage/update/delete

---

## Backend Logic (Phase 3)

### HOME workspace auto-shows ALL calls in org
**MISSING** — No automatic mechanism ensures the default workspace contains all org calls. Recordings are added to workspaces via `workspace_entries` inserts. New recordings from import pipeline go to a target workspace, not automatically to HOME.

The `handle_new_user()` trigger creates a personal workspace with `is_default = TRUE`, but there's no trigger/mechanism to auto-populate it with all calls.

### Adding/removing calls from custom workspaces via links
**DONE** — `workspace_entries` table supports INSERT (adding recording to workspace) and DELETE (removing). UNIQUE constraint prevents duplicates. RLS controls who can add/remove.

### Deleting a call removes it from HOME + all workspaces + all folders/tags
**DONE** — `recordings` FK has `ON DELETE CASCADE` from `workspace_entries`. Deleting a recording cascades to all workspace entries. However, deletion is blocked if any workspace_entries exist (RLS policy: `NOT EXISTS (SELECT 1 FROM workspace_entries ...)`), requiring entries to be removed first.

### Cross-org copy creates NEW call with new ID
**PARTIAL** — The `cross_bank_default` column on organizations supports `copy_only` and `copy_and_remove` policies. The `migrate_fathom_call_to_recording()` RPC creates new recordings with new IDs when copying. However, there is no general-purpose "copy recording to another org" RPC — the existing function is migration-specific.

### Workspace deletion removes links but keeps calls
**DONE** — `workspace_entries` has `ON DELETE CASCADE` from `workspaces` FK. When a workspace is deleted, all entries are removed but recordings persist in the organization. Default workspace is protected from deletion by `prevent_default_workspace_delete()` trigger.

---

## Frontend (Phases 4-6)

### Organization switching UI
**DONE** — `callvault/src/components/layout/OrgSwitcherBar.tsx`

- Dropdown menu listing all user's orgs
- House icon for personal org, building icon for business
- One-click switching, checkmark on active
- "Create Organization" option with dialog (`CreateOrganizationDialog.tsx`)
- Context managed via `useOrgContext` hook + Zustand store

### Workspace/Hub selection in sidebar
**DONE** — `callvault/src/components/layout/WorkspaceSidebarPane.tsx`

- Collapsible workspace list with nested folders
- Active workspace highlighted with vibe-orange indicator
- `is_default` workspace shows star icon
- "Create Workspace" button with dialog (`CreateWorkspaceDialog.tsx`)
- Folders show open/closed icons, support drag-and-drop (`FolderDropZone`)
- Archived folders in collapsible sub-section

### Personal folders & tags UI
**PARTIAL** — Folders UI is implemented within workspaces (`useFolders`, `FolderDropZone`, folder items in sidebar). However, there is no *personal* folder system separate from workspace folders. Tags UI is limited to `local_tags` on workspace entries — no standalone personal tags management UI found.

### Copy vs Move dialogs
**MISSING** — No `CopyDialog`, `MoveDialog`, or cross-workspace copy/move UI components found in the callvault repo. The `orgContextStore.ts` references copy/move concepts but no user-facing dialogs exist.

### Member management panels (org + workspace)
**DONE (workspace only)** — `callvault/src/components/workspace/WorkspaceMemberPanel.tsx`

- Tabs for "Members" and "Pending Invites"
- Role badges with color coding
- Change role, remove member functionality
- Resend/revoke invitations
- "Invite Member" button opens `WorkspaceInviteDialog.tsx`

**MISSING** — No org-level member management panel found. Organization membership is created at org creation time, but no UI for managing org members separately from workspace members.

### Invitation/join flow
**DONE** — `callvault/src/routes/_authenticated/join/workspace.$token.tsx`

- Full invitation acceptance page showing: inviter name, org name, workspace name, role, description
- Error handling: expired, revoked, not found states
- Accept/Decline buttons
- Backed by `get_workspace_invite_details` and `accept_workspace_invite` RPCs (SECURITY DEFINER)
- `WorkspaceInviteDialog.tsx` for sending invitations

---

## Access Control

### Org Owner/Admin sees all calls in all workspaces
**DONE** — RLS policy on `workspaces`: `is_organization_admin_or_owner(organization_id, auth.uid())` grants SELECT. Same pattern on `workspace_entries` and `workspace_memberships`. Org admins have visibility across all workspaces.

### Regular members see only calls in their workspaces
**DONE** — RLS on `workspace_entries`: `is_workspace_member(workspace_id, auth.uid())`. Members can only see entries in workspaces they belong to. `recordings` table uses org-level membership check (any org member can see recordings in that org).

**Note:** There's a subtle gap — `recordings` RLS allows any org member to SELECT recordings in their org, not just recordings in their workspaces. The workspace scoping happens at the `workspace_entries` layer. A member could theoretically query recordings directly without going through workspace_entries.

### Removing user from workspace revokes access instantly
**DONE** — Deleting a `workspace_memberships` row immediately fails the `is_workspace_member()` check in RLS policies. No caching layer or delay. Workspace admins can remove members via RLS-protected DELETE.

### Personal folders/tags have NO impact on permissions
**DONE** — Folders are organizational tools; folder ownership (`user_id`) and workspace membership are checked independently. No folder/tag RLS policy grants data access — they only control who can see/edit the folder itself.

### hybrid_search_transcripts_scoped RPC respects workspace scope
**DONE** — Implemented in `20260301000001_rename_vaults_to_workspaces.sql`. The function:

1. If `filter_workspace_id` provided: verifies user has membership, returns only matching results
2. If `filter_organization_id` provided: aggregates all user's workspace memberships in that org, scopes to those recordings
3. Falls back to unscoped search for backwards compatibility
4. Intersects with any user-provided `filter_recording_ids`
5. Returns `workspace_id` and `workspace_name` for result attribution

---

## Claimed Remaining (Phase 8)

### New user onboarding flow
**DONE** — `handle_new_user()` trigger creates personal organization + default workspace on signup. Frontend has `useOnboarding` hook and `ModelExplorer` component.

### Legacy user backfill for is_home
**DONE** — Migration `20260228000001` includes: `UPDATE public.vaults SET is_default = TRUE WHERE vault_type = 'personal'`. The `ensure_personal_organization()` RPC handles legacy users who lack a personal org/workspace.

### Terminology audit
**DONE** — Migration `20260301000001_rename_vaults_to_workspaces.sql` renames all tables (banks→organizations, vaults→workspaces, etc.), columns (bank_id→organization_id, vault_id→workspace_id), constraints, and helper functions. Migration `20260303000003_naming_cleanup.sql` exists for additional cleanup.

### UI polish
**PARTIAL** — Phase 16.2 (V2 Visual Alignment) is 3/4 plans complete per STATE.md. UI components exist and are styled but polish is ongoing.

### Type safety cleanup
**PARTIAL** — `callvault/src/types/workspace.ts` defines type aliases mapping DB names to UI names. Generated Supabase types still use old names (banks/vaults). Several `eslint-disable @typescript-eslint/no-explicit-any` comments in services. The services still query `supabase.from('banks')` and `supabase.from('vaults')` rather than using renamed table names.

### Search scope integration
**DONE** — `hybrid_search_transcripts_scoped` RPC supports workspace and organization-level filtering. Returns workspace attribution in results.

---

## Architecture Discrepancies

The issue's checklist describes a design with:
- `is_home` boolean (actual: `is_default`)
- `call_workspace_links` join table (actual: `workspace_entries` with richer schema)
- `personal_folders` / `personal_folder_calls` separate tables (actual: extended existing `folders` table)
- `personal_tags` / `personal_call_tags` separate tables (actual: `local_tags` on workspace_entries + org-scoped call_tags)

These are design differences, not gaps. The actual implementation achieves the same goals through a more unified data model.

---

## Risk Items

1. **Recordings RLS too permissive:** Any org member can SELECT any recording in their org, regardless of workspace membership. Workspace scoping only applies at the `workspace_entries` layer. Consider tightening to require workspace membership for recording access.

2. **No cross-org copy RPC:** The `cross_bank_default` policy column exists but no general-purpose copy-recording-between-orgs function was created. Only the migration-specific `migrate_fathom_call_to_recording` exists.

3. **No Copy/Move dialogs:** Frontend lacks user-facing UI for moving or copying recordings between workspaces. This is a significant UX gap for multi-workspace users.

4. **No org member management UI:** Users can manage workspace members but not organization-level members. Adding someone to an org requires creating them through workspace invitations.

5. **Stale generated types:** Frontend services use old table names (`banks`, `vaults`) in Supabase queries because the generated types haven't been regenerated after the rename migration. This works (DB aliases) but creates confusion.

---

## Final Verdict

| Area | Status | Confidence |
|------|--------|------------|
| Database schema | **DONE** (different design than checklist) | High |
| RLS / org isolation | **DONE** | High |
| Backend RPCs | **DONE** (search, invites, migration) | High |
| Org switching UI | **DONE** | High |
| Workspace sidebar | **DONE** | High |
| Member management | **PARTIAL** (workspace only, no org-level) | High |
| Invitation flow | **DONE** | High |
| Copy/Move UI | **MISSING** | High |
| Personal folders/tags | **PARTIAL** (reuses workspace folders, no personal tags UI) | High |
| Search scope | **DONE** | High |

**Overall: 70% DONE, 20% PARTIAL, 10% MISSING**

The system works for single-workspace scenarios and basic multi-workspace use. The main gaps are cross-workspace operations (copy/move), org-level member management, and the HOME workspace auto-population concept (which may not be needed given the actual architecture).
