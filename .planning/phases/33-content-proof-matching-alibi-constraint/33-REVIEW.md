---
phase: 33-content-proof-matching-alibi-constraint
reviewed: 2026-09-05T18:31:57Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - supabase/functions/_shared/event-resolver.ts
  - supabase/functions/_shared/__tests__/event-resolver.test.ts
  - supabase/migrations/20260905130000_content_proof_apply_tier_param.sql
  - src/test/event-resolution-content-proof.integration.test.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-09-05T18:31:57Z
**Depth:** standard (with targeted cross-file verification against `dedup-fingerprint.ts`, the prior `event_match_decisions`/`apply_event_match_atomic` migrations, `src/types/supabase.ts`, and sibling integration tests, per the specific questions in scope)
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the content-proof tier, speaker-alibi veto, and the `apply_event_match_atomic` tier-param migration for Phase 33. Five of the reviewer's specific verification questions were traced end-to-end through the code and cross-referenced against the DB schema and sibling test files:

1. **Confirmed by grep + read**: `event-resolver.ts` contains zero `.rpc()` calls and zero `.update()` calls anywhere in the file; the only `event_id` reference is the read-only `.is('event_id', null)` filter. The content-proof pass genuinely only ever inserts `merge_proposed` rows into `event_match_decisions`. SAFE-02 holds as claimed.
2. **Confirmed by grep + read**: `isAlibiVetoed`/`isSpeakerAlibiViolation` are used at exactly three call sites (tier-1, content-proof, metadata), always as a boolean gate before a write, never as a positive scoring input. No path treats "not vetoed" as "confirmed same event."
3. **Confirmed by reading both migrations**: the `DROP FUNCTION IF EXISTS public.apply_event_match_atomic(UUID, UUID, UUID, TEXT, JSONB, UUID)` argument list matches the prior migration's real signature exactly, so only one overload exists in `public` when the three `REVOKE EXECUTE` statements run afterward, and all three (PUBLIC/anon/authenticated) are present. The permission reissue is correct as written. However, see WR-01 — there is no regression test that would catch a *future* migration silently omitting this reissue.
4. **Not fully confirmed — see CR-01 below.** The shingle-overlap gate has no temporal correlation requirement at all (unlike the metadata tier's explicit non-zero-time-overlap hard gate) and no protection against templated/repeated transcript content, which is a realistic false-positive vector for a tier that is explicitly designed to be auto-attach-eligible.
5. **Confirmed correct for the join key, confirmed a design gap for real-content risk.** The code exclusively reads/writes `transcript_chunks.canonical_recording_id` (a real, nullable, `ON DELETE SET NULL` UUID FK added in `20260303000009_update_transcript_chunks_fk.sql`), never touches the legacy `recording_id` BIGINT column, and correctly scopes all chunk fetches to the same-org candidate batch — a second org's real chunks cannot leak cross-org. `chunk_text`/`chunk_index` are `NOT NULL` at the schema level, so the code's defensive null-handling is harmless belt-and-suspenders. The real risk once a second org's genuine call-transcript chunks flow through this path is the same one raised in point 4 (CR-01).

## Critical Issues

### CR-01: Content-proof "conclusive" bar has no temporal gate and no defense against templated/repeated transcript content

**File:** `supabase/functions/_shared/event-resolver.ts:1069-1173` (`scoreContentProofOverlap`, `ContentProofCandidate`, `findContentProofMatches`)

**Issue:** The content-proof tier is the one tier in this milestone explicitly empowered to auto-attach without human review (the whole point of the migration under review is to let `apply_event_match_atomic` legally record `tier='content_proof'`). Its conclusiveness claim rests entirely on the assumption stated in the file's own comment block (lines 973-980): "shingles are rare by construction... no corpus-wide IDF-like rarity model is needed." That assumption does not hold for real call-transcript content, which is exactly what `transcript_chunks.chunk_text` now contains (61K real rows, confirmed against `20251125000001_ai_chat_infrastructure.sql`'s `chunk_text TEXT NOT NULL` — this is genuine transcribed speech, not synthetic filler).

Two concrete, non-hypothetical false-positive vectors are structurally unguarded:

