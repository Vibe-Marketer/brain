---
phase: 34-identity-consolidation
plan: gapclosure
subsystem: database
tags: [supabase, postgres, identity, security, rls, idor, prod-apply]

requires:
  - phase: 34-02
    provides: "identities + identity_aliases tables, user_can_view_identity, get_identity_evidence RPC"
  - phase: 34-review
    provides: "CR-01 and WR-02 findings"
provides:
  - "get_identity_evidence gated by user_can_view_identity (no more cross-org IDOR)"
  - "user_can_view_identity speakers.identity_id branch"
affects: [35, 39]

tech-stack:
  added: []
  patterns:
    - "Same TEST-then-prod guarded-apply discipline as prior Phase 34 plans: prod-ref verified before AND after via supabase/.temp/project-ref, migration applied via supabase db push --linked."

key-files:
  created:
    - supabase/migrations/20260906000001_fix_identity_evidence_authz_and_speakers_view_gap.sql
  modified:
    - src/test/identity-evidence-rpc.integration.test.ts

key-decisions:
  - "Both fixes landed as a single additive CREATE OR REPLACE migration rather than two separate migrations, since they touch the same two functions in the same file and were reviewed together."
  - "Test fix is minimal per Andrew's standing directive: only the non-owner assertion was corrected (redacted-row -> zero-rows), plus one new test proving the WR-02 speakers branch. No new scaffolding beyond the existing fixture pattern in the file."

requirements-completed: []

duration: ~25min
completed: 2026-09-07
status: complete
---

# Phase 34 Gap Closure: CR-01 + WR-02 Summary

**Closed a cross-org IDOR in `get_identity_evidence` and a latent RLS gap in `user_can_view_identity` for speakers-only-linked users, both flagged in the Phase 34 code review, via one additive migration applied TEST-then-prod.**

## What CR-01 and WR-02 Were

**CR-01 (Critical):** `get_identity_evidence(p_identity_id UUID)` was `GRANT EXECUTE TO authenticated` with zero caller-authorization check in its body. Any authenticated user in any organization could call it with a hand-typed `identity_id` UUID and receive that identity's full evidence rows (`alias_type`, `confidence`, `evidence`) for a person they had no relationship to. This was inconsistent with the `identities` table's own RLS policy two sections away in the same migration, which correctly gates on `user_can_view_identity()`. The existing integration test pinned this as intentional ("redaction is the boundary, not RLS"), which the review identified as a documented, working cross-org IDOR — no PII leaked today only because the sole writer hardcodes `evidence = 'verified email'`, but the access-control gap was real and independent of current content.

**WR-02 (Warning):** `user_can_view_identity()` checked three branches — `identities.owner_user_id`, `call_participants` (via `is_organization_member`), and `contacts` (via `is_organization_member`) — but never checked `speakers.identity_id`, despite the same migration extending `speakers` with `identity_id` and documenting it as "user-scoped." A user whose only link to an identity was a `speakers` row they owned (no owner/participant/contact link) would be denied SELECT on the `identities` row for a person they legitimately had a speaker-level link to. Not exploitable today (no client code reads `identities` via a speakers-only link), but the resolver actively writes `identity_id` onto `speakers` rows, and Phase 39 (DISCO-02) is expected to build on ownership claiming that would surface this gap.

## The Exact Fix

New migration: `supabase/migrations/20260906000001_fix_identity_evidence_authz_and_speakers_view_gap.sql`. Both functions are `CREATE OR REPLACE` with the original bodies preserved byte-for-byte plus the two additions:

