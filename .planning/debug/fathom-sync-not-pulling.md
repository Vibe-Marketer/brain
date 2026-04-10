---
status: diagnosed
trigger: "fathom-sync-not-pulling — New Fathom recordings not auto-syncing into CallVault"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:10:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — three separate but compounding root causes found
test: Full code + migration read of webhook handler, oauth-refresh, fathom-oauth-callback, sync-meetings, connector-pipeline, and migration history
expecting: N/A — investigation complete
next_action: return diagnosis

## Symptoms
<!-- IMMUTABLE after filling -->

expected: New Fathom recordings should auto-sync into CallVault via webhooks
actual: Recent Fathom calls are not appearing — no new calls synced
errors: No visible error messages
reproduction: Check the transcripts/calls list — recent Fathom recordings are missing
started: Was working before, stopped syncing recently (last day or two)

## Eliminated

- hypothesis: Tokens expired in import_sources and no refresh happens
  evidence: fathom-oauth-refresh writes tokens back to user_settings only, but sync-meetings and fetch-meetings read from import_sources first — confirmed below as a real issue, not eliminated
  timestamp: 2026-04-07T00:10:00Z

## Evidence

- timestamp: 2026-04-07T00:05:00Z
  checked: migration 20260403170000_delete_user_naegele412.sql
  found: auth.users row for naegele412@gmail.com (UUID 2cb229ba-a701-48b1-95f7-49d2579b7966) was hard-deleted via ON DELETE CASCADE on 2026-04-03
  implication: Any import_sources rows, user_settings rows, and webhook_secrets that belonged to that user ID were cascade-deleted. If the Fathom OAuth connection was stored under that user ID it is now gone entirely.

- timestamp: 2026-04-07T00:05:00Z
  checked: migration 20260403180000_multi_fathom_account_support.sql
  found: Ran same day as the delete. Moves OAuth tokens FROM user_settings INTO import_sources. Migration attempts to copy tokens: UPDATE import_sources SET oauth_access_token=... FROM user_settings WHERE ims.user_id=us.user_id. But the delete ran FIRST (170000 < 180000) so by the time the copy ran, the naegele412 row in user_settings was already gone via cascade.
  implication: If the working Fathom connection belonged to naegele412@gmail.com, the migration found nothing to copy and import_sources for the surviving account has no tokens.

- timestamp: 2026-04-07T00:06:00Z
  checked: supabase/functions/fathom-oauth-refresh/index.ts
  found: refreshOAuthTokens() writes refreshed tokens only to user_settings (lines 60-66). It does NOT write back to import_sources.
  implication: After the multi-fathom migration moved tokens into import_sources, any automatic token refresh silently writes to the wrong table. import_sources.oauth_access_token stays stale/expired forever even after a successful refresh cycle.

- timestamp: 2026-04-07T00:07:00Z
  checked: supabase/functions/sync-meetings/index.ts and fetch-meetings/index.ts credential resolution
  found: Both functions now resolve creds in priority order: (1) import_sources by sourceId, (2) first active fathom import_sources row, (3) user_settings legacy fallback. They use the access token from import_sources if found — even if it is expired — before falling back to user_settings.
  implication: If import_sources has a stale/null token and user_settings has the refreshed one, the functions may pick up a null/expired token from import_sources and attempt a refresh. After the refresh they store the new token in user_settings (fathom-oauth-refresh) but not back into import_sources, so the next call faces the same stale token again.

- timestamp: 2026-04-07T00:08:00Z
  checked: supabase/functions/webhook/index.ts — processMeetingWebhook (lines 256-286)
  found: Webhook handler looks up which user to sync to by matching meeting.recorded_by.email against user_settings.host_email. If host_email is not set in user_settings for the current (surviving) user, the webhook throws: "Cannot process webhook: Host email not found in user settings."
  implication: If the naegele412 account was the one with host_email set, and the surviving primary account's user_settings.host_email is null or set to a different email, every incoming Fathom webhook is rejected silently (logged as error, returns 401 to Fathom which likely stops retrying).

- timestamp: 2026-04-07T00:09:00Z
  checked: fathom-oauth-callback/index.ts — auto-set host_email logic (lines 214-232)
  found: The callback auto-sets host_email in user_settings IF host_email is currently null. But this only runs during a fresh OAuth connect flow — it does not backfill host_email for an existing connected user.
  implication: After the naegele412 deletion, the surviving user's host_email may be unset or point to the wrong email. New webhooks arrive with recorded_by.email = fathom account holder's email, find no matching host_email in user_settings, and are dropped.

## Resolution

root_cause: |
  Three compounding issues broke Fathom sync on or around 2026-04-03:

  ROOT CAUSE A — Host email mismatch breaks webhook delivery (MOST LIKELY cause of "no new calls"):
    The webhook handler (webhook/index.ts, processMeetingWebhook) exclusively identifies the target user by matching meeting.recorded_by.email against user_settings.host_email. The naegele412@gmail.com account was deleted. If that account held the host_email that matched the Fathom recorder's email, every subsequent webhook is rejected with "Host email not found in user settings" and returns 401 to Fathom. Fathom likely stops delivering (or the deliveries all fail silently).

  ROOT CAUSE B — Token migration left import_sources with null tokens after naegele412 deletion:
    Migration 20260403180000 attempted to copy OAuth tokens from user_settings → import_sources AFTER migration 20260403170000 deleted the naegele412 user (with cascade). If the Fathom tokens lived on the naegele412 row, the copy step found nothing to migrate and import_sources.oauth_access_token is null for the surviving account. Manual sync (fetch-meetings / sync-meetings) also fails because no valid credentials exist.

  ROOT CAUSE C — fathom-oauth-refresh writes tokens back to user_settings only, not import_sources:
    After the multi-fathom migration moved canonical token storage to import_sources, the refresh function (fathom-oauth-refresh/index.ts lines 60-66) still writes refreshed tokens only to user_settings. This creates a perpetual stale-token cycle for import_sources rows, preventing any background token refresh from fixing the expired token situation.

fix: (not applied — diagnose-only mode)
  1. Identify the surviving user's auth.users ID and ensure user_settings.host_email is set to the Fathom recorder's email address.
  2. Re-run the Fathom OAuth connect flow (or manually update import_sources.oauth_access_token / oauth_refresh_token) to restore a valid token for the surviving user's import_sources row.
  3. Fix fathom-oauth-refresh/index.ts to also write refreshed tokens to import_sources (look up by user_id + source_app='fathom', update that row too).

verification:
files_changed: []
