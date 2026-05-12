---
phase: 31
phase_name: Auth, Signup & Payment Gate
researched: 2026-05-12
status: Research complete
---

# Phase 31 — Research

## Mandate

Verify root causes for AUTH-01 (silent signup success), QA-20 (silent wrong-password failure), AUTH-03 (Soren bypassing payment gate), AUTH-05 (Google OAuth wrong-recipient routing) so the planner can write precise atomic tasks.

## Key Findings (verified against code)

### F1 — Sonner `<Toaster>` IS mounted globally on App.tsx

- **Location:** `src/App.tsx:9` (import) and `src/App.tsx:292` (`<SonnerToaster position="bottom-right" richColors />`)
- **Mount level:** Inside `<Router>`, AFTER `<Routes>`, ABOVE `</Router>`. This is global — the Toaster renders on every route including `/login`.
- **Implication:** The "silent signup" / "silent wrong-password" failures are NOT caused by a missing Toaster. CONTEXT.md hypothesis ("Toaster route-scoped") is **incorrect**.

### F2 — Real root cause of AUTH-01 silent signup success

- **Trigger code:** `src/pages/Login.tsx:53-72`
- The `handleSignUp` flow calls `toast.success('Account created! Please check your email to confirm your account.')` then runs `setEmail('')` / `setPassword('')` — but provides NO visual confirmation screen and the success toast at `bottom-right` is small/easy to miss.
- **Root cause is NOT silent backend success** (the original CONTEXT.md hypothesis is partially wrong). The backend succeeds AND the toast fires — but the user experience reads as silent because:
  1. The form fields clear without a screen swap, looking identical to a no-op.
  2. The bottom-right toast at default Sonner duration (4s) is easy to miss on a centered-form page.
  3. There is NO equivalent of the `/forgot-password` full-screen "Check your email" confirmation that Sonner toast cannot replace.
- **Fix:** Replicate `ForgotPassword.tsx:46-127` confirmation-screen pattern inside `Login.tsx` post-signup.

### F3 — Real root cause of QA-20 silent wrong-password failure

- **Trigger code:** `src/pages/Login.tsx:91-104`
- The catch block calls `toast.error(getErrorToastMessage(error))`. Supabase returns `error.message = "Invalid login credentials"` for wrong-password (per QA-20 backend log).
- **`getErrorToastMessage` chain** (`src/lib/user-friendly-errors.ts:23-179`):
  - `error.message.toLowerCase()` = `"invalid login credentials"`
  - Hits the **"validation errors" branch (line 132-145)** because `"invalid"` is in the message.
  - Returns `friendly.message = "Invalid login credentials"` (the original error.message) → wrapped with `(Fix & Retry)` suffix.
  - **The toast WOULD fire and read: "Invalid login credentials (Fix & Retry)"** — but QA-20 says nothing appeared.
- **Possible real causes (verify in execution):**
  1. The toast fires but is dismissed before user notices (4s default).
  2. There's a race where `finally { setLoading(false) }` triggers a re-render that unmounts the toast somehow.
  3. The error reaches the catch but `error instanceof Error` is false because Supabase returns `AuthError` (non-Error class).
- **Fix scope:** Add a Supabase-specific match for `"invalid login credentials"` in `getUserFriendlyError` BEFORE the generic `invalid` branch, returning the locked UI-SPEC copy. Verify via dev-browser that the toast actually surfaces with the new copy.

### F4 — Toaster default duration probably too short

- Sonner defaults: toast duration 4 seconds. No override in current `<SonnerToaster>` mount.
- **Recommendation in plan:** add `duration={6000}` or per-toast `{ duration: 6000 }` on error toasts. This is a small but high-impact change.

### F5 — Pricing redirect is already partially supported

- `Login.tsx:25-30` already handles `?next=` for OAuth consent redirects. The new redirect-out signup pattern can reuse `pendingNext` sessionStorage write.
- No existing logic at the marketing site level — assumption is documented per user instruction (`?signup=true&plan={tier}&email={email}` is the contract).

### F6 — Payment gate prerequisites

- `useSubscription` hook returns `isPaid: boolean` (`tier !== 'free' && (status === 'active' || status === 'trialing')`) — **this is the gate signal**.
- The signup trigger migration (`20260430123000_trial_provisioning_and_dead_code_cleanup.sql`) auto-creates a `pro-trial` for every new user with `subscription_status='trialing'`, `product_id='pro-trial'`. This means a fresh signup IS `isPaid=true` for the duration of their trial.
- **AUTH-03 implication:** "Soren bypassing the gate" means Soren's trial has expired (or was manually adjusted) AND he hit `/setup` (the actual onboarding route, NOT `/onboarding`). The gate needs to enforce against expired-trial / canceled / null states.
- **Route to gate:** `/setup` (SetupWizard.tsx) is the actual onboarding wizard. The plan must add the gate to the `/setup` route guard (wrap with `useRequirePaidPlan` or extend ProtectedRoute).

