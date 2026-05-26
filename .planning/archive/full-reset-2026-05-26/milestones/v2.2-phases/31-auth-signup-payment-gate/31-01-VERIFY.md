---
phase: 31
plan: 01
verified: 2026-05-12
status: code-complete, awaiting-live-uat
---

# Phase 31 Plan 01 — Verification

## Automated checks (PASS)

| Check | Result |
|-------|--------|
| `npm run type-check` | PASS (zero errors) |
| `npm run lint` on changed files | PASS (zero new lint errors on Login.tsx, App.tsx, user-friendly-errors.ts) |
| `npm test` unit suite | PASS (794 unit tests pass; 2 pre-existing integration test failures unrelated to Phase 31 — see Phase 30 BUG-01 work) |
| `npm run build` | PASS (build succeeds in 10.27s) |
| Migration applied to remote | PASS (`grandfathered` column live in `user_profiles`, 18 rows backfilled to true) |

## Code-level acceptance criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| getUserFriendlyError maps 9 new Supabase substrings BEFORE generic chains | PASS | `src/lib/user-friendly-errors.ts` lines 29-99 — block placed at top of function, all 9 substrings present (user already registered, invalid login credentials, password should be at least 6 characters, weak password, email rate limit exceeded, over email send rate limit, email not confirmed, signup is disabled, email address is invalid) |
| Each new mapping returns `canRetry: false` | PASS | grep confirms 9 `canRetry: false` occurrences in new block |
| Login.tsx signup uses ForgotPassword-style confirmation screen | PASS | `signupConfirmEmail` state added; confirmation screen JSX block present with heading "Check your email", bordered callout, hollow "Back to sign in" button |
| Immediate-session success toast says exactly `'Account created — welcome to CallVault!'` | PASS | Line 92 of updated Login.tsx |
| Email-pending success path sets confirmation state, no toast.success | PASS | Line 97 (`setSignupConfirmEmail(validation.data.email)`) — no toast call in that branch |
| App.tsx Sonner Toaster has `duration={6000}` | PASS | Line 292 — `<SonnerToaster position="bottom-right" richColors duration={6000} />` |
| Migration adds grandfathered column with backfill | PASS | File `supabase/migrations/20260512000000_user_profiles_grandfathered.sql` exists; remote query confirms column live + 18 users grandfathered |

## Live dev-browser UAT (operator-needed)

The dev-browser MCP is not available in this orchestrator session. The following surfaces are code-complete and ready for live verification on `https://app.callvaultai.com` once Vercel auto-deploys the commit:

- [ ] **Duplicate-email signup:** submit signup with `naegele412@gmail.com` (or any existing account) → expect toast: `"This email is already registered. Sign in instead."`
- [ ] **Wrong-password signin:** submit signin with valid email + wrong password → expect toast: `"Invalid email or password. Check your spelling or reset your password."`
- [ ] **Email-confirm-pending signup:** submit signup with `qa-{epoch}@vibeos.com` → expect full-screen "Check your email" confirmation screen with the email shown
- [ ] **Sonner duration:** confirm toasts stay visible ~6 seconds (Phase 30 reference value was ~4s default)

Recommended cleanup after operator UAT: `DELETE FROM auth.users WHERE email LIKE 'qa-%@vibeos.com';` (note: requires same trigger-disable trick as Soren delete — see `20260512000100_delete_soren_canary.sql` for the pattern).

## Notes

- The original CONTEXT.md hypothesis that the Sonner `<Toaster>` was missing on /login was **incorrect** (see RESEARCH.md F1). The real AUTH-01 root cause was the post-signup form-clear masquerading as a no-op + bottom-right toast easy to miss. The fix swaps to a screen-level confirmation per ForgotPassword.tsx pattern.
- Soren canary delete moved to Plan 02 Task 4 — see `31-02-VERIFY.md`.
