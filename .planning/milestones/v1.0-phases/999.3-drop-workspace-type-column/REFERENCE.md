# REFERENCE — Phase 999.2: Drop `workspaces.workspace_type` column

**Captured:** 2026-05-28
**Source:** Andrew + audit conducted today (`gsd-debug` session continuation)
**Status:** Backlog. Do not start without a clean ~3hr engineering block + fresh context.

---

## Why this exists

`workspace_type` was nominally retired by Phase 25 (`20260507052421_workspace_type_retirement.sql`, 2026-05-07) — the CHECK constraint was dropped and the migration's header claims "no code reads it after Phase 25." That claim is **wrong**. Today's audit found ~30 active reference sites across 4 backend files, 3 frontend files, and ~10 test files. Several actively BRANCH on the value:

- `connector-pipeline.ts` filters `.eq('workspace_type', 'personal')` to find the user's anchor workspace for connector imports (twice — lines 302, 533)
- `youtube-import/index.ts` filters and writes `.eq('workspace_type', 'youtube')` (lines 467, 484) — uses a dedicated workspace per org typed `'youtube'`
- `mcp-server/index.ts` accepts `workspace_type` as a `create_workspace` MCP tool param (lines 873, 2454, 2482)
- `mcp-server/tools/read/list_workspaces.ts` selects and surfaces it in tool output (lines 10, 39, 43)

Dropping the column blindly breaks YouTube imports and personal-connector flows.

## Andrew's design decisions (from 2026-05-28 conversation)

1. **All import sources should route to a workspace via the same mechanism** — a single `workspace_id` reference, not source-specific filters. No special-casing YouTube.
2. **`create_workspace` and `list_workspaces` MCP tools KEEP existing** — just drop the `workspace_type` field from input/output. Don't differentiate "team" vs "personal" anywhere in MCP surfaces.
3. **`personal` vs `team` distinction is meaningless** in current product semantics — confirmed by the Phase 25 retirement intent.

## Required architecture change BEFORE the column drop

`import_sources` does NOT currently have a `workspace_id` column. Schema verified 2026-05-28:

```
id, user_id, source_app, is_active, account_email,
last_sync_at, error_message, created_at, updated_at,
oauth_access_token, oauth_refresh_token, oauth_token_expires,
fathom_api_key, api_key, webhook_signing_secret,
connection_metadata, webhook_path_token
```

So the new design requires `import_sources.workspace_id UUID NOT NULL REFERENCES workspaces(id)` to be added + backfilled FIRST.

## Sequenced migration plan (~3 hours)

| # | Step | Risk | Backout |
|---|---|---|---|
| 1 | Migration: add `workspace_id UUID REFERENCES workspaces(id)` to `import_sources` (nullable initially) | Low | Drop the column |
| 2 | Same migration: backfill `workspace_id` per existing row. For sources with `source_app IN ('fathom','zoom','fireflies','grain','read-ai','plaud','file-upload')`: use the user's is_home workspace (currently identified by `workspace_type='personal'` OR `is_home=true`). For YouTube sources: use whichever workspace currently has `workspace_type='youtube'` in that org (creating one if missing — match Andrew Naegele's AI Simple 'YouTube Vault' as the canonical example). | Medium — backfill must be idempotent + verifiable | Re-run with `ON CONFLICT DO NOTHING` |
| 3 | Same migration: `ALTER COLUMN workspace_id SET NOT NULL` once backfill is verified clean | Low | Revert NOT NULL |
| 4 | Rewrite `connector-pipeline.ts` (lines 302, 533) — replace `workspace_type='personal'` filter with reading `import_sources.workspace_id` for the active source row | Medium — touches import path; needs integration test | Revert file |
| 5 | Rewrite `youtube-import/index.ts` (lines 467, 484) — same: route via `import_sources.workspace_id` | Medium — same | Revert file |
| 6 | Remove `workspace_type` param from `create_workspace` MCP tool definition (line 873) + handler (lines 2454, 2482). Tool stays; just drops one input field. | Low — agents that pass it get an ignored param | Revert file |
| 7 | Remove `workspace_type` from `list_workspaces` MCP tool select + response shape (lines 10, 39, 43) | Low | Revert file |
| 8 | Strip `workspace_type` from frontend hooks (`useWorkspaces.ts` lines ~79, 118, 155, 206, 232; `useWorkspaceMutations.ts` lines ~37, 48, 54, 63, 99, 117, 195) and components (`WorkspaceManagement.tsx` lines ~53, 83, 105, 115, 353; `WorkspaceBadgeList.tsx` line 94; `useOrganizationContext.ts` line 84) | Low — type-system catches misses via typecheck | Revert files |
| 9 | Update `src/types/workspace.ts` — remove `workspace_type` from `WorkspaceWithMeta` type (line 54) | Low | Revert file |
| 10 | Update generated types `src/types/supabase.ts` (lines 3772, 3785, 3798) — drop `workspace_type` from `workspaces` Row/Insert/Update | Auto-regenerable | `npm run gen:types` after column drop |
| 11 | Update test fixtures across ~10 files (see "Test files to update" below) — remove `workspace_type` from mock workspace objects | Low — tests caught early | Revert per file |
| 12 | Final migration: `ALTER TABLE workspaces DROP COLUMN workspace_type` | **Irreversible at the column level** (data lost). Mitigated by Phase 25 having already retired it as a behavior switch. | Restore from PITR if needed |
| 13 | Verification: `npm run typecheck`, `npm run build`, `vitest run`, real-Supabase integration smoke test for each connector (Fathom + YouTube minimum) | — | — |

