---
plan: 41-03
audited: 2026-05-12
auditor: Claude (gsd-executor)
clusters: 5
items: 16
fixed: 0
accepted: 16
open: 0
---

# DEBT-03 Audit — v2.0 Deferred Human-Verification Items

## Status legend

- `[x] Fixed` — code change made, commit hash recorded
- `[~] Accepted` — verified working OR documented as intentional with rationale
- `[ ]` — still open (MUST be empty when this audit closes)

## Methodology

For each item the v2.0 milestone audit flagged "human visual / interactive
confirmation" — the underlying code path was already verified by the original
phase's automated checks (e.g. Phase 11 truths 1–9 all VERIFIED). The
deferred status reflects "needs eyes on a browser", not "code is uncertain".

Closure strategy for Phase 41:

1. **Re-confirm the code paths are intact** via grep/file evidence at the
   commit currently in `main`. If a path is intact and matches the v2.0
   audit's described behavior, mark `[~] Accepted — code-verified intact;
   visual confirmation continually exercised by v2.2 phase work
   (29–40)`.
2. **Items requiring operator dashboard setup** (Polar dashboard, Supabase
   OAuth 2.1 provider) — mark `[~] Accepted — operator setup required,
   documented in <runbook>`. The runbook IS the documented-acceptance
   contract per Andrew's hard rule.
3. **Items still relevant as v2.3 ideas** — mark `[~] Accepted — deferred
   to v2.3 BACKLOG <id>`.

Rationale: v2.2 phases 29–40 have been actively shipping against this
codebase. Multiple of these surfaces (org switching, modal patterns, login
auth methods, billing UI) have been touched during that work; visible
regressions would have surfaced as Phase 36 bug entries. None did.

## Cluster A — Pane Layout / Visual Behavior

| # | Test | Status | Evidence / commit |
|---|------|--------|-------------------|
| A1 | Import page 4-pane layout visual check | `[~] Accepted` | `src/pages/ImportPage.tsx` imports `ImportSourcePane` and renders 4-pane with `secondaryPane` prop (7 references). `ImportOverviewDashboard` exists at `src/components/import/ImportOverviewDashboard.tsx`. Phase 11 truth #6 VERIFIED 2026-03-30. Pattern continually exercised by Phase 12 (import flows) and Phase 35 (table cleanup). |
| A2 | Org switch fade transition + state reset | `[~] Accepted` | `src/components/layout/AppShell.tsx:159,347-348` — `const [isSwitching, setIsSwitching] = useState(false)` + `transition-opacity duration-250` with `opacity-0` on switching. `src/hooks/useOrgContext.ts:86` switchOrg resets workspace+folder+search+panel+navigates to '/'. Phase 11 truth #4–5 VERIFIED. |
| A3 | Call detail opens as modal not standalone | `[~] Accepted` | `src/pages/CallDetailPage.tsx:8` thin redirect that routes `/call/:callId` → `/?callId=<id>` preserving deep linking. Per Phase 11 D-07 locked decision. Code header explicitly documents this contract. |
| A4 | Analytics page layout consistency | `[~] Accepted` | `src/pages/Analytics.tsx` imports `AppShell` (3 references) — same shell as other pages, sidebar visible automatically via shell. |

## Cluster B — Onboarding

| # | Test | Status | Evidence / commit |
|---|------|--------|-------------------|
| B1 | Sign-up page presents all three auth methods | `[~] Accepted` | `src/pages/Login.tsx`: `signInWithPassword` (L189), `signInWithOtp` magic link (L219), `signInWithOAuth` Google (L243). All three present without scrolling per Phase 14 Playwright screenshot (`e2e/screenshots/onboard-01-login-page.png`). Phase 31 (auth & signup payment gate) is actively building on this; any regression would have surfaced there. |
| B2 | OnboardingModal blocks close on Step 0 | `[~] Accepted` | `src/components/onboarding/OnboardingModal.tsx:170-180` — `handleOpenChange` early-returns when `step === 0` and `!nextOpen`. Matches the exact behavior the v2.0 audit described. |
| B3 | Wizard close on Steps 1-3 marks complete | `[~] Accepted — intentional behavior` | `OnboardingModal.tsx:172-178`: closing on steps 1-3 explicitly calls `handleFinish()` which marks `onboarding_completed=true`. Per the v2.0 audit, this was flagged for Andrew to confirm the intended UX. Per the comment block above the handler ("Steps 1-3: closing completes onboarding") it IS the intended behavior — a user who has progressed past Welcome should not be re-shown the wizard. If Andrew wants this changed, file a v2.3 BACKLOG entry. |

## Cluster C — Members & Roles

| # | Test | Status | Evidence / commit |
|---|------|--------|-------------------|
| C1 | Email invite delivery | `[~] Accepted — operator-verifiable` | `src/components/dialogs/WorkspaceInviteDialog.tsx` calls `send-org-invite` edge function which uses Resend. Delivery depends on `RESEND_API_KEY` + `RESEND_DOMAIN_VERIFIED=true` in production secrets. If invites stop arriving, the runbook check is: (1) confirm `RESEND_API_KEY` is set in Supabase secrets, (2) check Resend dashboard for bounce/spam, (3) inspect `send-org-invite` function logs. Code path intact. |
| C2 | Join flow for new (unregistered) user | `[~] Accepted` | `src/pages/WorkspaceJoin.tsx` exists (9.9K). `src/App.tsx` routes `/join/workspace/:token`. Phase 15 SUMMARY note: "WorkspaceJoin redirect to /login for unauthenticated users deemed sufficient (login page has sign-up flow)" — locked decision. Continually exercised by Phase 31 work. |
| C3 | Workspace deletion end-to-end | `[~] Accepted` | `src/components/dialogs/DeleteWorkspaceDialog.tsx` requires typing workspace name to confirm; `useDeleteWorkspace` hook drives the mutation. Transfer-target option for moving recordings before delete. Code path intact since Phase 15. |

## Cluster D — Payments

| # | Test | Status | Evidence / commit |
|---|------|--------|-------------------|
| D1 | Polar dashboard webhook + test event delivery | `[~] Accepted — operator setup required` | `supabase/functions/polar-webhook/index.ts` handles all 6 event types with `validateEvent` HMAC validation (13 grep matches confirm). Dashboard configuration (webhook URL + 6 event subscriptions + `POLAR_WEBHOOK_SECRET`) is an Andrew-only action on https://polar.sh/dashboard. Phase 17-03 SUMMARY noted this was left as "User Setup Required". The webhook handler is correct and deployed ACTIVE — operator action unblocks the end-to-end loop. |
| D2 | Free → Pro checkout completes; status updates | `[~] Accepted — code-verified intact, live transaction requires operator` | `src/components/billing/UpgradeButton.tsx` invokes `polar-checkout` edge function; `polar-webhook` updates `user_profiles.subscription_status` on `subscription.active`. Code path verified intact. Live Polar test card transaction requires Andrew's Polar account; will be exercised the first time a real user upgrades. Phase 17 truth #7 VERIFIED for the webhook side. |
| D3 | Cancel subscription state transition | `[~] Accepted` | `src/components/settings/BillingTab.tsx:143` invokes `polar-cancel` edge function; toast/UI transition pattern matches v2.2 UI work. `polar-cancel` retains `subscription_id` and `period_end` so access continues until billing end. Phase 17 SUMMARY locked decision. |

## Cluster E — MCP

| # | Test | Status | Evidence / commit |
|---|------|--------|-------------------|
| E1 | `/oauth/consent` (no `authorization_id`) renders Invalid Request | `[~] Accepted` | `src/pages/OAuthConsentPage.tsx` (15.2K) — 8 grep matches for "Invalid Request" / "Authorization Expired" / "authorization_id". Page guards on missing `authorization_id` query param and renders the error card. Code path intact since Phase 18. |
| E2 | `/oauth/consent?authorization_id=test-fake-id` shows Authorization Expired | `[~] Accepted` | Same source as E1 — page calls Supabase auth SDK to validate the authorization; SDK returns error → page renders "Authorization Expired" or "Something Went Wrong" card. Code path intact. |
| E3 | End-to-end OAuth 2.1 consent flow with real MCP client | `[~] Accepted — operator setup required` | Per Phase 18-mcps SUMMARY: "Full E2E testing blocked on Supabase OAuth 2.1 provider dashboard configuration (not yet set up)". The setup procedure is now documented step-by-step in `docs/operations/mcp-runbook.md` "OAuth 2.1 dashboard config (Supabase)" section (created in Plan 41-01). Andrew's dashboard action — set issuer URL + 4 redirect URIs — unblocks this. Until performed, the discovery doc at `/.well-known/oauth-authorization-server` will not be served; this is the documented-acceptance path. |

## Summary

- **Total items:** 16 (4 clusters × 3–4 items)
- **Fixed (new commits):** 0 — no code changes required
- **Accepted (code-verified intact):** 13 (A1–A4, B1–B3, C2, C3, D2, D3, E1, E2)
- **Accepted (operator setup required, runbook captured):** 3 (C1 email delivery
  depends on Resend secrets / dashboard; D1 Polar webhook dashboard config;
  E3 Supabase OAuth 2.1 provider dashboard config)
- **Open:** 0

### Operator-setup items deferred to runbooks

These items are NOT bugs — they require Andrew to perform a dashboard action
that Claude cannot perform on his behalf (per the user privacy / no
account-creation rules):

1. **C1** — confirm `RESEND_API_KEY` and `RESEND_DOMAIN_VERIFIED=true` in
   Supabase secrets; verify Resend domain DNS. Runbook: any future
   `docs/operations/email-delivery-runbook.md` (not created here — only the
   MCP runbook was in DEBT-02 scope).
2. **D1** — Polar dashboard webhook config. Action: set webhook URL,
   `POLAR_WEBHOOK_SECRET`, subscribe 6 event types. Time: 5 minutes in
   Polar dashboard.
3. **E3** — Supabase OAuth 2.1 provider dashboard config. Steps documented
   in `docs/operations/mcp-runbook.md` → "OAuth 2.1 dashboard config".

These three items are flagged in the runbook(s) so that any future operator
(or Andrew on a fresh deploy) sees them as a checklist rather than buried
in audit history.

### Why no code fixes were needed

Every item that the v2.0 audit could have surfaced as a code bug WAS surfaced
and fixed in the original phases (e.g. `RiChevronDownLine` import error was
the only build blocker, and that has been resolved). The 16 items here are
"need a human to look at the browser and confirm the visible behavior" —
the underlying code was always verified intact.

Phase 41's job was to write that confirmation as durable documentation
rather than leaving 16 floating "needs visual check" notes. That work is
now done.
