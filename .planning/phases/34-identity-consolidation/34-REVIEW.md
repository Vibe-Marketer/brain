---
phase: 34-identity-consolidation
reviewed: 2026-09-07T03:54:57Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - supabase/migrations/20260905140000_create_identities_and_link_tables.sql
  - supabase/migrations/20260905150000_create_identity_alias_verifications.sql
  - src/test/identity-schema-noop.integration.test.ts
  - src/test/identity-evidence-rpc.integration.test.ts
  - src/test/rls-regression.test.ts
  - src/types/supabase.ts
  - src/types/contacts.ts
  - type-baseline.json
  - supabase/functions/_shared/otp.ts
  - supabase/functions/_shared/__tests__/otp.test.ts
  - supabase/functions/request-email-alias-verification/index.ts
  - supabase/functions/confirm-email-alias-verification/index.ts
  - supabase/functions/confirm-email-alias-verification/__tests__/confirm-email-alias.integration.test.ts
  - supabase/functions/_shared/__tests__/identity-resolver.test.ts
  - supabase/functions/_shared/identity-resolver.ts
  - supabase/functions/resolve-identities/index.ts
  - src/services/identity-evidence.service.ts
  - src/hooks/useIdentityEvidence.ts
  - src/components/shared/IdentityEvidenceBadge.tsx
  - src/components/shared/__tests__/IdentityEvidenceBadge.test.tsx
  - src/components/call-detail/__tests__/CallParticipantsTab.identityEvidence.test.tsx
  - src/lib/query-config.ts
  - src/hooks/useCallDetailQueries.ts
  - src/components/call-detail/CallParticipantsTab.tsx
  - src/types/meetings.ts
  - src/services/identity-alias.service.ts
  - src/hooks/useIdentityAliases.ts
  - e2e/plan-34-06-verify.spec.ts
  - src/components/settings/AccountTab.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-09-07T03:54:57Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This phase is unusually well-engineered for a live-prod-data schema change: the `identities`/`identity_aliases` RLS mirrors the lesson from Phase 30's events CR-01 (SECURITY DEFINER `user_can_view_identity()` written correctly from the start, `FORCE ROW LEVEL SECURITY` on every new table, no org-admin bypass), the OTP flow uses a real CSPRNG + SHA-256 hash-at-rest + a genuine 5-attempt cap enforced server-side before comparison, the `identity_alias_verifications` table is client-deny by construction (RLS enabled+forced with zero authenticated/anon policies — not just "we didn't grant SELECT"), and `identity-resolver.ts` structurally forbids display-name-only linking at the type level (`identity_id: null` as a literal type), which `resolveRow` and its test suite both prove out. The forward-only resolver only touches rows with `identity_id IS NULL` created at/after an explicit cutover and is not wired to any cron/trigger yet — genuinely inert until invoked, matching the plan.

The one real gap is `get_identity_evidence`: it is `GRANT EXECUTE TO authenticated` with **no caller-authorization check at all** — any authenticated user, in any organization, can call it for any `identity_id` UUID and get back confidence + evidence for a person they have zero relationship to. The integration test in this same phase (`identity-evidence-rpc.integration.test.ts`) explicitly proves this is deliberate ("non-owner: get_identity_evidence still returns the redacted row... redaction is the boundary, not RLS"), and today's only writer hardcodes `evidence: 'verified email'` so no PII is currently returned through it — but this is a documented, working IDOR: cross-org exposure of confidence/evidence data, gated only by UUID-guessing difficulty rather than an actual authorization check. This is inconsistent with the `identities` table's own RLS (which DOES check ownership/participation) sitting two feet away in the same migration, and is worth fixing before this evidence surface grows.

Two smaller correctness/robustness issues (a hover/click race in the evidence badge, and a latent gap in `user_can_view_identity()` for `speakers`-only links) round out the findings. Tests reviewed across this phase are genuinely load-bearing — no tautological or stub-proof assertions were found; call that out as a positive given the standing instruction to hunt for exactly that.

## Critical Issues

### CR-01: `get_identity_evidence` has no caller-authorization check — any authenticated user can read any identity's evidence, cross-org

