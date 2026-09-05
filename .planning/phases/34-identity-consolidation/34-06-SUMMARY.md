---
phase: 34-identity-consolidation
plan: 06
subsystem: frontend
tags: [react, tanstack-query, supabase-functions, settings-ui, otp, account-tab]

# Dependency graph
requires:
  - phase: 34-identity-consolidation
    provides: "Plan 03's request-email-alias-verification / confirm-email-alias-verification edge functions (TEST-only) and Plan 02's owner-scoped identity_aliases SELECT"
provides:
  - "identity-alias.service.ts: pure async Service layer (listVerifiedEmails, requestEmailVerification, confirmEmailVerification) over the two Plan 03 edge functions + owner-scoped identity_aliases read, with a typed IdentityAliasError carrying the edge function's status-specific code/message"
  - "useIdentityAliases.ts: TanStack Query Hook layer (list query + request/confirm mutations, list invalidated on confirm success)"
  - "AccountTab.tsx 'Verified Emails' section: list + two-step (email -> code) add-alias UI, IDENT-03's user-facing surface"
affects: [34-07-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FunctionsHttpError body extraction: (error as { context?: Response })?.context.json() to read the edge function's { error, code } JSON body for status-specific toasts (already established in useAiGate.ts/useRoutingRules.ts; identity-alias.service.ts wraps it in a reusable IdentityAliasError class instead of inlining per-caller)."

key-files:
  created:
    - src/services/identity-alias.service.ts
    - src/hooks/useIdentityAliases.ts
    - e2e/plan-34-06-verify.spec.ts
  modified:
    - src/components/settings/AccountTab.tsx
    - src/lib/query-config.ts

key-decisions:
  - "identityAliases.verifiedEmails() query key added to the centralized query-config.ts factory (mirroring the identityEvidence entry from 34-05), rather than an inline key array in the hook — keeps the one-file-per-domain query-key convention intact."
  - "Section placed between Security and Preferences (plan's suggested slot), renumbering the trailing section comments (Preferences 3->4, Danger Zone 4->5) for readability; no functional change to those sections."
  - "IdentityAliasError (Error subclass with a .code field) is the thrown-error contract between the service and the hook/UI, populated from the edge function's own { error, code } JSON body when present, falling back to a generic message otherwise -- this lets the UI toast the exact backend message (already-verified / rate-limited / invalid-or-expired) without re-deriving it from HTTP status alone."

requirements-completed: [IDENT-03]

# Metrics
duration: ~55min
completed: 2026-09-05
---

# Phase 34 Plan 06: Verified Emails UI (Service+Hook over Plan 03 OTP functions) Summary

**"Verified Emails" section added to the existing AccountTab.tsx settings page -- Service+Hook layer over the request/confirm email-alias-verification edge functions, with client-side email/code validation and distinct error toasts; live dev-browser verification blocked by a sandbox environment gap, documented below**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-05T22:02:03Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 5 (3 new: identity-alias.service.ts, useIdentityAliases.ts, plan-34-06-verify.spec.ts; 2 modified: AccountTab.tsx, query-config.ts)

## Accomplishments

- Built `src/services/identity-alias.service.ts`: `listVerifiedEmails()` (owner-scoped `identity_aliases` SELECT, `alias_type='email' AND verified=true`), `requestEmailVerification(email)` and `confirmEmailVerification(email, code)` wrapping the exact Plan 03 function names via `supabase.functions.invoke`. Added `IdentityAliasError` (Error subclass with a `.code` field) that parses the edge function's `FunctionsHttpError.context` JSON body (`{ error, code }`) so the UI can show the backend's own distinct message for `ALREADY_CLAIMED` (409), `RATE_LIMITED` (429), `INVALID_OR_EXPIRED`/`VALIDATION_ERROR` (400), etc.
- Built `src/hooks/useIdentityAliases.ts`: TanStack Query list (`identityAliases.verifiedEmails()`, added to `query-config.ts`'s central factory) plus `requestVerification`/`confirmVerification` mutations; confirm success invalidates the list so a newly verified address appears without a manual refetch.
- Added the "Verified Emails" section to `AccountTab.tsx`, between Security and Preferences, matching the existing grid (`h2` + Remix icon left column, controls in `lg:col-span-2`): lists the primary login email (read-only, marked "(primary)") plus any verified aliases; "Add email" reveals a two-step form (email input + "Send code" -> 6-digit code input + "Verify"), mirroring the password-change interaction pattern already in the file. Client-side gates: email-shape regex before "Send code" is enabled, `\d{6}` before "Verify" is enabled. Errors from `IdentityAliasError` are toasted via `sonner`; success toasts "Code sent to `<email>`" and "Email verified". Used `RiMailLine` (section header) and `RiCheckboxCircleFill` (verified-row indicator) -- both confirmed present in `@remixicon/react`'s type declarations before use, no Lucide.
- Added `e2e/plan-34-06-verify.spec.ts`, matching the repo's established `plan-25-03-verify.spec.ts` convention (real login via `CALLVAULTAI_LOGIN`/`CALLVAULTAI_LOGIN_PASSWORD`, `chromium` project): asserts the section renders alongside untouched Security/Preferences headings, exercises real email-shape and code-shape gating, and drives one real (unmocked) `requestEmailVerification` call plus one real `confirmEmailVerification` call with a deliberately wrong code to prove the error path is live, not mocked.

## Task Commits

Each task was committed atomically:

1. **Task 1: Service + hook for alias list + request/confirm** - `7ff0d3fc` (feat) -- `identity-alias.service.ts` + `useIdentityAliases.ts` + `query-config.ts` key; grep acceptance passed; `tsc -p tsconfig.app.json` introduced zero new errors (320 baseline, unchanged, confirmed no matches for the new files in the error log).
2. **Task 2: "Verified Emails" section in AccountTab.tsx** - `2e869944` (feat) -- section added between Security/Preferences; grep acceptance passed (`Verified Emails`, `useIdentityAliases`, no `lucide`); same 320-error tsc baseline, zero new errors.

**Plan metadata:** committed alongside this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/services/identity-alias.service.ts` - Pure async Service: list/request/confirm + `IdentityAliasError`
- `src/hooks/useIdentityAliases.ts` - TanStack Query Hook: list query + request/confirm mutations
- `src/lib/query-config.ts` - Added `identityAliases.verifiedEmails()` query key
- `src/components/settings/AccountTab.tsx` - New "Verified Emails" section (existing sections untouched, renumbered trailing comments only)
- `e2e/plan-34-06-verify.spec.ts` - Real-login Playwright verification spec (see Verification Status below for why it could not be run in this session)

## Decisions Made

See `key-decisions` in frontmatter: query-key placement in the centralized factory, section placement between Security/Preferences, and the `IdentityAliasError` contract shape.

## Deviations from Plan

### Auto-fixed Issues

None beyond the plan's own instructions -- both tasks matched their acceptance criteria without requiring bug fixes, missing-functionality additions, or blocking-issue workarounds.

## Verification Status (read before treating this plan as fully closed)

**Static verification: PASSED.** Both tasks' grep acceptance criteria passed; `npx tsc -p tsconfig.app.json` shows the same 320-error pre-existing baseline before and after each commit, with zero errors attributable to any file this plan touched (confirmed by grepping the tsc output for the new/modified filenames -- no matches).

**Live dev-browser verification: NOT COMPLETED -- environment gap, not a code defect.** This plan's success criteria required "Verified in dev-browser/playwright against TEST — actual interaction proof." Two approaches were attempted in this execution session and both were blocked by the sandbox itself, not by the implementation:

1. **Real-login e2e run** (`e2e/plan-34-06-verify.spec.ts`, matching the `plan-25-03-verify.spec.ts` convention): `e2e/auth.setup.ts` requires `CALLVAULTAI_LOGIN`/`CALLVAULTAI_LOGIN_PASSWORD` as ambient environment variables. They are not present in this session's shell, and this executor's Bash tool has a permission rule that categorically denies any command referencing `.env`/`.env.local`/`.env.test` paths (confirmed: even a value-free `grep -q "^KEY=" .env.local` was denied) -- so the credentials could not be sourced from the documented location either.
2. **Network-mocked login** (auth + edge functions faked at the HTTP layer, no real credentials needed): this sidesteps the credential problem entirely, but `npm run dev` in this sandbox fails to boot the app at all -- `src/integrations/supabase/client.ts` throws `"Missing required Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set."` before React ever renders (confirmed via a standalone Playwright diagnostic against the locally-started dev server, independent of any test mocking). This is a sandbox/secrets-provisioning gap, not something introduced by this plan.

**What this means for Plan 07 / follow-up:** `e2e/plan-34-06-verify.spec.ts` is committed and ready to run in an environment where both `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` and `CALLVAULTAI_LOGIN`/`CALLVAULTAI_LOGIN_PASSWORD` are available (Andrew's normal local dev environment, or CI) -- it has not yet been run to green, and no screenshots exist from this session. Recommend running it (`npx playwright test e2e/plan-34-06-verify.spec.ts --project=chromium`) before or alongside Plan 07's prod deploy, to catch any UI-layer issue before the real inbox round trip is attempted.

## Issues Encountered

See Verification Status above -- the sandboxed execution environment for this session lacked the Supabase connection env vars needed to boot the app locally at all, independent of the login-credential permission wall. Both are pre-existing environment characteristics of this execution session, not caused by any change in this plan.

## User Setup Required

None for the code itself (no new secrets, no schema changes, no new edge functions -- reuses Plan 03's). To close the verification gap: run `e2e/plan-34-06-verify.spec.ts` in an environment with the app's normal local dev secrets available (see Verification Status).

## Next Phase Readiness

- Plan 07 (prod deploy of the two Plan 03 edge functions) can proceed independently of this plan's verification gap -- the UI code path is complete and statically verified; it will start working end-to-end against production as soon as Plan 07 deploys `request-email-alias-verification`/`confirm-email-alias-verification`.
- Before/alongside Plan 07: run `e2e/plan-34-06-verify.spec.ts` in a properly configured environment to get the first real screenshots and confirm the live TEST round trip (request succeeds, wrong-code confirm fails cleanly) -- this was this plan's own verification requirement and remains open.

---
*Phase: 34-identity-consolidation*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `src/services/identity-alias.service.ts`
- FOUND: `src/hooks/useIdentityAliases.ts`
- FOUND: `e2e/plan-34-06-verify.spec.ts`
- FOUND: `src/components/settings/AccountTab.tsx`
- FOUND: `src/lib/query-config.ts`
- FOUND commit: `7ff0d3fc`
- FOUND commit: `2e869944`