**`user_can_view_identity`** — added a fourth `EXISTS` branch:
```sql
) OR EXISTS (
  SELECT 1 FROM speakers s
  WHERE s.identity_id = p_identity_id
    AND s.user_id = p_user_id
);
```
(confirmed `speakers.user_id` as the ownership column against `00000000000000_consolidated_schema.sql` before landing this, per the review's own caveat.)

**`get_identity_evidence`** — added the authz gate to the `WHERE` clause exactly as the review's suggested SQL specified:
```sql
WHERE identity_id = p_identity_id
  AND verified = true
  AND public.user_can_view_identity(p_identity_id, auth.uid())
```

`COMMENT ON FUNCTION` updated on both to document the CR-01/WR-02 fix and reference the review.

## Test Changes

`src/test/identity-evidence-rpc.integration.test.ts`:
- Renamed and rewrote the "non-owner" test case: previously asserted the RPC returns a redacted-but-present row for a non-authorized caller; now asserts **zero rows** — the RPC denies entirely (CR-01 proof).
- Added one minimal new test ("speakers-only link... WR-02 fix") reusing the existing fixture pattern: calls `user_can_view_identity` directly via the service-role client, first proving `false` before any link exists, then inserts a `speakers` row for the non-owner user with `identity_id` set to the shared test identity, then proving `user_can_view_identity` now returns `true`. Cleanup added to `afterAll`.
- No new scaffolding beyond reusing the file's existing owner/non-owner user fixtures and identity fixture.

## TEST-Green Proof

Linked CLI to TEST (`swjzxiddcrtaqixsfaac`), confirmed via `cat supabase/.temp/project-ref`. Applied migration via `supabase db push --linked` — clean apply, no errors. Ran:

```
VITEST_INTEGRATION_OK=true npx vitest run src/test/identity-evidence-rpc.integration.test.ts
```
Result: **PASS (4) FAIL (0)** — all four test cases in the suite green, including the rewritten non-owner assertion and the new speakers-branch test.

Also ran the broader identity/RLS regression suite as a sanity check:
```
VITEST_INTEGRATION_OK=true npx vitest run src/test/identity-schema-noop.integration.test.ts src/test/rls-regression.test.ts
```
Result: **PASS (9) FAIL (0) skipped (61)** — no regressions.

## Prod-Ref Guard Confirmations (Before/After)

- **Before push:** `supabase link --project-ref vltmrnjsubfzrgrtdqey`, then `cat supabase/.temp/project-ref` → `vltmrnjsubfzrgrtdqey` (confirmed prod, not test).
- **Applied:** `supabase db push --linked` — clean apply of `20260906000001_fix_identity_evidence_authz_and_speakers_view_gap.sql`.
- **After push:** `cat supabase/.temp/project-ref` → `vltmrnjsubfzrgrtdqey` (unchanged — confirms the push did not silently relink or drift to a different project).
- **Post-apply introspection (both functions verified live in prod via `supabase db query --linked "SELECT prosrc FROM pg_proc WHERE proname=...`):**
  - `get_identity_evidence.prosrc` contains `AND public.user_can_view_identity(p_identity_id, auth.uid())` — CR-01 fix confirmed live.
  - `user_can_view_identity.prosrc` contains the fourth `EXISTS (SELECT 1 FROM speakers s WHERE s.identity_id = p_identity_id AND s.user_id = p_user_id)` branch, with the original three branches unchanged — WR-02 fix confirmed live, no regression to the pre-existing branches.

This is a function-only migration (`CREATE OR REPLACE FUNCTION`, no schema/table changes) but was guarded with the same rigor as a table-creating migration per the standing milestone discipline — ref-checked before and after, and function bodies introspected post-apply rather than trusted from the migration file alone.

## Outcome

Both CR-01 and WR-02 are closed. `get_identity_evidence` now denies non-authorized callers entirely (zero rows) instead of leaking redacted evidence cross-org. `user_can_view_identity` now correctly grants visibility to users linked via `speakers.identity_id`, closing the gap before Phase 39's ownership-claiming work could have surfaced it as a real-world denial bug. No other Phase 34 functions, tables, or RLS policies were touched.

## Post-Task Cleanup

Incidental `supabase/.temp/{gotrue,rest,storage}-version` and `supabase/.temp/storage-migration` file drift from linking CLI between TEST and prod was reverted via `git checkout --` before committing (not committed). CLI relinked to prod (`vltmrnjsubfzrgrtdqey`) as final state.

## Self-Check

- `supabase/migrations/20260906000001_fix_identity_evidence_authz_and_speakers_view_gap.sql` — FOUND
- `src/test/identity-evidence-rpc.integration.test.ts` modifications — FOUND (diff present, committed)
- Commit `813f124` — present in `git log --oneline`
- Prod function bodies — confirmed live via direct introspection above (not trusted from migration file alone)

---
*Phase: 34-identity-consolidation*
*Completed: 2026-09-07*
