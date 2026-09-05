---
phase: 33-content-proof-matching-alibi-constraint
verified: 2026-09-05T19:15:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 33: Content-Proof Matching + Alibi Constraint Verification Report

**Phase Goal:** Transcript content conclusively confirms matches, and the speaker-alibi constraint rejects physically impossible ones with certainty.
**Verified:** 2026-09-05T19:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Special Focus: CR-01 / WR-02 Code-Review Fix Confirmation

The task explicitly required confirming that the post-review fixes (commit `dd2f9fec`) are actually live in production, not merely claimed. Verified independently (not from SUMMARY/REVIEW text):

| Check | Method | Result |
|---|---|---|
| Fix commit exists, contains both fixes | `git show --stat dd2f9fec` | Present: `fix(33): add content-proof temporal gate (CR-01) and normalize alibi participant emails (WR-02)` |
| Working tree matches commit (no drift) | `git diff dd2f9fec HEAD -- event-resolver.ts` | Empty diff; `git status` clean |
| Temporal gate function exists and is wired | Read `event-resolver.ts:1171-1216` (`isContentProofTemporallyPlausible`, `CONTENT_PROOF_MAX_START_TIME_GAP_MINUTES=1440`) and `:1261` (`findContentProofMatches` calls it BEFORE `scoreContentProofOverlap`) | Confirmed: gate runs first, `continue` skips ungated pairs; not bypassable |
| Email normalization fix exists and is wired | Read `event-resolver.ts:356` — `const normalizedEmail = normalizeParticipant(row.email);` in the alibi participant fetch | Confirmed: normalization applied before storing into `AlibiParticipant` |
| Regression tests are real, not vacuous | Read `event-resolver.test.ts:761-856` (CR-01 suite) | Confirmed: constructs a real 5-shared-shingle pair 6 months apart, asserts `findContentProofMatches([...]) === []`; control test proves same content when temporally plausible still proposes — proves the gate, not the scorer, is what changed |
| Unit suite passes (independently re-run) | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` | **59/59 passed** (matches REVIEW.md's claimed count) |
| Integration suite passes against real TEST db (independently re-run) | `VITEST_INTEGRATION_OK=true npx vitest run src/test/event-resolution-content-proof.integration.test.ts` | **4/4 passed** against live `callvault-test` project |
| Deployed function version | `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` | `resolve-events` — **ACTIVE, VERSION 7**, `UPDATED_AT 2026-09-05 18:49:26 UTC` |
| Deploy timestamp correlates to fix commit | Commit `dd2f9fec` authored `2026-09-05 14:49:06 -0400` = `18:49:06 UTC` | Deploy landed **20 seconds** after the commit — version 6→7 bump is this exact fix, not a stale/earlier deploy |

**Conclusion: CR-01 and WR-02 are confirmed live in production**, verified by code inspection, independent test re-execution, and direct prod introspection — not by trusting SUMMARY/REVIEW claims.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | (Roadmap SC-1) Rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets (`chunk_index`, never wall-clock), conclusively attaches two captures of the same event | ✓ VERIFIED | `extractShingles`/`scoreContentProofOverlap`/`findContentProofMatches` read directly (`event-resolver.ts:1027-1283`); sorts by `chunk_index`, never `timestamp_start/end`. Now additionally requires `isContentProofTemporallyPlausible` (CR-01 fix) before content scoring, closing the false-positive gap the code review found. 59/59 unit tests pass, including dedicated tests proving conclusive-vs-coincidental discrimination and the CR-01 false-positive vector is rejected. |
| 2 | (Roadmap SC-2) An identity with `has_confirmed_speech` in event A during interval T is rejected as a speaker in a time-disjoint event B during T; attendance alone is never an alibi | ✓ VERIFIED | `isSpeakerAlibiViolation`/`hasConfirmedSpeakerInOther` read directly (`event-resolver.ts:1341-1389`): requires `has_confirmed_speech === true` on one side, presence on the other, AND disjoint intervals; overlapping intervals never violate. Email comparison now normalized (WR-02 fix) so casing/whitespace mismatches can't silently defeat it. |
| 3 | (Roadmap SC-3) Zero-transcript (audio-only) captures fall back to the deterministic/metadata tier without error | ✓ VERIFIED | `event-resolver.ts:472-475`: every candidate included even with 0 chunks; `findContentProofMatches` naturally proposes nothing for an empty-chunks side. Integration test re-run confirms fallback with `summary.errors === 0`. |
| 4 | `apply_event_match_atomic` can legally write a ledger row with `tier='content_proof'` (and still `'deterministic'` for existing callers) without a second, parallel merge implementation | ✓ VERIFIED | Migration read in full: `DROP FUNCTION` (old 6-arg) + `CREATE FUNCTION` (new 7-arg, `p_tier TEXT DEFAULT 'deterministic'`, guard `IN ('deterministic','content_proof','metadata')`). Confirmed live in prod via `pg_get_function_arguments`: exactly one overload, trailing `p_tier text DEFAULT 'deterministic'::text`. |
| 5 | `isSpeakerAlibiViolation` returns only a boolean veto — a false result is never treated as a confirmation of a merge | ✓ VERIFIED | Code review point 2 (independently spot-checked): `isAlibiVetoed` used at exactly 3 call sites (tier-1 `:394`, content-proof `:491`, metadata `:636`), always `if (isAlibiVetoed(...)) { skip }` — never read as a positive scoring input anywhere. |
| 6 | Alibi veto is threaded across **every** tier's write path (deterministic, content-proof, metadata), not just one | ✓ VERIFIED | Single hoisted `alibiLookup` built once (`:324-381`), consumed identically at all 3 write sites confirmed above. |
| 7 | The content-proof auto-attach capability (`apply_event_match_atomic(p_tier='content_proof')`) is proven by a direct call, never invoked by the automatic sweep — SAFE-02 preserved | ✓ VERIFIED | Code review point 1 (independently spot-checked): zero `.rpc()` calls and zero `.update()` calls anywhere in `event-resolver.ts`; only `event_id` reference is the read-only `.is('event_id', null)` filter. Integration test's direct-call test (Test 5 in 33-02-PLAN.md Task 3) is part of the 4/4 passing suite. |
| 8 | The `p_tier` migration is applied to TEST and then to production (ref `vltmrnjsubfzrgrtdqey`), guarded, with the 7-arg `apply_event_match_atomic` confirmed live by introspection | ✓ VERIFIED | Ran `supabase projects list` — linked project confirmed `vltmrnjsubfzrgrtdqey` (callvault-ai, prod). Ran the exact introspection query myself: single 7-arg overload confirmed live. |
| 9 | `resolve-events` is redeployed so the content-proof pass + alibi veto ship in production | ✓ VERIFIED | `supabase functions list`: ACTIVE, VERSION 7, updated 2026-09-05 18:49:26 UTC — 20s after the CR-01/WR-02 fix commit (see Special Focus section above). |
| 10 | In production the tier is provably inert today: zero `tier='content_proof'` ledger rows, and `apply_event_match_atomic` EXECUTE stays revoked from anon/authenticated | ✓ VERIFIED | Ran introspection myself: `event_match_decisions WHERE tier='content_proof'` = **0**. `has_function_privilege`: `anon_exec=false`, `authenticated_exec=false`, `service_role_exec=true`. |
| 11 | `src/types/supabase.ts` regenerated to reflect `apply_event_match_atomic`'s new `p_tier` arg | ✓ VERIFIED | Read `src/types/supabase.ts:5346-5357`: `p_tier?: string` present in the `Args` block. Last touched by commit `d2d3cb0a` (matches 33-03-SUMMARY.md's claimed commit). |

**Score:** 11/11 truths verified

### Note on the "transcript_chunks ~0 rows" wording

Plan 03's must-have literally says "transcript_chunks has ~0 rows." Live introspection (re-run by me) shows **61,253** real rows — not ~0. This is not a gap: the executor caught this during Plan 03 execution, went beyond the literal 3-item checklist, traced the actual join key (`canonical_recording_id`) the code uses, and proved the ONE flagged organization (Clickable Impact) has **zero** linkage to any of the 61K rows (independently re-confirmed by me: `COUNT(*) FROM recordings r JOIN transcript_chunks tc ON tc.canonical_recording_id = r.id WHERE r.organization_id = '3def74de-...' ` = **0**). The safety property that matters (tier does nothing today) holds, verified more rigorously than the plan originally specified, not less. This is exactly the CR-01 finding's underlying concern (61K rows across 7 orgs is a real false-merge substrate) — which is precisely why the temporal-gate fix matters going forward the moment `event_resolution` is enabled for any of those other 7 orgs. Flagged forward in STATE.md per the SUMMARY; not a phase-33 gap today.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/20260905130000_content_proof_apply_tier_param.sql` | Additive `p_tier` param, DROP+CREATE, 3x REVOKE re-issued | ✓ VERIFIED | Read in full (174 lines). All elements present and correct; confirmed applied in prod. |
| `supabase/functions/_shared/event-resolver.ts` | Pure content-proof scorer + alibi predicate + sweep wiring + CR-01/WR-02 fixes | ✓ VERIFIED | 1389 lines. All exports present (`extractShingles`, `scoreContentProofOverlap`, `findContentProofMatches`, `isSpeakerAlibiViolation`, `isContentProofTemporallyPlausible`, `SHINGLE_SIZE`, `CONTENT_PROOF_MIN_SHARED_SHINGLES`, `CONTENT_PROOF_MAX_START_TIME_GAP_MINUTES`). Deployed to prod as `resolve-events` v7. |
| `supabase/functions/_shared/__tests__/event-resolver.test.ts` | Unit coverage incl. CR-01/WR-02 regressions | ✓ VERIFIED | 59/59 passing (re-run independently). CR-01 and WR-02 regression `describe` blocks confirmed present and non-vacuous by direct read. |
| `src/test/event-resolution-content-proof.integration.test.ts` | End-to-end TEST proof (attach, fallback, alibi, auto-attach) | ✓ VERIFIED | 4/4 passing (re-run independently against live `callvault-test` project). |
| `src/types/supabase.ts` | Regenerated with `p_tier` arg | ✓ VERIFIED | Confirmed present at line 5354. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `scoreContentProofOverlap` | `chunk_index` ordering | relative-offset alignment, never timestamp | ✓ WIRED | Code read confirms sort-by-`chunk_index` before shingle extraction. |
| `findContentProofMatches` | `isContentProofTemporallyPlausible` | gate called before content scoring | ✓ WIRED | `:1261` — `if (!isContentProofTemporallyPlausible(...)) continue;` precedes `scoreContentProofOverlap` call. |
| `apply_event_match_atomic` INSERT | `event_match_decisions.tier` | `p_tier` parameter replaces hardcoded literal | ✓ WIRED | Migration + prod introspection both confirm. |
| `isSpeakerAlibiViolation` | `call_participants.has_confirmed_speech` | only `=== true` anchors an alibi | ✓ WIRED | Code read confirms. |
| `runShadowSweep` alibi lookup | `normalizeParticipant` | emails normalized before storage (WR-02) | ✓ WIRED | `:356` — confirmed applied before storing into lookup. |
| `resolve-events` (prod) | `runShadowSweep` content-proof + alibi logic | edge function redeploy | ✓ WIRED | v7 ACTIVE, deploy timestamp correlates to fix commit to the second. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Unit suite (content-proof + alibi + CR-01/WR-02 regressions) | `npx vitest run supabase/functions/_shared/__tests__/event-resolver.test.ts` | PASS (59) FAIL (0) | ✓ PASS |
| Integration suite against live TEST db | `VITEST_INTEGRATION_OK=true npx vitest run src/test/event-resolution-content-proof.integration.test.ts` | 4 passed (4) | ✓ PASS |
| Prod: `apply_event_match_atomic` signature | `SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname='apply_event_match_atomic'` | 1 row, `p_tier text DEFAULT 'deterministic'::text` | ✓ PASS |
| Prod: EXECUTE grants | `has_function_privilege('anon'/'authenticated'/'service_role', ...)` | `false / false / true` | ✓ PASS |
| Prod: content_proof ledger rows | `SELECT COUNT(*) FROM event_match_decisions WHERE tier='content_proof'` | `0` | ✓ PASS |
| Prod: `resolve-events` deployed version | `supabase functions list` | `ACTIVE, v7, 2026-09-05 18:49:26 UTC` | ✓ PASS |
| Prod: flagged-org chunk linkage (inertness mechanism) | `COUNT(*) FROM recordings JOIN transcript_chunks ON canonical_recording_id ... WHERE organization_id = 'Clickable Impact'` | `0` | ✓ PASS |
| Type-check spot check | `npx tsc -p tsconfig.app.json` (manual scan of output) | Same known baseline error classes only (esm.sh imports, pre-existing unrelated errors); no new error referencing `isContentProofTemporallyPlausible`/`normalizeParticipant`/`hasConfirmedSpeakerInOther` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| MATCH-02 | 33-01, 33-02, 33-03 | Content-proof tier: rare n-gram shingle overlap over `transcript_chunks`, aligned on relative offsets; high overlap is conclusive | ✓ SATISFIED | Truths 1, 4, 7, 8, 9, 10 above; now hardened by the CR-01 temporal gate. |
| MATCH-07 | 33-01, 33-02 | Speaker-alibi constraint rejects candidates; attendance is never an alibi | ✓ SATISFIED | Truths 2, 5, 6 above; hardened by the WR-02 normalization fix. |

