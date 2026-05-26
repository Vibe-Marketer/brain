---
phase: 32
slug: shared-call-public-landing-page
created: 2026-05-11
status: complete
---

# Phase 32 — Research

> What we need to know to plan the Shared-Call Public Landing Page well. Locked decisions live in 32-CONTEXT.md and the visual contract lives in 32-UI-SPEC.md; this file covers technical landmines, response-shape mechanics, and pattern reuse.

---

## 1. Backend Response Shape Matrix (`supabase/functions/share-call/index.ts`)

Today (`handleGetShareCall`, token branch, lines 219–321):

| Case | Current behavior | Target behavior |
|------|------------------|-----------------|
| Token doesn't exist (`call_share_links` row not found) | `404 / LINK_NOT_FOUND` | UNCHANGED — `404 / LINK_NOT_FOUND` |
| Token exists but `status='revoked'` | `403 / LINK_REVOKED` (with `share_link` object) | UNCHANGED |
| Token exists, recipient mismatch (auth'd user email ≠ `recipient_email`) | **MISSING** — there is no recipient check today. The handler skips straight to the call fetch and returns 200 if call exists. This is the QA-22 signal-destruction bug. | **NEW — `403 / WRONG_RECIPIENT`** with `{ error, code: 'WRONG_RECIPIENT', recipient_masked }` |
| Token exists, call_recording_id has no matching row in `fathom_raw_calls` | `404 / CALL_NOT_FOUND` (lines 278–283) | UNCHANGED |
| Token exists, authenticated user is the correct recipient | `200` with full payload | UNCHANGED |
| Token exists, **unauthenticated** request | `200` with full payload (transcript, recording_id, etc.) — current behavior leaks call content to anyone with the token | **NEW — `200 / public-view`** with safe-subset: `{ inviter_name, call_title, recipient_masked?, is_public_view: true }`. NO transcript, NO internal IDs, NO recipient email (only masked). |

**Discrimination signal:** the recipient-mismatch check needs the authenticated user's email. The handler currently never reads the Authorization header inside the token-based branch. Phase 32 adds an optional auth-header probe at the start of the token branch: if a Bearer token is present and resolves to a user, capture `currentUserEmail`. If `currentUserEmail` exists and `shareLink.recipient_email` exists and they don't match (case-insensitive), return `403 WRONG_RECIPIENT`.

**Sender-views-own-link behavior:** CONTEXT.md asks plan-phase to pick — "sender always sees their own call OR see 'You're the sender' indicator". Decision: **sender always sees the call** (simplest, no extra UI surface). If the authenticated user is the sender (`shareLink.user_id === currentUser.id`), skip the recipient check and return the full call payload, even when their email doesn't match `recipient_email`. Rationale: the sender created the link, they own the call, they should always be able to QA it.

**Public-view payload sourcing:**

- `inviter_name`: query `user_profiles.display_name` joined on `call_share_links.user_id`. If missing, derive a fallback from `auth.users.email` (first part before `@`, capitalized). Never expose the raw email.
- `call_title`: `fathom_raw_calls.call_name`. If null, return "An untitled call".
- `recipient_masked`: server-side mask of `call_share_links.recipient_email`. Mask helper: keep first 2 chars of local part, replace rest of local part with 3 asterisks, keep domain. `naegele412@gmail.com` → `na***@gmail.com`. If local part has 1 char, keep all 1; if 2 chars, keep both.

**Email-masking helper location:** new helper in `_shared/email-mask.ts` (small pure function, no Supabase deps), imported by `share-call/index.ts`. Reusable for any future public-error-surface that needs to mask.

---

## 2. Optional-Auth Probe Pattern (How to Read User Email Without Failing on Anonymous)

The existing token branch is intentionally unauthenticated. We need a soft probe that:
- Reads `req.headers.get('Authorization')` if present.
- If present, calls `supabaseClient.auth.getUser(token)`.
- If that returns `{ user, error: null }`, capture `user.email` and `user.id`.
- If header is absent OR token is invalid, treat the request as anonymous (no email, no id) — do NOT 401.

Already partially implemented at lines 287–294 (access-log block). Phase 32 hoists that probe to the top of the token branch so it's available before the recipient check.

```typescript
let currentUserEmail: string | null = null;
let currentUserId: string | null = null;
const authHeader = req.headers.get('Authorization');
if (authHeader) {
  const probeToken = authHeader.replace(/^Bearer\s+/i, '');
  const { data, error: probeError } = await supabaseClient.auth.getUser(probeToken);
  if (!probeError && data?.user) {
    currentUserEmail = data.user.email ?? null;
    currentUserId = data.user.id;
  }
}
```

---

## 3. Frontend Response-Shape Discriminated Union

`useSharedCall` (in `src/hooks/useSharing.ts`) currently returns `{ shareLink, call, isValid, isRevoked }`. The new contract needs a discriminated union:

```typescript
type SharedCallStatus =
  | { status: 'loading' }
  | { status: 'public-view'; inviter_name: string; call_title: string }
  | { status: 'wrong-recipient'; recipient_masked: string | null }
  | { status: 'ok'; shareLink: ShareLink; call: SharedCall }
  | { status: 'not-found' }
  | { status: 'revoked'; revoked_at: string }
  | { status: 'error'; message: string };
```

SharedCallView's render branch becomes a `switch (data.status)` instead of nested `if (error) / if (isRevoked) / if (!data.isValid)`. This eliminates the redirect-to-login auto-redirect entirely and replaces it with explicit state routing.

**Map from HTTP response:**

| Edge Function returns | `useSharedCall` resolves to |
|-----------------------|------------------------------|
| 200 with `is_public_view: true` | `{ status: 'public-view', inviter_name, call_title }` |
| 200 with `is_valid: true` and `call` populated | `{ status: 'ok', shareLink, call }` |
| 403 with `code: 'WRONG_RECIPIENT'` | `{ status: 'wrong-recipient', recipient_masked }` |
| 403 with `code: 'LINK_REVOKED'` | `{ status: 'revoked', revoked_at }` |
| 404 with `code: 'LINK_NOT_FOUND'` or `'CALL_NOT_FOUND'` | `{ status: 'not-found' }` |
| 5xx / network failure | `{ status: 'error', message }` |
| In-flight | `{ status: 'loading' }` (React Query `isLoading`) |

---

## 4. Free-Tier-From-Share-Link Signup — How It Connects

Phase 31 established the external-pricing-redirect for general signup. Phase 32's share-link signup is a **separate entry point** that bypasses that redirect. Mechanics:

1. PublicShareLanding's "Sign up to view" button → `navigate('/login?signup=true&share={token}')`.
2. `Login.tsx` (already reads `?signup=true` per Phase 31) extends the param parser to also read `?share={token}`.
3. When `share` param is present, the Login page fetches the recipient email from the token via a new lightweight endpoint OR via a `share-call` call with `mode=lookup-recipient` (planner picks — see Decision below). Simplest: extend `share-call?token=...&mode=recipient` to return ONLY `{ recipient_email }` for the signup pre-fill — same handler, gated by `mode` param.
4. The email input pre-fills, is disabled, and the form behaves like Phase 31's `?signup=true` path EXCEPT it does NOT trigger the Polar pricing redirect — it goes straight to `supabase.auth.signUp()` with the locked email + entered password.
5. After auth success: call `polar-create-customer` Edge Function with Free tier `product_id` to provision a Polar customer record. Per CONTEXT.md deferred-to-execution note: use the EXISTING `polar-create-customer` Edge Function unchanged, just pass the Free tier product_id.
6. Set `user_metadata.signup_source = 'share-link'` during `signUp()` call.
7. `navigate('/s/{token}')` on success (immediate session) OR full-screen "Check your email" confirmation screen (email-confirm-pending).

**Free tier auto-assignment:** `user_profiles` row gets created (likely via auth trigger or via the existing `polar-create-customer` flow). Phase 32 needs `tier: 'free'` to be set. Check the existing post-signup flow — if `polar-create-customer` already handles tier provisioning via the Polar webhook, that's the path. If not, Phase 32 inserts `tier: 'free', grandfathered: false` on the `user_profiles` row directly.

**Decision needed in plan-phase:** how to read the recipient email for pre-fill. Two options:
- **Option A (recommended):** Extend `share-call` GET endpoint to support `?token=...&mode=recipient-lookup` returning `{ recipient_email, inviter_name, call_title }` without auth. The same call powers the public landing render AND the signup pre-fill — single backend round-trip.
- **Option B:** Add a separate lightweight `share-token-lookup` Edge Function. More files, but separation of concerns.

Plan chooses **Option A** (folded into the existing public-view 200 response — the public landing already gets `inviter_name`, `call_title`, and `recipient_masked`; just add `recipient_email` to the unauthenticated 200 response... wait, that leaks the unmasked recipient email to anyone with the token).

**Revised Decision: Option A2.** Public landing 200 response includes `recipient_masked` (already in spec), NOT `recipient_email`. Signup pre-fill route uses a separate authenticated-via-token-only call: `share-call?token=...&mode=signup-prefill` returns `{ recipient_email }`. The token IS the credential (same security model as the existing token-based fetch), so anyone with the token can see the unmasked recipient — but only via this explicit mode parameter, not by default. This matches the existing "token is the credential like a signed URL" pattern documented in the edge function comments.

Actually, the simplest path: the public landing 200 response includes `recipient_masked` for display, AND the unmasked `recipient_email` because the token itself authorizes access to the call content (which includes the recipient's identity anyway). The recipient email is not more sensitive than the call transcript. The security boundary is "do you have the token?" — anyone with the token can see everything. So just include `recipient_email` and `recipient_masked` in the 200 public-view response. SharedCallView displays `recipient_masked`; Login.tsx reads `recipient_email`.

**Final Decision: A3.** Public 200 response = `{ inviter_name, call_title, recipient_email, recipient_masked, is_public_view: true }`. Same payload powers both surfaces.

---

## 5. SharedCallView State Machine Refactor

Current (`src/pages/SharedCallView.tsx`):
- Auth gate (lines 51–58): redirects to `/login` if `!user`. **REMOVE.**
- isLoading: render Spinner. **KEEP.**
- error: render `Error Loading Call` card. **EVOLVE** to "Couldn't load the call" copy + Try Again + Go Home buttons (per UI-SPEC).
- isRevoked: render `Link Revoked` card. **EVOLVE** tokens off `text-amber-500` to `text-muted-foreground`.
- `!isValid || !call`: render `Call Not Found` card. **EVOLVE** copy to UI-SPEC locked text.
- Happy path: render banner + header + transcript. **KEEP** structurally, sanitize `bg-info-bg` / `border-info-border` / `text-info-text` tokens to `bg-muted/40` / `border-border` / `text-foreground`+`text-muted-foreground`.

New states added:
- `status === 'public-view'`: render `<PublicShareLanding>` component.
- `status === 'wrong-recipient'`: render `<WrongAccountState>` component.

The state machine becomes a simple `switch (data.status)` at the top of the render. The auth-context check still fires (we still want to know if the user is logged in), but it does NOT trigger a redirect — it's an input into the backend probe.

---

## 6. Validation Architecture (Nyquist Dimension 8)

| Validation Type | What we validate | How |
|------|--------------|-----|
| Schema | Edge function response shape per case (200 public, 200 ok, 403 WRONG_RECIPIENT, 403 LINK_REVOKED, 404 LINK_NOT_FOUND, 404 CALL_NOT_FOUND) | Integration tests at `supabase/functions/share-call/__tests__/share-call.integration.test.ts` — real DB, real Edge Function dispatch via `supabase functions serve` OR direct handler import. |
| Behavioral | Frontend state machine renders correct card per response status | Vitest tests on `SharedCallView.tsx` with mocked `useSharedCall` returning each discriminated union variant. |
| Integration | useSharedCall maps HTTP responses to the discriminated union correctly | Vitest tests on `useSharing.ts` using `msw` OR `fetch` mock — verify each HTTP code/code combo produces the expected `status`. |
| Visual | Public landing, wrong-account, ShareCallDialog cleanup all render per UI-SPEC | dev-browser screenshots on staging/prod after deploy — operator UAT. |
| End-to-End | Sender creates share → recipient (correct + wrong account) views | dev-browser cross-account flow on `app.callvaultai.com` per the 6-step matrix in CONTEXT.md SHARE-04. |
| Security | Token-based access doesn't leak transcript to unauthenticated, recipient mismatch detected, email masked server-side | Integration tests assert response body shape for unauthenticated case (no `full_transcript` key, no internal IDs); manual: try a wrong-account auth request and verify the 403 body has only `recipient_masked`, not the raw email. |
| Performance | Edge function latency stays ≤300ms at p50 for token-based fetch | Supabase function logs after deploy — confirm no >500ms p95 spikes from the added `auth.getUser` probe. The probe is optional and only fires when a header is present, so anonymous public-view requests don't pay the cost. |

---

## 7. Test Patterns to Reuse

- **Real-DB integration tests:** Phase 30 BUG-01 established the `*.integration.test.ts` suffix with `describe.skipIf(!integrationDbReachable)`. The `share-call` Edge Function currently has no test file — Phase 32 creates `supabase/functions/share-call/__tests__/share-call.integration.test.ts` with test fixtures that:
  1. Create a real `auth.users` row (sender)
  2. Create a real `recordings` + `fathom_raw_calls` row owned by sender
  3. Create a real `call_share_links` row with a specific `recipient_email`
  4. Call the handler with no auth header → assert 200 public-view shape
  5. Call with sender's JWT → assert 200 ok shape
  6. Call with wrong-recipient's JWT → assert 403 WRONG_RECIPIENT shape with masked email
  7. Call with correct-recipient's JWT → assert 200 ok shape
  8. Call with revoked link → assert 403 LINK_REVOKED
  9. Call with non-existent token → assert 404 LINK_NOT_FOUND
  10. Clean up all rows in `afterAll`

- **Vitest hook tests:** existing `src/hooks/__tests__/useSharing.test.ts` provides the pattern. Extend with new tests for the discriminated union mapping.

- **Vitest component tests:** existing testing pattern for React components with `@testing-library/react`. New tests for `PublicShareLanding.tsx`, `WrongAccountState.tsx`, and the SharedCallView state machine.

---

## 8. Files to Read (for planner / executor)

Before modifying anything:

- `supabase/functions/share-call/index.ts` (modification target — token branch lines 219–321)
- `supabase/functions/_shared/auth.ts` (existing auth helper — Phase 37 will migrate; Phase 32 may use parts but keep inline for now)
- `supabase/functions/_shared/cors.ts` (already imported)
- `src/pages/SharedCallView.tsx` (frontend modification target)
- `src/hooks/useSharing.ts` (hook surface change — `useSharedCall` slice)
- `src/components/sharing/ShareCallDialog.tsx` (visual cleanup target — 3 locked fixes)
- `src/pages/Login.tsx` (signup-completion extension for `?share={token}`)
- `src/integrations/supabase/client.ts` (auth client reference)
- `src/lib/user-friendly-errors.ts` (Phase 31 error mapping — reused)
- `src/lib/recording-ids.ts` (UUID/legacy-ID helper — may be needed for inviter lookup)
- `.planning/phases/31-auth-signup-payment-gate/31-01-PLAN.md` (Phase 31 plan — confirmation screen pattern)
- `docs/design/brand-guidelines-v4.4.md` (design token canonical reference)

---

## RESEARCH COMPLETE

Findings cover:
- Backend response shape matrix (6 cases, 2 changes: WRONG_RECIPIENT + public-view).
- Optional-auth probe pattern for token branch.
- Frontend discriminated union for `useSharedCall`.
- Free-tier signup wiring through existing Phase 31 + `polar-create-customer` infrastructure.
- SharedCallView state machine refactor scope.
- Validation strategy (8 dimensions covered).
- Test patterns to reuse from Phase 30/31.
- Files to read for each modification.

Plan-phase can now produce 3 plan files: backend (32-01), frontend state machine + new components + signup integration (32-02), ShareCallDialog cleanup + E2E verification (32-03).
