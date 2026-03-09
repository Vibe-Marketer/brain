# Sharing Decision Doc

**Status:** Finalized
**Last Updated:** 2026-03-10
**Issue:** #97

## §1 — Sharing Model

CallVault uses a **workspace-based sharing model**. Recordings are not shared directly to individuals — they are added to workspaces. Access to a workspace is controlled by workspace membership.

A recording can exist in multiple workspaces simultaneously (many-to-many via `workspace_entries`). Every recording is automatically added to the org's HOME workspace on creation.

## §2 — What Happens When You're Removed

When a user is removed from a workspace (`workspace_memberships` row deleted):

1. **Calls disappear immediately.** The `recordings` RLS policy requires active `workspace_memberships` for visibility. Postgres evaluates this at query time — no caching, no delay.

2. **Personal folders/tags still exist but calls stop showing.** The user's personal folder assignments and tag assignments for those recordings remain in the database. However, any query joining `personal_folder_recordings → recordings` or `personal_tag_recordings → recordings` will silently filter the hidden recordings via RLS. The folder/tag itself still exists; it just shows fewer (or zero) calls.

3. **Own recordings remain visible.** If the removed user also *owns* the recording (`owner_user_id = auth.uid()`), they can still see it via the "Users can view own recordings" policy. Workspace removal only affects recordings they didn't create.

4. **No data is deleted.** Removal is purely access control. The recording, its transcript, and all metadata remain intact. The `workspace_entries` row stays — only the `workspace_memberships` row is gone.

5. **Re-adding the user restores access.** Inserting a new `workspace_memberships` row immediately restores full visibility of all recordings in that workspace.

## §3 — Who Can Remove Members

- **Workspace admins and owners** can remove any member from their workspace (`is_workspace_admin_or_owner` check).
- **Users can leave a workspace themselves** unless they are the last `workspace_owner` (enforced by trigger `prevent_last_workspace_owner`).
- **Organization owners** can remove members from any workspace in their org, but must do so through the workspace directly (not a shortcut org-level removal).

## §4 — Org Admin Exception

An org admin/owner (`organization_admin` or `organization_owner` role) can see ALL recordings in their organization regardless of workspace membership. They see them via the "Org admins can view all recordings" policy, not the workspace path. Removing an org admin from a specific workspace does NOT hide recordings from them — you must demote their org role to restrict their view.

## §5 — Guest Role Behavior

Guests (`role = 'guest'` in `workspace_memberships`) are valid workspace members and follow the same visibility rules. They can view recordings in their workspace but cannot create workspace entries, add other members, or modify workspace settings.
