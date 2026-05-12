---
phase: 32
slug: shared-call-public-landing-page
created: 2026-05-11
---

# Phase 32 — Pattern Map

> For each file Phase 32 creates or modifies, the closest existing analog and the concrete patterns the executor must replicate.

---

## Files to Create

### `supabase/functions/_shared/email-mask.ts` (NEW)

**Analog:** `supabase/functions/_shared/cors.ts` — small, pure, dependency-free shared helper.

**Pattern:**
```typescript
// Single exported function, no Supabase deps, no side effects.
export function maskEmail(email: string): string {
  // ...
}
```

Keep under 30 lines. Include 4 inline test-case comments showing the expected input → output for: standard email, 1-char local, 2-char local, missing email.

---

### `src/components/share/PublicShareLanding.tsx` (NEW)

**Analog:** `src/pages/Login.tsx` (lines 207–250 — the card chrome + logo + heading + CTAs).

**Pattern:** centered-card layout with `min-h-screen flex items-center justify-center bg-viewport p-4`, inner `w-full max-w-md rounded-2xl border border-border bg-card shadow-lg px-8 py-10`, centered logo (`h-12 w-auto mb-4`), heading (`text-xl font-semibold text-foreground`), sub-heading (`text-sm text-muted-foreground`), stacked full-width buttons (primary `bg-foreground text-background`, secondary `variant="hollow"`).

**Props:** `{ inviterName: string; callTitle: string; token: string; onSignUp: () => void; onOpenExisting: () => void }`. No data fetching inside.

