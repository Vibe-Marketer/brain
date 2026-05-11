---
phase: 29
plan: 03
subsystem: qa-sweep
tags: [persona-b, dev-browser, fresh-signup, auth-flow, regression-discovery]
requires:
  - "29-01 (precheck PASS, dev-browser session valid)"
provides:
  - "29-03-PERSONA-B-SWEEP-NOTES.md — structured Persona B observation log with 12 findings tagged for Plan 29-05"
  - "14 PNG screenshots under screenshots/persona-b-*.png covering the full signup attempt, sign-in error path, magic-link, forgot-password, and Google button baseline"
  - "Confirmation that AUTH-01 is BROKEN in a worse way than originally cataloged (silent success instead of 'unexpected error')"
  - "Confirmation that AUTH-02 has no pricing page implemented at all"
  - "Evidence that soren@vibeos.com already exists in production (D-01 edge case)"
affects:
  - Plan 29-05 (catalog write-back) — consumes 29-03-PERSONA-B-SWEEP-NOTES.md as the primary source for AUTH-01..05 Sweep Status entries
  - Phase 31 (Auth & Signup hardening) — will consume the findings + visual baselines as implementation reference
tech_stack:
  added: []
  patterns:
    - "dev-browser Playwright skill driven by `npx tsx` heredoc scripts (same pattern as Plans 29-01 / 29-02)"
    - "Per-context cookie/storage clearing to isolate Persona B from Persona A's persistent session without breaking it"
    - "Network response inspection via page.on('response') to capture Supabase auth backend behavior independently of the UI"
key_files:
  created:
    - .planning/phases/29-qa-sweep-regression-catalog/29-03-PERSONA-B-SWEEP-NOTES.md
    - .planning/phases/29-qa-sweep-regression-catalog/screenshots/persona-b-*.png (14 files)
  modified: []
decisions:
  - "Cleared cookies + localStorage + sessionStorage in the persona-b dev-browser context instead of forcing a UI sign-out — produces a guaranteed clean state, avoids any side-effects of clicking through the org/account menu, and isolates from Persona A's qa-sweep page context"
  - "Tested with both soren@vibeos.com AND a guaranteed-new throwaway (qa-sweep-{ts}@vibeos.com) to disambiguate the existing-account vs. truly-new signup responses — proved the D-01 edge case is in effect AND proved the silent-feedback bug applies to ALL signups regardless of account state"
  - "Captured Google button visual baseline (per AUTH-05 deferral to Phase 31 per CONTEXT.md D-02) but did NOT initiate OAuth handshake"
  - "Did NOT attempt to confirm the throwaway-account email — would require external email-tooling (Mailtrap / Supabase admin API) outside Phase 29 scope. AUTH-03 stays Cannot-verify until Phase 31"
metrics:
  duration_minutes: 25
  completed_date: 2026-05-11
  findings_total: 12
  findings_by_severity:
    P0: 5  # Findings 1, 2, 4, 5, 6
    P1: 3  # Findings 3, 10, 12
    P2: 1  # Finding 11
    P3: 3  # Findings 7, 8, 9 (informational)
  findings_by_tag:
    RE-VERIFY-AUTH: 3   # AUTH-01, AUTH-02, AUTH-04
    CANNOT-VERIFY-AUTH: 2  # AUTH-03, AUTH-05
    NEW: 4  # account-exists, sign-in-silent-error, no-public-landing, CSP-worker-src
    INFORMATIONAL: 3  # client-side validation works, forgot-password works, magic-link works
  screenshots_count: 14
  branch_outcome: "B' (variant of plan's Branch B — backend success with silent UI; existing-account case obfuscated by Supabase, indistinguishable to user)"
---

# Phase 29 Plan 03: Persona B Fresh-Signup Sweep Summary

One-line: Ran Persona B (fresh signup, `soren@vibeos.com`) through the full email-signup → pricing → payment → onboarding flow on `app.callvaultai.com` via dev-browser Playwright skill — confirmed AUTH-01 + AUTH-02 + AUTH-04 still broken, with AUTH-01 worse than originally cataloged (silent success vs. "unexpected error"), captured 12 findings + 14 screenshots, surfaced the D-01 edge case (`soren@vibeos.com` pre-exists in production).

