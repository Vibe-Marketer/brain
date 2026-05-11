---
status: complete
phase: 21-write-crud-tools
source:
  - 21-01-SUMMARY.md
started: 2026-05-07T00:00:00Z
updated: 2026-05-07T13:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Migration `20260507083233_call_notes.sql` is applied to remote.
  The `mcp-server` edge function responds to a `tools/list` MCP request and `create_note`
  appears in the returned tool list. No 500s. No "table call_notes does not exist" errors.
result: pass
verified_by: claude
evidence: |
  - tools/list returned 200 with 38 tools; create_note + get_call_notes present
  - get_call_notes description matches D-13 ("newest first, including author and timestamp")
  - create_note call without auth returns -32001 (auth gate fires before table access)

### 2. Create a note (live MCP client)
expected: |
  From an MCP client connected with a CallVault token, calling `create_note` with
  recording_id + content (and workspace_id for org-scoped tokens) returns a confirmation
  string of the form `Created note on "<title>" (<N> chars)`.
result: pass
verified_by: andrew (via Claude Code MCP)
evidence: |
  Andrew's Claude Code session restarted with mcp__callvault__create_note tool loaded.
  Tool call returned: 'Note added to "Q3 Sales Sync" (Oct 5, 2026, in Testing workspace)'.

### 3. Note appears via get_call_notes
expected: |
  Calling `get_call_notes { recording_id }` immediately after a create_note returns the
  note formatted as `## <author> — <ISO timestamp>\n<content>`.
result: pass
verified_by: claude
evidence: |
  get_call_notes on recording 2fdf6aa5...60f8 returned:
    # Notes: Q3 Sales Sync
    ## Andrew Naegele — 2026-05-07T13:37:30.017704+00:00
    test note

### 4. Create a note (org-scoped token, explicit workspace_id)
expected: |
  Org-scoped token + explicit workspace_id parameter creates the note successfully.
result: pass
verified_by: andrew (via Claude Code MCP)
evidence: |
  Second create_note call (with workspace_id: be66ccd6...c14d3) succeeded after the first
  attempt without workspace_id was rejected.

### 5. Org-scoped token without workspace_id rejected
expected: |
  Org-scoped token + no workspace_id returns MCP error -32602 indicating workspace_id required.
result: pass
verified_by: andrew (via Claude Code MCP)
evidence: |
  First create_note call (recording_id + content only, no workspace_id) failed; Andrew added
  workspace_id on the retry. Behavior matches D-04 boundary check.

### 6. Cross-workspace boundary enforced
expected: |
  workspace_id parameter that doesn't match the recording's actual workspace returns -32001
  access-denied. Note is NOT created.
result: pass
verified_by: claude
evidence: |
  create_note(recording in 'Testing' ws, workspace_id='AI Simple Founders') returned
  -32001: "Recording not found or not accessible".
  Subsequent get_call_notes confirmed only 3 notes (the cross-ws attempt was not inserted).

### 7. Empty content rejected
expected: |
  Whitespace-only content returns MCP error -32602 "content cannot be empty".
result: pass
verified_by: claude
evidence: |
  create_note with content="   " returned: -32602 "content is required and cannot be empty"

### 8. 10,000 char boundary precise
expected: |
  Exactly 10,000 chars passes; 10,001 fails with -32602.
result: pass
verified_by: claude
evidence: |
  - 10000 chars: 'Created note on "Q3 Sales Sync" (10000 chars)' — succeeded
  - 10001 chars: -32602 "content exceeds 10,000 character limit"

### 9. Multiple notes per recording, newest-first ordering
expected: |
  Sequential creates produce notes ordered newest-first in get_call_notes output, separated
  by `\n\n---\n\n`, each block having its own author/timestamp header.
result: pass
verified_by: claude
evidence: |
  Three notes created at 13:37:30, 13:38:50, 13:38:51. get_call_notes returned them in
  reverse-chronological order, separated by `\n\n---\n\n`, each with its own
  `## Andrew Naegele — <ISO>` header.

### 10. Author label correct (display name, not email)
expected: |
  Author label resolves to a friendly identifier (display name), NOT raw UID.
  Note: post-fix (commit 6f9a11f3 "stop leaking author emails to MCP clients"), the
  resolved label is the user's display name from user_profiles, not their email.
result: pass
verified_by: claude
evidence: |
  Header line: `## Andrew Naegele — 2026-05-07T...` — display name resolved correctly
  via user_profiles lookup. No email leakage. No raw UID.

### 11. Legacy workspace_entries.notes column untouched
expected: |
  create_note INSERTs into call_notes (not workspace_entries.notes).
  get_call_notes reads from call_notes only.
result: pass
verified_by: claude
evidence: |
  - get_call_notes block (case 'get_call_notes' to case 'list_shared_calls'):
    1× .from('call_notes'), 0× workspace_entries
  - create_note block: 1× .from('workspace_entries') (recording-ownership check only,
    no insert/update), 1× .from('call_notes').insert({...}) — legacy column not written

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none — all tests passed]

## Notes

- Test data left in production: 4 test notes on recording "Q3 Sales Sync" (workspace 'Testing'),
  including one 10,000-char filler note. Safe to leave or manually delete.
- Token used for verification: "Claude Code Phase 21 UAT" (org-scoped, listed in Settings → AI Integrations).
  Rotate or revoke when no longer needed.
- Post-execution fix shipped during this UAT cycle: commit 6f9a11f3 (`fix(mcp): get_call_notes
  — stop leaking author emails to MCP clients`) — author labels now resolve to display names,
  not emails.
