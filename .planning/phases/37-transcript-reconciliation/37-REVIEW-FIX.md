---
phase: 37-transcript-reconciliation
fixed_at: 2026-09-10T20:10:00Z
review_path: .planning/phases/37-transcript-reconciliation/37-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 37: Transcript Reconciliation Code Review Fix Report

**Fixed at:** 2026-09-10T20:10:00Z
**Source review:** .planning/phases/37-transcript-reconciliation/37-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 3
- Fixed: 3
- Skipped: 0

IN-01 (Info-level) is out of `fix_scope: critical_warning` and was not attempted.

## Fixed Issues

### CR-01: `agreeing_recording_ids` computes the opposite of its documented "never lost a disagreement" semantics — overstates consensus

**Files modified:** `supabase/functions/_shared/transcript-reconciler.ts`, `supabase/functions/reconcile-transcripts/index.ts`, `supabase/functions/_shared/__tests__/transcript-reconciler.test.ts`
**Commit:** `a3a5ef48`
**Applied fix:** `buildReconciledSegment` previously inferred a recording's dissent by absence from EVERY token's `agreeing_recording_ids` (OR-semantics) — a recording that matched even one shared token anywhere in the segment escaped the dissenting set even if it lost every other token-level vote. Changed to track dissent per-position directly: `resolveTokenDisagreement`'s call site in `index.ts` now computes `dissenting_recording_ids` (candidates that lost each disagreement) and threads it through to `buildReconciledSegment`, which unions dissent across all positions — a recording is now excluded from `agreeing_recording_ids` if it lost even one disagreement anywhere in the segment (AND-semantics, matching the function's own documented contract). Added a regression test (`transcript-reconciler.test.ts`, "CR-01 regression") proving a recording that agrees on some tokens but dissents on others within the same segment is fully excluded from `agreeing_recording_ids`. Full unit suite (29 tests) passes.
**Deploy status:** Pure code module + edge function source change on a non-auto-deploying branch (`v2.2-event-resolution`). No production deploy action was taken as part of this fix; a `supabase functions deploy reconcile-transcripts` (guarded apply) is still required to make this change live, same as WR-01/WR-02 below.

### WR-01: `transcript_chunks` fetch has no `ORDER BY` — backbone-source selection not guaranteed stable across sweep re-runs

**Files modified:** `supabase/functions/reconcile-transcripts/index.ts`
**Commit:** `9a2c1884`
**Applied fix:** Added `.order('canonical_recording_id', { ascending: true }).order('chunk_index', { ascending: true })` to the `transcript_chunks` select query, giving `bucketChunks`/`group.members` a deterministic order independent of Postgres's physical row order (which otherwise could vary between sweep re-runs and change `tokenizeAndAlignText`'s alignment backbone choice). Verified with `deno check` (no type errors).
**Deploy status:** `reconcile-transcripts` is already live in production. This fix requires a guarded `supabase functions deploy reconcile-transcripts` to take effect — **not performed by this agent**. Flag for a human-authorized deploy.

### WR-02: Per-event DELETE-then-INSERT is not transactional or lock-guarded — overlapping sweep invocations can produce duplicate segment rows

**Files modified:** `supabase/migrations/20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql` (new), `supabase/functions/reconcile-transcripts/index.ts`
**Commit:** `75ac36fd`
**Applied fix:** Added a new `reconcile_transcript_segments_atomic(p_event_id, p_organization_id, p_rows)` SECURITY DEFINER RPC that wraps the delete-then-insert in a single transaction and holds a `pg_advisory_xact_lock(hashtext(event_id::text))` for the duration of the call — overlapping sweep invocations for the SAME event now serialize instead of interleaving delete/insert calls (which previously could produce duplicate rows, since no UNIQUE constraint exists by design, or leave the event with zero/partial rows depending on interleaving order). Different events use different lock keys, so unrelated concurrent sweeps are never serialized against each other. `index.ts`'s write path now calls this RPC via `supabase.rpc(...)` instead of two independent `delete()`/`insert()` calls.

**Orchestrator correction (post-fix, pre-authorization):** the fixer's migration only had `REVOKE ALL ... FROM PUBLIC`, not explicit per-role revokes. Applied to TEST (`swjzxiddcrtaqixsfaac`) and introspected live: `information_schema.routine_privileges` showed EXECUTE still granted to **both `anon` and `authenticated`** — Supabase's project-level default privileges grant EXECUTE on new functions directly to those roles (not merely via the `PUBLIC` pseudo-role), so `REVOKE ... FROM PUBLIC` alone does not remove them. This meant any client, including unauthenticated `anon` requests, could have called this RPC directly with an arbitrary `event_id`/`organization_id`/`rows` payload and written fabricated reconciled-transcript content for **any** event, completely bypassing the sweep's own `event_match_decisions` gating and same-org bucketing — a more severe issue than the original WR-02 finding. Fixed by adding explicit `REVOKE EXECUTE ... FROM anon` and `REVOKE EXECUTE ... FROM authenticated` statements (mirroring the working `merge_organizations_atomic`/`unclaim_organization_domain_atomic` precedent in `20260908140001_create_org_merge_unclaim_admin_rpcs.sql`, which already does this correctly). Re-verified live on TEST: only `postgres`/`service_role` retain EXECUTE. Migration file updated to match; committed as `28eb0e15`.

**Deploy status:** `reconcile-transcripts` is already live in production and the `reconciled_transcript_segments` table already exists in prod. Both the (now-corrected) migration and the corresponding edge function change require the same human-authorized guarded-apply discipline as every other production change in this milestone. Applying the migration first, then deploying the edge function, avoids a window where the deployed function calls an RPC that does not yet exist in prod.

## Skipped Issues

None — all in-scope findings (CR-01, WR-01, WR-02) were fixed. IN-01 was excluded by `fix_scope: critical_warning` (Info-level, not attempted).

## Outstanding Human Action Required

Before these fixes take effect in production:
1. Review and apply `supabase/migrations/20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql` to the production database (guarded apply, prod ref `vltmrnjsubfzrgrtdqey` per `.env`).
2. Deploy `reconcile-transcripts` to Supabase Cloud (`supabase functions deploy reconcile-transcripts`) to ship all three fixes (CR-01, WR-01, WR-02) together.
3. Confirm no other caller of the old two-call delete+insert path exists before removing/deprecating direct table access, if that cleanup is desired later.

---

_Fixed: 2026-09-10T20:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
