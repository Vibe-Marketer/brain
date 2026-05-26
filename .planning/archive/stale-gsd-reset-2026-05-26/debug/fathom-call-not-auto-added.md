---
status: fixed
trigger: "I need to figure out exactly why a call I had yesterday that was recorded using Fathom.. it showed in the search when I searched for it, but for some reason it didn't come through automatically like it should have. It should have been added to my library automatically, but was not."
created: 2026-05-20T00:00:00-04:00
updated: 2026-05-20T10:15:00-04:00
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: Confirmed — Fathom never delivered a webhook for the call, and the daily reconcile fallback was failing because the cron command resolved a NULL URL/secret from missing DB settings
test: Live production SQL against recordings, fathom_raw_calls, webhook_deliveries, cron.job_run_details, and manual fathom-reconcile invocation
expecting: The May 19 call should now exist in recordings + workspace_entries, and the scheduled reconcile job should use a non-null function URL and secret
next_action: Decide whether to normalize host_email ownership for andrew@aisimple.co across duplicate user rows

## Symptoms
<!-- IMMUTABLE after filling -->

expected: A Fathom-recorded call from May 19, 2026 should have been added to the CallVault library automatically.
actual: The call appeared when searched for, but it was not added to the library automatically.
errors: No error messages were reported by the user.
reproduction: Search for the Fathom call from May 19, 2026; verify it appears in search results while absent from the automatically populated library.
started: Observed for a call that happened on May 19, 2026.

## Eliminated

## Evidence

- timestamp: 2026-05-20T14:02:54Z
  checked: production DB connectivity
  found: Connected to Supabase production through the pooler; direct DB host was unreachable from this network, pooler worked.
  implication: Live production state could be inspected directly.

- timestamp: 2026-05-20T14:03:00Z
  checked: May 19, 2026 Fathom raw + canonical recordings
  found: `AI for CRE Masterclass` / Fathom recording_id `147763308` existed in `fathom_raw_calls` and `recordings` only after `2026-05-20T13:58:36Z`.
  implication: The call was not inserted by the original May 19 webhook path; it was repaired later.

- timestamp: 2026-05-20T14:04:00Z
  checked: `recordings.source_metadata` for recording_id `147763308`
  found: `source_metadata.import_source = fathom-reconcile`; the canonical recording has one `workspace_entries` row.
  implication: The library row was created by reconcile, not webhook/manual sync, and it is now visible in the library.

- timestamp: 2026-05-20T14:05:00Z
  checked: `webhook_deliveries` and `processed_webhooks` for recording_id `147763308`
  found: Zero webhook delivery rows and zero processed webhook rows for the call.
  implication: CallVault did not receive a Fathom webhook for this recording.

- timestamp: 2026-05-20T14:06:00Z
  checked: `cron.job_run_details` for `fathom-daily-reconcile`
  found: Daily reconcile failed on May 16, 17, 18, 19, and 20 at 07:00 UTC with NULL URL / NULL secret in `net.http_post`.
  implication: The fallback that should recover missed Fathom webhooks was disabled by missing DB-level `app.supabase_url` / `app.reconcile_secret` settings.

- timestamp: 2026-05-20T14:08:00Z
  checked: `cron.job` after repair
  found: `fathom-daily-reconcile` is active at `0 7 * * *`, points directly at `/functions/v1/fathom-reconcile`, and no longer depends on `current_setting(...)`.
  implication: Tomorrow's scheduled fallback should no longer fail for NULL DB settings.

- timestamp: 2026-05-20T14:10:00Z
  checked: manual authenticated `fathom-reconcile` invocation
  found: Edge function returned `success: true`, iterated 11 active sources, and completed the request shape used by cron.
  implication: The deployed function and repaired scheduler auth/path are valid.

- timestamp: 2026-05-20T14:12:00Z
  checked: recent orphan counts
  found: Last 30 days: `fathom_raw_calls` without matching `recordings` = 0; Fathom `recordings` without `workspace_entries` = 0.
  implication: No current 30-day Fathom mirror/library gaps remain after reconcile.

- timestamp: 2026-05-20T14:13:00Z
  checked: user_settings/import_sources for the user owning recording_id `147763308`
  found: Owner `7942f09e-b718-44d5-821b-082d5d3d8868` has active Fathom API-key source and webhook_secret, but blank `host_email`. Two other user rows have `host_email = andrew@aisimple.co`.
  implication: Even if an andrew@aisimple.co webhook arrives, host-email routing is ambiguous and may not target the same library/account that Fathom API search/reconcile uses.

## Resolution

root_cause: |
  The specific May 19, 2026 call (`AI for CRE Masterclass`, Fathom recording_id `147763308`) did not enter the library at call time because the webhook path never ran for it: production has no `webhook_deliveries` or `processed_webhooks` row for that recording.

  The fallback path also failed. `fathom-daily-reconcile` had been failing every day at 07:00 UTC because its cron command depended on `current_setting('app.supabase_url', true)` and `current_setting('app.reconcile_secret', true)`, both of which were unset in production. That generated a NULL URL/secret and prevented the daily reconciliation job from calling `fathom-reconcile`.

  A related config issue remains: the account that owns the now-visible library row (`andrew@aisimple.co`, user_id `7942f09e...`) has an active Fathom source and webhook secret but no `host_email`; `host_email = andrew@aisimple.co` is attached to two other user rows. Webhook routing is therefore not aligned with the account/library used by Fathom API search/reconcile.

fix: |
  Repaired the production `fathom-daily-reconcile` cron job so it no longer depends on missing DB settings. The job is active at `0 7 * * *` and points directly at the deployed `fathom-reconcile` function with the configured reconcile secret.

  Ran an authenticated reconcile request manually. The missing call is now in `recordings`, linked from `fathom_raw_calls.canonical_recording_id`, and has one `workspace_entries` row.

verification: |
  - `recordings.legacy_recording_id = 147763308` exists with `source_metadata.import_source = fathom-reconcile`.
  - Matching `fathom_raw_calls` row has `canonical_recording_id = 9ab232c7-c837-480d-90dc-47e0d2d4d088`.
  - Matching recording has `workspace_entries` count = 1.
  - Manual `fathom-reconcile` invocation returned `success: true`.
  - Last 30 days: 0 `fathom_raw_calls` without matching `recordings`; 0 Fathom `recordings` without `workspace_entries`.

files_changed:
  - .planning/debug/fathom-call-not-auto-added.md