**Motion:** `motion.div` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}` around the card.

---

### `src/components/share/WrongAccountState.tsx` (NEW)

**Analog:** `src/pages/Login.tsx` (signup-confirmation branch, lines 211–245 — `Check your email` card with centered icon, heading, body, buttons).

**Pattern:** centered card same as PublicShareLanding but `max-w-sm` instead of `max-w-md`. `RiUserLine` icon (32px, `text-muted-foreground`, centered, `mb-3`) replaces the logo. Heading + body paragraph + two stacked buttons (`bg-foreground text-background` primary, `variant="ghost"` secondary).

**Props:** `{ recipientMasked: string | null; onSignOut: () => void; onCancel: () => void; isSigningOut: boolean }`.

**Auto-focus:** on mount, focus the Sign Out button via `useRef` + `useEffect`.

---

### `supabase/functions/share-call/__tests__/share-call.integration.test.ts` (NEW)

**Analog:** any existing `*.integration.test.ts` in the repo. Search: `find /Users/Naegele/dev/brain -name "*.integration.test.ts" -not -path "*/node_modules/*"`.

**Pattern from `src/test/integration-setup.ts`:**
- `describe.skipIf(!integrationDbReachable)` wrapper.
- `beforeAll`: create fixtures with `SUPABASE_SERVICE_ROLE_KEY`.
- `afterAll`: clean up all fixture rows by ID.
- Test names: `should return 200 public-view for unauthenticated request`, `should return 403 WRONG_RECIPIENT for recipient mismatch`, etc.

If no existing edge-function integration tests exist, use the Vitest pattern: dispatch the handler directly by importing the handler module (Deno-target code may not be importable from Node/Vitest — fallback: hit the deployed function URL using `supabase.functions.invoke()` from `@supabase/supabase-js`, with the SERVICE_ROLE_KEY for fixture setup and a regular client for the actual invoke). Planner picks the route based on what works in this repo's test runner.

---

## Files to Modify

### `supabase/functions/share-call/index.ts`

**Lines to touch:** 219–321 (`handleGetShareCall`, token branch).

**Pattern from existing code:** the existing access-log block (lines 287–294) shows the optional-auth-probe pattern — Phase 32 hoists this to the top of the token branch.

**Concrete changes:**
1. After `if (token) {`, insert optional-auth probe (see RESEARCH section 2 — exact code).
2. After the `linkError || !shareLink` 404, BEFORE the `shareLink.status === 'revoked'` check: if `currentUserEmail == null`, return `200` with public-view payload (after fetching `inviter_name` from `user_profiles` and `call_title` from `fathom_raw_calls`).
3. After the revoked check: if `currentUserId === shareLink.user_id`, skip recipient check (sender-views-own-link path).
4. Otherwise, if `shareLink.recipient_email && currentUserEmail.toLowerCase() !== shareLink.recipient_email.toLowerCase()`: return `403` with `{ error: 'Wrong recipient', code: 'WRONG_RECIPIENT', recipient_masked: maskEmail(shareLink.recipient_email) }`.
5. Otherwise (current user IS the recipient OR `recipient_email` is null = unrestricted token), continue to existing call fetch + 200 ok response.
6. Add `?mode=signup-prefill` short-circuit at the very top of the token branch: if `mode === 'signup-prefill'`, return `{ recipient_email: shareLink.recipient_email }` (200) — used by Login.tsx pre-fill.

**Import the email-mask helper:**
```typescript
import { maskEmail } from '../_shared/email-mask.ts';
```

---

### `src/pages/SharedCallView.tsx`

**Pattern from existing code:** the existing render branches (lines 60–133) — keep the loading / revoked / not-found / happy-path render branches but rewire them off a discriminated union instead of nested ifs.

**Concrete changes:**
1. Remove lines 51–58 entirely (auth redirect block). The page renders even when unauthenticated.
2. The `useAuth()` call stays (we still want to know if the user is authenticated — it's passed into the hook so the hook can attach the JWT to the fetch).
3. Replace the existing if-chain (lines 60–133) with a `switch (data.status)` over the discriminated union from `useSharedCall`.
4. Add cases for `status === 'public-view'` (renders `<PublicShareLanding>`) and `status === 'wrong-recipient'` (renders `<WrongAccountState>`).
5. Sanitize `bg-info-bg`, `border-info-border`, `text-info-text` on the call-view banner (lines 167–178) → `bg-muted/40 border-border text-foreground` (inviter name) + `text-muted-foreground` (helper text).
6. Sanitize `text-red-500` (line 77) → `text-destructive`. Sanitize `text-amber-500` (line 98) → `text-muted-foreground`. Replace error-card copy with UI-SPEC locked copy.
7. Add `Try Again` button to the 5xx error card (refetch via React Query `refetch`).

---

### `src/hooks/useSharing.ts`

**Lines to touch:** 237–298 (`useSharedCall` function).

**Concrete changes:**
1. Replace `SharedCallData` interface with the discriminated union from RESEARCH section 3.
2. Update `queryFn` to parse the response and map to the correct union variant per HTTP code + error code.
3. The fetch URL gains a JWT header when `userId` is present: pull session token from `supabase.auth.getSession()` and attach as `Authorization: Bearer {token}`. This is how the backend probe triggers.
4. Remove the legacy `accessor_user_id` query param from the fetch URL (the backend now derives identity from the auth header, per security audit Critical #3, already mostly done at line 252).
5. Export a new typed result interface — `UseSharedCallResult` becomes `{ data: SharedCallStatus; refetch: () => void; }` (the discriminated union IS the data — no separate `isLoading` because `status === 'loading'` covers it).

---

### `src/pages/Login.tsx`

**Pattern from existing code:** the existing `?signup=true&plan={tier}&email={email}` reading (lines 56–58, 262–264) — extends naturally for `?share={token}`.

**Concrete changes:**
1. Add `shareParam = searchParams.get('share')` to the param reader.
2. When `shareParam` is set, fetch `recipient_email` and `call_title` via `share-call?token={shareParam}&mode=signup-prefill` (anonymous call — token IS the credential).
3. If the lookup fails (token invalid), redirect to `/login` (no share param) and toast "This share link is invalid."
4. Pre-fill `email` state with the looked-up `recipient_email`; the email input becomes `disabled` with a `RiLockLine` icon inside the right side, and a helper `Locked to the recipient of this share link.` below the input.
5. Update the sub-heading copy when `shareParam` is set: `You're on the Free plan. Set a password to view the call.`
6. In `handleSignUp`, after `supabase.auth.signUp()` success, if `shareParam` is set:
   - Pass `signup_source: 'share-link'` in `options.data` (user_metadata).
   - On success, call `polar-create-customer` Edge Function with Free tier `product_id` (requires the new session's JWT — only callable in the immediate-session branch).
   - Navigate to `/s/{shareParam}` instead of `getPostLoginRedirect()`.
7. The mode-switcher row at the bottom: when `shareParam` is set, hide the "Sign up → view plans" external CTA (already in signup mode by virtue of `?signup=true` carrying through); the alternative-path link becomes `Already have an account? Sign in instead` → `navigate('/login?share={token}')`.

---

### `src/components/sharing/ShareCallDialog.tsx`

**Locked fixes per UI-SPEC §`### ShareCallDialog cleanup specifics (SHARE-03)`:**

**Fix 1 — borders/highlight:**
- Line 208: remove `border-green-500/50 bg-green-500/5`. Replace with a `ring-2 ring-foreground/10` (planner picks ring or scale-pulse).
- Lines 256–258: `text-green-600` → `text-foreground`, `RiCheckLine` stays.

**Fix 2 — icon:**
- Replace ALL `RiLinkM` imports (line 21) with `RiLinksLine`.
- Three usage sites: line ~180 (CREATE button), line ~213 (link-row icon), line ~268 (empty-state icon).

**Fix 3 — overflow:**
- Add `max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col` to `<DialogContent>` (line 140).
- Wrap the body `<div className="space-y-4">` (line 155) in `flex-1 min-h-0 flex flex-col overflow-hidden`.
- Active-links inner container (line 201): remove `max-h-48`, make it `flex-1 min-h-0 overflow-y-auto`.

**Copy changes per UI-SPEC §`### ShareCallDialog (Visual Cleanup — SHARE-03)`:**
- Section label `Create New Share Link` → `Add recipient`.
- Placeholder `Recipient email (optional)` → `recipient@example.com`.
- Button `CREATE` → `Create link` (sentence-case).
- Section label `Active Share Links ({count})` → `Active share links ({count})`.
- Empty state `No share links yet. Create one above to share this call.` → `No share links yet. Add a recipient above to create one.`
- Footer `Revoked links will no longer work.` → `Revoked links stop working immediately.`
- Button `CLOSE` → `Close` (sentence-case).

---

## Cross-File Patterns

### Error toast mapping

Reuse `getErrorToastMessage` from `src/lib/user-friendly-errors.ts` (Phase 31). Every catch block in the share-link signup path uses this — no new strings.

### Token-based session

`useAuth()` provides `{ user, session, loading }`. The session's `access_token` is needed in the `useSharedCall` fetch when the user is authenticated. Pull it via `supabase.auth.getSession()` inside the queryFn — do NOT trust a stale `useAuth()` snapshot.

### React Query keys

Existing `queryKeys.sharing.byToken(token)` in `src/lib/query-config.ts` — no change needed; the cache key stays the same, only the response shape changes.

### Sender vs recipient identity comparison

Always lowercase both sides: `currentUserEmail.toLowerCase() === shareLink.recipient_email.toLowerCase()`. Supabase auth stores emails lowercased; share_links table accepts whatever the sender typed. Defensive comparison.

---

## PATTERN MAPPING COMPLETE
