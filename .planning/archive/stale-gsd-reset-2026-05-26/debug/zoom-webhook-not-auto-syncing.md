---
status: awaiting_human_verify
trigger: "zoom webhook not auto-syncing after meeting this morning"
created: 2026-04-10T13:00:00Z
updated: 2026-04-10T13:15:00Z
---

## Current Focus

hypothesis: connector-pipeline's personal org resolution query returns 2 rows (user is member of 2 'personal' type orgs), causing maybeSingle() to throw, which causes runPipeline to return { success: false } silently — webhook marks itself processed but no recording is stored.
test: confirmed via REST API query that the organization_memberships query returns 2 personal orgs for user 00e0061a-c707-488a-912c-588c2d595387
expecting: fix is to add role=organization_owner filter to narrow to 1 row
next_action: apply fix to connector-pipeline.ts insertRecording and runPipeline, redeploy zoom-webhook

## Symptoms

expected: After a Zoom meeting with cloud recording, the recording should auto-sync to CallVault within minutes
actual: Recording is not appearing — no auto-sync happening
errors: No visible errors in the UI
reproduction: Have a Zoom meeting on naegele412@gmail.com, wait for cloud recording to process, check CallVault
started: 2026-04-10 morning. Zoom connected 2026-04-08, host_email fix deployed same day.

## Eliminated

- hypothesis: zoom-webhook function not deployed
  evidence: supabase functions list shows zoom-webhook ACTIVE v55, updated 2026-04-08
  timestamp: 2026-04-10T13:05:00Z

- hypothesis: host_email not set for the user
  evidence: user_settings query shows host_email=naegele412@gmail.com for user 00e0061a-c707-488a-912c-588c2d595387
  timestamp: 2026-04-10T13:05:00Z

- hypothesis: webhook never arrived from Zoom
  evidence: processed_webhooks contains zoom_recording.transcript_completed_1775824453127_OGl63b4MTF2gwDbjjHp9pw== at 2026-04-10T12:34:14Z (clean entry, no _ERROR suffix)
  timestamp: 2026-04-10T13:08:00Z

- hypothesis: user has no organization or workspace set up
  evidence: organization_memberships shows user owns personal org c9a35ce0-c86e-4fe4-b48b-09ee30bfe826, workspaces show "My Calls" (is_home=true) and "Zoom"
  timestamp: 2026-04-10T13:10:00Z

## Evidence

- timestamp: 2026-04-10T13:05:00Z
  checked: supabase functions list
  found: zoom-webhook is ACTIVE v55 (deployed 2026-04-08 14:16:29)
  implication: function is deployed and responding

- timestamp: 2026-04-10T13:05:00Z
  checked: user_settings REST API query filtering by zoom_oauth_access_token NOT NULL
  found: user_id=00e0061a-c707-488a-912c-588c2d595387 has host_email=naegele412@gmail.com
  implication: host_email is correctly set — webhook routing by email will find this user

- timestamp: 2026-04-10T13:08:00Z
  checked: processed_webhooks table
  found: zoom_recording.transcript_completed_1775824453127_OGl63b4MTF2gwDbjjHp9pw== at 2026-04-10T12:34:14Z with NO _ERROR suffix
  implication: Zoom DID send the webhook, the function DID run, and it completed without the outer catch firing. But recording was not created.

- timestamp: 2026-04-10T13:09:00Z
  checked: recordings table, zoom_raw_calls table, both filtered for this user/zoom
  found: ZERO records in both tables
  implication: runPipeline returned success:false but webhook still marked processed — a per-user error was swallowed in processZoomWebhook's user loop

- timestamp: 2026-04-10T13:10:00Z
  checked: organization_memberships for user 00e0061a
  found: TWO rows, both with organizations.type='personal' — org c9a35ce0 (owner, "Personal") and org 04714fb3 (member, "AI Simple")
  implication: The connector-pipeline query `.eq('organizations.type', 'personal').maybeSingle()` returns 2 rows → throws "JSON object requested, multiple (or no) rows returned"

- timestamp: 2026-04-10T13:11:00Z
  checked: connector-pipeline.ts insertRecording and runPipeline — both use same query pattern
  found: Both resolve personal org with `.eq('organizations.type', 'personal').maybeSingle()` without filtering by role
  implication: Any user who is a MEMBER of another user's personal org will have this query fail

- timestamp: 2026-04-10T13:12:00Z
  checked: added .eq('role', 'organization_owner') filter and tested via REST API
  found: returns exactly 1 row — the correct personal org c9a35ce0 for user 00e0061a
  implication: Fix is validated — filtering by role='organization_owner' correctly isolates user's own org

## Resolution

root_cause: connector-pipeline.ts resolves the user's personal organization by querying organization_memberships WHERE type='personal', using maybeSingle(). When a user is also a member of another org with type='personal' (e.g., they joined another user's personal org as a team member), the query returns multiple rows, causing maybeSingle() to throw. This error is caught per-user in processZoomWebhook and swallowed, so the webhook is marked processed but no recording is ever created.

fix: Add .eq('role', 'organization_owner') to both org resolution queries in connector-pipeline.ts (in insertRecording and in runPipeline). A user is only the owner of their own personal org. This narrows the query to exactly 1 row.

verification: 
files_changed: [supabase/functions/_shared/connector-pipeline.ts]
