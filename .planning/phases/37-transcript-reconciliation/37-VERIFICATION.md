---
phase: 37-transcript-reconciliation
verified: 2026-09-10T20:08:42Z
status: gaps_found
score: 6/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The reconciled transcript mechanism live in production correctly implements RECON-05/RECON-06 (each segment records which recordings supplied AND agreed; single-source is never shown as consensus) and the non-destructive delete+rebuild guarantees found in the code-review fix pass"
    status: failed
    reason: >
      The code review (37-REVIEW.md) found a Critical bug (CR-01) in
      buildReconciledSegment's agreeing_recording_ids computation: it used
      OR-semantics (a recording only needed to agree on ONE token anywhere
      in a segment to be counted as "agreeing"), overstating consensus
      versus the function's own documented AND-semantics contract. This was
      fixed in the repo (commit a3a5ef48) along with WR-01 (nondeterministic
      alignment backbone, commit 9a2c1884) and WR-02 (non-atomic
      delete+insert allowing duplicate rows on overlapping sweeps, commits
      75ac36fd/ca3c3b71), and 37-REVIEW.md (iteration 2) confirms all three
      fixes are correct when read against the local repo. However, direct
      introspection of the LIVE production Supabase project
      (vltmrnjsubfzrgrtdqey) shows none of these fixes are deployed:
      `supabase migration list --linked` shows migration
      20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql as
      Local-only (blank Remote column) — not applied to prod. `supabase
      functions list` shows reconcile-transcripts still at VERSION 1,
      updated_at 2026-09-10 19:47:00 UTC (the original Plan-05 deploy,
      never redeployed). Downloading the live deployed function source
      (`supabase functions download reconcile-transcripts --project-ref
      vltmrnjsubfzrgrtdqey`) confirms the deployed
      transcript-reconciler.ts still contains the exact pre-fix OR-semantics
      dissent logic (`everyAgreeingId` / `if (!everyAgreeingId.has(id))
      dissenting.add(id)`), and the deployed index.ts still does two
      separate `.delete()` + `.insert()` calls (no `supabase.rpc(...)` to
      the atomic RPC) with only `.order('event_id', ...)` on the
      transcript_chunks fetch (no canonical_recording_id/chunk_index
      ordering). 37-REVIEW-FIX.md itself flags this under "Outstanding
      Human Action Required" (apply migration 20260910010000, redeploy the
      function) but no subsequent plan, commit, or STATE.md entry records
      that this was ever done. STATE.md and 37-05-SUMMARY.md both predate
      the review-fix commits and describe the phase as "complete... shipped
      to production" without qualification, which is not true of the
      reviewed/fixed code — production is running the pre-review-fix
      version.
    artifacts:
      - path: "supabase/functions/reconcile-transcripts/index.ts"
        issue: "Repo version (delete+insert replaced with atomic RPC call, ORDER BY added) is correct and matches 37-REVIEW.md iteration 2, but the version LIVE in production is the pre-fix version with none of these changes."
      - path: "supabase/functions/_shared/transcript-reconciler.ts"
        issue: "Repo version has AND-semantics dissent tracking (dissenting_recording_ids threaded from index.ts); the version LIVE in production still has the OR-semantics bug that lets a recording claim 'agreeing' status after losing every other token-level vote in a segment."
      - path: "supabase/migrations/20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql"
        issue: "Applied to TEST (swjzxiddcrtaqixsfaac, confirmed via supabase migration list --linked) but NOT applied to production (vltmrnjsubfzrgrtdqey, confirmed Local-only via the same command against prod)."
    missing:
      - "Guarded prod apply of migration 20260910010000 (reconcile_transcript_segments_atomic RPC + REVOKE EXECUTE from anon/authenticated), following the same prod-ref-guard discipline as 37-05."
      - "Redeploy of reconcile-transcripts to prod carrying the CR-01/WR-01/WR-02 fixes, in the correct order (migration first, then function, per 37-REVIEW-FIX.md's own stated deploy-order caution)."
      - "Post-deploy introspection proving the live function version bumped past 1 and the deployed source no longer contains the OR-semantics dissent bug (mirroring the intro­spection style already used in 37-05-SUMMARY.md)."
      - "A STATE.md / REQUIREMENTS.md note (or a new 37-06 plan) recording that the review-fix deploy happened, so 'Phase 37 complete, shipped to production' becomes true of the reviewed code, not just the pre-review code."
---

# Phase 37: Transcript Reconciliation Verification Report

