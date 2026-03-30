---
status: awaiting_human_verify
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

root_cause: |
  Bug 1 (UUID mismatch): useMeetingsSync.ts passed numeric Fathom recording IDs (e.g. 132544116) directly to call_tag_assignments.recording_id, which was migrated to UUID type in migration 20260310125000. Two call sites were affected: (1) loadTagAssignments() queried call_tag_assignments with numeric IDs from unsynced meetings, (2) syncSingleMeeting() inserted into call_tag_assignments with meeting.recording_id (numeric).

  Bug 2 (Invalid JWT): generate-ai-titles and auto-tag-calls were missing from supabase/config.toml. For local dev, this means Supabase uses platform defaults. Adding them with verify_jwt = true matches the explicit pattern used by all other user-initiated functions and ensures consistent behavior. NOTE: The production 401 on app.callvaultai.com may have an additional root cause if v1 connects to a different Supabase project (JWT from a different project would be invalid for this project's gateway). This cannot be investigated without v1 codebase access.

fix: |
  Bug 1: In useMeetingsSync.ts:
  - loadTagAssignments(): added early return when all IDs are numeric (unsynced meetings have no UUID yet — can't have UUID-keyed call_tag_assignments entries). For mixed/UUID-only lists, only queries with UUID IDs.
  - syncSingleMeeting(): after inserting fathom_calls, looks up recordings.id via legacy_recording_id to get the UUID, then inserts call_tag_assignments with the UUID. Logs error and skips gracefully if UUID not found.

  Bug 2: In supabase/config.toml:
  - Added [functions.generate-ai-titles] verify_jwt = true
  - Added [functions.auto-tag-calls] verify_jwt = true

verification: TypeScript compiles with zero errors. Both fix sites reviewed and logic confirmed correct.
files_changed:
  - src/hooks/useMeetingsSync.ts
  - supabase/config.toml
