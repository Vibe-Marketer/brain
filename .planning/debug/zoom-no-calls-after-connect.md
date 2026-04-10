---
status: awaiting_human_verify
trigger: "zoom-no-calls-after-connect"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:01:00Z
---

## Current Focus

hypothesis: TWO independent bugs confirmed:
  1. zoom-oauth-callback NEVER calls Zoom /me API to fetch host_email, so host_email stays null → webhook routing fails silently
  2. zoom-oauth-callback does NOT trigger an initial sync — user must manually use ZoomImportDetail to fetch+select+import
test: Compare zoom-oauth-callback vs fathom-oauth-callback line-by-line — confirmed fathom auto-fetches user email and sets host_email; zoom does not
expecting: Fix = add host_email auto-detection to zoom-oauth-callback (call Zoom /me API after token exchange)
next_action: Fix zoom-oauth-callback to auto-set host_email from Zoom /me API; also verify ZoomImportDetail works (the manual import path)

## Symptoms

expected: After connecting Zoom OAuth, the app should sync/pull in the user's Zoom cloud recordings and show them as calls in the transcripts pane
actual: Zoom shows as "connected" in the Accounts tab, but zero calls appear — nothing was synced
errors: No visible error messages — it just silently shows nothing
reproduction: Connect Zoom via Settings > Accounts on the naegele412@gmail.com user account, observe no calls appear
started: First time connecting Zoom on this second account. The Zoom integration works on the primary account.

## Eliminated

- hypothesis: OAuth token wasn't saved
  evidence: UI shows "connected" which reads from zoom_oauth_access_token in user_settings — token was definitely stored
  timestamp: 2026-04-07

- hypothesis: zoom-fetch-meetings doesn't work
  evidence: That function reads from user_settings by user_id and fetches from Zoom API — it would work fine if called. The problem is the user never got to the import step.
  timestamp: 2026-04-07

## Evidence

- timestamp: 2026-04-07
  checked: zoom-oauth-callback/index.ts
  found: After storing tokens (step 11), it returns success immediately. It never calls Zoom API to get the user's email/profile. It never sets host_email in user_settings.
  implication: host_email stays null for this user → zoom-webhook processZoomWebhook() does `.eq('host_email', hostEmail)` lookup → finds zero users → never routes new recordings to them

- timestamp: 2026-04-07
  checked: fathom-oauth-callback/index.ts lines 148-232
  found: After storing tokens, Fathom callback calls Fathom API `/meetings?limit=1`, extracts `recorded_by.email`, then calls `save-host-email` logic inline to set `host_email` in user_settings if not already set.
  implication: Fathom auto-sets host_email on connect; Zoom does not — this is the asymmetry causing the issue

- timestamp: 2026-04-07
  checked: zoom-webhook/index.ts lines 428-444
  found: processZoomWebhook() looks up users with `.eq('host_email', hostEmail)`. If no user has that host_email, it logs "No users found with host_email" and throws an error — zero users get the recording.
  implication: Even when a new Zoom recording comes in via webhook, it can't route to the second account because host_email is null

- timestamp: 2026-04-07
  checked: ZoomImportDetail.tsx + OAuthCallback.tsx
  found: After OAuth success, user is redirected to /import?source=zoom&connected=true. ZoomImportDetail shows a manual search UI — user must pick a date range, click "Search Zoom", select recordings, pick a workspace, then click "Import". There is no auto-import on first connect.
  implication: Even for manual import (not webhooks), user must actively go through the ZoomImportDetail flow. The problem is user never did this, or the import page didn't clearly guide them.

- timestamp: 2026-04-07
  checked: zoom-oauth-callback vs fathom-oauth-callback
  found: fathom-oauth-callback also auto-detects account email and stores it as source.account_email in import_sources. zoom-oauth-callback stores nothing in import_sources — it only writes to user_settings zoom_oauth_* fields.
  implication: Zoom account email is not tracked anywhere, so the import header cannot show which account is connected

## Resolution

root_cause: zoom-oauth-callback never called Zoom's /users/me API after token exchange, so host_email was never set in user_settings. The zoom-webhook function routes incoming recordings by querying user_settings WHERE host_email = hostEmail — with host_email null, no user matched and all webhooks silently failed. Additionally, Zoom has no auto-sync on first connect; the user must manually go to Import > Zoom, pick a date range, select recordings, and import.
fix: |
  1. Added Zoom /users/me call to zoom-oauth-callback after storing tokens. Detects account email and sets host_email in user_settings if not already set. Also returns accountEmail in the response so the frontend can display which account is connected.
  2. Manually patched host_email = 'naegele412@gmail.com' for the existing second-account user (ID 00e0061a) via REST API since they connected before the fix.
  3. Deployed updated zoom-oauth-callback via `supabase functions deploy zoom-oauth-callback --use-api`.
verification: Awaiting user confirmation that (a) new Zoom recordings appear automatically via webhook, and (b) the Import > Zoom flow works to pull in historical recordings.
files_changed:
  - supabase/functions/zoom-oauth-callback/index.ts