## What got built

A raw observation file (`29-03-PERSONA-B-SWEEP-NOTES.md`) and 14 PNG screenshots documenting every screen Persona B encountered during the signup attempt. Each finding is tagged for Plan 29-05's catalog write-back routing (`[RE-VERIFY-AUTH-NN]`, `[CANNOT-VERIFY-AUTH-NN]`, `[NEW]`, informational) and severity-rated P0/P1/P2/P3 per CONTEXT.md D-10.

The notes file has:
- Screen Trace table (8 rows, every step + capture path or "n/a with reason")
- Branch outcome explicitly documented (Branch B' — variant of plan's Branch B)
- 12 Finding blocks in the D-03 format
- AUTH-NN Re-Verification Summary table (one row per AUTH-01..05)
- Test account state table (which accounts created during sweep, cleanup recommendations for Plan 29-05)
- Cleanup performed + Threat Flags sections

## Branch Outcome: B' (silent-success variant)

The plan anticipated four branches. None matched cleanly because the current production failure mode is more nuanced:

- **Branch A (account exists):** Did not match cleanly — Supabase obfuscates the response per `enable_signup_email_obfuscation`, so existing-account and new-account responses look identical to the UI
- **Branch B' (the actual current behavior):** Backend signup HTTP 200 on `/auth/v1/signup`, but frontend gives zero feedback. User cannot distinguish between success, existing-account, or any other state. Worse than the originally-cataloged "An unexpected error occurred" because at least an error gives a signal.
- **Branch C (specific informative error):** Matches client-side password-length validation only — server-side errors are still silent
- **Branch D (signup progresses):** Did not match — user is never signed in after submit (email confirmation gate)

## Top findings (impact-ordered)

### P0 — must-ship in v2.2

1. **Finding 1 — [RE-VERIFY-AUTH-02]** No pricing page in signup flow. Direct URL probes to `/pricing`, `/plans`, `/select-plan`, `/billing` all 302 → `/login`. AUTH-02 is not just buggy; the page literally doesn't exist. Phase 31 must DESIGN this surface, not just fix it.
2. **Finding 2 — [RE-VERIFY-AUTH-01]** Signup form gives NO user feedback (no toast, no redirect, no "check your email"). Backend HTTP 200 + Supabase user object returned, but UI is silent. User has no way to know signup succeeded.
3. **Finding 4 — [RE-VERIFY-AUTH-04]** Signup with existing email gives no useful error. No toast, no inline error, no "this email is already registered" message.
4. **Finding 5 — [NEW]** Sign-in with wrong password gives NO error message. Backend returns HTTP 400 `invalid_credentials`, but frontend swallows it completely. Equivalent silent-failure bug to AUTH-04, on the sign-in side.
5. **Finding 6 — [CANNOT-VERIFY-AUTH-03]** Payment gate cannot be reached from outside an authed session in Phase 29 scope. Carry-over P0 — Phase 31 must re-verify after AUTH-01 fix.

### P1 — must-ship in v2.2

6. **Finding 3 — [NEW]** Persona B target `soren@vibeos.com` already exists from prior testing (D-01 edge case confirmed by comparing Supabase response shape against throwaway email). Plan 29-05 should add cleanup decision for the user.
7. **Finding 10 — [CANNOT-VERIFY-AUTH-05]** Google sign-in OAuth flow deferred to Phase 31 per D-02. Visual baseline captured.
8. **Finding 12 — [NEW]** CSP blocks blob: workers on the `/login` page (same root cause as Plan 29-02 Finding 006). Confirms it's a global production CSP misconfiguration, not authed-only.

### P2 — eligible for BACKLOG

9. **Finding 11 — [NEW]** No public landing page at `app.callvaultai.com/`; root redirects unauthed users to `/login`. May be intentional (marketing site is separate domain) but worth confirming with product owner.

### P3 — informational

10. **Finding 7** Client-side password-length validation works correctly and surfaces a toast. Proves toast UI exists; fix for AUTH-01/04 should wire it into the auth success/error handlers.
11. **Finding 8** Forgot-password flow gives proper user feedback ("Check your email" confirmation screen). Phase 31 should mirror this UX.
12. **Finding 9** Magic-link flow gives proper user feedback (toast + confirmation screen). Same — Phase 31 should mirror.

