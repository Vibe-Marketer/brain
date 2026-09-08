---
phase: 35-speaker-resolution-across-sources
reviewed: 2026-09-08T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - supabase/functions/_shared/speaker-resolver.ts
  - supabase/functions/_shared/__tests__/speaker-resolver.test.ts
  - supabase/functions/resolve-speakers/index.ts
  - supabase/migrations/20260908120000_create_speaker_resolution_decisions.sql
  - src/test/integration/resolve-speakers.integration.test.ts
  - src/test/rls-regression.test.ts
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-09-08
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the full Phase 35 (IDENT-04/05 speaker resolution) file set: the pure `speaker-resolver.ts` scoring module, its adversarial unit suite, the `resolve-speakers` edge function, the `speaker_resolution_decisions` migration, the deploy-deferred integration test, and the RLS-regression registration. All seven priority checks from the review brief were traced end-to-end against the actual code (not summaries):

1. **`propagateNamedLabel` bare-name-match guard** — confirmed structurally impossible. Donor eligibility requires `donor.identity_id` truthy AND `donor.verified === true` (`speaker-resolver.ts:339`); the edge function only constructs a `PropagationDonor` when `call_participants.identity_id` is non-null (`index.ts:291,308-314`). No code path assigns an identity from a bare `speaker_name` string alone.
2. **`collapsePhantomSpeaker` fail-closed on disagreement** — confirmed. Any `candidateSplit` interval falling outside the tolerance-expanded labeled span immediately returns `{ collapsed: false, reason: 'disagreement' }` (`speaker-resolver.ts:414-416`), proven by the "5-minute-later second speaker" adversarial unit test. However, see WR-01 below: the pure function itself does not structurally require corroborated (`verified`) evidence for the `labeled` side, nor a minimum of 2 candidate groups — both invariants are caller-enforced only.
3. **Same-org bucketing before pairing** — confirmed genuine. `index.ts` buckets `recordingsByEvent` → `recordingsByOrg` (lines 198-257) and only pairs donors/targets within a single `orgRecordings` array; the integration test's Org B adversarial fixture proves zero cross-org decisions are written.
4. **Clock-drift tolerance correctness** — confirmed applied as a symmetric ±20s (locked midpoint of the 15-30s range) gap-magnitude buffer on both the propagation overlap check and the collapse subsumption check, and the unit suite's "overlap-adversarial" fixture (60s gap, 3x tolerance) proves it doesn't defeat the disjoint-intervals-stay-unresolved guarantee.
5. **401-before-parse gate** — confirmed genuinely first; the shared-secret check (`index.ts:134-141`) runs before `req.json()` (line 144). Confirmed the function never writes `transcript_chunks.speaker_name`/`speaker_email` in place — every write target is `speaker_resolution_decisions`.
6. **RLS on `speaker_resolution_decisions`** — confirmed `ENABLE` + `FORCE ROW LEVEL SECURITY`, single `service_role`-only `FOR ALL` policy, no client-reachable policy at all (mirrors `event_match_decisions` exactly, no Phase-30-CR-01-class inherited-policy risk since there is no participation-scoped SELECT policy to inherit from).
7. **Tautological/ceremony tests** — none found. The unit suite's negative cases are constructed to fail against a naive/stub implementation (explicit 60s-gap adversarial fixture, explicit no-donor fixture). The integration suite drives the real spawned `deno run` process over real HTTP against a real TEST-project DB. One test-quality concern is flagged below (WR-05) regarding execution-order coupling between two `it` blocks, but it is not tautological — the assertions are real DB-state checks.

No BLOCKER-level findings. Five WARNINGs identified — two are latent design gaps in the pure scoring module's structural guarantees (not currently exploitable given the single existing caller, but worth closing before a second caller is added), one is a semantic correctness gap in how "over-segmentation" is detected for null-labeled chunks, one is a data-completeness risk from an unbounded/unordered `.limit(1000)` query, and one is a test-maintainability issue. Two INFO items round out minor observability/matching gaps.

## Warnings