No orphaned requirements — REQUIREMENTS.md traceability table maps exactly `MATCH-02, MATCH-07` to Phase 33, matching the `requirements:` field declared in all 3 plans.

### Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any phase-modified file (`event-resolver.ts`, `event-resolver.test.ts`, the migration, the integration test).

Three code-review findings remain explicitly unaddressed **by the reviewer's own scope decision** (33-REVIEW.md addendum: "WR-01, WR-03, and IN-01 are unchanged by this addendum — no action taken on any of them, per scope"). Independently assessed here as non-blocking to this phase's goal:

| File | Finding | Severity | Impact |
|---|---|---|---|
| `supabase/migrations/20260905130000_content_proof_apply_tier_param.sql` | WR-01: No regression test guards the `REVOKE EXECUTE` reissue against a *future* migration repeating the DROP+CREATE pattern without reissuing grants | ⚠️ WARNING (non-blocking) | Current state directly verified correct in prod (anon/authenticated both `false`). Risk is forward-looking test-coverage gap, not a present defect. |
| `event-resolver.ts:381-418` | WR-03: Tier-1 write loop lacks the fail-closed try/catch isolation given to content-proof and metadata tiers — a tier-1 exception aborts the whole sweep tick, including content-proof/metadata, silently | ⚠️ WARNING (non-blocking) | Robustness/isolation gap in shared function, not a correctness defect in content-proof or alibi logic. Does not affect SC-1/SC-2/SC-3. |
| `src/test/event-resolution-content-proof.integration.test.ts:530-581` | IN-01: Direct-apply-RPC test permanently leaks one `events` row per run (matches pre-existing Phase 31 precedent) | ℹ️ INFO (non-blocking) | Test hygiene only; does not affect production correctness. |

