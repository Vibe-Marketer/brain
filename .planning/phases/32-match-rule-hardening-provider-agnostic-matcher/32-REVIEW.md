---
phase: 32-match-rule-hardening-provider-agnostic-matcher
reviewed: 2026-09-05T15:27:25Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - supabase/functions/_shared/dedup-fingerprint.ts
  - supabase/functions/_shared/event-resolver.ts
  - supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts
  - supabase/functions/_shared/__tests__/event-resolver.test.ts
  - supabase/migrations/20260902000001_recurring_call_titles_security_invoker.sql
  - supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql
  - src/test/event-resolution-kill-switch.integration.test.ts
  - src/test/event-resolution-metadata-tier.integration.test.ts
  - src/test/rls-regression.test.ts
  - scripts/shadow-precision-eval.ts
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-09-05T15:27:25Z
**Depth:** standard (extended with targeted cross-file verification for the task's explicit pointed questions — see note below)
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the Phase 32 match-rule-hardening changeset: the `checkMatch` nonzero-time-overlap gate (dedup-fingerprint.ts), the new provider-agnostic metadata tier (`findMetadataCandidates`/`scoreMetadataPair`/`writeMetadataProposals` in event-resolver.ts), the `kill_switch_revert_event_merges` bulk-reversal RPC, the `recurring_call_titles` security_invoker restoration, the extended RLS regression suite, and the read-only shadow-precision evaluator script.

To answer the task's specific pointed questions accurately (especially #3, "is there any other caller?" of `checkMatch`), I traced callers across file boundaries beyond the 10 listed files — into `zoom-webhook/index.ts`, `zoom-sync-meetings/index.ts`, `connector-pipeline.ts`, and (to verify claims made by the reviewed migration/test-file comments against what actually shipped) the phase's own `32-02` through `32-05` PLAN/SUMMARY artifacts. That verification changed two of my initial conclusions for the better (see WR-01 and IN-04 below — I want to be transparent that I checked before finalizing rather than shipping a stale claim) and surfaced the review's most serious finding (CR-01), which could not have been found by reading the 10 listed files in isolation.

**What's solid:** the `Object.create(null)` prototype-pollution fix (with a real regression test reproducing the exact CR-01-from-31-REVIEW collision), the metadata tier's same-org grouping and asymmetric propose-threshold math (verified the "independently strong" gate is in fact mathematically redundant, as the code's own comment claims), the kill-switch RPC's `SECURITY DEFINER` + `search_path` pinning + `REVOKE EXECUTE` pattern, and the RLS regression suite's existence-before-denial pattern (proving a table isn't just empty before asserting a deny).

**What isn't:** one confirmed violation of this phase's own written data-handling threat model with real customer data now sitting in git (CR-01), a fail-closed guarantee that silently degrades to fail-open under a specific, plausible DB error (CR-02), and a "kill switch" that is not safe to press twice (CR-03). All three are demonstrated with direct evidence below, not speculation.

## Critical Issues

### CR-01: Real third-party company data was drawn into the sweep against this phase's own locked threat-mitigation decision, and is now committed to git, unprotected by `.gitignore`

**File:** `scripts/shadow-precision-eval.ts:8-13, 33-38, 471-493` (mechanism); `.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/32-05-shadow-precision-worksheet-3def74de-495f-411b-b5dd-b3852429b14d-2026-09-05T15-05-27-796Z.json` and `32-05-shadow-precision-hand-labeled.json` (the actual exposed data, confirmed committed via `git ls-files`)

**Issue:** `32-05-PLAN.md`'s own threat model states, verbatim:

> `T-32-06 | Information Disclosure | Using a customer org for the label set | mitigate | Locked decision: Andrew's own org/account only, never a customer's data, never a synthetic org.`

Task 3's `<action>` and `<success_criteria>` repeat this: *"SAFE-06: shadow precision measured against a hand-labeled set from Andrew's own org... before SAFE-01 is enabled for any customer org."* `T-32-04`'s mitigation likewise promises *"light human gate confirms the specific org is not a customer."*

The actual execution (`32-05-SUMMARY.md`) did not follow this. Andrew rejected the org the plan's own read-only scan suggested (`AI Simple` — his own consulting business) and instead chose `Clickable Impact`, quoted verbatim in the SUMMARY: *"the Clickable Impact org is the best because this is actually **a company that I work with**... Clickable Impact is a good place to start because I already have **people from Clickable** on here CallVault."* That is a description of a distinct third-party company's account, not "Andrew's own org/account" — the exact scenario `T-32-06` names as a threat to be prevented, not weighed and accepted.

The concrete, in-scope consequence is verifiable directly from the reviewed file set: `shadow-precision-eval.ts`'s own docstring frames its local JSON write as an inherently safe sink ("The only filesystem writes are the local JSON worksheet under `.planning/phases/.../` -- never a database write"), but `.planning/` is **not** gitignored (only `.planning/graphs/` is — checked `.gitignore` directly), and both worksheet artifacts are tracked:

```
$ git ls-files | grep 32-05-shadow-precision-worksheet
.planning/phases/32-match-rule-hardening-provider-agnostic-matcher/32-05-shadow-precision-worksheet-3def74de-495f-411b-b5dd-b3852429b14d-2026-09-05T15-05-27-796Z.json
```

Both files contain real recording titles ("06.16.26 - Clickable - Sales Meeting"), real recording UUIDs, real timestamps, and the org's real name ("Clickable Impact") — committed at `c5d019b9`. That commit is 3 commits ahead of `origin/main` and not yet on any remote-tracking ref (`git branch -r --contains <sha>` returns nothing), so this has not yet been pushed — it is still recoverable, which is exactly why this needs to be caught now rather than after a `git push`.

**Fix:**
1. Before the next push: remove both worksheet files from git (`git rm` + amend, or `git filter-repo`/`git rebase -i` if any intervening commits depend on them) rather than letting them reach `origin/main`.
2. Add a rule to `.gitignore` for future shadow-precision worksheet output (e.g. `.planning/phases/**/*-shadow-precision-worksheet-*.json` and `*-hand-labeled.json`), or change `writeWorksheet()` in `scripts/shadow-precision-eval.ts` to write outside any tracked directory (e.g. a `.local/` or `/tmp`-style path) by default.
3. Get an explicit, current decision from Andrew on whether using Clickable Impact's data was acceptable under whatever agreement CallVault has with them, and if so, update `32-05-PLAN.md`'s threat model / `T-32-06` to reflect the actual decision made instead of leaving a "locked decision" on record that visibly wasn't the one executed — the next engineer who reads the threat model will trust it.

---

### CR-02: `runShadowSweep`'s metadata tier does not fail closed when the `recurring_call_titles` fetch errors — MATCH-05 title-suppression is silently disabled for the whole tick

**File:** `supabase/functions/_shared/event-resolver.ts:373-408`

**Issue:** The file's header explicitly promises: *"On any query/extraction error, fails CLOSED: skips, writes nothing for the failed item, logs, and continues with the rest of the batch."* `32-02-PLAN.md`'s own task text requires the same for this exact fetch: *"Keep it same-org-only and fail-closed (a fetch error skips that org, logs, continues — mirror the existing tier-1 error handling)."*

The `call_participants` fetch correctly implements this — its error branch is the `if` of an `if/else`, so a failure skips the entire metadata-tier body (candidate-building, scoring, and writing) for the tick. The `recurring_call_titles` fetch does **not**:

```ts
if (recurringResult.error) {
  console.error(
    '[event-resolver] runShadowSweep recurring_call_titles fetch failed closed:',
    recurringResult.error.message,
  );
  summary.errors++;
} else {
  for (const row of (recurringResult.data ?? []) as {...}[]) {
    occurrenceByOwnerTitle.set(`${row.user_id}::${row.title}`, row.occurrence_count);
  }
}

const metadataCandidates: MetadataCandidate[] = candidates.map((c) => ({
  ...
  occurrence_count:
    c.owner_user_id && c.title
      ? occurrenceByOwnerTitle.get(`${c.owner_user_id}::${c.title}`) ?? null
      : null,
}));

const metadataMatches = findMetadataCandidates(metadataCandidates);
const writeResult = await writeMetadataProposals(supabase, metadataMatches);
```

There is no `continue`/`return` in the error branch. When `recurring_call_titles` errors, `occurrenceByOwnerTitle` stays empty, every candidate's `occurrence_count` resolves to `null`, and `shouldSuppressTitleSignal(null)` returns `false` by its own documented fail-closed-toward-NOT-suppressed contract — meaning every genuinely recurring title in this batch scores at **full title weight (0.20)** instead of being suppressed, and the sweep proceeds to score and propose merges anyway. This is precisely the recurring-title false-merge trap (the F5 pattern) this tier exists to close, silently re-opened by a transient/permissions DB error on one specific query. The comment even says "failed closed" on the line that doesn't.

This is not covered by `event-resolution-metadata-tier.integration.test.ts` — no test simulates a `recurring_call_titles` fetch failure, so the gap ships untested.

**Fix:** Make the `recurring_call_titles` error branch actually skip metadata-tier proposing for the tick, matching the `call_participants` pattern:
```ts
if (recurringResult.error) {
  console.error(
    '[event-resolver] runShadowSweep recurring_call_titles fetch failed closed:',
    recurringResult.error.message,
  );
  summary.errors++;
  // fail closed: do not propose with unknown suppression state
} else {
  for (const row of ...) { occurrenceByOwnerTitle.set(...); }
  // move candidate-building + findMetadataCandidates + writeMetadataProposals here,
  // inside the success branch only
}
```
Add an integration/unit test that forces this fetch to error (e.g. inject a client whose `recurring_call_titles` query errors) and asserts `metadataProposed === 0` for that tick.

---

### CR-03: `kill_switch_revert_event_merges` is not idempotent — repeat invocation over the same window silently re-reverts already-reverted decisions

**File:** `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql:57-79`

**Issue:** The function selects on `emd.decision = 'merge_applied'` and, per matching row, **inserts a new `'reversed'` ledger row** referencing the original via `reverses_decision_id` — it never updates the original row's `decision` column:

```sql
FOR v_rec IN
  SELECT emd.id, emd.recording_id_a, emd.recording_id_b, emd.tier
  FROM event_match_decisions emd
  JOIN recordings r ON r.id = emd.recording_id_a
  WHERE emd.decision = 'merge_applied'
    AND emd.created_at >= p_start_time
    AND emd.created_at <= p_end_time
    AND (p_organization_id IS NULL OR r.organization_id = p_organization_id)
LOOP
  UPDATE recordings SET event_id = NULL, updated_at = NOW()
  WHERE id IN (v_rec.recording_id_a, v_rec.recording_id_b);

  INSERT INTO event_match_decisions (..., decision, decided_by, applied, reverses_decision_id)
  VALUES (..., 'reversed', 'admin', false, v_rec.id);

  v_count := v_count + 1;
END LOOP;
```

Because the original row's `decision` is left as `'merge_applied'` forever, a **second call with the same (or any overlapping) `p_start_time`/`p_end_time`/`p_organization_id`** will re-select the exact same already-reverted decisions. The `UPDATE ... SET event_id = NULL` is a harmless no-op (already null), but the `INSERT` is not — it writes a **second** `'reversed'` row pointing at the same `reverses_decision_id`, and `v_count` reports reversals that didn't actually happen. There is also no `FOR UPDATE` row lock on the cursor SELECT, so two concurrent admin invocations over overlapping windows have the identical race.

This is a "break glass" admin tool — exactly the kind of action that gets retried under incident pressure (timeout with unclear success, accidental double-submit from a UI, a script retrying on a 5xx). A non-idempotent bulk-reversal RPC is a real risk for the one tool whose entire purpose is being a trustworthy undo button.

The test suite does not catch this, and its own comment overclaims what it proves. `event-resolution-kill-switch.integration.test.ts`'s third test is titled "a second... call... does not re-revert the already-reverted org-A merges," but that second call is scoped to **`p_organization_id: orgBId`** (line 361), not `orgAId` — so decision1/decision2 (org A) are excluded by the **org filter**, not because they're already reverted. The test's own inline comment (lines 383-386) claims: *"decision = 'merge_applied' is the RPC's own filter, so an already-reversed decision is no longer eligible on a later call"* — this is not what the SQL implements (the original row's `decision` is never changed away from `'merge_applied'`), and no test actually repeats the identical org+window to exercise it. `32-03-SUMMARY.md` line 95 repeats the same conflated claim ("without double-reverting the already-reverted org-A decisions") to describe the same org-B-scoped call, so this gap propagated into the phase's own completion record.

**Fix:** Exclude decisions that already have a reversal on record, e.g.:
```sql
WHERE emd.decision = 'merge_applied'
  AND emd.created_at >= p_start_time
  AND emd.created_at <= p_end_time
  AND (p_organization_id IS NULL OR r.organization_id = p_organization_id)
  AND NOT EXISTS (
    SELECT 1 FROM event_match_decisions rev
    WHERE rev.reverses_decision_id = emd.id
  )
```
(Append-only ledger design means mutating the original row's `decision` is likely the wrong fix — the `NOT EXISTS` guard preserves append-only semantics while restoring idempotency.) Add a test that calls the RPC twice with **identical** parameters (same org, same window) and asserts the second call's `revertedCount` is `0` and no second `reversed` row is created.

## Warnings

### WR-01: `dedup-fingerprint.test.ts`'s header comment overstates `checkMatch`'s live reachability

**File:** `supabase/functions/_shared/__tests__/dedup-fingerprint.test.ts:5-8`

**Issue:** The header states: *"This module (dedup-fingerprint.ts) is the LIVE Zoom-only dedup matcher -- called synchronously by zoom-webhook and zoom-sync-meetings on every real webhook delivery today."* I traced every caller of `checkMatch` (the function this test file exists to pin, and the one carrying the F5 fix) to verify the task's question #3 ("is there any other caller?"):

- `checkMatch`'s only call site anywhere in `supabase/functions/` is inside `findPotentialDuplicates` in `zoom-webhook/index.ts:273`. Grepping the whole file for the identifier `findPotentialDuplicates` returns exactly **one** match — the function definition itself (`index.ts:227`) — it is never invoked from `Deno.serve`.
- `zoom-sync-meetings/index.ts` imports only `generateFingerprint`/`generateFingerprintString` from `dedup-fingerprint.ts` — it never imports or calls `checkMatch` at all.
- Both files' actual "already exists, skip" decision runs through `runPipeline` (`connector-pipeline.ts`), via `pipelineResult.skipped`/`result.skipped` — a completely separate mechanism (keyed off `onConflict: 'user_id,zoom_meeting_uuid'` and the pipeline's own dedup, not a `checkMatch` fuzzy score). `connector-pipeline.ts` has zero references to `dedup-fingerprint.ts` or `checkMatch`.

So the *module* is live (fingerprint strings get generated and stored), but the *specific function this test file and the F5 fix are about* is not reachable from either edge function's live handler. This is not a novel discovery on my part — `event-resolution-metadata-tier.integration.test.ts`'s own MATCH-11 guard already documents `findPotentialDuplicates`/`handleDuplicateMerge` as "dead code, pre-existing, confirmed unchanged by this plan," and `32-04-SUMMARY.md` independently confirms via a historical-data audit that "the bug was already confirmed dormant -- the consuming pipeline was dead code, never wired to the live handler" and frames the prod deploy as "defense-in-depth rather than stopping an active false-merge stream." So the team is aware and transparent about this elsewhere — but the specific comment in this required-reading test file still asserts the opposite ("called synchronously... on every real webhook delivery today"), and a future engineer debugging a real duplicate-meeting report who reads only this file (its stated purpose) would be misdirected toward a dead code path.

**Fix:** Correct the header comment to distinguish "the module is live" from "`checkMatch` specifically is reachable only via dead code (`findPotentialDuplicates`)," and point future readers at `runPipeline`/`connector-pipeline.ts` as the actual live dedup mechanism for these two functions.

---

### WR-02: Kill-switch org filter checks only `recording_id_a`'s organization, not both sides of the pair

**File:** `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql:59-64`

**Issue:** `JOIN recordings r ON r.id = emd.recording_id_a` followed by `AND (p_organization_id IS NULL OR r.organization_id = p_organization_id)` only validates `recording_id_a`'s org. This relies entirely on the invariant that `event_match_decisions` pairs are always same-org (enforced at the matcher layer by `findDeterministicMatches`/`findMetadataCandidates`, and at the RLS layer per the new SAFE-04 tests). If that invariant is ever violated by a future bug or a manual/out-of-band insert, an org-scoped kill-switch call would behave inconsistently — it could revert a pair based on only one side's org, or fail to revert a pair whose `recording_id_a` happens to sit in a different org than intended.

**Fix:** Defense-in-depth: join both sides and require both to match (or neither, when `p_organization_id IS NULL`), e.g. `JOIN recordings ra ON ra.id = emd.recording_id_a JOIN recordings rb ON rb.id = emd.recording_id_b ... AND (p_organization_id IS NULL OR (ra.organization_id = p_organization_id AND rb.organization_id = p_organization_id))`.

---

### WR-03: Kill-switch reverses one pairwise decision at a time with no awareness of larger merged groups

**File:** `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql:65-68`

**Issue:** `UPDATE recordings SET event_id = NULL ... WHERE id IN (v_rec.recording_id_a, v_rec.recording_id_b)` nulls out exactly the two recordings named by one `event_match_decisions` row. If a third recording was separately matched into the same `event_id` via a different pairwise decision (e.g. C matched with A after A+B were already merged), reverting the A+B decision alone would leave C still pointing at an event that A no longer belongs to, without touching C or its own decision row. I can't fully confirm from the reviewed files whether N-way merges via chained pairwise decisions are a supported/exercised scenario in this codebase (`apply_event_match_atomic`'s full behavior is out of this review's file scope), but if they are, a kill-switch call scoped to one time window could partially and silently unwind a merged group.

**Fix:** Before shipping this as the general-purpose "undo button," confirm whether N-way merges via chained decisions occur in practice; if so, either revert full event groups atomically (all decisions sharing an `event_id`, not just the one in-window row) or document this as a known limitation for operators using the tool.

---

### WR-04: Kill-switch silently no-ops on NULL start/end instead of raising a validation error

**File:** `supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql:53-55`

**Issue:** `IF p_start_time > p_end_time THEN RAISE EXCEPTION ...` — if either parameter is `NULL` (both parameters have no `DEFAULT`, so a caller can still pass an explicit `null` via PostgREST), the comparison evaluates to `NULL`, which is not `TRUE`, so the guard does not fire. The function then proceeds; the `WHERE emd.created_at >= p_start_time` clause evaluates to `NULL` (not `TRUE`) for every row when compared against `NULL`, so the loop matches zero rows and the function silently returns `0`. Not dangerous (fails to "does nothing" rather than "reverts everything"), but a caller who mistakenly omits a required time bound gets a confusing silent no-op instead of a clear error telling them what's wrong.

**Fix:** Add an explicit NULL check ahead of the range check: `IF p_start_time IS NULL OR p_end_time IS NULL THEN RAISE EXCEPTION 'p_start_time and p_end_time are required'; END IF;`.

---

### WR-05: `rls-regression.test.ts`'s new SAFE-04 block never verifies Org A can still read the merged event/recordings — only that Org B cannot

**File:** `src/test/rls-regression.test.ts:1391-1425`

**Issue:** The pre-existing `eventA` block (lines 1278-1333) deliberately asserts *both* directions and explains why in its own comment: *"A pure negative/leak test would also pass for the wrong reason against a mis-scoped deny-everyone policy, so this block asserts BOTH directions."* It even goes further, adding a third, participant-only-fixture test specifically to close a real gap (`30-REVIEW.md CR-01`) where a false-deny in the participation branch went undetected because the only fixture user also happened to pass via the ownership branch.

The new Phase 32 SAFE-04 block (merged-event-via-`apply_event_match_atomic` fixtures `recordingA3Id`/`recordingA4Id`/`mergedEventId`) only has the negative half: "Org B (unrelated org) cannot read the merged event by id" and "...cannot read either merged recording by id." There is no equivalent "Org A (the actual owner) reads exactly 1 row of the merged event/recordings" positive assertion. This means a regression that accidentally denies genuine access to *post-merge* records (e.g. a policy that only grants read access when a recording's `event_id` was set by the "normal" resolution path, not by `apply_event_match_atomic`) would pass this entire suite silently — precisely the class of bug this file's own `30-REVIEW.md CR-01` precedent exists to catch, just not replicated here.

**Fix:** Add `clientA` positive-read assertions (`data?.length === 1`) for `mergedEventId` and for `recordingA3Id`/`recordingA4Id`, mirroring the existing `eventA` block.

---

### WR-06: `recurring_call_titles` aggregates purely by `(owner_user_id, title)` with no organization scoping

**File:** `supabase/migrations/20260310125000_migrate_call_recording_id_to_uuid.sql:515-526` (view definition, confirmed by direct read); consumed by `supabase/functions/_shared/event-resolver.ts:374-394`

**Issue:** The view's `GROUP BY r.owner_user_id, r.title` has no `organization_id` in its `SELECT`, `WHERE`, or `GROUP BY`. If the same `owner_user_id` owns recordings in two different organizations that happen to share a title, `occurrence_count` for that `(user, title)` pair is a sum across **both** orgs — meaning one org's MATCH-05 title-suppression decision (`shouldSuppressTitleSignal`) can be influenced by a different org's data. I traced the effect direction: `shouldSuppressTitleSignal` only ever *increases* with a higher count (more occurrences → more likely to suppress → lower score → more conservative), so this specific leak cannot cause a false merge on its own — it can only make the system more conservative than intended. Still, every other part of this matcher (findDeterministicMatches, findMetadataCandidates) is explicitly same-org-scoped as defense-in-depth even where the effect would also be "safe," so this is an inconsistency worth closing rather than relying on the fact that this particular leak happens to point the safe direction.

**Fix:** Either add `organization_id` to the view (requires a migration + updating `event-resolver.ts`'s query/key), or explicitly document in the view's comment that `occurrence_count` is intentionally cross-org per-user, if that's accepted.

---

### WR-07: `checkMatch`'s mandatory gate only forbids *zero* overlap, not *weak* overlap — an untested near-miss variant of F5 remains possible

**File:** `supabase/functions/_shared/dedup-fingerprint.ts:286`

**Issue:** `const isMatch = timeOverlap > 0 && criteriaMetCount >= 2;` — time only has to be **nonzero**, not one of the two criteria actually met. A pair with a razor-thin nonzero overlap (e.g. `0.01`, well under the `0.50` `time_overlap` threshold) still satisfies the gate; if title (`>=0.80`) and participants (`>=0.60`) both independently clear their own thresholds, `criteriaMetCount = 2` regardless of time, and `is_match = true`. This is explicitly the code's own documented design (the comment scopes the fix narrowly to "zero," and the threshold-based 2-of-3 rule is stated as "unchanged"), so I'm not asserting this contradicts intent — but the new test suite (`dedup-fingerprint.test.ts`) covers "zero overlap" (F5 exactly) and "nonzero-but-fails-title-and-participants" (the inverse), and never exercises "nonzero-but-below-the-0.50-threshold, combined with title+participants both met" — the actual boundary condition adjacent to F5 that this gate's design leaves open. Given the bucket-rounding involved (15-minute start buckets, 5-minute duration buckets) can produce small nonzero overlaps between otherwise-distinct occurrences, this is worth a deliberate test to confirm the team is accepting this as in-scope-per-design rather than an oversight.

**Fix:** Add a test case: title>=0.80 AND participants>=0.60 AND `0 < timeOverlap < 0.50`, and assert whatever the *intended* behavior is (match or no-match) so this boundary is a documented decision, not an implicit one.

## Info

### IN-01: `findDuplicates` (dedup-fingerprint.ts) is exported but has zero callers anywhere in the codebase

**File:** `supabase/functions/_shared/dedup-fingerprint.ts:326-343`
**Issue:** Grepping `findDuplicates(` across `supabase/`, `src/`, and `scripts/` returns only the definition itself. This corroborates WR-01: the whole `checkMatch`-based scored-matching machinery in this file has no live caller today.
**Fix:** Either wire it up somewhere or remove it / mark it clearly as retained-for-future-use in a comment, so its dead status is a documented decision rather than an accident.

### IN-02: Redundant branch in `calculateParticipantOverlap`

**File:** `supabase/functions/_shared/dedup-fingerprint.ts:213-220`
**Issue:**
```ts
if (participants1.length === 0 && participants2.length === 0) {
  return 0;
}
if (participants1.length === 0 || participants2.length === 0) {
  return 0;
}
```
The first check's condition is a strict subset of the second's (`&&` implies `||`), so the first branch is dead — the second check alone produces identical behavior. Harmless, just confusing to a future reader who might assume the two branches mean something different.
**Fix:** Delete the first `if` block; the comment explaining the "both empty = neutral" intent can move to the remaining check.

### IN-03: Duplicated insert + unique-violation-handling logic between `runShadowSweep`'s tier-1 write and `writeMetadataProposals`

**File:** `supabase/functions/_shared/event-resolver.ts:301-322` vs `714-746`
**Issue:** Both blocks independently implement "insert into `event_match_decisions`, treat `isUniqueViolation` as a benign increment, otherwise log+count an error." Same idiom, duplicated rather than shared.
**Fix:** Extract a small helper (e.g. `insertProposal(supabase, row, summary)`) used by both call sites.

### IN-04: `20260902000001_recurring_call_titles_security_invoker.sql`'s comment ("applied to TEST only") is now stale

**File:** `supabase/migrations/20260902000001_recurring_call_titles_security_invoker.sql:19-23`
**Issue:** The migration's scope note says production application is deferred to "Plan 04's guarded production apply." I initially read this as a live, unpatched production vulnerability and started to write it up as a Critical finding — but `32-04-SUMMARY.md` documents this was in fact applied to production on 2026-09-02, with direct SQL introspection evidence (`recurring_view_reloptions: ["security_invoker=true"]`, previously `null`). No outstanding vulnerability. Flagging only because the migration file, read in isolation (which is exactly how a future engineer investigating this view will encounter it), still asserts a now-outdated "TEST only" scope.
**Fix:** Append a short follow-up note to the migration's comment (or a new migration's comment) confirming the production apply date, so the file doesn't read as an open item forever.

---

## Addendum: CR-02 and CR-03 Remediation (2026-09-05)

Both Critical findings below are fixed, tested, and deployed. CR-01 (the shadow-precision
worksheet data-exposure finding) is tracked and resolved/accepted separately by Andrew, per
the executing task's explicit instruction -- not addressed by this addendum. The 7 warnings
and 4 info findings above remain dormant/deferred as documented; no action taken on them here.

### CR-02: `recurring_call_titles` fetch error now fails closed (zero proposals for the tick)

**Fix:** `runShadowSweep`'s metadata tier now tracks a `recurringTitlesFetchFailed` flag. When
the `recurring_call_titles` fetch errors, candidate-building, `findMetadataCandidates`, and
`writeMetadataProposals` are skipped entirely for that tick -- mirroring the sibling
`call_participants` error branch's existing skip-the-tick behavior. Tier-1 (deterministic)
proposals already written earlier in the same tick are unaffected.

**Tests:** `supabase/functions/_shared/__tests__/event-resolver.test.ts` gained a
`runShadowSweep`-level regression test using a fake Supabase client that forces the
`recurring_call_titles` fetch to error against a fixture that would otherwise score 0.9125
(above `MERGE_PROPOSE_THRESHOLD`) if unsuppressed -- asserts `metadataProposed === 0` and zero
`event_match_decisions.insert` calls. Two control tests (fetch succeeds, below-threshold count
-> proposes; fetch succeeds, at-threshold count -> correctly suppressed) prove the fixture is
capable of proposing and that the refactor did not regress the normal success path. All 29
tests in the file pass (26 pre-existing + 3 new).

**Deployed:** `resolve-events` redeployed to production (`vltmrnjsubfzrgrtdqey`) via
`supabase functions deploy resolve-events --use-api` -- version bumped 4 -> 5,
`UPDATED_AT 2026-09-05 16:15:51`, `ACTIVE`. Bundles the fixed `_shared/event-resolver.ts`.

**Commit:** `fb68b617` (fix(32): CR-02 fail closed on recurring_call_titles fetch error in metadata tier)

### CR-03: `kill_switch_revert_event_merges` is now idempotent under retry

**Fix:** New additive migration
`supabase/migrations/20260905120000_kill_switch_revert_idempotency_fix.sql`
(`20260902000002` is unedited, per this repo's migration convention). The cursor `SELECT` now
excludes any decision that already has a `'reversed'` row referencing it
(`NOT EXISTS (... WHERE rev.reverses_decision_id = emd.id)`), preserving the ledger's
append-only convention (mutating the original row was rejected as inconsistent with
`apply_event_match_atomic`/`reverse_event_match_atomic`, which also never mutate a decision row
post-write -- confirmed by reading `20260901000003` directly). Also adds `FOR UPDATE OF emd` to
the cursor, serializing concurrent overlapping invocations against the same candidate rows --
the secondary gap the same finding named. `REVOKE EXECUTE` re-asserted defensively.

**Tests:** `src/test/event-resolution-kill-switch.integration.test.ts` gained a new,
self-contained test (its own fixture pair, independent of the file's existing
decision1/decision2/decision3/decisionOld fixtures) that calls the RPC twice with IDENTICAL
parameters (same org, same window) and asserts the second call reverts `0` decisions and no
duplicate `reversed` row exists. All 4 tests in the file pass (3 pre-existing + 1 new),
verified against a real database both before and after the prod apply.

**TEST-then-prod apply (both verified via two independent signals -- `supabase/.temp/project-ref`
file + `supabase projects list` LINKED marker):**
1. Linked to TEST (`swjzxiddcrtaqixsfaac`, callvault-test). `supabase db push --linked --dry-run`
   confirmed exactly one pending migration (the new file), nothing else. Applied for real;
   `supabase migration list --linked` confirmed `20260905120000` Local == Remote. Introspected
   the live function body (`pg_get_functiondef`) and confirmed both the `NOT EXISTS` guard and
   `FOR UPDATE OF emd` are present; grants confirmed `EXECUTE` limited to `postgres`/
   `service_role` only (no `anon`/`authenticated`).
2. Ran the kill-switch integration test against TEST: `VITEST_INTEGRATION_OK=true npx vitest
   run src/test/event-resolution-kill-switch.integration.test.ts` -- 4/4 pass, including the new
   idempotency test (339ms, real DB round trips).
3. Relinked to PRODUCTION (`vltmrnjsubfzrgrtdqey`, callvault-ai) -- confirmed via both signals
   BEFORE applying. `--dry-run` confirmed exactly the one new migration pending, nothing else.
   Applied for real; `supabase migration list --linked` confirmed Local == Remote. Introspected
   the live prod function body: `NOT EXISTS` guard present, `FOR UPDATE OF emd` present; grants
   confirmed `EXECUTE` limited to `postgres`/`service_role` only. Confirmed via both signals
   AGAIN after apply, and again after the `resolve-events` redeploy that followed -- never
   drifted to `swjzxiddcrtaqixsfaac`/callvault-test at any point.

**Commit:** `becbb352` (fix(32): CR-03 kill-switch idempotency under retry)

### Deferred (out of scope for this remediation, logged separately)

`reverse_event_match_atomic` (Phase 31, `20260901000003`) shares CR-03's non-idempotency shape
under a repeated single-decision retry (same append-only design, same missing exclusion guard,
narrower blast radius since it's one pair per call rather than a bulk sweep). Not named in this
review's findings and not fixed by this addendum -- logged to `deferred-items.md` for a future
pass.

_Addendum added: 2026-09-05_
_By: Claude (GSD executor, CR-02/CR-03 remediation)_

---

_Reviewed: 2026-09-05T15:27:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
