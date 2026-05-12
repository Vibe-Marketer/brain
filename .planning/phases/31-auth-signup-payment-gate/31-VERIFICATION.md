---
phase: 31
verified: 2026-05-12
status: code-complete, awaiting-live-uat
---

# Phase 31 — Verification

## Plans completed

| Plan | Status | VERIFY doc |
|------|--------|-----------|
| 31-01 (error mapping + confirmation screen + Toaster duration + migration) | code-complete | 31-01-VERIFY.md |
| 31-02 (CTA redirect + signup-completion + useRequirePaidPlan + SetupWizard gate + Soren delete) | code-complete | 31-02-VERIFY.md |
| 31-03 (AUTH-05 share-token through OAuth) | code-complete (pre-existing fix verified) | 31-03-VERIFY.md |

## Aggregated automated checks

- `npm run type-check` — PASS
- `npm run lint` (changed files) — PASS
- `npm test` — 794 unit tests PASS; 2 pre-existing integration test failures unrelated to Phase 31 (Phase 30 BUG-01 fixture issue)
- `npm run build` — PASS (10.27s)
- Supabase migrations applied: `20260512000000_user_profiles_grandfathered`, `20260512000100_delete_soren_canary` — both confirmed live via `mcp__postgres__query`
- Soren canary deleted (auth.users count = 0)

## Requirements closure

| Req | Status | Implementation |
|-----|--------|----------------|
| AUTH-01 | code-complete | Signup confirmation screen mirrors ForgotPassword pattern; success toast copy locked |
| AUTH-02 | code-complete | "Sign up" CTA redirects to external marketing pricing page; no in-app signup-without-plan path |
| AUTH-03 | code-complete | useRequirePaidPlan + SetupWizard gate redirect non-paid, non-grandfathered accounts |
| AUTH-04 | code-complete | 9 Supabase-Auth-specific error mappings added with locked UI-SPEC copy |
| AUTH-05 | code-complete | pendingShareToken survives OAuth round-trip (pre-existing + documented) |
| QA-19 | done | Soren account deleted from auth.users via migration |
| QA-20 | code-complete | "Invalid login credentials" → "Invalid email or password..." via AUTH-04 mapping |
| QA-21 | resolved | Architectural decision honored — pricing lives on marketing site, app subdomain stays pure |

## Open items requiring operator dev-browser UAT

Per CLAUDE.md HARD RULE, dev-browser verification is mandatory but the dev-browser MCP is unavailable in this orchestrator session. The following surfaces are code-complete and pushed to main (Vercel auto-deploys); operator-side UAT pending:

1. Signup duplicate-email toast copy
2. Signin wrong-password toast copy
3. Signup happy-path confirmation screen
4. Sign-up CTA external redirect
5. Post-payment return path UI rendering
6. Payment gate lock-screen + redirect at /setup
7. Share-token survives Google OAuth round-trip

These are listed individually in each plan's VERIFY.md.

## Open assumption (documented per user instruction)

The Phase 31 frontend assumes the marketing site at `callvaultai.com/pricing` performs the post-Polar-checkout redirect back to `app.callvaultai.com/login?signup=true&plan={tier}&email={email}`. If the marketing site doesn't yet honor this contract, the post-payment account-creation surface won't see traffic. Coordinate or descope as a marketing-site ticket.

## Files changed in this phase

**Frontend code:**
- `src/lib/user-friendly-errors.ts` — 9 new Supabase-Auth-specific mappings
- `src/pages/Login.tsx` — external signup CTA, signup-completion mode reading ?signup params, confirmation screen, vibe-orange arrow on CTA
- `src/App.tsx` — Sonner duration={6000}
- `src/hooks/useRequirePaidPlan.ts` (new) — payment gate hook
- `src/pages/SetupWizard.tsx` — gate enforcement + lock-screen + redirect

**Planning docs:**
- `.planning/phases/31-auth-signup-payment-gate/31-RESEARCH.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-PATTERNS.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-01-PLAN.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-02-PLAN.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-03-PLAN.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-01-VERIFY.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-02-VERIFY.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-03-VERIFY.md` (new)
- `.planning/phases/31-auth-signup-payment-gate/31-VERIFICATION.md` (this file)

**Database:**
- `supabase/migrations/20260512000000_user_profiles_grandfathered.sql` (new — applied)
- `supabase/migrations/20260512000100_delete_soren_canary.sql` (new — applied)

## Conclusion

Phase 31 is **code-complete and deployed-ready**. The user-locked decisions in CONTEXT.md and UI-SPEC.md are honored literally. Live dev-browser UAT remains as the final gate per `human_needed` policy; the operator should run through the 7 numbered tests above on `app.callvaultai.com` after the next Vercel deploy.

Per the `--no-transition` flag, this phase is NOT transitioned to complete in ROADMAP.md / STATE.md.
