# Access Boundaries Decision Doc

**Status:** Finalized
**Last Updated:** 2026-03-10
**Issue:** #97

## §1 — Data Isolation Model

CallVault enforces two layers of boundary:

1. **Organization boundary** — Users can only see data from organizations they belong to. They cannot see recordings, workspaces, or members from other organizations.
2. **Workspace boundary** — Within an organization, regular members can only see recordings from workspaces they are actively a member of.

Org admins and owners bypass the workspace boundary and see everything in their org.

## §2 — Workspace Access Rules

### Who can see a workspace's recordings

| Role | Can see recordings |
|------|-------------------|
| `workspace_owner` | Yes — all recordings in this workspace |
| `workspace_admin` | Yes — all recordings in this workspace |
| `manager` | Yes — all recordings in this workspace |
| `member` | Yes — all recordings in this workspace |
| `guest` | Yes — all recordings in this workspace |
| Non-member | No — recordings filtered by RLS |
| Org admin/owner | Yes — all recordings in all org workspaces |

### Who can add recordings to a workspace

| Role | Can create `workspace_entries` |
|------|-------------------------------|
| `workspace_owner` | Yes |
| `workspace_admin` | Yes |
| `manager` | Yes |
| `member` | Yes |
| `guest` | No — guest role excluded from INSERT policy |

### Who can manage workspace membership

| Action | Required role |
|--------|--------------|
| Add member | `workspace_owner` or `workspace_admin` |
| Remove member | `workspace_owner` or `workspace_admin` |
| Leave workspace | Any member (self-removal) unless last owner |
| Change member role | `workspace_owner` or `workspace_admin` |
| Delete workspace | `workspace_owner` only (and not if `is_default = TRUE`) |
| Rename workspace | `workspace_owner` or `workspace_admin` |

## §3 — Organization Access Rules

### Who can see org-level data

| Role | Can see all org workspaces | Can see all recordings |
|------|---------------------------|----------------------|
| `organization_owner` | Yes | Yes |
| `organization_admin` | Yes | Yes |
| `member` (any org role without admin) | Only their workspace memberships | Only workspace-scoped |

### Who can manage org membership

| Action | Required role |
|--------|--------------|
| Invite new member | `organization_owner` or `organization_admin` |
| Remove member | `organization_owner` or `organization_admin` |
| Change member org role | `organization_owner` or `organization_admin` |
| Delete organization | `organization_owner` only |
| Rename organization | `organization_owner` or `organization_admin` |

## §4 — Cross-Org Rules

- Users can belong to multiple organizations.
- Recordings belong to exactly one organization (set at import time, cannot be changed after creation).
- Copying a recording to another org creates a new recording row owned by the copying user (`copy_recording_to_organization()` RPC).
- A user must be a member of **both** the source and target org to copy between them.

## §5 — Personal Org Rules

Every user has a personal organization (`type = 'personal'`). This org:
- Contains exactly one workspace: "My Calls" (`is_home = TRUE`, `is_default = TRUE`)
- Has exactly one member: the user themselves (`organization_owner` + `workspace_owner`)
- Cannot be deleted while it has a default workspace
- Does not support inviting other members (personal org stays personal)

## §6 — Home Workspace Behavior

Every organization has exactly one `is_home = TRUE` workspace:
- All new recordings are auto-added to the HOME workspace on INSERT (via `auto_home_workspace_entry` trigger)
- This ensures recordings are visible to all org members who are members of the HOME workspace
- The HOME workspace cannot be deleted while recordings exist in it
