---
phase: 25-workspace-type-retirement
plan: 01
type: summary
status: complete
completed: 2026-05-07
duration_minutes: 8
commit: f16e6b56
requirements_completed: [WS-04, WS-05]
files_modified:
  - supabase/migrations/20260507052421_workspace_type_retirement.sql (created, 221 lines)
  - src/types/supabase.ts (regenerated, +39 lines)
key_decisions:
  - Migration timestamp 20260507052421 (UTC, > 20260401120000 so ordering is correct)
  - Demote step only touches workspace_type='personal' rows (other types like 'youtube' kept verbatim)
  - delete_workspace guard inserted as the first check before role/org-id lookups (fail-fast)
  - workspace_type column preserved as legacy data per CONTEXT.md decisions
---

# Phase 25 Plan 01: Workspace Type Retirement DB Migration — Summary

Single Supabase migration that retires `workspace_type` as a behavior switch and replaces it with `is_default` (one per org, protected) plus per-user `sort_order` on memberships. Migration applied to remote Supabase project `vltmrnjsubfzrgrtdqey` and verified via Management API queries.

## What was implemented

- New migration `20260507052421_workspace_type_retirement.sql` with 8 sections (drop CHECK, add sort_order, backfill sort_order, backfill is_default, demote duplicate personals, partial unique index, update trigger, patch RPC).
- Backfilled `sort_order` on every `workspace_memberships` row via `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1` so each user has a contiguous 0..N-1 range.
- Backfilled `is_default = TRUE` on exactly one workspace per organization using deterministic priority (`is_home DESC, workspace_type='personal' DESC, created_at ASC, id ASC`), with idempotency guard (`NOT EXISTS` on existing defaults).
- Demoted any non-winning `workspace_type='personal'` rows to `'team'` so they are deletable.
- Created `workspaces_one_default_per_org_idx` partial unique index — DB-level enforcement of "exactly one default per org."
- Replaced `ensure_home_workspace()` trigger function so newly-created orgs' Home workspaces also get `is_default=TRUE` (preserves `SET search_path = public`).
- Patched `delete_workspace` RPC with a `Cannot delete the default workspace.` guard as the first check. Rest of the body preserved verbatim (role check, transfer, membership delete, workspace delete).
- Regenerated `src/types/supabase.ts`. `sort_order: number` now appears on `workspace_memberships` Row, Insert, and Update types (3 occurrences).

## Files modified

| File | Change | Lines |
|------|--------|-------|
| `supabase/migrations/20260507052421_workspace_type_retirement.sql` | Created | 221 |
| `src/types/supabase.ts` | Regenerated (sort_order added on workspace_memberships) | +39 |

## must_haves status

| Truth | Status |
|-------|--------|
| The `workspaces_workspace_type_check` CHECK constraint no longer exists | verified — `SELECT COUNT(*) FROM pg_constraint WHERE conname LIKE '%workspace_type%'` = 0 |
| Every workspace_memberships row has a non-null sort_order value (0-indexed, ranked deterministically per user) | verified — query for `MIN(sort_order)<>0 OR MAX(sort_order)<>COUNT(*)-1` returned 0 rows |
| Every organization has exactly one workspaces row with is_default=true | verified — orgs=20, defaults=20; no orgs without a default; no orgs with >1 |
| The partial unique index workspaces_one_default_per_org_idx prevents two is_default rows for the same org | verified — `pg_indexes.indexdef` includes `WHERE (is_default = true)` |
| The ensure_home_workspace() trigger sets is_default=TRUE on newly-created Home workspaces | verified — `pg_get_functiondef ILIKE '%is_default%'` returned true |
| delete_workspace RPC raises 'Cannot delete the default workspace.' when called on an is_default=true workspace | verified — `pg_get_functiondef ILIKE '%Cannot delete the default workspace%'` returned true |
| Andrew's AI Simple org normalized to exactly one is_default=TRUE; rest deletable | verified — "My Calls" is_default=TRUE; YouTube Vault, Clickable Impact, AI Simple Founders, youtube, Testing, Phill Tomlinson all is_default=FALSE; no duplicate personals (org only had 1 personal to begin with) |

All 7 truths verified.

## Verification command outputs

```
=== 1. CHECK constraint dropped (expect 0) ===
[{"count":0}]

=== 2. Partial unique index ===
[{"indexname":"workspaces_one_default_per_org_idx","indexdef":"CREATE UNIQUE INDEX workspaces_one_default_per_org_idx ON public.workspaces USING btree (organization_id) WHERE (is_default = true)"}]

=== 3a. Orgs with != 1 default ===
[]
=== 3b. Orgs without a default ===
[]

=== 4. Users with non-contiguous sort_order ===
[]

=== 5. ensure_home_workspace function contains is_default ===
[{"has_is_default":true}]

=== 6. delete_workspace contains 'Cannot delete the default workspace' guard ===
[{"has_guard":true}]

=== 7. AI Simple org workspaces ===
"My Calls" is_default=true (workspace_type='personal' — kept since it won the lottery)
"AI Simple Founders" is_default=false workspace_type='team'
"YouTube Vault" is_default=false workspace_type='youtube'
"Clickable Impact" is_default=false workspace_type='team'
"youtube" is_default=false workspace_type='team'
"Testing" is_default=false workspace_type='team'
"Phill Tomlinson" is_default=false workspace_type='team'

=== 8. Total counts ===
[{"orgs":20,"defaults":20}]
```

## Deviations from plan

None — plan executed exactly as written.

The plan's `delete_workspace` reference (RESEARCH.md / interfaces section) matched the actual `20260401120000_delete_workspace_rpc.sql` body verbatim, so the patched function preserved the existing role check, transfer logic, last-owner trigger toggle, and final delete unchanged. Only the `is_default` guard was inserted at the top.

## Open issues for next plans

- **Plan 25-02 (frontend type-decoupling)** can now safely:
  - Read `is_default` as a singleton invariant (DB enforces it)
  - Add `.order('sort_order')` to the `useWorkspaces` query (column exists)
  - Replace all `workspace_type !== 'personal'` checks with `!is_default`
  - Drop the workspace-type selector from `CreateWorkspaceDialog`
- **Plan 25-03 (drag-and-drop reorder)** can now write to `sort_order` and rely on the per-user ordering invariant. The `idx_workspace_memberships_user_sort` index is in place for fast `(user_id, sort_order)` queries.
- **AI Simple org "My Calls"** is now `is_default=true` and `workspace_type='personal'`. The `personal` value remains as legacy data — frontend code in Plan 25-02 must stop branching on it.

## Self-Check: PASSED

- Migration file exists at `supabase/migrations/20260507052421_workspace_type_retirement.sql` — FOUND
- Commit `f16e6b56` exists (`git log --oneline | grep f16e6b56`) — FOUND
- `src/types/supabase.ts` contains `sort_order` (3 matches in 3 files / Row/Insert/Update) — FOUND
- All 8 verification SQL checks returned expected results (above)
