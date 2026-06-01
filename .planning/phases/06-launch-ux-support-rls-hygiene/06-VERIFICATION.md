---
phase: 06-launch-ux-support-rls-hygiene
verified: 2026-06-01T06:50:40Z
status: gaps_found
score: 7/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "HRD-02 RLS regression guardrails are safe for real-DB execution and isolate test env from production credentials."
    status: failed
    reason: "RLS regression test still falls back to non-test env vars (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), so destructive fixtures can target non-test environments."
    artifacts:
      - path: "src/test/rls-regression.test.ts"
        issue: "Uses fallback chain from *_TEST_* envs to non-test env vars for URL and anon key."
    missing:
      - "Require VITE_SUPABASE_TEST_URL and VITE_SUPABASE_TEST_ANON_KEY explicitly with no production fallback."
  - truth: "Launch data-layer hygiene is complete for credential-handling paths touched by Phase 06."
    status: failed
    reason: "OAuth refresh path writes oauth_access_token/oauth_refresh_token directly into import_sources and user_settings, violating encrypted-token persistence expectations."
    artifacts:
      - path: "supabase/functions/fetch-meetings/index.ts"
        issue: "Refresh flow stores plaintext tokens via direct .update() on import_sources and user_settings."
    missing:
      - "Route refreshed token persistence through shared encrypted token helper used by OAuth callback/encryption path."
  - truth: "MVP-mode verification contract is valid for this phase."
    status: failed
    reason: "ROADMAP phase mode is mvp, but phase goal is not a User Story format; user-story validation fails."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Goal does not match required 'As a..., I want..., so that...' format."
    missing:
      - "Normalize Phase 6 goal to User Story format (or switch mode) before strict MVP-flow verification."
human_verification:
  - test: "Run full first-time flow in browser: landing -> signup -> email verification -> first session -> connect first source -> see first recording -> open support popout -> complete paid upgrade."
    expected: "No dead-end screens, no blank states without CTA, no unhandled errors, no flickering pane transitions."
    why_human: "End-to-end UX behavior, visual states, and external auth/checkout flows are not fully provable via static checks."
  - test: "Complete interceptor walkthrough and inspect browser console/network for full Phase 6 journey."
    expected: "No console errors, no 404s, no broken images."
    why_human: "Requires runtime browser environment and external services."
---

# Phase 6: Launch UX + Support + RLS Hygiene Verification Report

**Phase Goal:** A stranger off the internet can sign up, verify email, connect their first source, get to a working vault, find help when stuck, and upgrade to Pro/Team — all without dead air or dead ends. Data-layer hygiene complete across every user-facing table before public launch.
**Verified:** 2026-06-01T06:50:40Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## User Flow Coverage

