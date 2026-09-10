---
phase: 36-live-organizations
fixed_at: 2026-09-09T21:42:30Z
review_path: /Users/admin/dev/brain/main/.planning/phases/36-live-organizations/36-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-09-09T21:42:30Z
**Source review:** .planning/phases/36-live-organizations/36-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — `fix_scope: critical_warning`)
- Fixed: 3
- Skipped: 0
- Out of scope, not attempted: IN-01 (Info-level, excluded by `fix_scope`)

All work happened in an isolated git worktree (`gsd-reviewfix/36-*` branch, forked from `v2.2-event-resolution`) to avoid racing the foreground session. Each fix below was committed individually to that branch; the worktree cleanup step fast-forwards `v2.2-event-resolution` to include all three commits. No commits from this pass touch `main`, and this branch does not auto-deploy to Vercel production (only `main` does) — the two frontend fixes (WR-02, WR-03) and the frontend half of WR-01 require no separate deploy step beyond the normal branch workflow.

## Fixed Issues

### WR-01: `merge_organizations_atomic` / `unclaim_organization_domain_atomic` report success even when zero rows were affected

**Files modified:**
- `supabase/migrations/20260909010000_fix_merge_unclaim_rpc_row_count_guards.sql` (**new file**)
- `src/services/admin-organizations.service.ts`
- `src/pages/admin/OrganizationsSection.tsx`

**Commit:** `056a18c3` — `fix(36): WR-01 raise on zero-row merge/unclaim RPC writes, surface merged status in UI`

**Applied fix:**
- **Did not edit the already-applied migration** `20260908140001_create_org_merge_unclaim_admin_rpcs.sql` — per this task's constraint, that file is already live on production (`vltmrnjsubfzrgrtdqey`) and Postgres migrations are treated as append-only history in this repo. Instead authored a new forward migration, `20260909010000_fix_merge_unclaim_rpc_row_count_guards.sql`, following the milestone's established header/banner convention (Migration/Purpose/Author/Date, explicit rationale referencing both the original migration and the sibling `remove_organization_alias` pattern the review cited).
- The new migration `CREATE OR REPLACE FUNCTION`s both RPCs, unchanged except for adding `IF NOT FOUND THEN RAISE EXCEPTION ... END IF;` immediately after the `UPDATE` (merge) / `DELETE` (unclaim) statement, exactly as specified in the review's fix snippet. `REVOKE EXECUTE ... FROM PUBLIC/anon/authenticated` is reasserted defensively in the new file (Postgres preserves ACLs across `CREATE OR REPLACE FUNCTION` with an unchanged signature, so this was not strictly required, but keeps the new migration file self-contained).
- **Applied to TEST only** (`callvault-test`, ref `swjzxiddcrtaqixsfaac`) via `supabase db push --linked` (dry-run confirmed only the new file was pending — TEST was already current through `20260909000000`). **Verified via live introspection**: queried `pg_get_functiondef()` for both functions post-push and confirmed each now contains `IF NOT FOUND` / `RAISE EXCEPTION` (merge: 3 total `RAISE EXCEPTION` sites — role check, self-merge check, new NOT FOUND check; unclaim: 2 — role check, new NOT FOUND check), and confirmed `pg_proc.proacl` still shows only `postgres`/`service_role`, i.e. PUBLIC/anon/authenticated remain revoked. CLI was then relinked back to `vltmrnjsubfzrgrtdqey` (prod) and confirmed via `supabase/.temp/project-ref`; an unrelated drift in tracked CLI-cache files (`gotrue-version`/`rest-version`/`storage-migration`/`storage-version` — live prod service versions had simply moved since those tracked snapshots were last committed) was reverted with `git checkout --` before committing, so the fix commit carries only the intended migration file.
- **PRODUCTION APPLY — RESOLVED (2026-09-09).** Andrew explicitly authorized applying `20260909010000_fix_merge_unclaim_rpc_row_count_guards.sql` to production. Applied to `vltmrnjsubfzrgrtdqey` via `supabase db push --linked`, prod-ref guard confirmed via `supabase projects list` ● marker both before and after, and `supabase migration list --linked` confirms `20260909010000` is now Local==Remote on prod alongside the four Phase 36 core migrations and the Plan 05 admin-read-all policy (six total for this phase). No further action needed.
- Frontend half (no prod-apply dependency, safe on this branch): `AdminOrganization` now carries `canonical_organization_id`/`merged_at` (selected in `listAllOrganizations`); `OrganizationsSection.tsx`'s row renders a muted "Merged" badge next to the org name and replaces the live "Merge into…" button with a static "Merged {date}" label whenever `canonical_organization_id` is set, so an already-merged loser is visibly labeled instead of offering a fully-live re-merge action. `MergeOrganizationsDialog`'s winning-org dropdown was intentionally left untouched — out of this finding's explicit fix scope.
- **Not done (explicitly out of scope per the review's own fix text):** no new "already merged" guard was added inside `merge_organizations_atomic` itself (re-merging a loser is still technically possible at the RPC layer — the review's fix section only asked for the NOT FOUND guard plus the UI-level surfacing, not a DB-level block on re-targeting).

