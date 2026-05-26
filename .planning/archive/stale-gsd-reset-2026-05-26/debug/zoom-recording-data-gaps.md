---
status: awaiting_human_verify
trigger: "Fix multiple Zoom recording data gaps: host on wrong side, no summary, no participants, invitees showing"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Focus

hypothesis: All four issues are caused by zoom-sync-meetings not setting recorded_by_email/recorded_by_name in source_metadata, not triggering summarize-call, not populating call_participants from transcript speakers, and no UI hide-invitees logic for Zoom
test: Fix source_metadata to include recorded_by_email + recorded_by_name, trigger summarize-call post-sync, extract transcript speakers into call_participants, and hide calendar_invitees display for Zoom source
expecting: Host bubbles appear on the right, summary is generated, participants show from transcript, invitee section hidden for Zoom calls
next_action: Apply all fixes to zoom-sync-meetings/index.ts

## Symptoms

expected: Zoom calls show host on right side, have AI summary, list participants, don't show calendar_invitees
actual: Host always on left (recorded_by_email null), no summary generated, no participants, invitees section shown (empty)
errors: source_metadata has zoom_host_email but NOT recorded_by_email or recorded_by_name — UI reads meta.recorded_by_email, which is null
reproduction: Open any Zoom recording in call detail
started: Always — Zoom sync never set these fields

## Eliminated

- hypothesis: generate-ai-titles handles summaries for Zoom
  evidence: generate-ai-titles only processes fathom_raw_calls with integer IDs — explicitly returns 400 "No valid legacy recording IDs" for Zoom UUIDs
  timestamp: 2026-04-07

- hypothesis: call_participants auto-populates from transcript
  evidence: populate_participants_from_source_metadata trigger reads source_metadata->>'recorded_by_email' — if that key is missing, no host participant is created. Transcript speakers not in scope of that trigger.
  timestamp: 2026-04-07

## Evidence

- timestamp: 2026-04-07
  checked: zoom-sync-meetings/index.ts sourceMetadata object (line 166-177)
  found: Sets zoom_host_email = meeting.host_email but does NOT set recorded_by_email or recorded_by_name
  implication: mapRecordingToMeeting in useWorkspaces.ts reads meta.recorded_by_email → null → host appears on left

- timestamp: 2026-04-07
  checked: useWorkspaces.ts mapRecordingToMeeting (lines 366-367)
  found: recorded_by_email = meta.recorded_by_email, recorded_by_name = meta.recorded_by_name — reads from source_metadata
  implication: Zoom needs to set these same keys in source_metadata

- timestamp: 2026-04-07
  checked: generate-ai-titles/index.ts (lines 385-398)
  found: Filters recordingIds to integers only, returns 400 for UUIDs — zoom synced IDs are UUIDs (meeting UUIDs)
  implication: AI title generation never runs for Zoom. No summary is generated either — no separate post-sync call to summarize-call exists

- timestamp: 2026-04-07
  checked: summarize-call/index.ts
  found: Supports UUID recording_id via recordings table — would work for Zoom if called after sync
  implication: Need to invoke summarize-call (or generate-content) after Zoom sync completes, similar to how AI titles are fired

- timestamp: 2026-04-07
  checked: call_participants migration (populate_participants_from_source_metadata trigger)
  found: Trigger fires on INSERT to recordings, reads source_metadata->>'recorded_by_email'. Transcript-speaker participants NOT auto-created.
  implication: Once recorded_by_email is in source_metadata, the host participant will auto-create. Transcript speakers need explicit insertion in zoom-sync-meetings.

- timestamp: 2026-04-07
  checked: CallOverviewTab.tsx line 80
  found: Shows calendar_invitees?.length for "NUMBER OF INVITEES" — shows 0 for Zoom, which is misleading
  implication: Should hide this row for Zoom source_app or show participant_count instead

- timestamp: 2026-04-07
  checked: VTT transcript format in zoom-sync-meetings
  found: consolidated segments have format "[00:00:02] Andrew Naegele: text" — speaker names extracted during parseVTTWithMetadata → consolidateBySpeaker
  implication: Unique speaker names are available in transcriptSegments. Can insert as call_participants type='speaker' after pipeline runs.

## Resolution

root_cause: zoom-sync-meetings sets zoom_host_email in source_metadata but the UI and participant trigger both read recorded_by_email/recorded_by_name — a naming mismatch. Additionally: (1) no post-sync summary generation, (2) no participant insertion from transcript speakers, (3) UI shows calendar_invitees count for Zoom (always 0).
fix: (1) Add recorded_by_email + recorded_by_name to sourceMetadata in zoom-sync-meetings. (2) After sync, invoke summarize-call for each synced UUID. (3) Insert transcript speaker names into call_participants. (4) Hide invitees row in CallOverviewTab for Zoom source. (5) Patch existing recording via DB update.
verification: pending
files_changed:
  - supabase/functions/zoom-sync-meetings/index.ts
  - src/components/call-detail/CallOverviewTab.tsx
