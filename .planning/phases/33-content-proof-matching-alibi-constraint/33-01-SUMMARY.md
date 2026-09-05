---
phase: 33-content-proof-matching-alibi-constraint
plan: 01
subsystem: event-resolution matching engine (content-proof tier + alibi constraint)
tags: [event-resolution, matching, postgres-rpc, pure-functions, tdd]
dependency-graph:
  requires:
    - Phase 31 event-resolver.ts (findDeterministicMatches, shouldSuppressTitleSignal pure-predicate style, same-org Map bucketing)
    - Phase 31 apply_event_match_atomic / event_match_decisions schema (20260901000002, 20260901000003)
    - Phase 30 call_participants.has_confirmed_speech column
  provides:
    - extractShingles / scoreContentProofOverlap / findContentProofMatches (pure content-proof scorer, MATCH-02)
    - isSpeakerAlibiViolation (pure alibi veto predicate, MATCH-07)
    - apply_event_match_atomic p_tier parameter (7-arg signature, tier='content_proof' now legal to write)
  affects:
    - supabase/functions/_shared/event-resolver.ts (Plan 02 will wire these into runShadowSweep)
    - apply_event_match_atomic callers (Plan 02's integration test will prove auto-attach capability)
tech-stack:
  added: []
  patterns:
    - Pure, DB-free, fail-closed predicate style (mirrors shouldSuppressTitleSignal) extended to two new domains: shingle scoring and alibi veto
    - Same-org Map<organization_id, candidate[]> bucketing pattern reused verbatim a third time (tier 1, tier 3, now content-proof)
    - Postgres function overload hazard: DROP old signature + CREATE new one (not CREATE OR REPLACE) when adding a defaulted trailing parameter, with explicit REVOKE re-issue
key-files:
  created:
    - supabase/migrations/20260905130000_content_proof_apply_tier_param.sql
  modified:
    - supabase/functions/_shared/event-resolver.ts
    - supabase/functions/_shared/__tests__/event-resolver.test.ts
decisions:
  - "Task 1 design gate resolved as option-a, approved as-is, no override constants -- pre-resolved by the human operator outside this executor invocation. Locks: sweep stays propose-only for content-proof (auto-attach is a separately-proven capability, SAFE-02 preserved byte-for-byte); alibi veto silently skips the write (no 'rejected' ledger row this phase); SHINGLE_SIZE=7, CONTENT_PROOF_MIN_SHARED_SHINGLES=5."
metrics:
  duration: ~20min
  completed: 2026-09-05
---

# Phase 33 Plan 01: Content-Proof Matching + Alibi Constraint Foundations Summary

Pure shingle-overlap scorer distinguishing a shared verbatim transcript passage from coincidental short phrases, plus a pure speaker-alibi veto predicate, and an additive Postgres migration letting `apply_event_match_atomic` legally write `tier='content_proof'` — all DB-free, unit-tested, and not yet wired into the sweep or applied to any database.

## Task 1: Design Gate (Checkpoint)

**Resolved: option-a, approved as-is.** Pre-approved by Andrew outside this executor invocation (matching how Phase 30/31/32 design gates were resolved). No override constants.

Locked by this decision, binding on Plans 02 and 03:
- Content-proof posture: the sweep's content-proof pass will write PROPOSE-ONLY rows (`decision='merge_proposed'`, `tier='content_proof'`), identically to tier-1 and metadata today. The auto-attach CAPABILITY (calling the now-p_tier-extended `apply_event_match_atomic` with `p_tier='content_proof'`) is built and proven separately by a direct integration test in Plan 02 — never called by the automatic sweep. SAFE-02's "sweep never applies" boundary is preserved byte-for-byte.
- Alibi veto: a violation silently skips the write (no `'rejected'` ledger row) — matches MATCH-07's "vetoes a candidate; never confirms one" and avoids unbounded duplicate rows on every 15-min sweep tick.
- Shingles: 7-token word shingles, exact-set overlap, conclusive at `CONTENT_PROOF_MIN_SHARED_SHINGLES=5` shared distinct 7-grams. Ledger score = Jaccard of the two shingle sets (provenance only, not the conclusive gate itself).

## Task 2: Migration — apply_event_match_atomic gains p_tier

`supabase/migrations/20260905130000_content_proof_apply_tier_param.sql` (authored, **not applied to any database** — Plan 03 owns the guarded TEST->prod apply):

1. `DROP FUNCTION IF EXISTS public.apply_event_match_atomic(UUID, UUID, UUID, TEXT, JSONB, UUID)` — removes the old 6-arg signature. Mandatory: a defaulted 7th parameter added via `CREATE OR REPLACE` would create a separate overload, and Postgres would resolve any 6-argument call to the stale overload that still hardcodes `'deterministic'`.
2. `CREATE FUNCTION public.apply_event_match_atomic(..., p_tier TEXT DEFAULT 'deterministic')` — body identical to the original except the trailing `p_tier` parameter, a guard (`IF p_tier NOT IN ('deterministic','content_proof','metadata') THEN RAISE EXCEPTION`) immediately after `BEGIN`, and the `INSERT INTO event_match_decisions` VALUES list now uses `p_tier` instead of the literal `'deterministic'`. `reverse_event_match_atomic` untouched.
3. All three `REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM PUBLIC/anon/authenticated` statements re-issued — the DROP in step 1 also drops these grants; without re-issuing them the new function would be callable by anon/authenticated via PostgREST, defeating the ownership-by-parameter check.
4. `COMMENT ON FUNCTION` updated to document `p_tier` and restate the unchanged SAFE-02 boundary.

Verify gate passed: `p_tier TEXT DEFAULT 'deterministic'` present, `DROP FUNCTION IF EXISTS ...(UUID, UUID, UUID, TEXT, JSONB, UUID)` present, exactly 3 `REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic` lines confirmed by grep count.

## Task 3: Pure content-proof scorer + alibi predicate (TDD)

Followed RED -> GREEN per the task's `tdd="true"` attribute:

**RED** (commit `572f448e`): added 20 new unit tests to `event-resolver.test.ts` importing four not-yet-implemented exports. Ran `npx vitest run` — confirmed 20 failures ("is not a function"), 29 pre-existing tests unaffected. Test-only commit.

**GREEN** (commit `5c5ae55e`): implemented in `event-resolver.ts`, appended after `writeMetadataProposals` (pure addition, 0 deletions — `runShadowSweep` byte-unchanged, confirmed via `git diff` showing no removed lines):

- `SHINGLE_SIZE = 7`, `CONTENT_PROOF_MIN_SHARED_SHINGLES = 5` (locked constants).
- `extractShingles(text, k)` — lowercases, splits on any run of non-letter/non-number Unicode (`\p{L}\p{N}` via regex `u` flag), drops empty tokens, returns overlapping k-token windows as a `Set<string>`. Fails closed to an empty Set on non-string/empty/short-text/malformed input; never throws.
- `scoreContentProofOverlap(chunksA, chunksB)` — concatenates each side's chunks sorted by `chunk_index` (never `timestamp_start`/`timestamp_end`, per 33-RESEARCH.md Pitfall 4), extracts shingles per side, returns `{ sharedShingles, jaccard, conclusive }`.
- `findContentProofMatches(candidates)` — reuses the same `Map<organization_id, candidate[]>` bucketing pattern verbatim from `findDeterministicMatches`/`findMetadataCandidates` (cross-org pairs never grouped, SAFE-04/T-33-03), emits a canonically-ordered `ContentProofMatch` only for conclusive pairs.
- `isSpeakerAlibiViolation(a, b)` — boolean veto only (T-33-02: `false` means "not vetoed," never "confirmed"). Requires the same email present on both sides with `has_confirmed_speech === true` on at least one side AND time-disjoint intervals, checked in both directions. Attendance alone never violates; overlapping intervals never violate. Fails closed (returns `false`, never throws) on null participants, non-array participants, or unparseable timestamps.

Verification:
- `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts`: **49/49 passing** (29 pre-existing + 20 new).
- `npm run type-check`: **0 new errors**, baseline unchanged at 321/321 (`tsconfig.app.json` + `tsconfig.node.json`).
- `runShadowSweep` confirmed byte-unchanged (`git diff` on `event-resolver.ts` shows 312 insertions, 0 deletions).
- All four new functions exported; no runtime Supabase-client import added (only the pre-existing type-only `SupabaseClient` import remains).

## Deviations from Plan

None — plan executed exactly as written. Task 1's checkpoint was pre-resolved externally per this invocation's explicit instructions (see Task 1 section above), not an executor-side deviation.

## Known Stubs

None. All four functions are fully implemented, pure logic with real unit-test coverage — no placeholder values, no hardcoded empty returns feeding a UI, no "coming soon" markers. Per 33-CONTEXT.md/33-RESEARCH.md Pitfall 1 and Pitfall 3, both `transcript_chunks` (zero live ingestion) and `call_participants.has_confirmed_speech` (zero code paths set it) are currently unpopulated in production/TEST — so this logic is correct-but-currently-inert on real data, exactly like Phase 32's dormant `checkMatch` finding. This is the phase's own explicitly-scoped, spec-acknowledged condition (33-RESEARCH.md Pitfall 3, option (b): "ship the alibi constraint's rejection logic as correct-but-currently-unreachable code... explicitly flag it for a later phase"), not an unaddressed stub — the functions themselves contain no stubbed behavior.

## Self-Check: PASSED

Verified below before proceeding to state updates.
