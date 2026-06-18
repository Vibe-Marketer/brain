---
status: resolved
trigger: "New customer signup receives confirmation email, confirms email, lands on https://app.callvaultai.com/setup, then sees the custom error page."
created: "2026-06-12T13:30:33Z"
updated: "2026-06-12T13:42:00Z"
---

# Debug Session: signup-email-confirmation-setup

## Symptoms

- expected_behavior: "A new customer can sign up, confirm email, land on /setup, and continue onboarding without an error page."
- actual_behavior: "After email confirmation, the browser lands on app.callvaultai.com/setup and renders the app's custom error page."
- error_messages: "Console only shows a Supabase Realtime websocket closing before establishment and PaywallConfigurationProvider state-change logs."
- timeline: "Reported 2026-06-12. User successfully received and confirmed the signup email before the /setup failure."
- reproduction: "Create a new customer account, click the email confirmation link, follow the redirect to https://app.callvaultai.com/setup."

## Current Focus

- hypothesis: "The reported failure was transient client-side state/stale runtime rather than broken signup provisioning or a persistent /setup route crash."
- test: "Production DB checks plus Playwright checks against the real app for a generated confirmed signup, a generated email-confirmation redirect to /setup, and the reported account."
- expecting: "If signup is currently broken, one of the controlled production browser checks should show the same custom error page or a pageerror."
- next_action: "none"
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: "2026-06-12T13:32:15Z"
  observation: "Production index for https://app.callvaultai.com/setup returns HTTP 200 and current bundle index-CggZiTjA.js, matching the user's console asset."
- timestamp: "2026-06-12T13:32:30Z"
  observation: "Recent production signup row for andrew@clickableimpact.com exists, confirmed at 2026-06-12T13:26:34.095Z, onboarding_completed=false, product_id=pro-trial, subscription_status=trialing, one Personal org, one My Calls workspace."
- timestamp: "2026-06-12T13:34:00Z"
  observation: "Production handle_new_user() is present and provisions user_profiles, FREE role, Personal organization, organization_owner membership, My Calls workspace, workspace_owner membership, and MCP token."
- timestamp: "2026-06-12T13:36:00Z"
  observation: "Controlled production test: created confirmed throwaway user, signed in through https://app.callvaultai.com/login, redirected to /setup, rendered setup wizard with My Calls workspace, no console/page errors. Test user cleaned up."
- timestamp: "2026-06-12T13:40:00Z"
  observation: "Controlled production test: generated Supabase signup confirmation link with redirectTo=https://app.callvaultai.com/setup, visited action link, final URL /setup#, rendered setup wizard with My Calls workspace, no console/page errors. Test user cleaned up."
- timestamp: "2026-06-12T13:42:00Z"
  observation: "Reported account check via admin-generated magic link to /setup rendered the setup wizard with My Calls workspace and no console/page errors. No onboarding actions were clicked."
- timestamp: "2026-06-12T13:42:00Z"
  observation: "Direct Sentry API token returned 403, and no Sentry-created tickets matching setup/error were present in production tickets table for the last 24 hours."

## Eliminated

- hypothesis: "Signup trigger failed to create profile/org/workspace rows."
  evidence: "Reported account and controlled test accounts had the expected profile, trial, org, and workspace state."
- hypothesis: "The deployed /setup route always crashes for new confirmed users."
  evidence: "Both confirmed-login and email-confirmation-link production repros rendered /setup successfully with no pageerror."
- hypothesis: "The reported account's current backing state crashes /setup."
  evidence: "The reported account rendered /setup successfully in production via magic-link session."

## Resolution

- root_cause: "No persistent server-side signup or /setup route failure reproduced. Most likely transient stale client/runtime state in the original browser session after confirmation, or an unreported browser-specific exception not present in Sentry/tickets."
- fix: "No source fix applied. Production signup provisioning and /setup rendering are currently healthy."
- verification: "Production DB checks; Playwright production confirmed-login repro; Playwright production email-confirmation-link repro; Playwright production reported-account /setup check."
- files_changed: ".planning/debug/signup-email-confirmation-setup.md"