**Verification performed:** Tier 1 (re-read all three files post-edit) + Tier 2 (`npx tsc -p tsconfig.app.json --noEmit`, zero errors attributable to either touched TS/TSX file — pre-existing project errors elsewhere confirmed unrelated) + live TEST-database introspection for the SQL half (see above).

**Status:** `fixed: requires human verification`. Reasoning: (1) this touches SECURITY DEFINER RPCs that gate a production data-integrity path, and while TEST introspection confirms the deployed function body is exactly as intended, the new exception path was not exercised end-to-end (i.e., I did not invoke either RPC with a since-deleted org/domain id through the full edge-function → UI chain to observe the error surface, and did not re-run the existing `src/test/org-merge-unclaim-rpc.integration.test.ts` suite — full integration-test execution is out of scope for this fixer pass per its own verification-strategy rules); (2) production apply is a separate, explicitly gated step still awaiting human authorization regardless of code correctness. The UI half (service + `OrganizationsSection.tsx`) is lower-risk and type-checks clean, but is bundled into the same commit as the SQL fix per the review's own multi-file finding structure.

### WR-02: Domain-claim failure shows two different, inconsistent error messages at once

**Files modified:** `src/hooks/useOrganizationIdentity.ts`

**Commit:** `54491be8` — `fix(36): WR-02 remove duplicate toast from domain-claim error`

**Applied fix:** Removed the `onError` callback (the generic `toast.error(error.message)`) from `claimMutation` only. Confirmed via grep that `useOrganizationIdentity`/`claimDomain` has exactly one consumer (`OrganizationIdentitySection.tsx`), which already catches the rejection from `claimDomain` and renders its own precise `claimErrorCopy()`-mapped inline message for every `OrganizationIdentityError` code (including the default/unknown-code fallback) — so removing the hook-level toast leaves no error path unhandled. `addAliasMutation`/`removeAliasMutation` were deliberately left untouched: their callers (`handleAddAlias`/`handleRemoveAlias`) don't render their own message and rely entirely on the hook's toast, so they don't have the double-messaging problem WR-02 describes.

**Verification performed:** Tier 1 (re-read hook file, confirmed `addAliasMutation`/`removeAliasMutation` unchanged) + Tier 2 (`npx tsc -p tsconfig.app.json --noEmit`, zero errors in the touched file).

**Status:** `fixed`.

### WR-03: `VerifiedDomainBadge`'s click handler undoes its own hover-open on every mouse click

**Files modified:** `src/components/shared/VerifiedDomainBadge.tsx`

**Commit:** `c739d17e` — `fix(36): WR-03 stop click handler from re-closing hover-opened popover`

**Applied fix:** Changed the trigger button's `onClick` from `setOpen((prev) => !prev)` to `setOpen(true)`, exactly as the review's fix snippet specified. `onMouseEnter`/`onFocus` still own opening and `onMouseLeave`/`onBlur` still own closing — unchanged.

**Verification performed:** Tier 1 (re-read component, confirmed hover/focus/blur handlers untouched) + Tier 2 (`npx tsc -p tsconfig.app.json --noEmit`, zero errors in the touched file). Interactive/browser-level behavioral verification of the popover was not performed — out of this fixer pass's scope (end-to-end testing is deferred to the verifier phase per this role's verification strategy).

**Status:** `fixed`.

---

_Fixed: 2026-09-09T21:42:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