**File:** `supabase/migrations/20260905140000_create_identities_and_link_tables.sql:148-164,231`
**Issue:** The RPC is `SECURITY DEFINER` and `GRANT EXECUTE ON FUNCTION public.get_identity_evidence(UUID) TO authenticated` with no check that the caller owns, participates in, or otherwise has any relationship to `p_identity_id`. It simply returns every verified `identity_aliases` row for whatever UUID is passed:
```sql
CREATE OR REPLACE FUNCTION public.get_identity_evidence(p_identity_id UUID)
RETURNS TABLE(alias_type TEXT, confidence NUMERIC, evidence TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT alias_type, confidence, evidence
  FROM identity_aliases
  WHERE identity_id = p_identity_id AND verified = true
  ORDER BY confidence DESC NULLS LAST;
$$;
```
Compare this to the `identities` table's own RLS policy two sections later in the same file, which correctly gates on `user_can_view_identity(id, auth.uid())` (owner OR org-participation via `call_participants`/`contacts`). The RPC bypasses that same check entirely — it was already written and available in this migration (`user_can_view_identity`) but is not called here. The comment justifies this as "the caller is responsible for having reached `p_identity_id` via a ... row RLS already authorized them" — but nothing enforces that; the RPC is directly callable from the browser console/API with a hand-typed UUID. `identity-evidence-rpc.integration.test.ts` (this same phase) demonstrates the gap by design: a non-owner, non-participant user in the test successfully calls the RPC and gets a full evidence row back for an identity they have no relationship to.

Today's only writer of `evidence` (`confirm-email-alias-verification/index.ts`) hardcodes the literal string `'verified email'`, so no PII leaks through this specific path today — but the column itself is a free-text `TEXT NOT NULL` with no content constraint, and the access-control gap is real and independent of current content: it is cross-org identity confidence/evidence disclosure to any authenticated user who obtains an identity UUID by any means (URL sharing, browser devtools on a legitimately-reached row, a future admin tool, a future writer that puts more descriptive text in `evidence`, etc.).

**Fix:** Gate the RPC the same way the `identities` table itself is gated:
```sql
CREATE OR REPLACE FUNCTION public.get_identity_evidence(p_identity_id UUID)
RETURNS TABLE(alias_type TEXT, confidence NUMERIC, evidence TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT alias_type, confidence, evidence
  FROM identity_aliases
  WHERE identity_id = p_identity_id
    AND verified = true
    AND public.user_can_view_identity(p_identity_id, auth.uid())
  ORDER BY confidence DESC NULLS LAST;
$$;
```
This makes the RPC's authorization boundary match the table's own RLS instead of relying on UUID-guessing difficulty as the only control. Update `identity-evidence-rpc.integration.test.ts`'s "non-owner" case to assert zero rows instead of a redacted row (the test currently pins the vulnerable behavior as correct).

## Warnings

### WR-01: `IdentityEvidenceBadge` hover + click handlers race — clicking the badge can immediately close the popover it just opened