### WR-01: `collapsePhantomSpeaker`'s corroboration guarantee is caller-enforced only, not structural

**File:** `supabase/functions/_shared/speaker-resolver.ts:145-179, 384-396`
**Issue:** `PropagationDonor` structurally guarantees non-linking by requiring a literal `verified: true` field (`speaker-resolver.ts:85`), matching the "Pitfall 3" design intent that a donor can never be constructed from a bare name match. `ConsensusCandidate` (the `labeled` side consumed by `collapsePhantomSpeaker`) has no equivalent field — it's just `{ canonical_recording_id, chunk_indices, identity_id, interval }`. Nothing in the type or the function body requires `labeled.identity_id` to have come from a verified source; `collapsePhantomSpeaker` only checks `!labeled.identity_id` (truthy check, line 387). Separately, the function doesn't enforce `candidateSplit.length >= 2` — it only rejects `length === 0` (line 393-395). Both invariants ("donor must be verified," "this is genuinely an over-segmentation, i.e., 2+ split groups") are currently upheld only because `resolve-speakers/index.ts` happens to always pass a `donor`-derived `labeled` (itself gated by `call_participants.identity_id`) and always checks `candidateSplit.length < 2` before calling (`index.ts:461`) — i.e., the safety property lives in the caller, not the module documented as carrying it "at the type level" (see the file's own header comment, lines 23-27).
**Fix:** Either (a) add a `verified: true` literal field to `ConsensusCandidate.labeled`'s type (mirroring `PropagationDonor`) and check it inside `collapsePhantomSpeaker`, and/or (b) have `collapsePhantomSpeaker` itself reject `candidateSplit.length < 2` with `reason: 'insufficient_overlap'` instead of relying on the caller's pre-filter. This closes the gap before any future caller (e.g. a differently-scoped sweep) can accidentally construct an unverified or single-candidate collapse.

### WR-02: Consensus-collapse over-segmentation grouping treats every individually-null-named chunk as a distinct "phantom speaker" group

**File:** `supabase/functions/resolve-speakers/index.ts:416-424`
**Issue:**
```ts
const label = chunk.speaker_name?.trim() || `__anon_${chunk.id}`;
```
IDENT-05's intent is to collapse genuine diarization over-segmentation: two or more *distinct diarization labels* (e.g. "Speaker 1" and "Speaker 2") that actually belong to one real speaker. But when `speaker_name` is null/empty (no diarization label at all — common for chunked transcript segments of a single utterance), this line manufactures a unique synthetic label per chunk via `chunk.id`. Any recording with 2+ null-named chunks subsumed inside a donor's span will trigger the `anonymousChunksByLabel.size >= 2` branch and be passed to `collapsePhantomSpeaker` as if they were distinct competing speaker labels — even though they may just be ordinary unlabeled transcript chunking artifacts of ONE speaker (a case `propagateNamedLabel`'s earlier pass in the same sweep already handles correctly via the `propagation` tier). The result is `tier='consensus_collapse'` ledger rows whose `signals`/provenance semantically claim "resolved a diarization label disagreement" when no such disagreement existed.
**Fix:** Only treat chunks as distinct "phantom speaker" candidates when they carry a real, non-null `speaker_name` label (i.e., skip/exclude null-named chunks from `anonymousChunksByLabel`, or route them through `propagateNamedLabel` exclusively). If null-named chunks must be considered, group them under one shared bucket (e.g., a single `__anon` key) rather than one bucket per chunk, so they aren't miscounted as multiple "distinct" speakers.

### WR-03: `recordings` sweep query has no `ORDER BY` before `.limit(1000)`, risking silent, non-reproducible truncation of a multi-recording event

**File:** `supabase/functions/resolve-speakers/index.ts:174-179`
**Issue:**
```ts
const { data: recordingRows, error: recordingsError } = await supabase
  .from('recordings')
  .select('id, event_id, recording_start_time, created_at')
  .not('event_id', 'is', null)
  .gte('created_at', since)
  .limit(1000);
```
No `.order(...)` is specified, so Postgres/PostgREST returns rows in an unspecified order, and the 1000-row cap can silently drop one recording of a two-recording event that straddles the boundary — the entire point of IDENT-04 is cross-recording pairing, so losing one side of a pair means that event's propagation silently never happens, with zero error/log signal (the summary counters have no "skipped due to truncation" metric). Repeated invocations aren't even guaranteed to return the same 1000 rows.
**Fix:** Add a deterministic `.order('created_at', { ascending: true })` (or similar), and either raise/paginate the limit or log a warning when `recordingRows.length === 1000` (cap reached) so silent truncation is at least observable before this function is wired to a cron.

### WR-04: Non-deterministic per-recording org assignment when `call_participants` rows disagree

**File:** `supabase/functions/resolve-speakers/index.ts:243-248`
**Issue:**
```ts
const orgByRecordingId = new Map<string, string>();
for (const p of participants) {
  if (!orgByRecordingId.has(p.recording_id) && p.organization_id) {
    orgByRecordingId.set(p.recording_id, p.organization_id);
  }
}
```
`participants` is fetched without an `ORDER BY` (`index.ts:209-212`), so for a recording with `call_participants` rows carrying inconsistent `organization_id` values (data-integrity edge case, but the column isn't constrained to match `recordings.organization_id` at the DB level in this migration set), which org "wins" the bucket for that recording is arbitrary and can vary between invocations. This is a low-likelihood but non-deterministic behavior in a security-relevant code path (SAFE-04 org bucketing).
**Fix:** If cross-org participant rows on one recording should never happen, add a defensive check/log when >1 distinct `organization_id` is observed for the same `recording_id`, and prefer the recording's own `organization_id` column (if one exists) as the source of truth over aggregating from `call_participants`.

### WR-05: Integration test execution-order coupling between "propagates" and "collapses" tests

**File:** `src/test/integration/resolve-speakers.integration.test.ts:332-392`
**Issue:** The test at line 332 ("propagates the donor identity...") is the only one that invokes the edge function via `fetch`. The test at line 368 ("collapses the over-segmented anonymous pair...") makes no HTTP call at all — it directly queries `speaker_resolution_decisions` for rows that only exist because the *prior* test's single sweep invocation happened to process both the propagation and collapse passes in one request. If vitest's declaration order changes, or the earlier test is `.skip`'d/filtered independently (e.g. via `-t` pattern matching), the collapse test will either fail with a confusing "expected >=2 rows, got 0" or (worse) silently pass against leftover state from a previous unrelated run if cleanup didn't fully run.
**Fix:** Either have the "collapses" test issue its own fetch call (idempotent given the upsert `onConflict`), or add an explicit code comment/`beforeAll`-scoped guard making the order dependency structurally enforced (e.g., a shared `let sweepRan = false` assertion) rather than implicit in declaration order.

## Info

### IN-01: Recordings skipped for missing org evidence are not tracked in the summary

**File:** `supabase/functions/resolve-speakers/index.ts:250-257`
**Issue:** `if (!orgId) continue; // no org evidence for this recording -- skip, fail closed.` — correct fail-closed behavior, but this silent skip has no corresponding counter in `ResolveSummary`, making it invisible in the function's own response payload when diagnosing why an expected propagation didn't happen.
**Fix:** Add a `summary.skippedNoOrgEvidence` (or similar) counter incremented here, for operational visibility once this function is wired to a cron.

### IN-02: Donor name-matching is case-sensitive, unlike email matching

**File:** `supabase/functions/resolve-speakers/index.ts:280-289`
**Issue:** Email comparison is normalized with `.trim().toLowerCase()` on both sides, but the name-fallback comparison (`pName === chunkName`) is case-sensitive after only `.trim()`. A diarization label of "john smith" won't match a `call_participants.name` of "John Smith," silently missing an eligible donor even though this is a benign under-match (fails closed, no security concern).
**Fix:** Normalize case on the name-fallback comparison for consistency with the email path, if this is meant to be a robust fallback rather than an intentionally conservative exact-match gate.

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
