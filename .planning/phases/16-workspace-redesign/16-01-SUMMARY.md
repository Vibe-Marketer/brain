---
phase: 16-workspace-redesign
plan: "01"
subsystem: schema-and-types
tags:
  - redirects
  - migrations
  - typescript
  - workspace
  - rls
dependency_graph:
  requires:
    - "15-03: recordings table and v2 frontend live"
  provides:
    - "workspace_invitations table with RLS (16-02+ invite flows)"
    - "folders.vault_id backfilled (16-02+ folder scoping)"
    - "vaults.is_default + protect_default_workspace trigger (16-07 delete protection)"
    - "Organization/Workspace/Folder TypeScript aliases (all 16-XX plans)"
    - "invitations queryKeys domain (16-10/11 invite hooks)"
    - "Server-level 301 redirects (external bookmarks, crawlers)"
  affects:
    - "16-02 through 16-13: all workspace redesign plans unblocked"
tech_stack:
  added:
    - "workspace_invitations PostgreSQL table"
    - "get_workspace_invite_details SECURITY DEFINER RPC"
    - "accept_workspace_invite SECURITY DEFINER RPC"
    - "protect_default_workspace BEFORE DELETE trigger"
  patterns:
    - "TypeScript type alias pattern (Organization=Bank, Workspace=Vault) for rename-without-migration"
    - "Vercel redirects array for server-level 301s alongside rewrites SPA catch-all"
    - "SECURITY DEFINER RPCs for unauthenticated pre-auth invite context"
key_files:
  created:
    - /Users/Naegele/dev/callvault/src/types/workspace.ts
    - /Users/Naegele/dev/brain/supabase/migrations/20260228000001_workspace_redesign_schema.sql
  modified:
    - /Users/Naegele/dev/callvault/vercel.json
    - /Users/Naegele/dev/callvault/src/lib/query-config.ts
decisions:
  - "TypeScript type aliases over DB views for concept rename — zero migration risk, queries unchanged"
  - "vaults.is_default backfill: UPDATE vaults SET is_default = TRUE WHERE vault_type = 'personal' — covers all 11 existing personal vaults"
  - "folders.vault_id backfill: first vault per bank ordered by created_at — assigns 16 existing folders to their primary workspace"
  - "UNIQUE(workspace_id, email, status) constraint on workspace_invitations — prevents duplicate pending invites per user per workspace"
metrics:
  duration: "3 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 16 Plan 01: URL Redirects and Schema Foundation Summary

**One-liner:** 7 server-level 301 redirects in vercel.json, additive SQL migration (workspace_invitations + folder scoping + is_default + RPCs + triggers), and TypeScript type aliases for zero-migration concept rename.

---

## Tasks Completed

| Task | Name | Status | Commits |
|------|------|--------|---------|
| 1 | URL redirects and additive DB migration | Done | `2f65070` (callvault), `32da1f2` (brain) |
| 2 | TypeScript type aliases and query key updates | Done | `166c651` (callvault) |

---

## Objective

Set up URL redirects and database schema foundation for the entire Workspace Redesign phase.

Old paths (`/bank/`, `/vault/`, `/hub/`) get 301-redirected at the Vercel edge before any UI rename ships. The DB migration adds `workspace_invitations`, folder workspace scoping (`vault_id`), archive columns (`is_archived`, `archived_at`), and default workspace protection (`is_default`). TypeScript type aliases provide the mapping layer from DB names (banks/vaults) to UI concept names (organizations/workspaces) without touching any query code.

---

## What Was Built

### Task 1: URL Redirects

**`/Users/Naegele/dev/callvault/vercel.json`** — Updated with 7 server-level 301 redirects:

```json
{ "source": "/vaults", "destination": "/workspaces", "permanent": true }
{ "source": "/vaults/:vaultId", "destination": "/workspaces/:vaultId", "permanent": true }
{ "source": "/join/vault/:token", "destination": "/join/workspace/:token", "permanent": true }
{ "source": "/settings/banks", "destination": "/settings/organizations", "permanent": true }
{ "source": "/bank/:path*", "destination": "/organization/:path*", "permanent": true }
{ "source": "/vault/:path*", "destination": "/workspace/:path*", "permanent": true }
{ "source": "/hub/:path*", "destination": "/folder/:path*", "permanent": true }
```

These fire at the Vercel CDN edge, before the SPA loads. External bookmarks and crawlers that saved old URLs will be transparently redirected with HTTP 301.

### Task 1: SQL Migration (Applied to Production)

**`/Users/Naegele/dev/brain/supabase/migrations/20260228000001_workspace_redesign_schema.sql`**

