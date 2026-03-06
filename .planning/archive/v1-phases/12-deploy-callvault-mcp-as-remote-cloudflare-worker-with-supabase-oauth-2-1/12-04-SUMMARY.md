---
phase: 12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1
plan: "04"
subsystem: frontend
tags:
  - oauth
  - consent-page
  - supabase-auth
  - mcp
  - react

dependency_graph:
  requires:
    - "12-01 (Worker foundation — supabase factory, types, utils)"
  provides:
    - "/oauth/consent route in CallVault frontend"
    - "supabase.auth.oauth approve/deny flow"
  affects:
    - "Phase 12 Plan 05 (deployment and end-to-end verification)"
    - "MCP OAuth 2.1 authorization code exchange"

tech_stack:
  added: []
  patterns:
    - "Public route with internal auth check (same as TeamJoin, VaultJoin)"
    - "useAuth() + useSearchParams() for consent page state"
    - "supabase.auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization"
    - "window.location.href redirect after approve/deny (required for full browser redirect)"

key_files:
  created:
    - "/Users/Naegele/dev/brain/src/pages/OAuthConsentPage.tsx"
  modified:
    - "/Users/Naegele/dev/brain/src/App.tsx"

decisions:
  - "Public route with internal auth guard: /oauth/consent has no ProtectedRoute wrapper — the component itself detects auth state and redirects to /login?next=... if unauthenticated. Matches TeamJoin/VaultJoin pattern."
  - "Cast supabase.auth as any for oauth methods: supabase-js type definitions may not include the OAuth 2.1 server beta API yet. Cast avoids build errors while preserving runtime behavior."
  - "window.location.href not navigate(): Supabase's redirect_to URLs are full external URLs (MCP client callback). React Router navigate() only handles internal routes."
  - "10-minute expiry error detection: checks error message for 'expired' or 'not found' strings, matches both timeout and unknown-ID cases."

metrics:
  duration: "~2 minutes"
  completed: "2026-02-21"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase 12 Plan 04: OAuth Consent Page — Summary

**One-liner:** React consent page using supabase.auth.oauth approve/deny methods, public route wired into CallVault frontend, branded card UI with scope display.

---

## What Was Built

### Task 1: OAuthConsentPage component (`0aa49b9`)

Created `/Users/Naegele/dev/brain/src/pages/OAuthConsentPage.tsx` (371 lines).

**State machine:** `loading` → `consent` (happy path) or error states (`error-no-id`, `error-expired`, `error-fetch`, `error-action`).

**Auth flow:**
- Waits for `useAuth()` to resolve (avoids flash redirects)
- If no `authorization_id` in URL → shows "Invalid authorization request" error
- If user not authenticated → redirects to `/login?next=/oauth/consent?authorization_id=<id>`
- If authenticated → calls `supabase.auth.oauth.getAuthorizationDetails(authorizationId)`

**Consent screen:**
- Shield icon + "Authorization Request" heading (Montserrat Extra Bold)
- App name prominently displayed
- Scope list with icons: `openid` → "Verify your identity", `email` → "View your email address", `profile` → "View your profile information"
- Data access notice: "This will allow [App Name] to read your call recordings, transcripts, and contacts on your behalf."
- Allow (primary) and Deny (hollow) buttons, disabled during in-flight API call

**Approve/Deny:**
- Calls `supabase.auth.oauth.approveAuthorization` or `denyAuthorization`
- On success: `window.location.href = data.redirect_to` (full browser redirect to MCP client callback)
- On failure: shows error state with message

### Task 2: Route registration in App.tsx (`f163878`)

Added to `/Users/Naegele/dev/brain/src/App.tsx`:

```tsx
import OAuthConsentPage from '@/pages/OAuthConsentPage';

// In <Routes>:
{/* OAuth consent page - public route, handles its own auth check internally */}
<Route path="/oauth/consent" element={<OAuthConsentPage />} />
```

Route is placed alongside other OAuth-related routes (`/oauth/callback*`) and is NOT wrapped in `<ProtectedRoute>` — the component handles auth internally.

TypeScript check: `npx tsc --noEmit` passes with zero errors.

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

---

## Checkpoint: Human Verification Required (Task 3)

Task 3 is a `checkpoint:human-verify` gate. Automated work is complete. The following verification is required before proceeding to Plan 05.

### What to Verify

1. Navigate to **http://localhost:8080/oauth/consent** in your browser (ensure dev server is running: `cd /Users/Naegele/dev/brain && npm run dev`)

2. **Expected behavior without authorization_id:** You should see the "Invalid Request" error card — "Invalid authorization request. Please try connecting again from your MCP client."

3. **Expected behavior with no active session:** If you visit while logged out, you should be redirected to `/login` (then redirected back on login).

4. **Visual check:** Centered card layout, shield icon, Montserrat headings, clean minimal design.

5. **Console check:** No errors in browser devtools.

### Full end-to-end testing

Full OAuth flow testing requires:
- Supabase OAuth 2.1 Server enabled in dashboard (Plan 05 setup step)
- Worker deployed with correct `SUPABASE_URL` secret (Plan 05)
- An MCP client (MCP Inspector) initiating the flow

This checkpoint only verifies the UI component is correctly built and routed.

---

## Self-Check

**Files created/exist:**

```
[ -f "/Users/Naegele/dev/brain/src/pages/OAuthConsentPage.tsx" ] — FOUND
```

**Commits exist:**

- `0aa49b9` — feat(12-04): create OAuthConsentPage component
- `f163878` — feat(12-04): wire /oauth/consent route into App.tsx router

## Self-Check: PASSED
