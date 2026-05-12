---
phase: 31
plan: 02
verified: 2026-05-12
status: code-complete, awaiting-live-uat
---

# Phase 31 Plan 02 — Verification

## Soren canary delete (QA-19)

**Pre-delete query result:**
```
id: e9351f66-784f-46a1-b9da-bf7a8494aed4
email: soren@vibeos.com
created_at: 2026-05-11T15:15:29.549Z
email_confirmed_at: 2026-05-11T15:15:29.779Z
subscription_status: trialing
product_id: pro-trial
current_period_end: 2026-05-18T15:15:29.496Z
grandfathered: true  (auto-set by 20260512000000 backfill — incorrect for a canary)
```

**Delete approach:** the straight `DELETE FROM auth.users` is blocked by two user-defined triggers (`prevent_last_workspace_owner` + `protect_default_workspace`). A migration (`20260512000100_delete_soren_canary.sql`) wraps the delete in a `DO $$ ... $$` block that temporarily disables those triggers, deletes the user's workspace + memberships + personal org, re-enables triggers, then deletes the auth.users row.

**Post-delete confirmation:**
```sql
SELECT COUNT(*) FROM auth.users WHERE email='soren@vibeos.com';
-- Result: 0
```
Confirmed via `mcp__postgres__query` after migration applied. Cascade deletes also removed the user_profile row.

**Operator note:** "Soren canary account deleted to allow clean happy-path signup re-testing. The delete pattern is encoded in 20260512000100 for future canary cleanups." — 2026-05-12

## Automated checks (PASS)

| Check | Result |
|-------|--------|
| `npm run type-check` | PASS |
| `npm run lint` on changed files | PASS (no new lint errors on Login.tsx, SetupWizard.tsx, useRequirePaidPlan.ts) |
| `npm test` unit suite | PASS (794 unit tests; pre-existing integration failures unrelated to Phase 31) |
| `npm run build` | PASS (10.27s, no errors) |

## Code-level acceptance criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Login.tsx "Sign up" CTA redirects to https://callvaultai.com/pricing?ref=app | PASS | `handleSignUpCtaClick` calls `window.location.href = 'https://callvaultai.com/pricing?ref=app'` |
| Login.tsx reads `?signup=true&plan={tier}&email={email}` and initializes signup-completion mode | PASS | `useSearchParams()` reads params; `initialMode` set to 'signup' when `signupParam`; email prefilled from `emailParam` |
| Signup-completion sub-heading shows locked "{Plan Name} plan" copy | PASS | `formatPlanName(planParam)` helper added; sub-heading switches based on `signupParam && planParam` |
| vibe-orange RiArrowRightLine after "Sign up" link | PASS | `<RiArrowRightLine className="ml-1 h-4 w-4 text-vibe-orange" aria-hidden="true" />` in mode-switcher |
| useRequirePaidPlan hook composes useSubscription + grandfathered query | PASS | `src/hooks/useRequirePaidPlan.ts` created; soft-fails on missing grandfathered column |
| Hook returns `{ isRequired, isLoading, redirectUrl }` shape | PASS | Type-checked + matches `RequirePaidPlanState` interface |
| SetupWizard wires useRequirePaidPlan + 800ms redirect | PASS | useEffect at line 251 schedules redirect; conditional render added for loading + gate states |
| Payment-gate screen has locked copy ("Choose a plan to continue") + RiLockLine in vibe-orange + "Continue to pricing" hollow button | PASS | JSX matches UI-SPEC literally |
| Soren canary deleted from auth.users | PASS | See top of file |

## Live dev-browser UAT (operator-needed)

- [ ] **Sign-up CTA external redirect:** unauthed `/login` → click "Sign up → view plans" → expect navigation to `https://callvaultai.com/pricing?ref=app`
- [ ] **Post-payment return path UI:** navigate to `https://app.callvaultai.com/login?signup=true&plan=pro&email=test%40example.com` → expect signup form, email prefilled, sub-heading reads `You're on the Pro plan. Set a password to finish.`
- [ ] **Payment gate redirect:** create a fresh signup with throwaway email → wait for trial to be artificially expired (SQL: `UPDATE user_profiles SET subscription_status='free', product_id=null WHERE user_id='<id>';`) → navigate to `/setup` → expect lock-screen ("Choose a plan to continue") for ~800ms → expect redirect to `https://callvaultai.com/pricing?reason=gate&user=...`

## Open assumption (documented per user instruction)

- **Marketing site post-payment redirect contract:** The Phase 31 frontend assumes the marketing site at `callvaultai.com/pricing` redirects post-Polar-checkout to `app.callvaultai.com/login?signup=true&plan={tier}&email={email}`. This is **not currently verified** to be live on the marketing site. If the marketing site doesn't yet redirect with these params, the post-payment account-creation surface won't see traffic. Treat as a marketing-site coordination ticket — the app-side is ready.

## Files touched

- src/hooks/useRequirePaidPlan.ts (new)
- src/pages/Login.tsx (modified — external CTA + signup-completion mode)
- src/pages/SetupWizard.tsx (modified — payment gate)
- supabase/migrations/20260512000100_delete_soren_canary.sql (new — applied to remote)
