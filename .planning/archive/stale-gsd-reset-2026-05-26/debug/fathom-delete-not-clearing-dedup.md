---
status: awaiting_human_verify
trigger: "fathom-delete-not-clearing-dedup"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — deleting from a workspace view only removes the workspace_entries row; the recordings row persists and the dedup check (fetch-meetings) finds it and marks calls "Already imported"
test: Verified by reading delete mutation logic in TranscriptsTab.tsx (line 1281-1288) and fetch-meetings dedup query (line 380-411)
expecting: Fix should make fetch-meetings dedup check account for workspace membership, OR document to users to delete from Home view, OR expose a re-import option
next_action: Fix by allowing re-import when recording exists (skip dedup block) OR note in UI — CHOSEN FIX: show correct label in UI AND allow user to truly delete from recordings if they want to re-import

## Symptoms

expected: After deleting imported calls, searching Fathom again should show them as available to import (not "Already imported")
actual: All 4 calls still show "Already imported" even after deletion. "4 calls found — 0 available to import"
errors: No errors — just incorrect "Already imported" status
reproduction: Import Fathom calls → delete them from the app → go back to Import > Fathom → search same date range → all show "Already imported"
started: Immediately after deleting the calls that were just imported

## Eliminated

- hypothesis: Soft-delete flag in recordings table prevents dedup check from finding deleted rows
  evidence: No deleted_at column or soft-delete pattern in recordings table. The delete from workspace view does NOT touch recordings at all.
  timestamp: 2026-04-14

- hypothesis: Separate fathom_calls or fathom_raw_calls table stores the dedup marker
  evidence: fetch-meetings dedup check only queries recordings table (legacy_recording_id + source_metadata->>'external_id'). fathom_raw_calls is written on import but never read by the dedup check.
  timestamp: 2026-04-14

## Evidence

- timestamp: 2026-04-14
  checked: supabase/functions/fetch-meetings/index.ts lines 379-411
  found: Dedup check queries recordings table via legacy_recording_id AND source_metadata->>'external_id'. Never queries fathom_calls or fathom_raw_calls.
  implication: Any recording row in recordings table = "already imported" for dedup purposes

- timestamp: 2026-04-14
  checked: src/components/transcripts/TranscriptsTab.tsx lines 1281-1288
  found: When deleting from workspace view, deleteMode = 'remove-from-workspace'. This only deletes workspace_entries rows. The recordings row is never touched.
  implication: User thinks they "deleted" the call, but recordings row persists. fetch-meetings still marks it imported.

- timestamp: 2026-04-14
  checked: src/components/transcripts/TranscriptsTab.tsx lines 1194-1256
  found: permanentDeleteMutation (only triggered from Home view) does delete from recordings. But from workspace view, only workspace_entries is deleted.
  implication: Root cause confirmed. User deleted from workspace view = soft remove. fetch-meetings dedup still fires.

## Resolution

root_cause: When a user deletes Fathom calls from a workspace view, the app only removes the workspace_entries row (intentional design — the recording persists in Home). The fetch-meetings dedup check queries the recordings table and finds the recording still present, so it marks the call as "Already imported". The user expects deletion to allow re-import, but the recording was never actually deleted.
fix: In fetch-meetings edge function, extended the dedup check to also fetch recording UUIDs and verify each has at least one workspace_entries row. If a recording exists in recordings but has zero workspace_entries (user removed it from all workspaces), it is now treated as available to re-import. Fails closed on workspace_entries query error to prevent duplicate imports.
verification: Deployed to production via `supabase functions deploy fetch-meetings --use-api`. Awaiting user confirmation.
files_changed: [supabase/functions/fetch-meetings/index.ts]
