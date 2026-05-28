---
slug: new-org-no-home-workspace
status: resolved
created: 2026-05-28
updated: 2026-05-28
trigger: |
  New organization created via UI → default workspace named "IMPORT" → advanced settings → MOVE selected → saved successfully. When user later tried to move calls into that org, got error: "TARGET ORGANIZATION HAS NO HOME WORKSPACE". Org and IMPORT workspace are confirmed to exist in DB; the error appears to be in the home-workspace detection / cross-org move resolver.

  Additional UX issues to fix alongside the bug:
  1. Move/Copy hidden in "advanced settings" dropdown — should be a simple switch with helper text, not buried
  2. "Handoff: Remove from current organization after copy" checkbox NOT auto-checked despite org default being MOVE — these should sync
  3. Helper text below the transfer modal doesn't change when the user toggles handoff on
  4. No indication that the per-transaction selection is a one-off override (should reference org settings default)
  5. Verify org settings actually has the move/copy default (Andrew thinks it does; if not, add it)
---

# Debug: new-org-no-home-workspace

## Symptoms

### Expected behavior
1. Creating a new organization auto-creates a primary "home" workspace
2. If a default workspace name is supplied at org creation, that workspace exists alongside (or as) the home workspace
3. Cross-org call moves resolve to the new org's home workspace without manual setup
4. UX:
   - Move/Copy is a simple switch with helper text, NOT hidden in advanced settings
   - "Handoff" option auto-syncs with the org-level default (MOVE → auto-checked; COPY → unchecked)
   - Helper text changes when handoff is toggled (copy-only message vs move/handoff message)
   - Modal indicates the choice is a per-transaction override of the org default and points to org settings to change the default

### Actual behavior (before fix)
1. Org was created successfully
2. IMPORT workspace was created successfully (visible in DB / UI)
3. Trying to move calls INTO the new org → error: **"TARGET ORGANIZATION HAS NO HOME WORKSPACE"**
4. Handoff checkbox did NOT reflect the org-level MOVE default — appeared unchecked despite default being MOVE
5. Helper text below the modal was correct for COPY but didn't update when handoff was enabled

### Error messages
```
TARGET ORGANIZATION HAS NO HOME WORKSPACE
```

Thrown at `src/services/data-movement.service.ts:90` (JS layer) and `supabase/migrations/20260309210000_fix_cross_org_routing_chunks_and_workspace.sql:252` (DB RPC layer — `copy_recording_to_organization`, 2-arg variant used by routing rules).

### Timeline
- Reported: 2026-05-28
- Trigger `tr_ensure_home_workspace` was created in migration `20260306000000_personal_organization_and_home.sql:140` (AFTER INSERT ON organizations).
- Migration `20260308130000_fix_double_workspace_and_duplicate_trigger.sql` patched the personal-org branch of this trigger but it was NEVER APPLIED to production (not present in `supabase_migrations.schema_migrations`).
- Migration `20260507052421_workspace_type_retirement.sql` (Phase 25) replaced `ensure_home_workspace()` BODY again, but the trigger DDL `CREATE TRIGGER tr_ensure_home_workspace` has only ever been declared once (in 20260306).
- Production trigger inventory on `organizations` before fix: **`tr_ensure_home_workspace` was GONE**. Only `organizations_updated_at` and `tr_auto_provision_mcp_token` survived. No migration in the tree drops this trigger — it disappeared via out-of-band manual DDL.

### Reproduction
1. Sign in as a user who can create orgs
2. Open org creation modal
3. Skip logo
4. Enter default workspace name "IMPORT" (or any name)
5. Open "Advanced Settings"
6. Select "MOVE (Copy and remove source)"
7. Save org → success
8. Switch to a different org with existing recordings
9. Try to move/transfer recordings INTO the newly-created org
10. Observe error: "TARGET ORGANIZATION HAS NO HOME WORKSPACE"

## Evidence

- timestamp: 2026-05-28T initial
  finding: Error string "Target organization has no HOME workspace" thrown in two places.
  files:
    - src/services/data-movement.service.ts:90 (JS — frontend)
    - supabase/migrations/20260309210000_fix_cross_org_routing_chunks_and_workspace.sql:252 (DB — copy_recording_to_organization)
  note: JS layer fails first because frontend looks up the home workspace before calling the per-recording RPC.

