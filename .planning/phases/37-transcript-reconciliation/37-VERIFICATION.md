---
phase: 37-transcript-reconciliation
verified: 2026-09-12T13:52:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "The reconciled transcript mechanism live in production correctly implements RECON-05/RECON-06 (AND-semantics dissent tracking) and the atomic delete+rebuild guarantee (WR-02) from code review"
  gaps_remaining: []
  regressions: []
---

# Phase 37: Transcript Reconciliation Verification Report

**Phase Goal:** A derived, regenerable canonical transcript across an event's captures, provenance-carrying, with source data never overwritten.
**Verified:** 2026-09-12T13:52:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (prod deploy of code-review fixes)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `reconciled_transcript_segments` exists with FORCE RLS + client-facing SELECT policy gated by a SECURITY DEFINER helper | ✓ VERIFIED (regression check) | Unaffected by this gap-closure round. Previously confirmed live on prod; migration `20260910000000` still present in `supabase migration list --linked` output re-run in this verification. |
| 2 | Two recordings' overlapping chunks align on a content-derived timeline; adjacent-non-overlapping chunks stay separate; single-source intervals never marked consensus; fuzzy token matching | ✓ VERIFIED (regression check) | `transcript-reconciler.ts` deployed to prod is now byte-identical (`diff` exit 0) to the repo version, which carries the full unit-tested implementation (29/29 tests passing per prior verification, unaffected by this round). |
| 3 | Reconciliation write path gates on `event_match_decisions.decision='merge_applied'`, buckets same-org-only, reads per-workspace lexicon, persists via delete+rebuild, never touches `transcript_chunks`/`embedded_at`/embedding pipelines | ✓ VERIFIED | Re-confirmed in the newly-downloaded prod source: `.order('event_id', ...)` gating query intact, plus new deterministic `.order('canonical_recording_id', ...).order('chunk_index', ...)` (WR-01 fix) at lines 285-286. Grep-clean for `upsert/onConflict/embedded_at/process-embeddings/embed-chunks`. |
| 4 | A read-only "Reconciled" tab renders in `CallDetailDialog`, absent unless 2+ resolved recordings; provenance badge shows only for 2+ agreeing sources; RLS-gated read | ✓ VERIFIED (regression check) | Frontend code unaffected by this deploy — unchanged since prior VERIFIED status. |
| 5 | The migration and edge function are live in production, with FORCE RLS/policies/SECURITY DEFINER helper confirmed by direct introspection, mechanism inert-by-default | ✓ VERIFIED (regression check) | Unchanged from prior verification; still holds. |
| 6 | The reconciliation write path never mutates/overwrites `transcript_chunks`, never writes `embedded_at`/embedding, never calls an embedding-pipeline function | ✓ VERIFIED | Re-confirmed via direct grep of the freshly-downloaded prod source (`supabase functions download reconcile-transcripts --project-ref vltmrnjsubfzrgrtdqey`): zero matches for `upsert/onConflict/embedded_at/process-embeddings/embed-chunks` in either `index.ts` or `transcript-reconciler.ts`. |
| 7 | The mechanism live in production correctly implements the reviewed/fixed provenance semantics (RECON-05/06 accuracy) and the atomicity/determinism fixes from code review | ✓ VERIFIED — GAP CLOSED | Independently re-verified from scratch, not trusting the orchestrator's description: (1) `supabase/.temp/project-ref` confirms the linked project is `vltmrnjsubfzrgrtdqey` (prod). (2) `supabase migration list --linked` shows `20260910010000` present in both Local and Remote columns — applied to prod. (3) `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` shows `reconcile-transcripts` at VERSION 2 (was 1), updated `2026-09-12 13:46:27`. (4) Downloaded the live deployed source fresh via `supabase functions download reconcile-transcripts --project-ref vltmrnjsubfzrgrtdqey` into a clean scratch dir. `diff` against the repo copies of both `supabase/functions/reconcile-transcripts/index.ts` and `supabase/functions/_shared/transcript-reconciler.ts` returned exit 0 with zero output — byte-identical to the reviewed/fixed repo code. (5) Grepped the downloaded source directly: `transcript-reconciler.ts` contains the AND-semantics fix — `dissenting_recording_ids` threaded per-token-position, a `dissenting` Set built by iterating `t.dissenting_recording_ids`, and `agreeingRecordingIds = sourceRecordingIds.filter((id) => !dissenting.has(id))` (lines 543-592) — replacing the old `everyAgreeingId`-based OR-semantics bug. `index.ts` contains `supabase.rpc('reconcile_transcript_segments_atomic', ...)` (line 440, WR-02 fix) instead of raw delete+insert, plus the deterministic `ORDER BY canonical_recording_id, chunk_index` (WR-01 fix, lines 285-286). (6) Queried `information_schema.routine_privileges` directly against prod via `supabase db query --linked`: only `service_role` and `postgres` hold EXECUTE on `reconcile_transcript_segments_atomic` — anon/authenticated correctly have no grant. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql` | Table + FORCE RLS + SECURITY DEFINER helper | ✓ VERIFIED | Regression-confirmed present in `migration list --linked` against prod. |
| `supabase/functions/_shared/transcript-reconciler.ts` | Pure reconciliation module, AND-semantics dissent | ✓ VERIFIED (repo == prod) | `diff` of freshly-downloaded prod source vs. repo: exit 0, no diff. |
| `supabase/functions/reconcile-transcripts/index.ts` | Forward-only sweep edge function, atomic RPC write | ✓ VERIFIED (repo == prod) | `diff` of freshly-downloaded prod source vs. repo: exit 0, no diff. Deployed at VERSION 2. |
| `supabase/migrations/20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql` | Atomic delete+insert RPC (WR-02 fix) | ✓ VERIFIED — now applied to prod | `supabase migration list --linked` shows `20260910010000` in both Local and Remote. `routine_privileges` query confirms only `service_role`/`postgres` have EXECUTE. |
| `src/services/reconciledTranscript.service.ts`, `src/hooks/useReconciledTranscript.ts` | RLS-gated reads + eligibility/labels | ✓ VERIFIED (regression) | Unchanged since prior verification. |
| `src/components/call-detail/CallReconciledTranscriptTab.tsx`, `ReconciledSegmentProvenanceBadge.tsx` | Read-only tab + provenance badge | ✓ VERIFIED (regression) | Unchanged since prior verification. |
| `src/test/rls-regression.test.ts` bespoke block | Cross-org isolation proof | ✓ VERIFIED (regression) | Unaffected by this deploy — no RLS policy changes in this gap-closure round. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `reconcile-transcripts/index.ts` (prod) | `reconcile_transcript_segments_atomic` RPC | `supabase.rpc(...)` call | ✓ WIRED — was DRIFTED, now closed | Previously the deployed function used raw `.delete()`+`.insert()`; freshly-downloaded prod source now shows the `supabase.rpc('reconcile_transcript_segments_atomic', ...)` call at line 440, matching repo. |
| `reconcile_transcript_segments_atomic` RPC | grant privileges | `information_schema.routine_privileges` | ✓ WIRED | Only `service_role`/`postgres` hold EXECUTE, confirmed via live `supabase db query --linked` against prod. |
| All other links (RLS policy → helper, tab → hook, dialog → tab, index.ts → event_match_decisions gating) | — | — | ✓ WIRED (regression) | Unaffected by this deploy; unchanged since prior verification. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RECON-01 | 37-02, 37-03 | Content-derived timeline alignment | ✓ SATISFIED | Unchanged, regression-confirmed. |
| RECON-02 | 37-02 | Weighted-vote token disagreement resolution | ✓ SATISFIED | Unchanged, regression-confirmed. |
| RECON-03 | 37-02 | Per-workspace entity lexicon tiebreak | ✓ SATISFIED | Unchanged, regression-confirmed. |
| RECON-04 | 37-01, 37-03 | Derived layer, source never overwritten, regenerable | ✓ SATISFIED | Re-confirmed grep-clean on freshly-downloaded prod source. |
| RECON-05 | 37-01, 37-02, 37-04 | Segment records which recordings supplied AND agreed | ✓ SATISFIED — now true in prod, not just repo | AND-semantics `dissenting_recording_ids` fix confirmed live in downloaded prod source. |
| RECON-06 | 37-01, 37-02, 37-04 | Single-source shown as single-source, never consensus | ✓ SATISFIED | Structural override for single-source segments confirmed present in prod source (unchanged from prior verification, and unaffected by the CR-01 fix regardless). |
| RECON-07 | 37-03 | No silent re-embedding | ✓ SATISFIED | Re-confirmed grep-clean on freshly-downloaded prod source. |

