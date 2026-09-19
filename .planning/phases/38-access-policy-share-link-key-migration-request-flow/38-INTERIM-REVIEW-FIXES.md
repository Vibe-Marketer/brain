---
phase: 38-access-policy-share-link-key-migration-request-flow
fixed_at: 2026-09-19T16:49:00-04:00
review_path: .planning/phases/38-access-policy-share-link-key-migration-request-flow/38-INTERIM-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 10
skipped: 2
status: partial
---

# Phase 38: Interim Code Review Fix Report

**Fixed at:** 2026-09-19T16:49:00-04:00  
**Source review:** `.planning/phases/38-access-policy-share-link-key-migration-request-flow/38-INTERIM-REVIEW.md`  
**Iteration:** 1

## Summary

- Findings in scope: 12
- Fixed: 10
- Remaining: 2
- All two blockers and all three high-severity findings are fixed.
- Corrective migrations `20260919000005` and `20260919000006` were applied to dedicated TEST project `swjzxiddcrtaqixsfaac` only.
- `share-call` version 6 was deployed to TEST only.
- Production `vltmrnjsubfzrgrtdqey` remains unchanged: Phase 38 migrations `00001` through `00006` are still pending and production `share-call` remains version 215 from 2026-09-10.

## Fixed Issues

### BL-01: Expired share tokens continue to authorize protected recording content

**Status:** fixed: requires human verification  
**Files modified:** `supabase/functions/share-call/index.ts`, `supabase/functions/share-call/__tests__/share-call.integration.test.ts`  
**Commit:** `465bf45d`  
**Applied fix:** Expired and malformed-expiry tokens now return the generic unavailable response before prefill, teaser, metadata, or transcript resolution. Real endpoint tests cover anonymous, recipient, sender, and signup-prefill requests.

### BL-02: Authenticated organization members can copy private recordings they cannot read

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`, `src/services/__tests__/data-movement.dedup.integration.test.ts`  
**Commit:** `00419a6a`  
**Applied fix:** Both authenticated copy RPCs now run a complete recording-read preflight before calling their preserved implementations. A real-database adversarial test proves a source-org member with no read path cannot copy private content.

### HI-01: UUID-native share recipients are missing from the central recording access check

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`, `src/test/access-policy.integration.test.ts`  
**Commit:** `00419a6a`  
**Applied fix:** Recipient authorization is UUID-first with an owner-scoped legacy fallback only when `recording_id` is null. A real-database test proves direct canonical recording reads through a UUID-only share.

### HI-02: Discovery and request eligibility misclassify callers who already have legacy RLS access

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`, `src/test/access-policy.integration.test.ts`  
**Commit:** `00419a6a`  
**Applied fix:** One helper now centralizes owner, organization admin/owner, workspace membership, UUID/legacy share, active grant, and Phase 38 policy access. Combined participant/admin, participant/workspace, and participant/UUID-share tests prove discovery and requests do not misclassify existing access.

### HI-03: Cross-organization routing trusts an arbitrary target workspace UUID

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`, `src/services/__tests__/data-movement.dedup.integration.test.ts`  
**Commit:** `00419a6a`  
**Applied fix:** The service-role routing wrapper now verifies target-workspace organization ownership and explicit user membership before invoking the preserved routing implementation. Negative real-database tests cover both mismatches.

### ME-01: Participant evidence remains affirmative after its supporting source is removed

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000006_phase38_participant_evidence_recompute.sql`, `src/test/access-policy.integration.test.ts`  
**Commit:** `1e3ea4d5`  
**Applied fix:** Participant role and confirmed-speech fields are recomputed deterministically on every evidence write, including a neutral attendee state. The real-database test removes transcript evidence and proves discovery disappears.

### ME-02: Revoked access returns to discovery with an approved request status

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`, `src/test/access-policy.integration.test.ts`  
**Commits:** `00419a6a`, `1e3ea4d5`  
**Applied fix:** Discovery reports approved only while the linked grant is active. The request, approve, revoke, rediscover, and request-again real-database flow passes.

### ME-03: Initial settings query failures render an endless loading skeleton

**Status:** fixed  
**Files modified:** `src/components/settings/PrivacyAccessSettings.tsx`, `src/components/settings/__tests__/PrivacyAccessSettings.test.tsx`  
**Commit:** `91b49411`  
**Applied fix:** Initial errors render before the loading/null branch. The component test now uses absent data with `isLoading: false`, proves Retry is visible, and invokes refetch.

### LO-01: Anonymous copy ordinals can contain gaps and expose hidden ordering

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`  
**Commit:** `00419a6a`  
**Applied fix:** Discovery filters inaccessible copies before applying `row_number()`, producing contiguous anonymous ordinals.

### LO-02: Oversized Zoom type metadata raises instead of failing closed to unknown

**Status:** fixed: requires human verification  
**Files modified:** `supabase/migrations/20260919000005_phase38_authorization_review_fixes.sql`, `src/test/fixtures/phase38-provider-event-kind.ts`, `src/test/access-policy.integration.test.ts`  
**Commits:** `00419a6a`, `1e3ea4d5`  
**Applied fix:** Zoom types are compared as allowlisted JSON text without an integer cast. The oversized numeric fixture resolves to `unknown` in the real database.

## Remaining Issues

### ME-04: Owners cannot manage surviving legacy-only share links from the Share dialog

**Reason:** Requires a new bridge-aware owner management API and UI/service integration. It is independent of the blocker/high authorization fixes and remains for the next implementation pass.

### ME-05: The claimed six-level access matrix is not exercised by the real-database suite

**Reason:** The focused review fixes add adversarial combined-role, UUID-share, revoked-grant, stale-evidence, and oversized-provider coverage, but the complete actor-by-six-level matrix remains to be implemented before Phase 38 verification.

## Verification

- Targeted real-database gate after blocker/high fixes: **3 files, 104 tests passed**.
- Access-policy real-database gate after migrations `00005` and `00006`: **1 file, 83 tests passed**.
- Settings and migration unit gate: **2 files, 17 tests passed**.
- Type check: **0 new errors; 299/299 recorded baseline errors remain**.
- Focused frontend ESLint: **0 errors, 0 warnings**.
- Phase 38 migration static suite: **10/10 passed**.
- TEST migration history: `20260919000001` through `20260919000006` matched local and remote.
- TEST `share-call`: active version 6, updated 2026-09-19 20:42:53 UTC.
- Production migration history: `20260919000001` through `20260919000006` remain local-only/pending.
- Production `share-call`: active version 215, last updated 2026-09-10 17:16:32 UTC.
- Final CLI link and tracked `supabase/.temp` state: production ref `vltmrnjsubfzrgrtdqey`; no link-state files committed.

---

_Fixer: gsd-code-fixer_  
_Iteration: 1_