- **No temporal correlation whatsoever.** `ContentProofCandidate` (lines 1094-1098) carries only `{ id, organization_id, chunks }` — no start/end time. Unlike the metadata tier, which hard-gates on `timeOverlap <= 0` (line 820, "a pair with zero real time overlap is discarded outright... regardless of how strong the other two signals are"), the content-proof tier can call two recordings months apart "conclusive" purely on text, with zero sanity check that they could plausibly be the same real-world event.
- **No rarity/frequency weighting, so templated content trivially clears the bar.** `CONTENT_PROOF_MIN_SHARED_SHINGLES = 5` with `SHINGLE_SIZE = 7` means as few as ~11 contiguous shared words (11 tokens → 11-7+1 = 5 windows) anywhere in two transcripts is "conclusive." Real call transcripts routinely contain verbatim-repeated spans that have nothing to do with shared identity: a sales/support rep's scripted opening read to two different customers, a recording platform's fixed join/leave/consent announcement, or a canned close — any of these easily exceeds 5 shared 7-grams between two genuinely unrelated recordings from the same org.

The speaker-alibi veto (MATCH-07) only closes part of this gap: it would catch the "same rep reads the same script to two different customers" case *if* the rep is tracked in `call_participants` with `has_confirmed_speech = true` on at least one side and the email matches exactly (see WR-02 for why that match can silently fail). It does **not** catch vendor/platform-injected boilerplate at all, since that text has no associated human participant to alibi-check against.

Given this milestone's own stated bar ("false merge = data-exposure incident") and that this capability is already deployed to prod and reachable by any future caller (admin action, cron job, later phase) that trusts "content_proof ⇒ conclusive," this is a load-bearing correctness gap, not a style nit.

**Fix:**
```typescript
// 1. Add a temporal gate, mirroring the metadata tier's own hard gate.
export interface ContentProofCandidate {
  id: string;
  organization_id: string;
  chunks: ContentProofChunk[];
  recording_start_time: string | null; // NEW
  recording_end_time: string | null;   // NEW
}

// In findContentProofMatches's pair loop, before scoring by content:
const timeOverlap = calculateTimeOverlap(a.recording_start_time, durationA, b.recording_start_time, durationB);
if (timeOverlap <= 0 /* and not within some bounded same-day/vendor-consistent window */) continue;

// 2. Reduce templated-content risk: require shared shingles to be spread
// across the transcript (not clustered in a single ~11-word span that could
// be a canned intro/outro), and/or raise CONTENT_PROOF_MIN_SHARED_SHINGLES,
// and/or exclude shingles that recur across many DISTINCT recording pairs
// for the same org (a cheap IDF-style corpus check) before counting them as
// evidence.
```
At minimum, add a unit test proving the matcher does **not** mark two transcripts conclusive when their only overlap is a single ~11-word canned block (the exact scenario this review found unguarded) before treating the current threshold as safe to keep auto-attach-eligible.

## Warnings

### WR-01: No regression test guards the `apply_event_match_atomic` REVOKE reissue

**File:** `supabase/migrations/20260905130000_content_proof_apply_tier_param.sql:166-168`

**Issue:** This migration correctly reissues all three `REVOKE EXECUTE ... FROM {PUBLIC, anon, authenticated}` statements after the `DROP FUNCTION` + `CREATE FUNCTION` (verified: the dropped 6-arg signature exactly matches the prior migration's real signature, so exactly one overload exists when the REVOKEs run, and PostgreSQL's default "new functions grant EXECUTE to PUBLIC" behavior is correctly undone). However, nothing in the test suite would catch a *future* migration that repeats this DROP+CREATE pattern (which the file header itself flags as the exact failure mode: "or the function becomes callable by anon/authenticated via PostgREST"). Because `apply_event_match_atomic` validates ownership **by parameter** (`p_owner_user_id`), not `auth.uid()`, a regression here is a full authorization bypass: any `authenticated` caller could merge two arbitrary *other* users' recordings by supplying that user's id as `p_owner_user_id`. Searched the whole test suite (`src/test/*.integration.test.ts`, `rls-regression.test.ts`) — every existing call to this RPC uses the service-role `admin` client; none assert that an anon/authenticated-scoped client is denied.

**Fix:** Add a permission-denial assertion, reusing the anon-client-with-real-JWT technique already established in `src/test/rls-regression.test.ts`:
```typescript
const anonClient = createClient(TEST_URL, TEST_ANON_KEY, { auth: { persistSession: false } });
await anonClient.auth.signInWithPassword({ email: someUserEmail, password });
const result = await anonClient.rpc('apply_event_match_atomic', { /* ...valid-looking args... */ });
expect(result.error).not.toBeNull(); // must be permission-denied, not a business-logic error
```

### WR-02: Speaker-alibi participant lookup skips the normalization the metadata tier applies to the same table/column

