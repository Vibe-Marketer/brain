---
phase: 37-transcript-reconciliation
reviewed: 2026-09-10T00:00:00Z
depth: standard
files_reviewed: 15
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
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 37: Transcript Reconciliation Code Review Report

**Reviewed:** 2026-09-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The RLS story is solid: `user_can_view_event_reconciliation` in the migration was cross-checked directly against the live `recordings` SELECT policies (`20260308000002_tighten_recordings_select_rls.sql`, confirmed to be the current, un-superseded set — `20260310000000` is a documented no-op) and it is a true subset, not a widened predicate. `rls-regression.test.ts` has a real bespoke block proving both the positive (Org A reads) and negative (Org B denied) cases for the new client-readable ledger — this is the right test shape, not a leak-only false-positive-prone test.

The one **Critical** finding is in the pure reconciliation module itself: `buildReconciledSegment`'s dissent-detection logic computes the opposite of what its own docstring promises, which will make the "Confirmed by N recordings" provenance badge overstate consensus for nearly every real multi-source segment. Two **Warning**-level findings concern reproducibility/idempotency of the sweep, which the code's own comments and tests treat as load-bearing guarantees (RECON-04 "regenerable", determinism) but which the edge function doesn't actually secure end-to-end.

## Critical Issues

### CR-01: `agreeing_recording_ids` computes the opposite of its documented "never lost a disagreement" semantics — overstates consensus

**File:** `supabase/functions/_shared/transcript-reconciler.ts:551-565`

**Issue:** `buildReconciledSegment`'s own comment states the intended semantics explicitly:

> "a recording is 'agreeing' only if it never appears as a losing/dissenting candidate anywhere in the resolved stream... a source that lost even one token-level disagreement did not fully agree with the reconciled segment."

That is an AND-across-all-positions rule ("agreeing" requires never losing). But the actual implementation computes the opposite — an OR-across-all-positions rule:

```ts
const dissenting = new Set<string>();
const everyAgreeingId = new Set<string>();
for (const t of resolvedTokens) {
  for (const id of t.agreeing_recording_ids) everyAgreeingId.add(id);
}
for (const id of sourceRecordingIds) {
  if (!everyAgreeingId.has(id)) dissenting.add(id);
}
const agreeingRecordingIds = sourceRecordingIds.filter((id) => !dissenting.has(id)).sort();
```

`dissenting` only contains a recording id if that recording *never once* appears in any token's `agreeing_recording_ids` across the whole segment. Any recording that wins/matches at even a single token position (e.g. a shared "the", "and", "we") is excluded from `dissenting` and therefore included in the final `agreeing_recording_ids` — even if it disagreed with the resolved text at every other position in the segment.

**Failure scenario:** Two recordings transcribe a 10-word segment and genuinely disagree on 9 of 10 words (weighted-vote/provider-priority picks recording A's token every time), but both happen to independently transcribe one common word (e.g. "the") identically. At that one position, `TokenAgreement.agreeing_recording_ids` includes both A and B. Because B now appears at least once in `everyAgreeingId`, B is excluded from `dissenting` and thus lands in the final `agreeing_recording_ids` alongside A — the UI's `ReconciledSegmentProvenanceBadge` ("Confirmed by 2 recordings") and the underlying `coverage: 'consensus'` signal both claim B corroborated the reconciled text, when B actually dissented on 90% of it. Since short common function words are near-universal across independently-transcribed sources, this pattern will fire on nearly every real multi-source segment with any disagreement at all, making the "consensus" badge close to meaningless as a trust signal — which is the entire stated purpose of RECON-06.

**Fix:** Track dissent per-recording directly from `TokenDisagreement` candidates that did not match the resolved token, rather than inferring it from absence-from-every-agreement-list:

```ts
const dissenting = new Set<string>();
const everyContributingId = new Set<string>();
for (const t of resolvedTokens) {
  for (const id of t.agreeing_recording_ids) everyContributingId.add(id);
}
// resolvedTokens must additionally carry, per disagreement position, which
// source ids contributed a *losing* candidate token — thread that through
// from resolveTokenDisagreement's TokenDisagreement.candidates instead of
// discarding it in index.ts's `resolvedTokens.map(...)` call.
for (const id of sourceRecordingIds) {
  if (dissentedAtLeastOnce.has(id)) dissenting.add(id);
}
```
This requires `index.ts`'s call site (lines 384-393) to also pass through which candidates *lost* at each disagreement, not just which token won — `resolveTokenDisagreement`'s return value already has this information (`disagreement.candidates` minus `resolved.agreeing_recording_ids`), it's just discarded before reaching `buildReconciledSegment`.

## Warnings

### WR-01: `transcript_chunks` fetch has no `ORDER BY` — backbone-source selection (and thus segment text) is not guaranteed stable across sweep re-runs

**File:** `supabase/functions/reconcile-transcripts/index.ts:271-276`

**Issue:** RECON-04's full delete+rebuild design is explicitly documented (migration comment, `transcript-reconciler.ts` header, and `resolveTokenDisagreement`'s tests) as producing "byte-identical output across identical-input regenerations" — the pure functions in `transcript-reconciler.ts` are indeed deterministic given a fixed input order. But `tokenizeAndAlignText` (`transcript-reconciler.ts:316-334`) picks its alignment "backbone" as `sources[0]` — the *first* member of `group.members`, whose order is inherited all the way back from this Supabase query:

```ts
const { data: chunkRows, error: chunksError } = await supabase
  .from('transcript_chunks')
  .select('id, canonical_recording_id, chunk_index, chunk_text, source_platform, speaker_name, speaker_email, timestamp_start, timestamp_end, entities')
  .in('canonical_recording_id', allRecordingIds);
```

No `.order(...)` clause is present. Postgres does not guarantee row order without an explicit `ORDER BY`, so two sweep runs over identical underlying data can return `chunkRows` in a different order, which changes which recording's tokens become the alignment backbone, which changes the progressive-alignment path in `pairwiseAlign`, which can change the final `segment_text` string (e.g. which of two near-tied disagreement candidates ends up at a given backbone position, or how insertions/deletions are placed) between otherwise-identical sweep runs.

**Failure scenario:** A cron-triggered sweep and a later manually-triggered sweep (or a retried sweep after a transient error) run over the exact same set of `transcript_chunks` rows but Postgres returns them in a different physical order (e.g. after an autovacuum or index-only-scan plan change). The reconciled segment text for a previously-viewed event silently changes on the next sweep even though nothing about the source transcripts changed — undermining the "regenerable, reproducible" guarantee the schema and code comments promise, and potentially confusing a user who compares the tab's contents across sessions.

**Fix:** Add a stable secondary sort to the chunk fetch, e.g. `.order('canonical_recording_id').order('chunk_index')`, so `bucketChunks` (and therefore `group.members`) has a deterministic order independent of Postgres's physical row order.

### WR-02: Per-event DELETE-then-INSERT is not transactional or lock-guarded — overlapping sweep invocations can produce duplicate segment rows

**File:** `supabase/functions/reconcile-transcripts/index.ts:417-434`

**Issue:** The migration explicitly documents that `reconciled_transcript_segments` has **no UNIQUE constraint on purpose**, because the write path is meant to always be "DELETE FROM ... WHERE event_id = $1 followed by a fresh INSERT batch, never an upsert." That's fine for a single sweep invocation, but the delete and insert are two independent REST calls over the Supabase client (`supabase.from(...).delete()` then, if `freshRows.length > 0`, `supabase.from(...).insert()`), not wrapped in a database transaction or guarded by any advisory lock/mutex keyed on `event_id`.

**Failure scenario:** Two sweep invocations overlap for the same event — e.g. a cron-triggered run and a manually-triggered run both pick up the same eligible event before either has finished (nothing in this endpoint prevents concurrent invocations; `reconcile-transcripts` is a plain HTTP-triggered function with no locking). Run 1 deletes the event's existing rows, then before Run 1 inserts, Run 2 also deletes (no-op, already empty) and then both Run 1 and Run 2 insert their independently-computed `freshRows` batches. Because there's no UNIQUE constraint to reject the second insert, the event ends up with two full copies of its reconciled segments (or, in a worse interleaving, Run 2's delete fires *after* Run 1's insert, deleting Run 1's freshly-written rows and leaving the event with only Run 2's rows or transiently zero rows if Run 2's own insert then fails). The "Reconciled" tab would show duplicated/doubled text to the user.

**Fix:** Either serialize sweep invocations (e.g. a `pg_advisory_xact_lock` keyed on a hash of `event_id`, or a `SELECT ... FOR UPDATE` on a per-event lock row) or make the delete+insert atomic via a single `SECURITY DEFINER` RPC that wraps both in one transaction.

## Info

### IN-01: Reconciliation eligibility count is RLS-scoped to the caller, so a user who can see only some of an event's recordings never sees the Reconciled tab even if reconciliation has already run

**File:** `src/services/reconciledTranscript.service.ts:82-91`

**Issue:** `getReconciliationEligibility`'s second query counts `recordings` rows for the event under the calling user's own JWT (RLS-scoped), not a privileged/aggregate count. If an event has 2+ recordings but the current user can only see 1 of them (e.g. the other recording was uploaded into a workspace they aren't a member of), `recordingCount` returns 1, `isReconciliationEligible` in `CallDetailDialog.tsx:145` evaluates `false`, and the "Reconciled" tab is hidden entirely — even though `reconciled_transcript_segments` may already contain a fully-swept, readable-to-this-user segment (the segments' own RLS is gated on `user_can_view_event_reconciliation`, which is a superset of "can see all N recordings" — it only requires visibility into *one* recording plus event participation). This is a functional gap, not a security issue (nothing leaks), but it means the tab's visibility is stricter than the data it would actually be allowed to show.

**Fix:** Consider deriving eligibility from whether `reconciled_transcript_segments` already has rows for the event (a direct, RLS-gated existence check) rather than re-deriving it from a client-visible recording count, or accept this as a known conservative trade-off if intentional.

---

_Reviewed: 2026-09-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
