---
phase: 34-identity-consolidation
verified: 2026-09-07T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 1
human_verification:
  - test: "Real end-to-end email-verification round-trip through a live inbox (Plan 34-07 Task 4)"
    expected: "Andrew adds a second owned email in Settings → Account → Verified Emails, receives a 6-digit code via Resend, enters it, and the email appears in the verified list. Prod introspection would then show an identities row with owner_user_id = Andrew, a verified identity_aliases row for the new email, and the pending identity_alias_verifications row deleted."
    why_human: "Requires a human to receive a real email and manually enter a code — cannot be automated or verified from the codebase. Explicitly deferred by Andrew per task instructions; not blocking phase pass. Confirmed via direct prod introspection this session that identity_aliases still has 0 rows, consistent with this being genuinely not yet performed (not a false completion claim)."
---

# Phase 34: Identity Consolidation Verification Report

**Phase Goal:** One `identities` spine reconciles speakers/contacts/call_participants without deleting any of them, with a custom OTP email-verification flow (IDENT-03) and a redacted evidence RPC (IDENT-08), shipped forward-only-safe to production.
**Verified:** 2026-09-07
**Status:** human_needed (all automatable truths pass; one explicitly-deferred manual step remains, per instruction not a blocking gap)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | IDENT-01: A single `identities` spine reconciles speakers/contacts/call_participants via nullable `identity_id`, none deleted, each keeps its own reader | ✓ VERIFIED | Live prod introspection: `information_schema.columns` confirms `identity_id` present on `speakers`, `contacts`, `call_participants`. All three tables intact (not dropped/renamed). `identities`/`identity_aliases` exist in prod with RLS enabled+forced. All identity_id columns nullable per migration DDL (`ADD COLUMN IF NOT EXISTS ... REFERENCES identities(id) ON DELETE SET NULL`). |
| 2 | IDENT-02: Identity resolution spans email aliases, provider participant IDs, and display-name variants | ✓ VERIFIED | `supabase/functions/_shared/identity-resolver.ts` implements `resolveByVerifiedEmail`, `resolveByProviderParticipantId`, and `evaluateDisplayNameCandidate` (type-pinned to never auto-link on name alone — `identity_id: null` literal type). `resolveRow` orders precedence email → provider-id → non-linking display-name candidate. Wired into `supabase/functions/resolve-identities/index.ts`, deployed ACTIVE in prod. |
| 3 | IDENT-03: A user can attach multiple owned, verified emails so calls under any resolve to one person, via custom OTP flow | ✓ VERIFIED (schema+backend+frontend); manual real-inbox round-trip deferred | `identity_alias_verifications` table live in prod (RLS enabled+forced, service-role-only — zero authenticated/anon policies, confirmed via `pg_class`). `otp.ts` uses `crypto.getRandomValues` (CSPRNG) + SHA-256 hash-at-rest. `confirm-email-alias-verification/index.ts` enforces 10-min expiry, 5-attempt hard cap (deletes row), generic error messages (no info leak on miss/expiry/wrong-code), get-or-create identity, and 409 on cross-identity double-claim. Both edge functions (`request-email-alias-verification`, `confirm-email-alias-verification`) ACTIVE in prod per `supabase functions list`. Frontend wired: `AccountTab.tsx` → `useIdentityAliases` → `identity-alias.service.ts` → `supabase.functions.invoke(...)` for both functions. Real end-to-end round-trip through a live inbox is the one open item — explicitly deferred to Andrew's manual action (see Human Verification below), not a code gap. |
| 4 | IDENT-08: Every resolved speaker label carries confidence + evidence, visible on demand, redacted (no raw PII) | ✓ VERIFIED | `get_identity_evidence(p_identity_id)` RPC live in prod, confirmed via direct `pg_proc.prosrc` introspection: returns only `(alias_type, confidence, evidence)`, never raw `value` (PII). Gated by `user_can_view_identity(p_identity_id, auth.uid())` — confirmed live in prod source, closing the CR-01 IDOR (see Gap Closure Verification below). `IdentityEvidenceBadge.tsx` wired into `CallParticipantsTab.tsx:82` (`<IdentityEvidenceBadge identityId={speaker.identity_id} />`). |