## AUTH-NN Re-Verification Summary

| Requirement | Status | Severity | Plan 29-05 routes to |
|-------------|--------|----------|----------------------|
| AUTH-01 | Confirmed still broken (silent success) | P0 | Phase 31 (mode update needed in REQUIREMENTS.md) |
| AUTH-02 | Confirmed still broken (no pricing page at all) | P0 | Phase 31 (design + implement) |
| AUTH-03 | Cannot-verify (email confirmation gate) | P0 | Phase 31 (re-verify post-AUTH-01-fix) |
| AUTH-04 | Confirmed still broken (server-side errors silent; client-side validation works) | P0 | Phase 31 (extend to sign-in error path) |
| AUTH-05 | Cannot-verify (OAuth deferred per D-02) | P1 | Phase 31 |

## Verification done

| Acceptance criterion | Method | Verdict |
|----------------------|--------|---------|
| Notes file exists | `[ -f 29-03-PERSONA-B-SWEEP-NOTES.md ]` | PASS |
| Contains literal `soren@vibeos.com` | `grep` → 19 occurrences | PASS |
| All AUTH-01..05 have a sweep tag | Re-verification table has one row per AUTH-0[1-5]; grep `AUTH-0[1-5]` → 52 occurrences | PASS |
| ≥ 5 PNG screenshots persona-b-*.png | `ls` → 14 files | PASS |
| Each [NEW] has explicit severity (P0-P3) | Findings 3 (P1), 5 (P0), 11 (P2), 12 (P1) all labeled | PASS |
| No literal Bearer tokens or JWTs | `grep -E "Bearer [A-Za-z0-9._-]+"` → empty | PASS |
| No literal password value | `grep "QASweep-2026-05-11"` → empty | PASS |
| Branch outcome documented | Section "Branch Outcome" explicitly describes B' | PASS |
| AUTH-05 visual baseline only | Finding 10 explicitly notes no OAuth handshake initiated | PASS |
| Final ## Summary section | Present with bottom-line: signup completed? pricing shown? payment gate? | PASS |

## Deviations from Plan

### Auto-fixed adjustments (Rule 3 — Blockers)

**1. [Rule 3 — Approach] No UI sign-out; used context.clearCookies() instead**
- **Found during:** Task 1 Step 0 (sign out Persona A)
- **Issue:** The plan called for triggering logout via the account menu. Persona A's session is on a SEPARATE named dev-browser page (`qa-sweep`) from the Persona B page (`persona-b`). Forcing a UI sign-out on `qa-sweep` would have broken Persona A's session for any later plan needing it.
- **Fix:** Created a fresh `persona-b` named page on the same dev-browser server, then cleared cookies + localStorage + sessionStorage on its context before each major branch. Equivalent to "incognito" mode at the context level while leaving Persona A's `qa-sweep` page untouched. Verified by re-navigating to root and confirming redirect to `/login`.
- **Files modified:** none — purely a runtime browser-state choice
- **Documented in:** notes file Pre-flight section

**2. [Rule 3 — Discovery] Tested with throwaway email to disambiguate existing-account vs. truly-new signup response**
- **Found during:** Step 5 after first soren@vibeos.com signup
- **Issue:** The plan's Branch A asks to check whether the account already exists. The Supabase backend obfuscates this — both new and existing emails return an HTTP 200 success-shaped response. Cannot distinguish from response status alone.
- **Fix:** Ran a parallel signup with `qa-sweep-{Date.now()}@vibeos.com` (guaranteed new) and diffed the response bodies. The existing-account response has `"role":""` and `"identities":[]` (empty); the new-account response has `"role":"authenticated"` and a populated `identities` array. This is the Supabase `enable_signup_email_obfuscation` security pattern. Confirmed `soren@vibeos.com` pre-exists.
- **Files modified:** none — additional observation
- **Documented in:** notes file Finding 3 with both response bodies side-by-side