MVP mode detected (`mode: mvp`), but `gsd-sdk query user-story.validate` returned `valid: false` for the Phase 6 goal (missing `As a`, `I want to`, `so that`). Coverage below is best-effort and does not satisfy strict MVP user-story framing.

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Trial/setup completion | User is routed into import, not dashboard | `SetupTrialUpsell` builds `/import?...&firstRunVideo=true` and `UpgradeButton successPath={importEntryPath}` | ✓ VERIFIED |
| First-run education | Founder video shown once, then dismissible | `ImportPage` reads `firstRunVideo`, opens `OnboardingVideoModal`, persists `callvault_onboarding_video_seen` | ✓ VERIFIED |
| Historical import intent | User explicitly syncs history with CTA | `ConnectorImportWizard` primary `Sync all`; test asserts no auto-import on OAuth return | ✓ VERIFIED |
| Support access | Sidebar support popout with required actions | `SupportPopover` mounted above settings in sidebar, actions include video/tour/how-it-works/docs/ticket | ✓ VERIFIED |
| Paid feature gate | Inline paywall and route-preserving checkout | `LockedFeatureButton` + `PaywallDialog`; MCPTab uses locked affordances with successPath marker | ✓ VERIFIED |
| Data-layer hygiene | Secure token handling + safe RLS testing | Plaintext refresh storage + risky env fallback remain | ✗ FAILED |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Landing->setup->import onboarding path remains intact (ONB-01/ONB-04) | ✓ VERIFIED | `src/pages/SetupTrialUpsell.tsx`, `src/pages/ImportPage.tsx` route and consume connector context; targeted routing tests pass. |
| 2 | Zero-data surfaces present action-first CTAs (ONB-02) | ✓ VERIFIED | `EmptyStates` uses `Connect a source`; `ImportHistoryPanel` empty state uses `Connect a source`; workspace management keeps create CTA. |
| 3 | Free-tier gated MCP actions show inline paywall and preserve route context (ONB-03) | ✓ VERIFIED | `MCPTab` uses `LockedFeatureButton`; `PaywallDialog` + successPath propagation verified in `paywall-gate` test. |
| 4 | Support popout exists with required actions/docs/ticket (ONB-05) | ✓ VERIFIED | `SupportPopover` action list and docs link; `send-support-ticket` endpoint sends to `support@callvaultai.com` with bounded payload validation. |
| 5 | RLS regression table coverage includes 9 missing tables (HRD-02) | ✓ VERIFIED | `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts` includes all nine required table names. |
| 6 | RLS regression guard does not risk production-like envs | ✗ FAILED | Test URL/key fallback chain includes `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. |
| 7 | Credential handling in phase-touched sync paths remains encrypted-hygienic | ✗ FAILED | `fetch-meetings` refresh path directly updates `oauth_access_token/oauth_refresh_token` in DB. |
| 8 | Fathom remote-update UX state is implemented end-to-end | ✓ VERIFIED | `fetch-meetings` emits `sync_state=updated_remotely`; sync orchestration keeps updated rows visible and refresh action exists. |
| 9 | Phase security review critical findings are resolved | ✗ FAILED | Both critical findings in `06-REVIEW.md` are still observable in code. |
| 10 | MVP-mode verification precondition (user-story goal format) is satisfied | ✗ FAILED | `user-story.validate` result: invalid. |

**Score:** 7/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/pages/SetupTrialUpsell.tsx` | route into import + first-run marker | ✓ VERIFIED | Exists, substantive, and wired via app routing + tests. |
| `src/pages/ImportPage.tsx` | connector selection + first-run video + no auto historical import | ✓ VERIFIED | Consumes params, opens onboarding modal, no automatic connector import call. |
| `src/components/onboarding/OnboardingVideoModal.tsx` | reusable founder modal | ✓ VERIFIED | Dialog + CTA + env URL fallback copy. |
| `src/components/support/SupportPopover.tsx` | anchored support popout with 5 actions | ✓ VERIFIED | Mounted in sidebar bottom, ordered action list present. |
| `supabase/functions/send-support-ticket/index.ts` | authenticated ticket email endpoint | ✓ VERIFIED | Uses `authenticateRequest`, zod validation, Resend send to support mailbox. |
| `src/components/billing/PaywallDialog.tsx` | inline paywall dialog | ✓ VERIFIED | `Upgrade to keep going` + `Not now` + upgrade CTA. |
| `src/components/billing/LockedFeatureButton.tsx` | locked affordance wrapper with successPath | ✓ VERIFIED | Builds route-preserving success path and opens paywall dialog. |
| `src/test/rls-regression.test.ts` | safe real-DB cross-org regression | ⚠️ PARTIAL | Coverage list and fixtures expanded, but env fallback remains unsafe. |
| `supabase/functions/fetch-meetings/index.ts` | updated_remotely detection + secure token refresh writes | ⚠️ PARTIAL | Sync-state logic implemented; refresh token persistence still plaintext updates. |
| `supabase/functions/fathom-refresh/index.ts` | provider refresh preserving local associations | ✓ VERIFIED | Updates provider-owned fields while preserving associations in-place. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `sidebar-nav.tsx` | `SupportPopover.tsx` | component render above settings | WIRED | `SupportPopover` is mounted in bottom section. |
| `SupportTicketDialog.tsx` | `support-ticket.service.ts` | `submitSupportTicket()` | WIRED | Dialog submit invokes service and toast paths. |
| `support-ticket.service.ts` | `send-support-ticket` | `supabase.functions.invoke` | WIRED | Calls function with message/context payload. |
| `send-support-ticket/index.ts` | Resend API | `fetch(https://api.resend.com/emails)` | WIRED | Sends to `support@callvaultai.com`. |
| `MCPTab.tsx` | `LockedFeatureButton.tsx` | locked actions for free tier | WIRED | Pro-gated MCP actions now inline-gated. |
| `LockedFeatureButton.tsx` | `PaywallDialog.tsx` | open dialog on click | WIRED | Wrapper renders paywall + upgrade CTA. |
| `fetch-meetings/index.ts` | Sync tab client | `sync_state`, `recording_uuid`, title fields | WIRED | Response fields consumed in sync orchestration and row UI. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ImportPage.tsx` | OAuth return state and source rows | URL params + `upsertImportSource` + query invalidation | Yes | ✓ FLOWING |
| `SupportPopover`/ticket path | ticket payload | dialog inputs + auth/org context -> Edge Function -> Resend | Yes | ✓ FLOWING |
| `MCPTab` paywall path | `isPaid` + upgrade success path | subscription hook + checkout URL | Yes | ✓ FLOWING |
| `rls-regression.test.ts` | cross-org table assertions | real Supabase fixtures + JWT clients | Yes, but env-safety flaw | ⚠️ STATIC RISK |
| `fetch-meetings/index.ts` | refreshed OAuth tokens | refresh response -> direct DB update | Yes, but insecure persistence | ⚠️ HOLLOW (security gap) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Paywall/support/import-routing unit checks | `npm run test -- --run src/components/billing/__tests__/paywall-gate.test.tsx src/components/ui/__tests__/sidebar-nav.test.tsx src/pages/__tests__/ImportPage.connector-routing.test.ts` | 3 files passed; 9 passed, 31 skipped | ✓ PASS |
| RLS coverage list includes 9 required tables | node script over `src/test/rls-regression.test.ts` | `missing=[]` | ✓ PASS |
| Live RLS integration proof | `npm run test:integration ...` (phase RLS suite) | Not run in this verification (env-gated in provided notes) | ? SKIP |

### Probe Execution

Step 7c: SKIPPED (no phase-declared probes and no `scripts/*/tests/probe-*.sh` found).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| ONB-01 | 06-01, 06-06 | First-run wizard polish and connector sync UX | ✓ SATISFIED | Import landing + onboarding video + explicit sync path present. |
| ONB-02 | 06-03 | Empty states with real CTA | ✓ SATISFIED | Empty-state surfaces updated to actionable CTAs. |
| ONB-03 | 06-04 | Polar paywall gate + upgrade flow | ✓ SATISFIED | Inline locked affordances + paywall dialog + successPath tests. |
| ONB-04 | 06-01 | Public launch chain continuity | ? NEEDS HUMAN | Code wiring exists, but full signup/verify/first-session chain not runtime-verified here. |
| ONB-05 | 06-02 | Support popout + ticket flow | ⚠️ PARTIAL | UI/action set and endpoint exist; metadata spoofing warning remains in review. |
| HRD-02 | 06-05 | RLS cross-org table gap fill | ⚠️ PARTIAL | Required tables covered, but test env guard still unsafe fallback. |

No orphaned phase-6 requirement IDs found between plan frontmatter and `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/test/rls-regression.test.ts` | 24-28 | Fallback to non-test Supabase env vars | 🛑 Blocker | Test can run destructive fixture setup against non-test targets. |
| `supabase/functions/fetch-meetings/index.ts` | 318-333 | Direct storage of refreshed OAuth tokens | 🛑 Blocker | Breaks encrypted-token-at-rest expectation and expands secret exposure risk. |
| `supabase/functions/send-support-ticket/index.ts` | schema/body flow | Trusts client-provided user/org/workspace IDs | ⚠️ Warning | Support metadata can be spoofed by caller payload. |
| `src/hooks/useSyncTabOrchestration.ts` | 331 | `parseInt` legacy ID conversion | ⚠️ Warning | NaN/unsafe values can leak into sync call path. |
| `src/types/meetings.ts` | 75 | `Record<string, any>` in core type | ⚠️ Warning | Weakens type safety and downstream guard reliability. |

### Human Verification Required

### 1. Full Launch Funnel
**Test:** New browser session: `app.callvaultai.com` landing -> signup -> email verification -> first login -> connect source -> first recording visible.
**Expected:** No dead-end screens or blank panes without CTA.
**Why human:** External auth + email verification + multi-screen UX flow.

### 2. Support + Upgrade Journey
**Test:** Open Support popout, use each action, submit ticket, then trigger locked MCP action and complete upgrade.
**Expected:** Support actions are usable; checkout returns to same context with gated action available.
**Why human:** Requires runtime browser/payments integration and visual confirmation.

### 3. Interceptor Stability Sweep
**Test:** Run full flow with console/network monitoring.
**Expected:** No console errors, 404s, broken images, or pane flicker.
**Why human:** Runtime browser/performance observation only.

### Gaps Summary

Phase 06 implemented most UX deliverables and expanded RLS table coverage, but phase goal is not achieved yet due to two security/hygiene blockers still present in code:
1. unsafe env fallback in the RLS regression suite, and
2. plaintext OAuth refresh token persistence in `fetch-meetings`.

Additionally, Phase 6 is marked MVP mode while using a non-User-Story goal format, which violates the MVP verification precondition and should be corrected before strict MVP user-flow verification closure.

---

_Verified: 2026-06-01T06:50:40Z_
_Verifier: the agent (gsd-verifier)_
