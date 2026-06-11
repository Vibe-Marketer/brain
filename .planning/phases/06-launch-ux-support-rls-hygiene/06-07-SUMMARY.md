---
phase: 06-launch-ux-support-rls-hygiene
plan: 07
subsystem: testing, security
tags: [rls, vitest, supabase, oauth, pgcrypto, fathom, edge-functions]
requires:
  - phase: 06-launch-ux-support-rls-hygiene
    provides: Phase 06 verifier gap report (06-VERIFICATION.md) naming the two code-level blockers this plan closes
provides:
  - RLS regression suite hard-bound to VITE_SUPABASE_TEST_URL / VITE_SUPABASE_TEST_ANON_KEY with no production fallback
  - fetch-meetings Fathom token refresh routed through encrypted persistence (store_encrypted_oauth_tokens / store_encrypted_user_settings_tokens RPCs)
  - shared persistUserSettingsOAuthTokens helper in connector-function-utils.ts for any future user_settings token writes
affects: [rls-regression, fathom-connector, oauth-token-hygiene, phase-06-verification]
tech-stack:
  added: []
  patterns:
    - "Refreshed connector OAuth tokens must flow through persistOAuthTokens / persistUserSettingsOAuthTokens — never direct .update() plaintext writes"
    - "Real-DB test suites read ONLY *_TEST_* env vars; missing vars throw an error naming the exact vars"
key-files:
  created: []
  modified:
    - src/test/rls-regression.test.ts
    - supabase/functions/fetch-meetings/index.ts
    - supabase/functions/_shared/connector-function-utils.ts
key-decisions:
  - "user_settings backward-compat mirror is non-blocking (warn on failure), matching fathom-oauth-callback semantics, so a legacy-row hiccup cannot fail an otherwise-successful refresh"
  - "Preserve the existing refresh token when Fathom's refresh response omits refresh_token (the old code would have nulled it)"
patterns-established:
  - "persistUserSettingsOAuthTokens: encrypted RPC first, plaintext fallback only when OAUTH_ENCRYPTION_KEY is unset, loud console.warn on fallback"
requirements-completed: [ONB-01, HRD-02]
duration: 18min
completed: 2026-06-11
---

# Phase 06 Plan 07: Gap Closure Summary

**RLS regression suite can no longer silently bind to prod Supabase credentials, and refreshed Fathom OAuth tokens now persist via the pgp_sym_encrypt RPC path instead of plaintext `.update()` writes to import_sources/user_settings.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-11T12:35:23Z
- **Completed:** 2026-06-11T12:53:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `src/test/rls-regression.test.ts` reads ONLY `VITE_SUPABASE_TEST_URL` / `VITE_SUPABASE_TEST_ANON_KEY`; fallbacks to `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` removed; missing-var error names the `*_TEST_*` vars explicitly. Plan 11-02's `CROSS_ORG_TABLES` ticket entries and fixtures preserved untouched (surgical edit — 3 hunks).
- `fetch-meetings` expired-token branch now calls `persistOAuthTokens(...)` for `import_sources` (encrypted RPC when `OAUTH_ENCRYPTION_KEY` is set, keeps source active, bumps `oauth_token_expires`) and the new `persistUserSettingsOAuthTokens(...)` for the legacy `user_settings` mirror.
- New shared helper `persistUserSettingsOAuthTokens` in `connector-function-utils.ts` wraps the `store_encrypted_user_settings_tokens` RPC already used by `fathom-oauth-callback` — no new storage path, table, or RPC introduced.
- Deployed `fetch-meetings` via `supabase functions deploy fetch-meetings --use-api` (exit 0) and verified live: unauthenticated POST → 401, authenticated POST (test login) → 200 with meetings payload.

## Task Commits

1. **Task 1: Enforce test-project-only env vars in RLS regression suite** - `137333a5` (fix)
2. **Task 2: Persist refreshed Fathom OAuth tokens through encrypted helper path** - `c684517c` (fix)

## Files Created/Modified

- `src/test/rls-regression.test.ts` - env chain now test-project-only; header comment + error message updated
- `supabase/functions/fetch-meetings/index.ts` - refresh branch rewired to shared encrypted persistence helpers
- `supabase/functions/_shared/connector-function-utils.ts` - added `persistUserSettingsOAuthTokens` helper

## Decisions Made

- user_settings mirror persistence is non-blocking (try/catch + warn) to match `fathom-oauth-callback`'s non-blocking treatment of the same write.
- Did not update `06-VERIFICATION.md` — the plan does not instruct re-running verification; the verifier owns that report.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refresh-token nulling on providers that omit refresh_token in refresh responses**
- **Found during:** Task 2
- **Issue:** Old code wrote `tokens.refresh_token` straight to the DB; if Fathom's refresh response omits `refresh_token`, the stored refresh token would be overwritten with null/undefined, breaking all future refreshes.
- **Fix:** `refreshToken: tokens.refresh_token ?? creds.oauth_refresh_token` — preserves the existing refresh token when the response omits one.
- **Files modified:** supabase/functions/fetch-meetings/index.ts
- **Verification:** Code review against `resolveOAuthAccessToken` in connector-function-utils.ts, which uses the identical fallback pattern.
- **Committed in:** c684517c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Correctness fix on the exact lines the plan rewrote. No scope creep.

## Issues Encountered

- **Pre-existing `deno check` failure in fetch-meetings** (`TS2345` supabase-js type drift at the `getDecryptedOAuthTokens` call). Confirmed identical on the pre-change file (HEAD~1) — out of scope per scope boundary; logged in `deferred-items.md`. Does not affect `--use-api` deploys; deploy succeeded and the live probe passed.
- **Transient full-suite failures in `src/services/__tests__/tickets.service.test.ts`** on first run (`createTicket is not a function`) — caused by an in-flight executor actively writing `src/services/tickets.service.ts` (off-limits files, uncommitted in the shared tree). Immediate re-run: 193 files / 1698 tests passed, 0 failures, exit 0.

## Verification Evidence

- `rg`: zero references to `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in rls-regression.test.ts; `*_TEST_*` vars referenced.
- `VITEST_INTEGRATION_OK=true npm run test -- --run src/test/rls-regression.test.ts` → 44 skipped, exit 0. **No live cross-org proof obtained** — the dedicated test project env (`.env.test`) is not populated on this machine; suite skips cleanly by design (recorded per plan `<verification>` instruction).
- `rg`: zero direct plaintext `oauth_*` `.update()` writes remain in fetch-meetings; `persistOAuthTokens(` present.
- `store_encrypted_user_settings_tokens` RPC signature confirmed in migrations (p_user_id, p_access_token, p_refresh_token, p_token_expires, p_encryption_key).
- Full suite: 1698 passed / 93 skipped, exit 0.
- `npm run build` on a `git archive HEAD` export (committed tree only, excluding in-flight executors' uncommitted work): exit 0.
- Deploy: `supabase functions deploy fetch-meetings --use-api` exit 0; live probe 401 unauthenticated / 200 authenticated.

## Next Phase Readiness

- Both Phase 06 verifier gaps (HRD-02 real-DB safety, credential hygiene) are code-closed; re-run the phase verifier to flip `06-VERIFICATION.md` truths 6 and 7.
- The third verifier gap (ROADMAP phase-goal User Story format) is a planning-doc issue owned by plan 06-08 / roadmap maintenance, not this plan.

---
*Phase: 06-launch-ux-support-rls-hygiene*
*Completed: 2026-06-11*

## Self-Check: PASSED

All claimed files exist on disk; commits 137333a5 and c684517c present in git log.