**3. [Rule 3 — Scope] Could not verify AUTH-03 payment gate**
- **Found during:** Step 6
- **Issue:** Email confirmation is required before sign-in succeeds for the new account. Cannot confirm an email from inside the sweep (no Mailtrap / Supabase admin tooling available).
- **Fix:** Documented AUTH-03 as `[CANNOT-VERIFY]` with the explicit reason. Added a recommendation to the Summary: Phase 31 must re-verify the payment gate after AUTH-01 (silent success) is fixed.
- **Files modified:** none
- **Documented in:** notes file Finding 6

### Additional findings beyond plan scope

The plan asked for AUTH-01..05 verification. Persona B also surfaced TWO new findings unrelated to the AUTH-NN list but tagged for Plan 29-05 routing:

- **Finding 5** — Sign-in-with-wrong-password silent failure (P0). Same root cause as AUTH-04 but on the sign-in path. Plan 29-05 should decide whether to extend AUTH-04 or file as new QA-NN.
- **Finding 11** — No public landing page at root (P2). Architectural question for Phase 31's AUTH-02 design.
- **Finding 12** — CSP `worker-src` misconfiguration on `/login` (P1). Same root cause as Plan 29-02 Finding 006 (BUG-09 chain). Plan 29-05 should merge.

No bugs were INTRODUCED by this plan — the sweep created one throwaway, unconfirmed test account in production Supabase (`qa-sweep-1778538743294@vibeos.com`) which has zero data footprint and is flagged for the user's cleanup decision in Plan 29-05.

## Authentication gates

None. The Persona B flow exercised auth surfaces directly without hitting any external auth challenges (no CAPTCHA, no phone verification, no 2FA on the test accounts).

## Known Stubs

None introduced by this plan. Documented stubs in the production app surfaced by Persona B's sweep:

- **Finding 1:** No pricing page implementation exists at all (this is a missing feature, not a stub — but the practical effect is the same: AUTH-02 cannot be satisfied without implementing the page)
- **Finding 2/4/5:** Auth success + error toast handlers are not wired to use the existing toast UI. The UI exists but the calls don't fire on signup-success, signup-existing-email, or sign-in-error paths

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `src/` (signup form handler) | The current signup form does not surface ANY response from `/auth/v1/signup`. While Supabase's obfuscated-existing-account pattern is a legitimate enumeration-defense, the FRONTEND should still convey a constant-time confirmation message so users get feedback. The current state means a network-tab observer CAN distinguish new vs. existing accounts (per Finding 3 evidence on `role` and `identities` fields). The fix should both add user-facing feedback AND consider whether the response shape should be normalized client-side before reaching the UI. |

## Account state created during sweep

| Email | State | Action for Plan 29-05 |
|-------|-------|------------------------|
| `soren@vibeos.com` | Pre-existing (NOT created this sweep) | Per D-01: do not delete. Plan 29-05 should add P3 cleanup decision: "Decide whether to delete or keep this canary account for Phase 31 re-verification." |
| `qa-sweep-1778538743294@vibeos.com` | Created this sweep, unconfirmed | Test row in production Supabase. Zero data footprint (no orgs, no plan, no payment). Plan 29-05 should add P3 cleanup decision for the user. |

## Self-Check: PASSED

- `[ -f 29-03-PERSONA-B-SWEEP-NOTES.md ]` → FOUND (28 KB)
- `grep "soren@vibeos.com" 29-03-PERSONA-B-SWEEP-NOTES.md` → 19 occurrences (≥1 required)
- `grep -E "AUTH-0[1-5]" 29-03-PERSONA-B-SWEEP-NOTES.md | wc -l` → 52 (≥5 required)
- `ls screenshots/persona-b-*.png | wc -l` → 14 (≥5 required)
- `grep -E "Bearer [A-Za-z0-9._-]+" 29-03-PERSONA-B-SWEEP-NOTES.md` → empty (no token leaks) ✓
- `grep "QASweep-2026-05-11" 29-03-PERSONA-B-SWEEP-NOTES.md` → empty (no password leaks) ✓
- Branch outcome documented → "Branch Outcome: B'" section present ✓
- AUTH-05 visual baseline only → Finding 10 explicitly notes no OAuth handshake initiated ✓
- Final `## Summary` section with bottom-line → present ✓
- `git log --oneline -1` shows commit `77a875c6 feat(29-03): Persona B fresh signup sweep ...` → FOUND
