---
phase: 31
plan: 03
verified: 2026-05-12
status: code-complete, awaiting-live-uat
---

# Phase 31 Plan 03 — Verification (AUTH-05 surface)

## Findings

The `pendingShareToken` write was **already in place** before Phase 31 started — `src/pages/SharedCallView.tsx:54` already writes `sessionStorage.setItem('pendingShareToken', token)` before navigating to `/login` for unauthenticated users. The contract is honored end-to-end:

1. Anon user lands on `/s/:token` → `SharedCallView` detects no auth, writes `pendingShareToken`, navigates to `/login`
2. User signs in (any method including Google OAuth)
3. After successful auth, either `getPostLoginRedirect()` in `Login.tsx:19` OR `ProtectedRoute.tsx:22-26` reads `pendingShareToken` and redirects to `/s/${token}`

The Phase 31 contribution is the documenting comment in `Login.tsx handleGoogleSignIn` (added in Plan 02 Task 2) explicitly noting that sessionStorage survives the OAuth round-trip. No code changes were required on `OAuthCallback.tsx` (which handles Fathom/Zoom integration OAuth, NOT Supabase Google auth — see RESEARCH.md F8).

## Code-level acceptance criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| sessionStorage.pendingShareToken written before /login redirect | PASS (pre-existing) | `src/pages/SharedCallView.tsx:54` |
| Login.tsx handleGoogleSignIn documents the contract | PASS | Comment added in Plan 02's Login.tsx rewrite |
| ProtectedRoute reads pendingShareToken and redirects | PASS (pre-existing) | `src/components/ProtectedRoute.tsx:22-26` |
| getPostLoginRedirect honors pendingShareToken | PASS (pre-existing) | `src/pages/Login.tsx:29-33` |

## Live dev-browser UAT (operator-needed)

- [ ] **Anon → share-call → Google OAuth round-trip:**
  - Pick a real share token from `call_shares` table
  - Clear cookies/storage in dev-browser
  - Navigate to `https://app.callvaultai.com/s/{token}`
  - Verify SharedCallView either redirects to `/login` or shows an auth prompt
  - Verify `window.sessionStorage.getItem('pendingShareToken')` equals the token
  - Click "Continue with Google", complete OAuth with a valid Google account
  - Verify the final URL is `https://app.callvaultai.com/s/{token}` (NOT `/`)

## Known Phase-32-dependent limitation

If the OAuth-authenticated account is NOT the share recipient, the share-call view will currently show "Call Not Found" because the `share-call` Edge Function destroys the wrong-recipient signal (returns identical 404 for both "doesn't exist" and "wrong recipient" — see QA-22 / Phase 32 SHARE-02). This is the Phase 32 backend fix; Phase 31's contribution is only ensuring the user lands at `/s/{token}` rather than `/` after OAuth.

The forward-compatible copy for the wrong-recipient surface is locked in UI-SPEC §"OAuth wrong-recipient (Google sign-in → shared call) — AUTH-05" — Phase 32 implements the UI when the backend signal lands.
