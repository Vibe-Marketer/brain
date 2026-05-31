# Onboarding Trial Upsell Plan

Date: 2026-05-29

## Circleback Reference

Observed with Interceptor on Circleback public signup/pricing flow:

1. Public CTAs consistently route to signup with trial language:
   - Homepage CTA: "Start for free"
   - Pricing headline: "Try it for free. Subscribe if you love it."
   - Individual and Team plan CTAs: "Start for free"
2. Signup is low-friction:
   - Single screen: "Let's get started"
   - Google and Apple first
   - Email fallback second
   - Legal copy only at the bottom
3. Email signup sends a six-digit verification code.
4. After verification, authenticated onboarding uses a visible 12-step rail:
   - Step 1: profile and company context.
   - Step 2: acquisition attribution.
   - Step 3: language defaults.
   - Step 4: meeting locations/platforms.
   - Step 5: recommended capture method.
   - Step 6: meeting defaults.
   - Step 7: calendar connection.
   - Step 8: upcoming meeting review after calendar connection.
   - Step 9: post-meeting notes sharing defaults.
   - Step 10: individual vs team segmentation.
   - Step 11: free trial activation pitch.
   - Step 12: not reached; trial checkout was blocked until payment details were supplied.
5. Step 7 requires calendar connection:
   - Google Calendar
   - Outlook
   - No visible skip option was exposed in the accessibility tree.
6. Step 8 confirms the calendar connection:
   - Shows the next few meetings.
   - Each meeting has an on/off toggle for whether Circleback will join.
7. Step 9 sets sharing defaults:
   - Me.
   - Everyone invited.
8. Step 10 segments usage:
   - On my own.
   - With my team.
   - Team selection is framed with "Get an extra free 7 days to try it out with your team."
9. Step 11 is the trial pitch:
   - "Better-than-human notes, minutes away"
   - "Try free for 7 days. Cancel anytime."
   - Feature bullets: AI-written notes, transcription accuracy, video playback, cross-meeting Q&A.
   - CTA: "Activate free trial ->"
10. Clicking trial activation opens an in-flow checkout confirmation:
   - "Try Circleback"
   - "7 days free"
   - "$0.00 due today"
   - "$25 per month starting June 5, 2026"
   - Timeline: today full access, day 5 reminder email, day 7 subscription starts unless canceled.
   - "Start trial" remained disabled until payment details were provided.
11. Pricing emphasizes a simple trial-led conversion:
   - Individual: $20.83/user/month annualized
   - Team: $25/user/month annualized
   - Trial is the primary CTA, not a secondary billing settings path.

## CallVault Current State

Relevant implementation details:

1. New users already receive a 7-day Pro trial in `handle_new_user()`:
   - `subscription_status = 'trialing'`
   - `product_id = 'pro-trial'`
   - `current_period_end = now() + interval '7 days'`
2. `useSubscription()` already treats active `pro-trial` as Pro.
3. `SetupWizard` currently completes onboarding and navigates directly to `/import`.
4. Polar checkout already exists through:
   - `UpgradeButton`
   - `polar-checkout` edge function
   - `POLAR_PRODUCT_IDS.PRO_MONTHLY` and `PRO_ANNUAL`

## Target Flow

1. User signs up.
2. User lands in `/setup`.
3. User answers lightweight context questions:
   - role/company context
   - where calls live
   - default import/sync preference
4. User connects one or more sources:
   - Fathom
   - Zoom
   - Fireflies
   - Read.ai
5. Instead of going directly into `/import`, the final setup action routes to a new trial conversion step.
6. Trial step explains:
   - Their Pro trial is active.
   - Connected sources will start syncing future calls where supported.
   - Historical calls are still manually selected/imported.
   - Pro unlocks unlimited imports, workspaces, MCP/external AI access, and 1,000 AI actions/month.
7. Primary CTA starts checkout for Pro.
8. Secondary CTA lets the user enter the app without checking out.

## Circleback Patterns To Borrow Carefully

1. Show progress as discrete steps.
   - Circleback makes the length explicit with a 12-step rail.
   - CallVault should keep this shorter, likely 4-5 steps, because our product already has source-specific OAuth friction.
