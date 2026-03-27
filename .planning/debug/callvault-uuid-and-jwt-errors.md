---
status: investigating
trigger: "Two bugs from production: 1) UUID type mismatch on call_tag_assignments query, 2) Invalid JWT on generate-ai-titles and auto-tag-calls Edge Functions"
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: BOTH ROOT CAUSES CONFIRMED
test: Full codebase trace complete
expecting: Fixes applied and verified
next_action: Apply fixes to both bugs

Bug 1 - UUID mismatch:
  hypothesis: useMeetingsSync.ts passes numeric recording_id directly to call_tag_assignments (which expects UUID after migration 20260310125000)
  confirmed: loadTagAssignments() takes string[] of recording_ids from unsyncedMeetings which are numeric Fathom IDs. syncMeeting() inserts call_tag_assignments with recording_id: meeting.recording_id (also numeric).

Bug 2 - Invalid JWT:
  hypothesis: generate-ai-titles and auto-tag-calls are missing from supabase/config.toml — the Supabase gateway's default verify_jwt=true rejects the token at the gateway level before the function handler runs
  confirmed: config.toml has entries for 13 other functions but NOT generate-ai-titles or auto-tag-calls. These two functions must be added with verify_jwt = true to match the pattern for user-initiated functions.

## Symptoms

expected: AI title generation and auto-tagging should work. Tag assignments query should use correct ID type.
actual:
- GET call_tag_assignments with recording_id=eq.132544116 returns HTTP 400 "invalid input syntax for type uuid"
- POST generate-ai-titles returns HTTP 401 "Invalid JWT"
- POST auto-tag-calls returns HTTP 401 "Invalid JWT"
- 6 console.error entries from the JWT failures
errors:
- DB Error code 22P02: invalid input syntax for type uuid: "132544116"
- HTTP 401: Invalid JWT on generate-ai-titles
- HTTP 401: Invalid JWT on auto-tag-calls
reproduction:
- Bug 1: Viewing a call with numeric recording_id triggers tag assignment lookup with wrong type
- Bug 2: Clicking "Generate AI Titles" or "Auto-Tag with AI" buttons
timeline: Captured 2026-03-27T02:08 on production (app.callvaultai.com)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-26T00:01Z
  checked: useCallDetailQueries.ts lines 263-290
  found: Comment on line 263 says "After migration 20260310125000, call_tag_assignments.recording_id is UUID. Use canonical_uuid when available." The callCategories query correctly guards with `const recordingUuid = call.canonical_uuid ?? (typeof call.recording_id === 'string' ? call.recording_id : null); if (!recordingUuid) return [];`
  implication: The correct fix IS in place for call detail queries. But useMeetingsSync.ts bypasses this guard.

- timestamp: 2026-03-26T00:02Z
  checked: useMeetingsSync.ts lines 131-160 and 328-333
  found: loadTagAssignments() receives recording_ids from unsyncedMeetings.map(m => m.recording_id) — these are numeric Fathom IDs (e.g. "132544116"). It passes them directly to call_tag_assignments.recording_id which now expects UUID. Also syncMeeting() inserts call_tag_assignments with recording_id: meeting.recording_id (also the numeric Fathom ID).
  implication: Bug 1 root cause. Both the tag-loading query and the tag-insert in useMeetingsSync pass numeric IDs to a UUID column.

- timestamp: 2026-03-26T00:03Z
  checked: supabase/config.toml
  found: 13 functions listed with verify_jwt settings. generate-ai-titles and auto-tag-calls are completely absent. All other user-initiated functions are listed with verify_jwt = true.
  implication: Bug 2 root cause. Missing config.toml entries means these functions use Supabase platform defaults. The "Invalid JWT" error is the Supabase gateway rejecting the JWT before the function handler runs.

- timestamp: 2026-03-26T00:04Z
  checked: mapRecordingToMeeting() in useWorkspaces.ts
  found: Workspace recordings correctly set canonical_uuid: recording.id (the UUID). But unsynced meetings from useMeetingsSync don't go through mapRecordingToMeeting — they come directly from Fathom API responses with numeric recording_ids and no canonical_uuid.
  implication: Confirms Bug 1 — useMeetingsSync.ts handles legacy Fathom data paths that never got updated for the UUID migration.

## Resolution

root_cause:
fix:
verification:
files_changed: []