None of these meet the Blocker bar (none prevent the phase goal; none are unresolved debt markers). Recommend tracking WR-01/WR-03 as a follow-up hardening item, but they do not block Phase 33 closure.

### Human Verification Required

None. This is a backend-only, no-UI infrastructure phase (33-CONTEXT.md: "smart discuss skipped (no UI)"). Every must-have was verifiable by code inspection, independent test execution, or direct production introspection.

### Gaps Summary

No gaps. All 11 must-haves (3 roadmap Success Criteria + 8 plan-level truths spanning all 3 plans) verified against the actual codebase and live production, not from SUMMARY/REVIEW claims alone. The task's specific concern — whether the CR-01 (critical) and WR-02 (warning) code-review fixes are genuinely live in prod, not just documented as fixed — is independently confirmed: the fix commit (`dd2f9fec`) is the current HEAD for `event-resolver.ts` with zero drift, the temporal gate and email-normalization code is present and correctly wired (not just added but consumed before the write path), both the unit suite (59/59) and the integration suite (4/4, against the real TEST project) pass on re-execution, and the deployed `resolve-events` function is at version 7 (up from 6), timestamped 20 seconds after the fix commit — eliminating the possibility that a stale pre-fix bundle is still serving traffic.

Three residual code-review warnings (WR-01, WR-03, IN-01) remain open by explicit reviewer scope decision; assessed here as non-blocking and appropriate to track as follow-up hardening rather than phase-closing gaps.

---

_Verified: 2026-09-05T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