2. Ask context before integration.
   - Circleback asks enough to personalize defaults before asking for calendar access.
   - CallVault can ask "Where are your calls recorded?" before showing connector setup.
3. Convert the setup choices into defaults.
   - Circleback uses meeting defaults to determine what its bot joins.
   - CallVault should use answers to preselect providers, explain historical import vs future sync, and choose a starting source.
4. Pair forms with outcome previews.
   - Circleback shows sample meetings/notes beside relevant steps.
   - CallVault should show a compact "What happens next" preview: future calls sync automatically, past calls remain manually selectable.
5. Do not copy the 12-step length directly.
   - Circleback can justify more steps because it is configuring an active meeting assistant.
   - CallVault should optimize for faster source connection and trial conversion.
6. Put trial activation after value setup.
   - Circleback asks for context, connects calendar, shows real upcoming meetings, then asks for trial activation.
   - CallVault should similarly ask for/connect sources first, show what was connected or what will be importable, then show the Pro trial conversion screen.
7. Make trial economics explicit before checkout.
   - Circleback states due today, trial length, paid start date, reminder timing, and refund/cancel language.
   - CallVault should show due today, trial end date, monthly price, and what happens if the user skips checkout.

## Proposed Routes

Add a full-page onboarding route:

- `/setup/trial`

This route should be auth-protected and outside the normal app layout, matching `/setup`.

Behavior:

- If the user is already paid and not just `pro-trial`, show "You're all set" and continue to app.
- If the user is on active `pro-trial`, show Pro trial upsell.
- If the user is free because trial expired or was not provisioned, show a stronger "Start Pro" upgrade screen.
- If the user arrived without connecting any source, still allow checkout but show "Connect sources next" secondary copy.

## UI Contract

The trial step should be visually calmer than the connector screen:

- Left side: concise trial narrative and connected source summary.
- Right side: Pro plan card.
- Primary button: "Continue with Pro"
- Secondary button: "Enter CallVault"
- Optional annual toggle:
  - Default monthly for less friction.
  - Offer annual as small savings copy, not as a blocker.

Avoid showing all three plan cards during first-run onboarding. This step should sell Pro, not make the user parse the whole billing page.

## Implementation Steps

1. Add `SetupTrialUpsell.tsx`.
   - Use `useSubscription()`.
   - Use `useImportSources()`.
   - Use `UpgradeButton` or a thin checkout helper around the same Polar edge function.
   - Use `completeOnboarding()` only when the user clicks checkout or enters the app.

2. Update `SetupWizard`.
   - Rename final action from "Continue to import" to "Continue".
   - Change `handleFinish()` to navigate to `/setup/trial` instead of `/import`.
   - Keep connector state localStorage intact until the trial step completes.

3. Add route in `App.tsx`.
   - `/setup/trial` with `ProtectedRoute`, no `Layout`.

4. Update OAuth return allowlist.
   - Add `/setup/trial` only if connector OAuth needs to return there later.
   - For current flow, connector OAuth should still return to `/setup`.

5. Update onboarding completion semantics.
   - `/setup` should not mark onboarding complete.
   - `/setup/trial` marks onboarding complete when:
     - checkout starts successfully, or
     - user chooses "Enter CallVault".

6. Update Polar checkout success URL.
   - Add optional `successPath` support to `polar-checkout`.
   - From onboarding checkout, use `/import?trial=started` or `/settings?tab=billing&trial=started`.
   - Prefer `/import?trial=started` so the user lands where their connected calls/imports live.

7. Add tests.
   - Setup wizard routes to `/setup/trial`.
   - Trial page renders Pro trial state.
   - Trial page starts checkout with Pro monthly product ID.
   - Trial page secondary action completes onboarding and enters `/import`.
   - Existing Fathom, Fireflies, Zoom, Read.ai connector tests still pass.

8. Verify with Interceptor.
   - New-user preview can reach `/setup?preview=new-user`.
   - Connecting/skipping routes to `/setup/trial`.
   - Trial screen layout fits desktop and mobile.
   - Checkout button invokes `polar-checkout`.
   - Secondary button enters app.

## Notes

- Do not alter Plaud behavior in this work.
- Keep Grain hidden.
- Do not reintroduce external marketing pricing redirects from app signup.
- Historical source imports remain manual; future call sync remains automatic where supported.