**Score:** 4/4 truths verified (IDENT-03's manual real-inbox step is explicitly out of scope for this pass per task instruction — noted as human-verification item, not a failure)

### Gap Closure Verification (CR-01 + WR-02) — confirmed genuinely live in prod, not just claimed

Both fixes were independently re-verified by this verifier via direct `pg_proc.prosrc` introspection against production (`vltmrnjsubfzrgrtdqey`), not trusted from GAPCLOSURE-SUMMARY.md's claims:

**CR-01 (get_identity_evidence had zero caller-authorization):**
```
supabase db query --linked "SELECT prosrc FROM pg_proc WHERE proname = 'get_identity_evidence';"
```
Result confirms the live function body contains:
```sql
WHERE identity_id = p_identity_id
  AND verified = true
  AND public.user_can_view_identity(p_identity_id, auth.uid())
```
A non-authorized caller now gets zero rows — the IDOR is closed in production, not just in the migration file.

**WR-02 (user_can_view_identity missing speakers.identity_id branch):**
```
supabase db query --linked "SELECT prosrc FROM pg_proc WHERE proname = 'user_can_view_identity';"
```
Result confirms the live function body contains the fourth branch:
```sql
) OR EXISTS (
  SELECT 1 FROM speakers s
  WHERE s.identity_id = p_identity_id
    AND s.user_id = p_user_id
);
```
alongside the three original branches unchanged (owner, call_participants participation, contacts participation).

Both fixes are live in production, confirmed by this verifier's own introspection query, independent of the gap-closure summary's self-reported evidence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260905140000_create_identities_and_link_tables.sql` | `identities`, `identity_aliases` tables + identity_id columns + RLS + RPCs | ✓ VERIFIED | Applied to prod; all objects confirmed live via introspection |
| `supabase/migrations/20260905150000_create_identity_alias_verifications.sql` | OTP pending-code ledger, service-role-only | ✓ VERIFIED | Live in prod; `pg_class` confirms RLS enabled+forced, only `service_role` policy exists |
| `supabase/migrations/20260906000001_fix_identity_evidence_authz_and_speakers_view_gap.sql` | CR-01 + WR-02 fixes | ✓ VERIFIED | Live in prod, confirmed via `pg_proc.prosrc` (see Gap Closure Verification) |
| `supabase/functions/_shared/otp.ts` | CSPRNG code gen + SHA-256 hash | ✓ VERIFIED | Read directly; `crypto.getRandomValues`, `crypto.subtle.digest('SHA-256', ...)` |
| `supabase/functions/request-email-alias-verification/index.ts` | Sends OTP via Resend | ✓ VERIFIED | Deployed ACTIVE in prod |
| `supabase/functions/confirm-email-alias-verification/index.ts` | Verifies OTP, links email | ✓ VERIFIED | Deployed ACTIVE in prod; read in full — 5-attempt cap, expiry, hash comparison, get-or-create identity, double-claim 409 all present |
| `supabase/functions/_shared/identity-resolver.ts` | Pure resolver: email/provider-id/display-name | ✓ VERIFIED | Read in full — type-pinned non-linking display-name guarantee present |
| `supabase/functions/resolve-identities/index.ts` | Edge function wiring resolver to DB | ✓ VERIFIED | Deployed ACTIVE in prod |
| `src/services/identity-alias.service.ts` | Frontend service wrapper | ✓ VERIFIED | Read in full — invokes both edge functions correctly |
| `src/components/shared/IdentityEvidenceBadge.tsx` | UI for confidence/evidence | ✓ VERIFIED (existence + wiring); import confirmed in `CallParticipantsTab.tsx` |
| `src/components/settings/AccountTab.tsx` | UI for adding/verifying emails | ✓ VERIFIED | Imports and uses `useIdentityAliases` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AccountTab.tsx` | `identity-alias.service.ts` | `useIdentityAliases()` hook | ✓ WIRED | Confirmed via grep import + usage |
| `identity-alias.service.ts` | `request-email-alias-verification` edge fn | `supabase.functions.invoke(...)` | ✓ WIRED | Confirmed in service file; function ACTIVE in prod |
| `identity-alias.service.ts` | `confirm-email-alias-verification` edge fn | `supabase.functions.invoke(...)` | ✓ WIRED | Confirmed in service file; function ACTIVE in prod |
| `CallParticipantsTab.tsx` | `IdentityEvidenceBadge` | JSX render with `identityId={speaker.identity_id}` | ✓ WIRED | Confirmed at line 82 |
| `get_identity_evidence` RPC | `user_can_view_identity` authz gate | SQL `AND public.user_can_view_identity(...)` in WHERE clause | ✓ WIRED | Confirmed live in prod via `pg_proc.prosrc` |
| `resolve-identities` edge fn | `identity-resolver.ts` pure functions | import + `resolveRow` call | ✓ WIRED | Deployed ACTIVE in prod |

### Data-Flow Trace (Level 4)

Not applicable in the traditional dashboard sense — this phase's tables are intentionally at zero rows in production (confirmed: `identities_count=0`, `aliases_count=0`, all `identity_id` linked-counts = 0 across `speakers`/`contacts`/`call_participants`). This is the correct and expected forward-only-safe state: the resolver is deployed but not yet invoked against real data, and Task 4 (the first real write) is Andrew's pending manual action. No hollow-wiring concern — the zero-row state is honest, not a stub masking broken data flow.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| IDENT-01 | 34-01, 34-02, 34-07 | Single identity graph reconciles speakers/contacts/call_participants, no deletion | ✓ SATISFIED | Prod introspection: columns present, tables intact, RLS forced |
| IDENT-02 | 34-04, 34-07 | Resolution spans email, provider IDs, display-name variants | ✓ SATISFIED | `identity-resolver.ts` implements all three signal types; deployed |
| IDENT-03 | 34-03, 34-06, 34-07 | Multi-email OTP verification, calls resolve to one person | ✓ SATISFIED (backend/frontend); manual round-trip pending | Full OTP flow live in prod; deferred human step tracked separately |
| IDENT-08 | 34-02, 34-05, 34-07 | Confidence + evidence visible on demand, redacted | ✓ SATISFIED | RPC live, CR-01 authz gap closed, UI badge wired |

No orphaned requirements — REQUIREMENTS.md maps exactly IDENT-01, IDENT-02, IDENT-03, IDENT-08 to Phase 34, all four appear in plan frontmatter and are satisfied.

### Anti-Patterns Found

None. Grep for `TODO|FIXME|XXX|TBD|placeholder|not implemented` across the phase's key backend/frontend files (`otp.ts`, both OTP edge functions, `resolve-identities/index.ts`, `IdentityEvidenceBadge.tsx`, `identity-evidence.service.ts`, `useIdentityEvidence.ts`) returned zero matches.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `get_identity_evidence` authz gate present in live prod function body | `supabase db query --linked "SELECT prosrc FROM pg_proc WHERE proname='get_identity_evidence'"` | Contains `AND public.user_can_view_identity(p_identity_id, auth.uid())` | ✓ PASS |
| `user_can_view_identity` speakers branch present in live prod function body | `supabase db query --linked "SELECT prosrc FROM pg_proc WHERE proname='user_can_view_identity'"` | Contains 4th `EXISTS` branch on `speakers.identity_id`/`speakers.user_id` | ✓ PASS |
| `identities`/`identity_aliases`/`identity_alias_verifications` RLS forced in prod | `pg_class` query on `relrowsecurity`/`relforcerowsecurity` | All three: `true`/`true` | ✓ PASS |
| `identity_id` columns present on speakers/contacts/call_participants in prod | `information_schema.columns` query | All three present | ✓ PASS |
| OTP edge functions deployed and ACTIVE in prod | `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` | `request-email-alias-verification` ACTIVE, `confirm-email-alias-verification` ACTIVE | ✓ PASS |
| Forward-only-safe: zero identity_id linkage in prod (no destructive auto-link) | `SELECT COUNT(*) ... WHERE identity_id IS NOT NULL` across 3 tables | All zero | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared for this phase; none found via convention search. Skipped — not applicable (this phase's verification relies on direct prod SQL introspection instead, documented above).

### Human Verification Required

### 1. Real end-to-end email-verification round-trip through a live inbox

**Test:** Log in to production, go to Settings → Account → Verified Emails, add a second owned email address, retrieve the 6-digit code from the Resend email, enter it.
**Expected:** UI shows success; the new email appears in the verified list; prod introspection shows a new `identities` row owned by the user, a verified `identity_aliases` row for the email, and the `identity_alias_verifications` pending row deleted.
**Why human:** Requires receiving a real email and manually entering a code — cannot be automated from the codebase or CI. This is Plan 34-07's Task 4, explicitly deferred by Andrew per instruction to this verification pass. Confirmed via prod introspection that `identity_aliases` currently has 0 rows — consistent with genuine non-completion, not a false "done" claim slipping through.

### Gaps Summary

No blocking gaps. All four requirement IDs (IDENT-01, IDENT-02, IDENT-03, IDENT-08) are implemented, deployed to production, and independently confirmed via direct database/function introspection rather than trusted from SUMMARY.md claims. The two code-review findings (CR-01 critical IDOR, WR-02 RLS gap) were independently re-verified as genuinely fixed and live in production via this verifier's own `pg_proc.prosrc` queries. The only open item is Plan 34-07's Task 4 — a real-inbox manual round-trip explicitly deferred to Andrew, tracked here as a human-verification item per the task instruction, not counted as a gap.

---

_Verified: 2026-09-07_
_Verifier: Claude (gsd-verifier)_
