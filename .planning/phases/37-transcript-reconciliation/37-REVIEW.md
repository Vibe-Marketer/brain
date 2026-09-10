---
phase: 37-transcript-reconciliation
reviewed: 2026-09-10T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/components/CallDetailDialog.tsx
  - src/components/call-detail/CallDetailHeader.tsx
  - src/components/call-detail/CallReconciledTranscriptTab.tsx
  - src/components/call-detail/ReconciledSegmentProvenanceBadge.tsx
  - src/hooks/useReconciledTranscript.ts
  - src/lib/query-config.ts
  - src/services/reconciledTranscript.service.ts
  - src/test/rls-regression.test.ts
  - src/types/supabase.ts
  - supabase/functions/_shared/__tests__/transcript-reconciler.test.ts
  - supabase/functions/_shared/speaker-resolver.ts
  - supabase/functions/_shared/transcript-reconciler.ts
  - supabase/functions/reconcile-transcripts/__tests__/reconcile-transcripts.integration.test.ts
  - supabase/functions/reconcile-transcripts/index.ts
  - supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql
  - supabase/migrations/20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 37: Code Review Report (Iteration 2 — re-review)

**Reviewed:** 2026-09-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found (info only, no blocker/warning survives)

## Summary

Re-review of the fix-and-re-review loop's iteration 1 findings (CR-01, WR-01, WR-02, and the orchestrator's own additional REVOKE gap). All three fixes were traced end-to-end against the actual code and verified correct:

- **CR-01 (dissent OR→AND semantics):** `resolveTokenDisagreement` no longer implicitly infers dissent; `index.ts` now explicitly threads `dissenting_recording_ids` per disagreement position (`transcript-reconciler.ts:405-407` computed in `index.ts:405-408`), and `buildReconciledSegment` (`transcript-reconciler.ts:569-573`) accumulates a `dissenting` set across *all* positions before computing `agreeingRecordingIds`, so a recording that wins even one shared token but loses another is correctly excluded (AND-semantics). The regression test at `supabase/functions/_shared/__tests__/transcript-reconciler.test.ts:379-409` reproduces exactly the OR-vs-AND bug shape (partial agreement on 3/5 tokens, must still be excluded) and passes against the new logic. Single-source groups are still force-set to their own lone source regardless of the dissent computation (`transcript-reconciler.ts:583`), so RECON-06 is unaffected.
- **WR-01 (non-deterministic backbone):** `index.ts:271-286` now has `.order('canonical_recording_id', ...).order('chunk_index', ...)` on the `transcript_chunks` fetch, with an inline comment explaining why (`tokenizeAndAlignText` picks `group.members[0]` as the alignment backbone). Correct and sufficient — Postgres row order is otherwise unspecified without an ORDER BY.
- **WR-02 (non-atomic delete+insert):** `index.ts:440-451` now calls a single `reconcile_transcript_segments_atomic` RPC instead of two separate REST calls. The RPC (migration `20260910010000`) wraps `DELETE` + conditional `INSERT` in one implicit transaction and serializes same-event concurrent invocations via `pg_advisory_xact_lock(hashtext(p_event_id::text))`. Signature match verified: `index.ts` passes `p_event_id`, `p_organization_id`, `p_rows` (named params, order-independent) against the RPC's `(p_event_id UUID, p_organization_id UUID, p_rows JSONB)` signature; the `p_rows` JSON shape (`segment_text`, `start_time`, `end_time`, `source_recording_ids`, `agreeing_recording_ids`, `signals`) matches exactly what the RPC's `INSERT ... SELECT` extracts via `r->>`/`r->`. All rows in a bucket share one `organization_id` by construction (the loop is already scoped to one `(event, org)` bucket per RPC call), so passing a single `p_organization_id` for the whole batch is correct, not a widening.
- **Orchestrator's REVOKE gap:** migration `20260910010000` now has explicit `REVOKE EXECUTE ... FROM PUBLIC`, `FROM anon`, and `FROM authenticated`, plus `GRANT ... TO service_role` — verified present at lines 94-97, matching the documented `merge_organizations_atomic` precedent. The other migration's SECURITY DEFINER helper (`user_can_view_event_reconciliation`, migration `20260910000000`) is correctly left un-revoked — it must remain callable by `authenticated` because Postgres RLS policy evaluation invokes it under the querying role's privileges, and this matches the codebase's own precedent (`is_organization_admin_or_owner` is never revoked either).

No other RPCs or SECURITY DEFINER functions are introduced by this phase's migrations, so there is no other missing REVOKE to find within the reviewed scope.

**Cross-file/RLS proof:** `src/test/rls-regression.test.ts` (~line 1961-2025) seeds a real `reconciled_transcript_segments` row and asserts both a positive case (Org A's owner can read it) and the actual leak-guard (Org B's JWT reads zero rows), which is the correct shape for the first client-readable ledger in this milestone.

IN-01 (functional eligibility-count gap, out of critical_warning scope per plan) is unchanged from iteration 1 and intentionally left unfixed — not re-flagged as new.

## Info

### IN-01: `useReconciliationEligibility`'s `recordingCount` includes non-reconciliation-eligible recordings

**File:** `src/services/reconciledTranscript.service.ts:82-89`
**Issue:** `getReconciliationEligibility` counts *all* `recordings` rows sharing `event_id`, not just the subset that passed `event_match_decisions.decision = 'merge_applied'` gating that `reconcile-transcripts/index.ts` actually requires before sweeping. A recording can share `event_id` with another via a *proposed* (not yet applied) match decision, so the "N recordings" badge and tab-visibility gate in `CallDetailHeader`/`CallDetailDialog` can show `isReconciliationEligible = true` (`recordingCount >= 2`) for an event that the backend sweep will never actually reconcile, leaving the "Reconciliation pending" empty state showing indefinitely for that event.
**Fix:** Unchanged from iteration 1 — this was scoped out as info-level/functional-gap, not a correctness bug in the reviewed diff itself (the two pieces of code are consistent with their own local contracts; the gap is a cross-system eligibility mismatch). Left as-is per the plan's scope.

---

_Reviewed: 2026-09-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
