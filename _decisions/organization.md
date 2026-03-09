# Organization Permissions Decision Doc

**Status:** Finalized
**Last Updated:** 2026-03-10
**Issue:** #97

## §1 — Organization Roles

| Role | Value in DB | Capabilities |
|------|-------------|--------------|
| Owner | `organization_owner` | Full control: rename, delete, manage all members/workspaces, see all recordings |
| Admin | `organization_admin` | Manage members/workspaces, see all recordings (cannot delete org or demote owners) |
| Member | (any member without admin/owner role) | See only workspaces/recordings they're explicitly added to |

There is no explicit `member` role value — any `organization_memberships` row that is not `organization_owner` or `organization_admin` is treated as a regular member.

## §2 — How Role Checks Work

**Helper functions (all SECURITY DEFINER, bypass RLS):**

- `is_organization_member(org_id, user_id)` — TRUE if any membership row exists
- `is_organization_admin_or_owner(org_id, user_id)` — TRUE if role IN ('organization_owner', 'organization_admin')
- `is_workspace_member(workspace_id, user_id)` — TRUE if any workspace_memberships row exists
- `is_workspace_admin_or_owner(workspace_id, user_id)` — TRUE if workspace role IN ('workspace_owner', 'workspace_admin')

These functions are used in every RLS policy to avoid in-line subquery recursion.

## §3 — FAQ About Permissions

**Q: Can an org admin see all calls even if they aren't in a specific workspace?**
A: Yes. The "Org admins can view all recordings" RLS policy grants full visibility to `organization_owner` and `organization_admin` roles regardless of their workspace memberships.

**Q: Can a regular member create a new workspace?**
A: Yes — any org member can create workspaces (`is_organization_member` check on INSERT). They become `workspace_owner` of the new workspace.

**Q: Can a workspace admin add members from outside the org?**
A: No — new workspace members must already be org members. Workspace invitations (via email) create org memberships AND workspace memberships in sequence.

**Q: What happens if the last org owner leaves?**
A: The `organization_memberships` DELETE policy uses `is_organization_admin_or_owner` which means owners can be deleted by other admins/owners. However, there is no DB-level "last owner" guard on organizations. This should be enforced at the application layer.

**Q: Can a workspace owner override an org admin's permissions?**
A: No. Org admin/owner permissions are org-scoped and take precedence. A workspace owner cannot restrict an org admin from seeing their workspace recordings.

**Q: Who can rename a workspace?**
A: `workspace_owner` or `workspace_admin` roles (enforced by `is_workspace_admin_or_owner` in the UPDATE policy on `workspaces`).

**Q: Who can rename an organization?**
A: `organization_owner` or `organization_admin` roles (enforced by `is_organization_admin_or_owner` in the UPDATE policy on `organizations`).

**Q: What is the `invitation_rls_auth_email` fix about?**
A: Organization invitations use the invited email address for matching (`auth.users.email`). The fix in migration `20260309100000` ensures the RLS policy uses the correct email column from `auth.users` rather than a potentially incorrect subquery form.

## §4 — Permission Enforcement Points

| Action | Enforced by |
|--------|------------|
| View recordings | RLS on `recordings` table |
| View workspace entries | RLS on `workspace_entries` table |
| View workspace list | RLS on `workspaces` table |
| Manage workspace members | RLS on `workspace_memberships` table |
| Invite to org | RLS on `organization_invitations` table |
| Delete recordings | `delete_recording()` SECURITY DEFINER RPC |
| Copy recordings between orgs | `copy_recording_to_organization()` SECURITY DEFINER RPC |
| Create org + first workspace | `create_business_organization()` SECURITY DEFINER RPC |

## §5 — Workspace Settings UI Permissions

The following workspace settings actions should only be visible to workspace admins/owners:

- Rename workspace
- Delete workspace (disabled if `is_default = TRUE`)
- Invite/remove members
- Change member roles

The following org settings actions should only be visible to org admins/owners:

- Rename organization
- Delete organization
- Invite/remove org members
- Change org member roles
- View billing

Regular members have read-only access to settings pages — they can see workspace membership lists but cannot modify them.
