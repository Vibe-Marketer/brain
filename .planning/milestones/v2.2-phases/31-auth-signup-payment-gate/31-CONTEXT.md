---
phase: 31
phase_name: Auth, Signup & Payment Gate
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 31: Auth, Signup & Payment Gate — Context

<domain>
## Phase Boundary

Close the customer-onboarding blocker: any new user can sign up (Google or email), pass through a pricing gate, complete payment, and receive meaningful error messages on every failure path. Includes:

- Email signup that gives **visible UI feedback** on success and error (today: HTTP 200 succeeds silently — no toast, no redirect, no confirmation screen).
- Sign-in error toast wiring (today: wrong password = silent failure despite `toast.error(getErrorToastMessage(error))` in code — implies `getErrorToastMessage` is suppressing the message, the toast container isn't mounted on this route, or another short-circuit exists).
- Pricing/plan-selection page shown **before** account creation — no silent free-tier bypass.
- Payment gate enforced before any non-grandfathered account hits `/onboarding`.
- Useful error copy on every failure: duplicate email, weak password, network failure, OAuth mismatch, share-link wrong-recipient.
- Google sign-in routing fixed for the shared-call wrong-recipient case.
- Soren canary account (`soren@vibeos.com`) deleted from Supabase Auth so signup happy-path can be re-tested clean.

Out of scope: building the marketing-site `/pricing` page (already exists at `https://callvaultai.com/pricing/` per live check 2026-05-11). Public shared-call landing page UX (Phase 32). Backend response shape change for share-call wrong-recipient (Phase 32). Frontend security audit (Phase 38).
</domain>

<decisions>
## Implementation Decisions

### Pricing Flow — External Marketing Site Hosts Pricing

Andrew's product call: pricing lives on the external marketing site `callvaultai.com/pricing` (already deployed via Vercel — verified live 2026-05-11). The app subdomain (`app.callvaultai.com`) stays pure-product.

**Signup user journey:**

1. User lands on `app.callvaultai.com` unauthenticated → redirected to `/login`.
2. User clicks the **"Sign up"** toggle (or a dedicated CTA) on `/login` → instead of switching the form to signup mode locally, the page **redirects out** to `https://callvaultai.com/pricing` (preserve any `?next=` query param via a server-side stash or URL param).
3. User picks a plan + pays on the marketing site (Polar checkout — already wired in `supabase/functions/polar-checkout`).
4. Polar success callback / marketing site routes the user **back** to `app.callvaultai.com/login?signup=true&plan={tier}` (or similar) where the account-creation form is now shown.
5. User finishes account creation; Supabase Auth links to the already-paid Polar customer record by email; redirected to onboarding.

**Why this pattern:** it's the standard for premium-tier SaaS (Linear, Vercel, Notion all follow this — marketing site converts, app subdomain stays pure). Trial-first SaaS (Slack, Figma) use the in-app pattern, but CallVault is paid-from-day-one per the existing PlanCards.tsx structure.

**Open coordination items (call out for plan-phase):**
- Confirm the marketing site at `callvaultai.com/pricing` already has Polar checkout buttons wired. If not, that's a marketing-site change request — coordinate or descope from this phase.
- Confirm the post-payment redirect target. If marketing site can't redirect back with the right query params, fall back to: email the user a "complete your account" link.
- A redirect-on-Signup-click can disorient users. Add a one-line copy fix on the `/login` "Sign up" CTA: e.g., "Sign up → view plans".

### Free / Pro / Team Tiers — Already Defined

`src/components/billing/PlanCards.tsx` already defines Free, Pro, and Team. `polar-cancel` references "downgrades to Free." `useAiGate` already enforces AI quotas per tier. The tiers do **not** need to be redesigned — they're locked.

**Free tier semantics — clarification needed during plan-phase:** AUTH-02 says "no silent free-tier bypass." If the Free tier IS a valid signup outcome (with limited features), then the "pricing gate" is really a "plan selection gate" — the user MUST pick a tier (even Free), but Free is a legitimate choice. If Andrew intends "no free tier at signup, only paid," then the Free card on `/pricing/` should be hidden from the new-user flow and only shown to grandfathered downgrade paths. **Default assumption for plan-phase:** Free is a valid signup tier; the gate enforces tier selection, not payment.

### Soren Canary Account — Delete

`soren@vibeos.com` already has a Supabase Auth account from prior testing — currently returning the obfuscated-existing-account response on signup attempt (`role: ""`, `identities: []`).

**Action during plan-phase research / execution:**
- Identify the user record via Supabase admin API or SQL: `SELECT id FROM auth.users WHERE email = 'soren@vibeos.com';`
- Delete via Supabase admin API (cascades to `user_profiles`, etc., per existing FK constraints).
- Use a throwaway email like `qa-{timestamp}@vibeos.com` (or Plain Email +addressing) for happy-path signup testing.

### AUTH-01 — Email Signup Silent Success

Today: `supabase.auth.signUp({ email, password })` returns HTTP 200 + valid user object, but the UI gives no feedback. Code at `src/pages/Login.tsx:53-72` LOOKS correct — calls `toast.success(...)` for both confirmed (session present) and unconfirmed (session absent / confirm-email-flow) cases.

**Root cause hypothesis (verify in plan-phase research):** the Sonner `<Toaster>` mount may be missing on the `/login` route, OR a route-level error boundary is unmounting it, OR `getErrorToastMessage` returns `""` for some error shapes. Plan-phase research must confirm the actual failure mode before writing code.

**Solution scope (after root cause confirmed):**
- Mirror the `/forgot-password` confirmation-screen pattern (gold standard per REQUIREMENTS.md AUTH-01 note) — replace the `setEmail('') setPassword('')` post-signup behavior with a full-screen "Check your email to confirm" state.
- Wire success toast for the immediate-session case (when email confirmation is disabled in dev).
- Verify Sonner is mounted on `/login`.

### AUTH-04 — Useful Error Copy

`getErrorToastMessage` in `src/lib/user-friendly-errors.ts` exists and handles network / auth / generic errors. Extend it to cover Supabase-specific signup errors:
- `User already registered` → "This email is already registered. Sign in instead."
- `Password should be at least 6 characters` → "Password must be at least 6 characters."
- `Email rate limit exceeded` → "Too many signup attempts. Try again in a few minutes."
- `Email not confirmed` → "Check your email and click the confirmation link to continue."
- Anything else → fall through to existing generic copy (not "An unexpected error occurred").

Add the same coverage to the sign-in path for QA-20 (wrong password silent failure).

### AUTH-05 — Google Sign-In Error Path

Today: a Google-authenticated user landing on a shared call where they aren't the authorized recipient sees "Call Not Found." Per QA-22, the backend currently destroys the wrong-recipient signal (returns 404 for both wrong-email and non-existent-token). The backend fix is **Phase 32 scope**.

For **Phase 31**, scope is the Google-OAuth-specific routing — when the user lands on `/oauth/callback` after Google sign-in with a `pendingShareToken` in sessionStorage, the redirect target must include the share token context so that the share-call view can give the right error (not a generic "not found"). Implementation tightens `src/pages/OAuthCallback.tsx` to thread the pending token through to the shared-call landing.

The full SHARE-02 wrong-recipient UX lands in Phase 32 once the backend signal is restored.

### Payment Gate Enforcement — AUTH-03

Today: `soren@vibeos.com` can reach `/onboarding` without a paid plan (per REQUIREMENTS.md). Required behavior: any non-grandfathered account → check `subscription_status` from `user_profiles` (already populated by `polar-customer-state` and `polar-webhook`). If null/`expired`/`canceled` → redirect to `https://callvaultai.com/pricing?reason=gate&user={user_id}`.

**Grandfathering policy:** existing accounts created before this phase ships have `grandfathered: true` flag (NEW column to add to `user_profiles`, default false) OR an allowlist table. Plan-phase decides which is cleaner. Andrew, Phill, and any prior beta users should be auto-grandfathered.

### Test Strategy — Real-DB Integration + Live Browser

Per Andrew's locked rule (memory): integration tests must hit a real DB, not mocks. Apply to:
- New user signup happy path (with Supabase Auth test project)
- Duplicate-email error path
- Wrong-password sign-in error path
- Payment gate redirect for unpaid account
- OAuth callback share-token threading

Live browser verification via dev-browser against `app.callvaultai.com` after deploy:
1. Throwaway email signup → toast → confirmation screen → email link → onboarding.
2. Existing-email signup → "This email is already registered" toast.
3. Wrong-password signin → "Invalid email or password" toast.
4. Unpaid account `/onboarding` access → redirected to pricing.
5. Google sign-in to shared call with wrong account → useful error (or fall back to current state if Phase 32 backend not yet shipped — note explicitly).
</decisions>

<code_context>
## Existing Code Insights

**Already in place:**
- `src/pages/Login.tsx` — `handleSignUp` / `handleSignIn` / `handleMagicLink` / `handleGoogleSignIn` exist; toast calls are present in source. The "silent failure" is downstream of these calls.
- `src/pages/ForgotPassword.tsx` — full-screen "Check your email to reset your password" confirmation pattern — REUSE for signup confirmation.
- `src/components/billing/PlanCards.tsx` — Free/Pro/Team plan definitions, already wired to Polar.
- `src/components/billing/UpgradeButton.tsx` — checkout invocation pattern.
- `src/lib/user-friendly-errors.ts` — `getUserFriendlyError` + `getErrorToastMessage`. Extend with Supabase auth-specific messages.
- `supabase/functions/polar-checkout/`, `polar-customer-state/`, `polar-create-customer/`, `polar-webhook/`, `polar-cancel/` — full Polar billing stack.
- `src/hooks/useAiGate.ts` — quota gate for AI features (orthogonal to signup gate, but uses same `subscription_tier`).
- `src/integrations/supabase/client.ts` — auth client.

**Likely modifications:**
- `src/pages/Login.tsx` — swap inline signup form for external-redirect CTA on "Sign up" click; keep email confirmation screen for the post-payment account-creation path.
- `src/pages/OAuthCallback.tsx` — thread pending-share-token through Google OAuth redirect chain.
- `src/lib/user-friendly-errors.ts` — extend with Supabase-Auth-specific messages.
- `src/components/layout/AppShell.tsx` or `App.tsx` — confirm Sonner `<Toaster>` mounts globally (not route-scoped).
- New: `src/hooks/useRequirePaidPlan.ts` — payment gate hook that redirects to marketing pricing if no paid plan (and not grandfathered).
- Migration: `user_profiles` add `grandfathered: bool default false` (or an `auth_allowlist` table).

**Integration points to verify with the marketing site:**
- The marketing site at `callvaultai.com/pricing` must (a) have working Polar checkout buttons for Free/Pro/Team and (b) redirect post-payment back to `app.callvaultai.com/login?...` with enough context to complete account creation. If either is missing, this becomes a coordination blocker.
</code_context>

<specifics>
## Specific Requirements (from REQUIREMENTS.md)

- **AUTH-01** — Email signup completes successfully AND surfaces feedback. Current state: silent backend success. Fix mirrors `/forgot-password` confirmation screen pattern.
- **AUTH-02** — Pricing/plan-selection shown before account creation; no silent free-tier bypass.
- **AUTH-03** — Payment gate enforced before onboarding (Soren and all non-grandfathered accounts).
- **AUTH-04** — Useful signup error copy (not "An unexpected error occurred").
- **AUTH-05** — Google sign-in error path for shared-call wrong-recipient.
- **QA-19** — Soren canary handling (DELETE the account).
- **QA-20** — Sign-in wrong-password silent failure (toast wiring).
- **QA-21** — Public landing / pricing architectural question (RESOLVED: external marketing site).

## Success Criteria (from ROADMAP.md)

1. Net-new email signup completes without "An unexpected error occurred" and creates a usable, org-scoped account.
2. Pricing/plan-selection page shown before account creation — no free-tier bypass.
3. Payment gate enforced: non-grandfathered accounts at `/onboarding` without paid plan → pricing.
4. Signup failure surfaces actual reason ("already registered", "password too short").
5. Google sign-in redirects to correct error page when authenticated user isn't the authorized share-call recipient.

## Verification Strategy

- Dev-browser end-to-end happy-path: throwaway email → signup CTA → external pricing redirect → checkout success → return to app → confirmation screen → email confirmation → onboarding.
- Dev-browser failure paths: duplicate email, wrong password, network failure, unpaid existing account.
- Edge function logs clean.
- Supabase Auth dashboard: confirm `soren@vibeos.com` deleted before testing happy path.
- Integration tests pass green.
</specifics>

<canonical_refs>
## Canonical References (MANDATORY for downstream agents)

- `.planning/ROADMAP.md` — Phase 31 section
- `.planning/REQUIREMENTS.md` — AUTH-01..05, QA-19, QA-20, QA-21
- `.planning/phases/29-qa-sweep-regression-catalog/` — Phase 29 sweep findings (especially QA-19, QA-20, QA-21)
- `src/pages/Login.tsx` — current signup/signin implementation
- `src/pages/ForgotPassword.tsx` — gold-standard confirmation screen pattern (REUSE)
- `src/pages/OAuthCallback.tsx` — OAuth redirect handler
- `src/lib/user-friendly-errors.ts` — error message system (extend)
- `src/components/billing/PlanCards.tsx` — Free/Pro/Team tier definitions
- `supabase/functions/polar-checkout/`, `polar-customer-state/`, `polar-webhook/` — billing stack
- `src/hooks/useAiGate.ts` — quota enforcement pattern (model for `useRequirePaidPlan`)
- `supabase/CLAUDE.md` — deploy via `--use-api`, RLS conventions
- `src/CLAUDE.md` — frontend conventions

## External Dependency

- `https://callvaultai.com/pricing/` — marketing-site pricing page (verified live 2026-05-11). The signup flow assumes it has functional Polar checkout buttons and post-payment redirect-back capability. If those aren't present, this becomes a marketing-site coordination ticket.
</canonical_refs>

<deferred>
## Deferred Ideas

- **Trial-first onboarding flow** (sign up first, pick plan after N days) — alternative SaaS pattern. Not chosen for this milestone. Capture as v2.3 product candidate.
- **In-app pricing page on app subdomain** — fallback if marketing site can't host functional checkout. Currently descoped; marketing site is verified live.
- **Email-magic-link signup gating** — currently `handleMagicLink` has `shouldCreateUser: true`. Does magic-link signup bypass the payment gate? If yes, harden it OR document why magic-link is intentionally trial-only.
- **Auth-allowlist table vs `grandfathered` column** — plan-phase will pick the cleaner approach. The deferred decision is whether to formalize a separate allowlist for staff/beta users.
- **Audit log of grandfathered users** — who's been auto-grandfathered and why. Not strictly necessary for v2.2 but useful for support.
</deferred>