## Test files to update (Step 11)

- `src/components/workspace/__tests__/workspace-icon-derivation.test.ts`
- `src/test/migrations/phase25-workspace-type-retirement.test.ts` — may want to DELETE this entirely since the column is gone
- `src/test/migrations/phase25-default-workspace-protection.test.ts` — keep, just drop the type field from fixtures
- `supabase/functions/_shared/__tests__/plaud-connector.test.ts`
- `src/components/settings/__tests__/WorkspaceManagement.test.tsx`
- `src/components/import/__tests__/DestinationPicker.test.tsx`
- `src/components/dialogs/__tests__/DeleteWorkspaceDialog.test.tsx`
- `src/hooks/__tests__/useWorkspaceMutations.workspaceOrder.test.ts`
- `src/components/dialogs/__tests__/EditWorkspaceDialog.test.tsx`
- `supabase/tests/rls_permissions_test.sql:38` — SQL test insert references the column

## Open questions for the agent to resolve at execute time

- Whether to also drop `workspace_type` from any other downstream places (e.g., the MCP `connection_metadata` JSON if it's referenced there)
- Whether the `plaud-client.ts:578` reference (`workspace.workspace_type === '0'`) is on the Plaud-side workspace shape (their API) or ours. Looks like it's Plaud's API based on the surrounding code — verify before touching.

## Agent prompt skeleton

Spawn a dedicated agent (Forge or general-purpose) with this REFERENCE.md as the spec. Tell it:
- Sequenced 13-step plan above is binding
- Atomic commits per step
- Run `npm run typecheck` after every code change
- Run `npm run build` before pushing the final column-drop migration
- DO NOT drop the column until all 11 prior steps are committed and verified
- Final commit message pattern: `chore(db): drop legacy workspace_type column (Phase 999.2)`

## Not in scope

- Renaming the personal workspace name from "My Calls" → "INBOX" — separate decision, see Andrew's 2026-05-28 conversation
- Migrating to the two-workspace-row model (immutable HOME + editable INBOX) — design discussed, not adopted
- Dropping `is_home` — required by Andrew's design; keep both flags

## References

- Phase 25 retirement migration: `supabase/migrations/20260507052421_workspace_type_retirement.sql`
- Today's audit conversation: 2026-05-28 GSD session, post `/gsd-debug new-org-no-home-workspace`
- AI Simple ground truth (1 row each): `INBOX` is_home=t/is_default=t/workspace_type='personal'; `YouTube Vault` workspace_type='youtube'; all other 8 workspaces workspace_type='team' or null
- Lead Gen Jay ground truth: 1 row, name='IMPORT', is_home=t/is_default=t/workspace_type='team'