1. **workspace_invitations** — New table with 10 columns, 4 indexes, 4 RLS policies (admin SELECT/INSERT/UPDATE + invited user SELECT by email)
2. **folders.vault_id** — Nullable FK to vaults. Backfilled: 16 folders assigned to first vault per bank (ordered by created_at). 0 NULL rows after backfill.
3. **folders.is_archived + archived_at** — Archive support columns. Both default to FALSE/NULL.
4. **vaults.is_default** — New BOOLEAN column (default FALSE). Backfilled: all 11 personal vaults set to TRUE.
5. **handle_new_user() updated** — Personal vault INSERT now includes `is_default = TRUE`. New signups get a protected default workspace.
6. **get_workspace_invite_details RPC** — SECURITY DEFINER function. Returns workspace/org/inviter context for a pending token. Accessible unauthenticated (for `/join/workspace/:token` pre-auth page).
7. **accept_workspace_invite RPC** — SECURITY DEFINER. Validates: token pending + not expired + email match to authenticated user. Creates vault_memberships row, marks invitation accepted.
8. **protect_default_workspace trigger** — BEFORE DELETE on vaults. Raises exception if `OLD.is_default = TRUE`. Trigger is active and tested.

### Task 2: TypeScript Type Aliases

**`/Users/Naegele/dev/callvault/src/types/workspace.ts`** — New file:

- `Organization` = `BankRow` (type alias — DB queries still use `supabase.from('banks')`)
- `Workspace` = `VaultRow & { is_default?: boolean }` (extended for Phase 16 new column)
- `WorkspaceInvitation` — interface for the new workspace_invitations table
- `WorkspaceInviteDetails` — return type for `get_workspace_invite_details` RPC
- `Folder` — explicit interface including Phase 16 columns (vault_id, is_archived, archived_at)
- `WorkspaceRole` — union type of 5 roles
- `ROLE_DISPLAY_NAMES` — maps DB role strings to UI-facing labels (`guest` -> `"Viewer"`)
- `BreadcrumbItem` — navigation breadcrumb shape

**`/Users/Naegele/dev/callvault/src/lib/query-config.ts`** — Added invitations domain:

```typescript
invitations: {
  all: ['invitations'] as const,
  byWorkspace: (workspaceId: string) => ['invitations', 'workspace', workspaceId] as const,
  details: (token: string) => ['invitations', 'details', token] as const,
},
```

---

## Production Verification

All SQL verification queries confirmed against production (aws-1-us-east-1.pooler.supabase.com):

| Check | Result |
|-------|--------|
| workspace_invitations columns | 10 rows (all expected columns present) |
| folders new columns | 3 rows: archived_at, is_archived, vault_id |
| vaults.is_default column exists | 1 row |
| folders_without_vault_id = 0 | PASS — all 16 folders backfilled |
| personal_vaults_not_default = 0 | PASS — all 11 personal vaults are is_default = TRUE |
| total_default_vaults = 11 | PASS — backfill worked |
| RPCs exist | 2 rows: accept_workspace_invite, get_workspace_invite_details |
| handle_new_user contains is_default | 2 occurrences confirmed |
| protect_default_workspace trigger | ACTIVE on public.vaults BEFORE DELETE |

---

## Deviations from Plan

None — plan executed exactly as written.

The migration used `IF NOT EXISTS` and `IF NOT EXISTS` guards throughout, causing NOTICE messages for `vault_id` index and column (both already existed from earlier work). These are expected and do not indicate errors.

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| TypeScript type aliases over DB views for concept rename | Zero migration risk; all Supabase queries keep using `banks`/`vaults`; aliases only affect TypeScript layer |
| vaults.is_default backfill: `UPDATE ... WHERE vault_type = 'personal'` | Covers all 11 existing personal vaults; without this backfill the protect trigger could never fire |
| folders.vault_id backfill: first vault per bank by created_at | Assigns folders to the primary (oldest) workspace per organization; handles all 16 existing folders cleanly |
| UNIQUE(workspace_id, email, status) on invitations | Prevents duplicate pending invites per user per workspace while allowing re-invite after revoke/expire |

---

## Self-Check

### Files Exist

```
FOUND: /Users/Naegele/dev/callvault/vercel.json
FOUND: /Users/Naegele/dev/brain/supabase/migrations/20260228000001_workspace_redesign_schema.sql
FOUND: /Users/Naegele/dev/callvault/src/types/workspace.ts
FOUND: /Users/Naegele/dev/callvault/src/lib/query-config.ts
```

### Commits Exist

```
FOUND: 2f65070 feat(16-01): add server-level 301 redirects for old Bank/Vault/Hub URLs
FOUND: 32da1f2 feat(16-01): workspace redesign schema foundation migration
FOUND: 166c651 feat(16-01): add TypeScript type aliases and invitations query keys
```

## Self-Check: PASSED