**File:** `supabase/functions/_shared/event-resolver.ts:340-355` (participant loop feeding `alibiLookup`) and `:1226-1235` (`hasConfirmedSpeakerInOther`)

**Issue:** The alibi participant fetch stores `email: row.email` verbatim:
```typescript
if (!row.email) continue;
const participant: AlibiParticipant = {
  email: row.email,
  has_confirmed_speech: row.has_confirmed_speech,
};
```
and `hasConfirmedSpeakerInOther` compares with strict equality: `o.email === p.email` (line 1231) — case-sensitive, whitespace-sensitive. The **metadata tier's own participant fetch, reading the same `call_participants.email` column earlier in the same function** (line ~546-548), explicitly normalizes: `normalizeParticipant(raw)` (lowercases + trims) precisely because email casing/whitespace at rest is not guaranteed consistent. If two providers (or two capture pipelines) report the same person's email with different casing across the two recordings being compared, `isSpeakerAlibiViolation` will silently fail to detect a genuine alibi violation — the exact "reject-only" safety layer CR-01 depends on for the "same human repeats a script" false-positive case would not fire.

This gap is untested: both the unit tests (`isSpeakerAlibiViolation` pure-function tests) and the integration test's fixture (`alibi-shared-${stamp}@example.com` reused as the literal same JS string for both sides, `event-resolution-content-proof.integration.test.ts:272-274`) use byte-identical casing, so no existing test would catch this.

**Fix:**
```typescript
const participant: AlibiParticipant = {
  email: normalizeParticipant(row.email),
  has_confirmed_speech: row.has_confirmed_speech,
};
```
(`normalizeParticipant` is already imported into this file from `./dedup-fingerprint.ts`.) Add a regression test with the same identity present under different casing/whitespace on each side, asserting the violation still fires.

### WR-03: Tier-1 (deterministic) write loop lacks the failure isolation given to the content-proof and metadata tiers

**File:** `supabase/functions/_shared/event-resolver.ts:381-418`

**Issue:** The content-proof block (lines 429-512) and metadata block (lines 519-635) are each explicitly wrapped in their own `try/catch`, and the file's own comments state this is deliberate: "Isolated in its own try/catch: a failure here fails closed... without touching tier-1's already-attempted proposals" and "without blocking the metadata tier below." The tier-1 proposal loop itself (lines 383-418, between the alibi-lookup block and the content-proof block) has no such wrapper — it runs inside the single outer `try` that spans the entire function body. If an insert in that loop throws (rather than merely returning a Postgrest `{ error }`, e.g. a genuine network-level exception), the outer `catch` at line 638 fires immediately, `return summary` executes right there, and **the content-proof and metadata tiers never run at all for that sweep tick** — silently, with no distinguishing signal in the summary beyond a generic `errors++`. This is the inverse of the isolation the two newer tiers were explicitly given, and it means the newest, most-defensively-coded tiers (content-proof, metadata) are only as robust as the oldest, least-isolated one.

**Fix:** Wrap the tier-1 loop in the same pattern used for the other two tiers:
```typescript
try {
  for (const match of matches) {
    // ... existing tier-1 body unchanged ...
  }
} catch (err) {
  console.error('[event-resolver] runShadowSweep tier-1 failed closed:', err);
  summary.errors++;
}
```

## Info

### IN-01: Direct-apply-RPC test permanently leaks an `events` row

**File:** `src/test/event-resolution-content-proof.integration.test.ts:530-581` (test), `:338-344` (cleanup comment)

**Issue:** The last test calls `apply_event_match_atomic` with `p_event_id: null`, which creates a brand-new `events` row. `afterAll` explicitly acknowledges and accepts this as an uncleaned byproduct ("The `events` row created by the direct apply-RPC test becomes orphaned... same accepted, uncleaned byproduct as `event-match-apply-reverse.integration.test.ts`'s own established pattern"). This mirrors existing precedent rather than being a new mistake in this file, but it does technically violate `supabase/CLAUDE.md`'s "tests must be idempotent — re-running the suite N times should leave the DB in the same state every time" contract, growing the `events` table by one orphaned row per test run indefinitely.

**Fix:** Capture the returned `eventId` in a `describe`-scoped variable and delete it in `afterAll` (`await admin.from("events").delete().eq("id", eventId)`, wrapped in the same try/catch style as the other cleanup steps). If the team prefers to keep parity with the Phase 31 precedent instead, consider a follow-up ticket to fix both files together rather than only this one.

---

_Reviewed: 2026-09-05T18:31:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