- timestamp: 2026-05-28T initial
  finding: Org creation flow goes via `create_business_organization` RPC, NOT an Edge Function.
  files:
    - src/components/dialogs/CreateOrganizationDialog.tsx (modal)
    - src/hooks/useOrganizationMutations.ts:54 (`supabase.rpc('create_business_organization', ...)`)
    - supabase/migrations/20260303000003_naming_cleanup.sql:265-319 (RPC source)
  note: RPC inserts ONE workspace with `workspace_type='team'`, no `is_home`, no `is_default`.

- timestamp: 2026-05-28T initial
  finding: Trigger inventory on production `organizations` table before fix:
    - organizations_updated_at (kept)
    - tr_auto_provision_mcp_token (kept)
    - tr_ensure_home_workspace (**MISSING** — should be there per migration 20260306000000_personal_organization_and_home.sql:140)
  query: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'organizations'::regclass AND NOT tgisinternal`
  note: `ensure_home_workspace()` FUNCTION still exists in pg_proc — only the TRIGGER is gone. No migration in the repo drops the trigger, so this was an out-of-band manual DDL operation.

- timestamp: 2026-05-28T initial
  finding: Live state of broken org. Only ONE business org in production lacked a home workspace.
  query: |
    SELECT o.id, o.name, o.created_at FROM organizations o
    WHERE o.type='business' AND NOT EXISTS (
      SELECT 1 FROM workspaces w WHERE w.organization_id=o.id AND w.is_home=TRUE
    );
  result: |
    22c98dba-f169-40c8-9e93-547875c203ff | Lead Gen Jay | 2026-05-28 05:00:05+00
  workspaces_in_org_before_fix: |
    [{"id":"4cf3bf4f-215c-4db8-ad35-ad3e9a978f19","name":"IMPORT","workspace_type":"team","is_home":false,"is_default":false}]

- timestamp: 2026-05-28T post-fix
  finding: All fix invariants green after migration applied.
  - TRIGGER_PRESENT: 1 (tr_ensure_home_workspace restored)
  - LEAD_GEN_JAY_HOME: name=IMPORT, is_home=true, is_default=true (promoted in backfill)
  - BUSINESS_ORGS_BROKEN: 0
  - BUSINESS_ORGS_MULTIPLE_HOMES: 0 (unique partial index satisfied)
  - MIGRATION_REGISTERED: 20260528052504 / restore_home_workspace_invariant
  - SMOKE_TEST_RPC: end-to-end `create_business_organization('Smoke Test Org', 'copy_and_remove', NULL, 'IMPORT TEST')` returned one workspace `(name=IMPORT TEST, is_home=t, is_default=t)`
  - SMOKE_TEST_TRIGGER: direct `INSERT INTO organizations (type='business')` created one workspace `(name=Home Workspace, is_home=t, is_default=t)` via the trigger alone
  - UNIT_TESTS: data-movement.service.test.ts 14/14 passing (no JS change required)
  - FULL_TEST_SUITE: 1423/1423 passing across 160 files, 0 regressions
  - BUILD: production build clean (vite build, 7.88s)

- timestamp: 2026-05-28T pre-existing-test-regression
  finding: rls-regression.test.ts (cross-org RLS isolation integration test) had been inserting workspaces with is_home=TRUE manually. With the trigger restored, this collided on the workspaces_is_home_idx partial unique index.
  fix: Switched the test to UPDATE the trigger-created workspace's name to 'Home A' / 'Home B' for legibility instead of INSERTing a new one. 20/20 passing after the change.

## Eliminated

- ❌ "Edge Function for org creation exists" — no such function; the entire flow is RPC + triggers.
- ❌ "Schema renamed/dropped is_home column" — column still exists, partial unique index workspaces_is_home_idx still in place.
- ❌ "RLS hiding the home workspace from the user" — caller is organization_owner; org-admin SELECT policy on workspaces would return the row if it existed.
- ❌ "Recent migration changed the trigger contract" — trigger function body is current and correct; only the trigger DDL binding is missing.
- ❌ "Frontend JS layer needs a change" — once the DB state is correct, the existing `is_home=true` lookup works as designed.

## Resolution

**Status: RESOLVED. Primary bug fixed, all five UX improvements shipped.**

- root_cause: The `tr_ensure_home_workspace` trigger that auto-created an `is_home=TRUE, is_default=TRUE` "Home Workspace" on every `INSERT ON organizations` was dropped from production out-of-band (no migration drops it; production `pg_trigger` confirms its absence). Without the trigger, `create_business_organization` RPC creates only one workspace and never flags it as the org's home, so the cross-org copy/move flow's `is_home=true` lookup returns null and raises "Target organization has no HOME workspace". One affected org in prod: Lead Gen Jay (22c98dba-f169-40c8-9e93-547875c203ff).

- fix:
  - **Primary bug** — Migration `20260528052504_restore_home_workspace_invariant.sql` (commit `33e2810b`):
    1. Restores `tr_ensure_home_workspace` AFTER INSERT trigger on `organizations`. Function rewritten to create exactly one `is_home=TRUE, is_default=TRUE` workspace, skip personal orgs, idempotent guard against pre-existing workspaces.
    2. Updates `create_business_organization` RPC to use the trigger-created workspace and rename it to the user-supplied name (no second workspace insert, no unique-index collisions). Includes an inline safety-net INSERT in case the trigger is ever dropped again.
    3. Backfills any business org that currently lacks an `is_home` workspace by promoting its sole/oldest workspace.
  - **UX bugs 1-5** — commit `c351b1a9`:
    1. `CreateOrganizationDialog.tsx`: moved Move/Copy out of Advanced Settings into a primary two-card radio group with inline helper copy; removed the now-empty collapsible.
    2. `CopyToOrganizationDialog.tsx`: handoff checkbox auto-syncs with the target org's `cross_org_default` whenever the target changes (with a manual-override flag so manual toggles aren't clobbered).
    3. Same dialog — title, description, helper text, progress label, and CTA all update with the `removeSource` state (COPY vs MOVE).
    4. Same dialog — caption beneath the handoff checkbox shows whether the selection matches the target org's default ("Matches X's default") or is a one-off override, with a pointer to Settings → Organizations.
    5. `OrganizationsTab.tsx`: `cross_org_default` is now editable for owners/admins via a Select dropdown. New `updateOrganizationCrossOrgDefault` service function + `useUpdateCrossOrgDefault` hook.
  - **Test maintenance** — `src/test/rls-regression.test.ts`: updated to be trigger-aware (UPDATE the trigger-created workspace's name instead of INSERTing a new one). 20/20 passing.

- verification:
  - DB state on production confirmed via psql: trigger present, zero broken business orgs, zero orgs with multiple is_home workspaces, Lead Gen Jay's IMPORT workspace promoted to is_home=t/is_default=t. Migration registered in `supabase_migrations.schema_migrations`.
  - End-to-end RPC smoke test (in BEGIN/ROLLBACK with impersonated authenticated role): returns one correctly-flagged workspace.
  - Trigger-only smoke test (direct INSERT INTO organizations): returns one correctly-flagged workspace.
  - Full Vitest suite: 1423 / 1423 tests passing across 160 / 160 files. Zero regressions.
  - Production build: clean, 7.88s.
  - UX visual verification: deferred to Andrew (multi-step authenticated flow on app.callvaultai.com — Interceptor can't easily automate end-to-end with OAuth).

- files_changed:
  - supabase/migrations/20260528052504_restore_home_workspace_invariant.sql (new)
  - src/components/dialogs/CreateOrganizationDialog.tsx (UX rework)
  - src/components/dialogs/CopyToOrganizationDialog.tsx (UX rework)
  - src/components/settings/OrganizationsTab.tsx (editable cross-org default)
  - src/services/organizations.service.ts (+ updateOrganizationCrossOrgDefault)
  - src/hooks/useOrganizationMutations.ts (+ useUpdateCrossOrgDefault)
  - src/test/rls-regression.test.ts (trigger-aware setup)
  - .planning/debug/new-org-no-home-workspace.md (this file)

- commits:
  - 33e2810b — fix(debug): restore tr_ensure_home_workspace trigger so new business orgs get is_home
  - c351b1a9 — feat(ui): surface cross-org default and auto-sync handoff in transfer flow