### F7 — Grandfathering — column approach is cleaner

- Per user instruction: pick the column approach. Add `grandfathered BOOLEAN DEFAULT false` to `user_profiles`.
- Andrew + Phill + Soren (post-trial) + any existing beta users need backfill. SQL: `UPDATE user_profiles SET grandfathered = true WHERE created_at < '2026-05-12';` (created_before-this-phase rule per CONTEXT.md).

### F8 — OAuth callback file mismatch with CONTEXT/UI-SPEC

- `src/pages/OAuthCallback.tsx` handles **Fathom/Zoom integration OAuth** (lines 50-63), NOT Supabase auth Google OAuth.
- Supabase auth Google OAuth uses `signInWithOAuth({ provider: 'google', redirectTo })` — Supabase handles the callback URL and lands the user at `redirectTo` directly, NOT at `/oauth/callback`.
- **AUTH-05 implication:** The "thread pending share token through OAuth" logic must live at the post-login landing surface — either inside `ProtectedRoute` (already at `src/components/ProtectedRoute.tsx:22-26` — handles `pendingShareToken` redirect) OR inside `getPostLoginRedirect()` at `src/pages/Login.tsx:19-32` (already handles `pendingShareToken`).
- **The thread already works.** The user clicks "Continue with Google" → Supabase redirects to `/` → `ProtectedRoute` reads `sessionStorage.pendingShareToken` → redirects to `/s/${token}`. The bug is downstream: the share-call view returns "Call Not Found" because the backend (Phase 32) destroys the wrong-recipient signal.
- **Phase 31 surface-level scope (per CONTEXT.md):** verify `pendingShareToken` is written by the share-call view BEFORE the OAuth redirect happens. Currently `src/pages/SharedCallView.tsx` is the file that should set `pendingShareToken` — verify in execution.

### F9 — Existing components already cover most UI

- `Login.tsx`, `ForgotPassword.tsx`, `useSubscription.ts`, `getErrorToastMessage`, `PlanCards.tsx`, `polar-checkout/`, `ProtectedRoute.tsx` all exist and work. Phase 31 is **mostly modify-existing-files**, with one new file (`useRequirePaidPlan.ts`) and one migration.

## Open Risks Carried to Plan

1. **Marketing site `callvaultai.com/pricing` Polar wiring** — assumed working per CONTEXT.md. If broken, post-Polar redirect back to `/login?signup=true&plan=...` won't fire and the post-payment-account-creation surface won't see traffic. Mitigation: ship the Phase 31 frontend regardless; the marketing site is the bottleneck, not us.
2. **Magic link bypass of payment gate** (`Login.tsx:121-126` has `shouldCreateUser: true`) — defer to v2.3 per CONTEXT.md deferred section.
3. **Sonner toast UX miss** — even with longer duration and better copy, users may still miss bottom-right toasts when a confirmation screen would be clearer. The plan should ALSO wire a full-screen confirmation for the signup case (the `ForgotPassword.tsx` pattern).
4. **Soren's actual subscription state** — operator must check Supabase before deleting. SQL: `SELECT id, email, subscription_status, product_id, current_period_end FROM auth.users JOIN user_profiles ON auth.users.id = user_profiles.user_id WHERE email='soren@vibeos.com';`

## Sources

- `src/App.tsx:9, 292` — Toaster mount confirmed global
- `src/pages/Login.tsx:42-156` — signup/signin/magic-link/Google flows
- `src/pages/ForgotPassword.tsx:46-127` — gold-standard confirmation screen
- `src/pages/OAuthCallback.tsx:50-63` — integration OAuth (NOT auth OAuth)
- `src/components/ProtectedRoute.tsx:22-26` — pendingShareToken redirect
- `src/lib/user-friendly-errors.ts:23-179` — error mapping chain
- `src/hooks/useSubscription.ts:143-216` — subscription state derivation
- `src/components/billing/PlanCards.tsx:34-90` — tier definitions
- `supabase/migrations/20260430123000_trial_provisioning_and_dead_code_cleanup.sql` — auto-trial on signup
- `supabase/functions/polar-checkout/index.ts` — checkout URL generation