**File:** `src/components/shared/IdentityEvidenceBadge.tsx:39-47`
**Issue:** The trigger button wires both `onMouseEnter={() => setOpen(true)}` and `onClick={(e) => { ...; setOpen((prev) => !prev) }}`. In real mouse interaction, `mouseenter` fires before `click` on the same element — so hovering onto the button opens it (`open` becomes `true`), and the subsequent click then toggles it closed (`open` becomes `false`), leaving the popover immediately closed right after a click that was presumably meant to pin it open. The test suite only exercises `fireEvent.mouseEnter` in isolation (`IdentityEvidenceBadge.test.tsx`'s `openBadge()` helper) and never simulates the realistic mouseenter→click sequence, so this doesn't show up as a failing test today.
**Fix:** Either drop the click-toggle handler entirely (hover/focus is sufficient per the RoutingTraceBadge precedent this component says it mirrors) or make click authoritative and drop hover-open, rather than mixing both on the same element:
```tsx
<button
  type="button"
  onMouseEnter={() => setOpen(true)}
  onMouseLeave={() => setOpen(false)}
  onFocus={() => setOpen(true)}
  onBlur={() => setOpen(false)}
  aria-label="View identity match confidence and evidence"
>
```

### WR-02: `user_can_view_identity()` never checks `speakers.identity_id` — RLS gap latent but real for a table this migration itself extends

**File:** `supabase/migrations/20260905140000_create_identities_and_link_tables.sql:122-139`
**Issue:** The migration adds `identity_id` to three tables (`speakers`, `contacts`, `call_participants` — IDENT-01) and comments that `speakers` is "user-scoped." But `user_can_view_identity()` only checks the `identities.owner_user_id` branch, the `call_participants` participation branch, and the `contacts` participation branch — it never checks whether the caller owns a `speakers` row linked to `p_identity_id`. A user whose only link to an identity is via a `speakers.identity_id` row (with no corresponding `call_participants`/`contacts` row on the same identity, and not the identity's `owner_user_id`) would be denied SELECT on the `identities` row for a person they legitimately have a speaker-level link to. Currently unexercised by any client code (the frontend only reads `call_participants.identity_id`, confirmed via `useCallDetailQueries.ts:455`, and no code path selects the `identities` table directly for a `speakers`-linked identity), so this is not exploitable today, but the resolver (`resolve-identities/index.ts`) does actively write `identity_id` onto `speakers` rows, and Phase 39 DISCO-02 (referenced in this migration's own comments) is expected to build on `owner_user_id` claiming, which will likely surface this gap.
**Fix:** Add a fourth branch mirroring the other two:
```sql
) OR EXISTS (
  SELECT 1 FROM speakers s
  WHERE s.identity_id = p_identity_id
    AND s.user_id = p_user_id
)
```
(confirm the actual ownership column name on `speakers` before landing this — the migration's own comment calls it "user-scoped" but doesn't specify the column).

### WR-03: OTP `generateCode()` has a small modulo bias (not a real brute-force risk, but worth a one-line fix given the file's own stated care about randomness)

**File:** `supabase/functions/_shared/otp.ts:16-20`
**Issue:** `arr[0] % 1_000_000` where `arr[0]` is drawn from `Uint32Array` (range 0..4294967295) introduces a slight non-uniform distribution across the 6-digit code space, since `4294967296` is not evenly divisible by `1000000` (some codes are ~1.0000002x more likely than others). This is a genuine minor departure from "uniformly random," though the practical exploitability against a 5-attempt brute-force cap is effectively zero — flagging because the file's docstring specifically emphasizes CSPRNG correctness as the point of this function.
**Fix:** Use rejection sampling to eliminate the bias if this is worth the extra draw:
```ts
export function generateCode(): string {
  const arr = new Uint32Array(1);
  const max = Math.floor(0xFFFFFFFF / 1_000_000) * 1_000_000;
  let value: number;
  do {
    crypto.getRandomValues(arr);
    value = arr[0];
  } while (value >= max);
  return String(value % 1_000_000).padStart(6, '0');
}
```

## Info

### IN-01: `e2e/plan-34-06-verify.spec.ts` has never actually been executed

**File:** `e2e/plan-34-06-verify.spec.ts:13-19`
**Issue:** The file's own header states it "could not be executed in the 34-06 execution session" due to missing env vars in the sandbox, and 34-07's summary confirms the real add-email round-trip (Task 4) is still an open action item for Andrew. The spec's happy-path assertion is also deliberately soft (`codeInput.or(errorToast)`, accepting either outcome as a pass) rather than asserting the specific expected UI state — reasonable given it's exercising a real, non-mocked network call, but worth knowing this test has zero runs against it and may have selector drift (e.g. exact heading/button text) that won't be caught until someone runs it.
**Fix:** Run `npx playwright test e2e/plan-34-06-verify.spec.ts --project=chromium` once in an environment with `CALLVAULTAI_LOGIN`/`CALLVAULTAI_LOGIN_PASSWORD` set, before or alongside deploying the request/confirm edge functions to prod (already noted as a manual gate in 34-07-SUMMARY.md).

### IN-02: `resolve-identities` provider-participant-id path is fully built but has no live input — verify it doesn't bit-rot silently

**File:** `supabase/functions/resolve-identities/index.ts:190-201`
**Issue:** `resolveRow` is called with `providerParticipantId` always `undefined` because no candidate table has a column for it yet (documented candidly in both the code comment and 34-04-SUMMARY.md). This is not a bug — it's deliberate forward-compatible plumbing with real unit coverage — but it means the provider-id branch of `identity-resolver.ts` has never been exercised against real data and its `providerAliases` fetch in `resolve-identities/index.ts` (lines 133-137, 152-159) is dead weight in production until a future migration adds a source column. Not actionable now; flagging so a future phase doesn't assume this path is battle-tested just because it has unit tests.
**Fix:** None required now. When a future migration adds a provider-participant-id source column, add an integration test that actually exercises this branch end-to-end (unit tests alone proved the pure function, not the edge-function wiring around it).

---

_Reviewed: 2026-09-07T03:54:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