All seven requirements are now genuinely satisfied end-to-end in the code actually running in production — not just in the repo.

### Anti-Patterns Found

None. Freshly-downloaded prod source is grep-clean for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER and for mutation/embedding anti-patterns (`upsert`/`onConflict`/`embedded_at`/`process-embeddings`/`embed-chunks`).

### Human Verification Required

None. All truths verifiable by direct production introspection (migration list, function list, function source download + diff + grep, and a live `routine_privileges` query), matching the verification style of the original phase.

### Gaps Summary

The single gap from the prior verification (production running the pre-review-fix version of `reconcile-transcripts`) is closed. Independent re-verification — not trusting the orchestrator's description of what was done — confirms:

1. The linked Supabase project is genuinely prod (`vltmrnjsubfzrgrtdqey`, confirmed via `supabase/.temp/project-ref`), not test.
2. Migration `20260910010000` (the atomic RPC + REVOKE EXECUTE) is applied to prod (`Local` and `Remote` both show the migration in `supabase migration list --linked`).
3. `reconcile-transcripts` is deployed at VERSION 2 (was 1), confirmed via `supabase functions list --project-ref vltmrnjsubfzrgrtdqey`.
4. The live deployed source, downloaded fresh in this verification session, is byte-identical (`diff` exit 0) to the reviewed/fixed repo code for both `index.ts` and `transcript-reconciler.ts`.
5. The deployed source directly contains the AND-semantics dissent fix (`dissenting_recording_ids` threading, CR-01) and the atomic RPC call (WR-02) plus the deterministic `ORDER BY` (WR-01) — confirmed by grep of the downloaded files, not by trusting the diff alone.
6. `EXECUTE` on `reconcile_transcript_segments_atomic` is correctly scoped to `service_role`/`postgres` only, confirmed via a live SQL query against prod.

Phase 37 goal — "A derived, regenerable canonical transcript across an event's captures, provenance-carrying, with source data never overwritten" — is now genuinely achieved by the code actually running in production, with all seven roadmap success criteria (RECON-01 through RECON-07) satisfied end-to-end.

---

_Verified: 2026-09-12T13:52:00Z_
_Verifier: Claude (gsd-verifier)_