**Phase Goal:** A derived, regenerable canonical transcript across an event's captures, provenance-carrying, with source data never overwritten.
**Verified:** 2026-09-10T20:08:42Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `reconciled_transcript_segments` exists with FORCE RLS + client-facing SELECT policy gated by a SECURITY DEFINER helper, and is registered in the cross-org isolation harness | ✓ VERIFIED | `supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql` present with FORCE RLS + 2 policies + `user_can_view_event_reconciliation` SECURITY DEFINER helper. Live on TEST and PROD confirmed by direct `supabase db query --linked` in 37-05-SUMMARY.md and independently re-confirmed here: `pg_class.relforcerowsecurity=true` on prod, `pg_policies` shows exactly 2 policies, `pg_proc.prosecdef=true` for the helper. `src/test/rls-regression.test.ts` bespoke block (lines ~1964-2025) ran live against TEST in this verification: "Org A ... reads the reconciled segment" and "Org B ... cannot read the reconciled segment" both PASS. |
| 2 | Two recordings' overlapping chunks align on a content-derived timeline (±20s tolerance); adjacent-non-overlapping chunks stay separate; single-source intervals never marked consensus; fuzzy token matching via fastest-levenshtein | ✓ VERIFIED | `supabase/functions/_shared/transcript-reconciler.ts` implements `alignChunksToTimeline` (union-find over `intervalsOverlapWithTolerance`, imported not reimplemented), `tokensMatch`/`tokenizeAndAlignText` (length-scaled fuzzy DP), `resolveTokenDisagreement` (weighted vote → lexicon tiebreak → deterministic `PROVIDER_PRIORITY_ORDER` fallback), `buildReconciledSegment`. Ran the full suite live in this verification: `npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` → 29/29 PASS, including the CR-01 regression test added post-review. |
| 3 | The reconciliation write path gates on `event_match_decisions.decision='merge_applied'` (not raw `event_id`), buckets same-org-only before pairing, reads a per-workspace entity lexicon, and persists via full delete+rebuild, never touching `transcript_chunks`/`embedded_at`/embedding pipelines | ⚠️ PARTIAL — correct in repo, NOT what is live in prod | Repo `reconcile-transcripts/index.ts` grep-confirms `event_match_decisions` gating, SAFE-04 bucketing, and (post-fix) a call to `reconcile_transcript_segments_atomic` RPC instead of raw delete+insert. **However**, the function version actually deployed to production (`vltmrnjsubfzrgrtdqey`) is VERSION 1 / updated 2026-09-10 19:47:00 UTC — the original Plan-05 deploy — and downloading its live source confirms it still does two separate `.delete()`/`.insert()` calls (no RPC) and lacks the deterministic `ORDER BY` fix. The gating/bucketing/no-mutation guarantees (RECON-04/07) DO hold in the currently-deployed version (grep-clean for upsert/embedded_at/embed refs), but the RECON-05/06 provenance-accuracy fix (CR-01) and the WR-02 race-condition fix do not. See Gap below. |
| 4 | A read-only "Reconciled" tab renders in `CallDetailDialog`, absent (not disabled) unless the event has 2+ resolved recordings; provenance badge shows only for 2+ agreeing sources; RLS-gated read | ✓ VERIFIED | `src/components/CallDetailDialog.tsx` conditionally renders `SelectionButton` + `CallReconciledTranscriptTab` on `isReconciliationEligible` (grep-confirmed at lines 145/611/653-654). `ReconciledSegmentProvenanceBadge.tsx` returns `null` when `!isMultiSource` (agreeing_recording_ids.length < 2), confirmed by direct read. `CallDetailHeader.tsx` renders the "N recordings" badge only when `isReconciliationEligible`. `reconciledTranscript.service.ts` reads `reconciled_transcript_segments` via a direct RLS-gated select (relies on Plan 01's policy, no separate widening). `rtk tsc -p tsconfig.app.json` baseline unchanged at 321 pre-existing errors (none new). |
| 5 | The migration and edge function are live in production, with FORCE RLS/policies/SECURITY DEFINER helper confirmed by direct introspection, and the mechanism is inert-by-default (no reconciled rows for non-eligible orgs) | ✓ VERIFIED | Re-confirmed independently in this verification: `supabase migration list --linked` (prod) shows `20260910000000` applied; `reconciled_transcript_segments` table/policies/helper live per direct query. `event_match_decisions` gating means zero rows are currently eligible — mechanism genuinely inert. This truth is about the ORIGINAL Plan-05 apply and holds true as stated. |
| 6 | The reconciliation write path never mutates/overwrites `transcript_chunks`, never writes `embedded_at`/embedding, never calls an embedding-pipeline function | ✓ VERIFIED | Both the repo version and the currently-deployed prod version are grep-clean for `\.upsert\(|onConflict|embedded_at|process-embeddings|embed-chunks`. This guarantee held in both the pre-fix and post-fix code — unaffected by the CR-01/WR-01/WR-02 gap. |
| 7 | The mechanism live in production correctly implements the reviewed/fixed provenance semantics (RECON-05/06 accuracy) and the atomicity/determinism fixes from code review | ✗ FAILED | See Gap above. Code review found and fixed a Critical correctness bug (CR-01) plus two Warnings (WR-01, WR-02); the fixes are correct and tested in the repo but were never deployed to production. Production is running the pre-review-fix `reconcile-transcripts` (version 1) and pre-fix `transcript-reconciler.ts` logic. |

**Score:** 6/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260910000000_create_reconciled_transcript_segments.sql` | Table + FORCE RLS + SECURITY DEFINER helper | ✓ VERIFIED | Present, applied to TEST and PROD, introspection-confirmed |
| `supabase/functions/_shared/transcript-reconciler.ts` | Pure reconciliation module | ✓ VERIFIED (repo) / ⚠️ STALE (prod) | 29/29 unit tests pass in repo; prod-deployed copy is the pre-CR-01-fix version |
| `supabase/functions/reconcile-transcripts/index.ts` | Forward-only sweep edge function | ✓ VERIFIED (repo) / ⚠️ STALE (prod) | Repo version calls the atomic RPC + deterministic ORDER BY; prod-deployed version (v1) does neither |
| `supabase/migrations/20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql` | Atomic delete+insert RPC (WR-02 fix) | ⚠️ TEST-ONLY | Applied to TEST (`swjzxiddcrtaqixsfaac`), confirmed NOT applied to prod (`vltmrnjsubfzrgrtdqey`) via `supabase migration list --linked` |
| `src/services/reconciledTranscript.service.ts`, `src/hooks/useReconciledTranscript.ts` | RLS-gated reads + eligibility/labels | ✓ VERIFIED | Present, wired, type-checks clean |
| `src/components/call-detail/CallReconciledTranscriptTab.tsx`, `ReconciledSegmentProvenanceBadge.tsx` | Read-only tab + provenance badge | ✓ VERIFIED | Conditional rendering and badge-visibility logic confirmed by direct code read |
| `src/test/rls-regression.test.ts` bespoke block | Cross-org isolation proof | ✓ VERIFIED | Ran live against TEST in this verification: both assertions PASS |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `reconciled_transcript_segments` SELECT policy | `user_can_view_event_reconciliation` | RLS USING clause | ✓ WIRED | Confirmed via migration + prod `pg_proc`/`pg_policies` introspection |
| `transcript-reconciler.ts` | `speaker-resolver.ts` | import of interval primitives | ✓ WIRED | `deriveAbsoluteInterval`/`intervalsOverlapWithTolerance`/`CLOCK_DRIFT_TOLERANCE_MS` additively exported and imported, no duplicated DP math |
| `reconcile-transcripts/index.ts` | `event_match_decisions` | gating join before pairing | ✓ WIRED | Two-step gating query confirmed in both repo and deployed-prod source |
| `reconcile-transcripts/index.ts` | `reconciled_transcript_segments` | write path | ⚠️ DRIFTED | Repo: atomic RPC (`reconcile_transcript_segments_atomic`). Deployed prod: raw `.delete()` + `.insert()` (pre-fix). Both are non-upsert delete+rebuild, so RECON-04's "no UNIQUE conflict target" holds either way, but the WR-02 race-condition fix is not live. |
| `CallReconciledTranscriptTab.tsx` | `useReconciledTranscript` | hook call | ✓ WIRED | Confirmed by direct read |
| `CallDetailDialog.tsx` | `CallReconciledTranscriptTab` | conditional Tabs mount | ✓ WIRED | Confirmed by grep + read: gated on `isReconciliationEligible` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RECON-01 | 37-02, 37-03 | Content-derived timeline alignment | ✓ SATISFIED | Pure module + edge function, unit-tested |
| RECON-02 | 37-02 | Weighted-vote token disagreement resolution | ✓ SATISFIED | Unit-tested, deterministic proof passes |
| RECON-03 | 37-02, 37-03 | Per-workspace entity lexicon tiebreak | ✓ SATISFIED | Lexicon built per-org in edge function, consumed by pure module |
| RECON-04 | 37-01, 37-03 | Derived layer, source never overwritten, regenerable | ✓ SATISFIED | Grep-clean for upsert/mutation in both repo and deployed-prod code; delete+rebuild in both versions |
| RECON-05 | 37-01, 37-02, 37-04 | Segment records which recordings supplied AND agreed | ⚠️ PARTIALLY SATISFIED | Correct in repo (CR-01 fixed); the semantics actually live in production still overstate consensus (pre-fix OR-semantics) |
| RECON-06 | 37-01, 37-02, 37-04 | Single-source shown as single-source, never consensus | ✓ SATISFIED (this specific guarantee unaffected by CR-01) | `buildReconciledSegment`'s structural override (`coverage === 'single_source' ? sourceRecordingIds : ...`) forces single-source segments to their own lone source regardless of the dissent bug — confirmed present in both repo and deployed-prod source |
| RECON-07 | 37-03 | No silent re-embedding | ✓ SATISFIED | Grep-clean in both repo and deployed-prod code; manual sweep proof in 37-05-SUMMARY.md |

REQUIREMENTS.md traceability table marks RECON-01..07 as `Complete` for Phase 37 — six of seven are genuinely satisfied end-to-end including in production; RECON-05 is satisfied in the repo but not fully in the currently-deployed production code (see gap).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (production deployment state, not a file) | — | Reviewed/fixed code (CR-01 critical, WR-01, WR-02) exists only in the repo and on TEST; production still runs the pre-fix version with no tracking doc or plan recording the gap | 🛑 Blocker | Phase is declared "complete, shipped to production" in STATE.md/ROADMAP.md, but the version of the mechanism actually live in prod contains a known Critical correctness bug that was found and fixed in code review but never deployed |

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any Phase 37 file.

### Human Verification Required

None. All truths are verifiable by direct code inspection, live test runs, and direct production introspection — no visual/UX/real-time behavior verification is needed for this backend-and-schema-heavy phase (the one UI truth, tab conditional rendering, was verified by code inspection since the mechanism is inert in prod with zero real reconciled data to visually inspect against).

### Gaps Summary

Six of the seven roadmap success criteria for Phase 37 are genuinely and verifiably true, including in production. The seventh gap is narrow but real: a Critical-severity code review finding (CR-01 — `agreeing_recording_ids` used OR-semantics instead of the documented AND-semantics, overstating consensus) plus two Warning findings (WR-01 non-deterministic alignment backbone, WR-02 non-atomic delete+insert enabling duplicate rows on overlapping sweeps) were all found, fixed, and unit-tested in the repository — but the fix was never deployed to production. The migration that ships the WR-02 atomicity fix (`20260910010000_create_reconcile_transcript_segments_atomic_rpc.sql`) is applied to TEST only; the `reconcile-transcripts` edge function live in production is still version 1, the exact pre-review-fix build. Direct download of the deployed function source confirms the live code still contains the OR-semantics dissent bug and the raw two-call delete+insert write path.

Because the eligibility gate (`event_match_decisions.decision='merge_applied'`) currently has zero matching rows in production, this bug has not yet corrupted any real data — the mechanism is a genuine no-op today, exactly as claimed. But "phase complete, shipped to production" is not accurate of the reviewed/corrected code; it is only accurate of the pre-review code. The gap is a missing deployment step (a "Plan 06" guarded prod-apply of the review-fix commits), not a missing implementation — the fix already exists and is proven correct on TEST via `src/test/rls-regression.test.ts` and the transcript-reconciler unit suite (29/29, including the CR-01 regression test).

**This looks like an intentional, low-risk sequencing choice (ship inert code, defer the fix-deploy) rather than an oversight requiring rework** — if the developer wants to accept "reviewed-and-fixed code lives in the repo, not yet in prod, mechanism is inert either way" as sufficient for Phase 37 closure, add an override:

```yaml
overrides:
  - must_have: "The reconciliation mechanism live in production correctly implements the reviewed/fixed provenance semantics (RECON-05/06 accuracy) and the atomicity/determinism fixes from code review"
    reason: "Mechanism is provably inert in production today (zero merge_applied rows); the CR-01/WR-01/WR-02 fixes are correct and tested in the repo/TEST; deploying them is deferred to a follow-up guarded prod-apply before any org is actually enabled for reconciliation"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

Otherwise, the recommended closure path is a short Plan 06: guarded prod apply of migration `20260910010000` + redeploy of `reconcile-transcripts`, then introspection proving the live function version bumped and the OR-semantics bug is gone.

---

_Verified: 2026-09-10T20:08:42Z_
_Verifier: Claude (gsd-verifier)_
