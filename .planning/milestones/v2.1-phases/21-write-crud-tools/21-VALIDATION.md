---
phase: 21-write-crud-tools
type: validation
status: filled
date: 2026-05-07
auditor: gsd-nyquist-auditor
test_file: supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts
---

# Phase 21 — Nyquist Validation Report

## Summary

| Metric | Value |
|---|---|
| Gaps audited | 4 (TOOL-05, TOOL-06, TOOL-07, get_call_notes PII fix) |
| Tests created | 48 (across 9 describe blocks) |
| Tests passing | 48 / 48 |
| Implementation bugs found | 0 |
| Status | **GAPS FILLED** |

All four behavioral gaps called out in the audit prompt are now covered by automated tests, executed under vitest, all green. The test file pairs **behavioral simulators** (replicating the case-handler logic against a deeply-mocked supabase client) with **anchor assertions** (regex-scoped reads of the real `mcp-server/index.ts` case blocks) so that drift between the test copy and the deployed code triggers a failure.

## Test Strategy

Edge functions in this repo can't be imported directly into vitest because they import from Deno-style URLs (`https://esm.sh/...`). The existing test convention in `supabase/functions/fetch-meetings/__tests__/rate-limit.test.ts` reimplements the function under test inside the test file. This audit follows that same pattern and adds **anchor tests** as a drift detector:

1. **Behavioral simulators** — `simulateCreateNote`, `simulateGetCallNotes`, `simulateTagCall`, `simulateAddCallToFolder` reimplement the case-handler logic line-for-line. They run against a mock supabase client that records every query (table, filters, order, limit, insert/upsert payloads) so tests can assert what was queried.

2. **Anchor assertions** — read `index.ts` via `readFileSync`, slice each case block by name, and `.toMatch()` against the locked behavior (e.g., `from('user_profiles')`, `NOTE_LIMIT = 50`, `eq('user_id', mcpToken.user_id)`). If someone deletes a check from the deployed code, the anchor test fails even if the simulator copy still passes.

The simulators give true behavioral test coverage (input → output assertions, side-effect verification on the mock). The anchors guard against the simulator drifting from the real implementation.

## Gap-by-Gap Coverage

### Gap 1 — TOOL-05 `create_note`: workspace boundary, content validation, cross-org rejection

| Behavior tested | Test name | Type | Result |
|---|---|---|---|
| Missing recording_id → -32602 | `rejects missing recording_id with -32602` | behavioral | green |
| Empty content (whitespace-only) → -32602 | `rejects empty content with -32602` | behavioral | green |
| Exactly 10,000 chars succeeds | `accepts content of exactly 10,000 chars (boundary)` | behavioral | green |
| 10,001 chars → -32602 | `rejects content of 10,001 chars with -32602` | behavioral | green |
| Org-scoped token without workspace_id → -32602 | `org-scoped token without workspace_id returns -32602` | behavioral | green |
| Org-scoped token with WS from another org → -32001 | `org-scoped token with cross-org workspace_id returns -32001` | behavioral | green |
| Workspace-scoped token rejects mismatched explicit WS → -32602 | `workspace-scoped token rejects mismatched explicit workspace_id with -32602` | behavioral | green |
| Cross-workspace recording_id → -32001, no row inserted | `cross-workspace recording_id returns -32001 (no insert)` | behavioral | green |
| Happy path: row in `call_notes` with token user_id as author | `happy path: inserts into call_notes with token user_id as author` | behavioral | green |
| Client cannot impersonate via params.user_id | `does NOT allow client to override author by passing user_id in params` | behavioral | green |
| Real impl inserts into `call_notes` | anchor test | anchor | green |
| Real impl uses `mcpToken.user_id` (not params.user_id) for author | anchor test | anchor | green |
| Real impl enforces 10,000-char cap with locked message | anchor test | anchor | green |
| Real impl trims content and rejects empty | anchor test | anchor | green |
| Real impl requires workspace_id for org-scoped tokens | anchor test | anchor | green |
| Real impl uses `orgWsIds.includes(explicitWorkspaceId)` boundary check | anchor test | anchor | green |
| Real impl verifies recording in target workspace via `workspace_entries` | anchor test | anchor | green |

**Result:** TOOL-05 fully covered (10 behavioral + 7 anchor = 17 tests). Status: **green**.

### Gap 2 — `get_call_notes` post-PII fix (commit 6f9a11f3)

| Behavior tested | Test name | Type | Result |
|---|---|---|---|
| Reads from `call_notes`, NOT `workspace_entries.notes` | `reads from call_notes (not workspace_entries.notes)` | behavioral | green |
| No author email leaks in response | `does NOT include note authors emails in the response (PII fix)` | behavioral | green |
| Does NOT call `auth.admin.getUserById` | `does NOT call auth.admin.getUserById (post-fix uses user_profiles)` | behavioral | green |
| Single batched `user_profiles` query (5 authors → 1 query) | `uses a single batched user_profiles query (not per-user fan-out)` | behavioral | green |
| Redacts to `User <8char>` when display_name null/empty | `falls back to "User <8char>" when display_name is null/empty` | behavioral | green |
| 50-note response cap | `caps response at 50 notes` | behavioral | green |
| Newest-first ordering | `orders notes newest-first` | behavioral | green |
| Org-scope fan-out via `fetchOrgWorkspaceIds` | `respects org-scope: workspace fan-out via fetchOrgWorkspaceIds` | behavioral | green |
| Real impl queries `call_notes`, not `workspace_entries` | anchor test | anchor | green |
| Real impl queries `user_profiles` for display name | anchor test | anchor | green |
| Real impl does NOT call `auth.admin.getUserById` in this block | anchor test | anchor | green |
| Real impl has `NOTE_LIMIT = 50` and `.limit(NOTE_LIMIT)` | anchor test | anchor | green |
| Real impl uses single batched `.in('user_id', authorIds)` | anchor test | anchor | green |
| Real impl redacts unknown authors as `User <8char>` | anchor test | anchor | green |

**Result:** PII fix fully covered (8 behavioral + 6 anchor = 14 tests). Status: **green**.

### Gap 3 — TOOL-06 `tag_call`: ownership + cross-org

| Behavior tested | Test name | Type | Result |
|---|---|---|---|
| Tag owned by another user → -32001 | `rejects with -32001 when tag belongs to a different user` | behavioral | green |
| Cross-workspace recording (workspace-scoped token) → -32001 | `rejects cross-workspace recording with -32001 (workspace-scoped token)` | behavioral | green |
| Cross-org recording (org-scoped token) → -32001 | `rejects cross-org recording with -32001 (org-scoped token)` | behavioral | green |
| Happy path: upserts `personal_tag_recordings` with token user_id | `happy path: upserts personal_tag_recordings with token user_id` | behavioral | green |
| Missing tag_id → -32602 | `rejects missing tag_id with -32602` | behavioral | green |
| Real impl checks `personal_tags.user_id = mcpToken.user_id` | anchor test | anchor | green |
| Real impl upserts `personal_tag_recordings` with `mcpToken.user_id` | anchor test | anchor | green |
| Real impl branches on `mcpToken.scope` for boundary | anchor test | anchor | green |

**Result:** TOOL-06 fully covered (5 behavioral + 3 anchor = 8 tests). Status: **green**.

### Gap 4 — TOOL-07 `add_call_to_folder` + `remove_call_from_folder`

| Behavior tested | Test name | Type | Result |
|---|---|---|---|
| Cross-org recording_id (workspace-scoped token) → -32001 | `rejects cross-org recording_id with -32001 (workspace-scoped token)` | behavioral | green |
| Cross-org recording_id (org-scoped token) → -32001 | `rejects cross-org recording_id with -32001 (org-scoped token)` | behavioral | green |
| Folder owned by different user → -32001 | `rejects folder owned by different user with -32001` | behavioral | green |
| Happy path: upserts `personal_folder_recordings` with token user_id | `happy path: upserts personal_folder_recordings with token user_id` | behavioral | green |
| Real impl checks `personal_folders.user_id = mcpToken.user_id` (add) | anchor test | anchor | green |
| Real impl branches on token scope and uses `fetchOrgWorkspaceIds` | anchor test | anchor | green |
| Real impl upserts `personal_folder_recordings` with `mcpToken.user_id` | anchor test | anchor | green |
| Real impl checks folder ownership before delete (remove) | anchor test | anchor | green |
| Real impl scopes the delete to `mcpToken.user_id` (defense-in-depth) | anchor test | anchor | green |

**Result:** TOOL-07 fully covered (4 behavioral + 5 anchor = 9 tests). Status: **green**.

## Verification Map

| Task ID | Requirement | Test File | Command | Status |
|---|---|---|---|---|
| TOOL-05 | `create_note` writes to `call_notes` with workspace boundary, content validation, cross-org rejection, workspace_id required for org-scoped tokens | `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` | `npx vitest run supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` | green |
| (post-fix) | `get_call_notes` reads from `call_notes`, redacted authors, no email leak, single batched user_profiles query, 50-note cap, "User <8char>" fallback | same file | same command | green |
| TOOL-06 | `tag_call` applies personal_tags with user_id ownership check + cross-org boundary | same file | same command | green |
| TOOL-07 | `add_call_to_folder` + `remove_call_from_folder` cross-org boundary | same file | same command | green |

## Run Output

```
Test Files  1 passed (1)
     Tests  48 passed (48)
  Start at  14:57:11
  Duration  1.61s
```

## Files for Commit

- `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` (new — 48 tests, ~620 LOC)
- `.planning/phases/21-write-crud-tools/21-VALIDATION.md` (this file — separate commit per workflow)

## Notes on Coverage Limits (transparency)

- **Tests are not against the deployed code.** They run a behavioral simulator that reimplements the case-handler logic. Anchor tests mitigate this by asserting the real `index.ts` contains every locked check (regex-scoped to each case block). If the implementation drifts, the anchor fails. End-to-end coverage against the deployed edge function is provided by `21-UAT.md` (11/11 tests passed against the live MCP endpoint).
- **No test exercises the auth/plan-gate path.** Those guards run upstream of the case-blocks (D-01) and are out of scope for this phase's behavioral gaps. They are tested implicitly by the UAT cold-start smoke test ("create_note call without auth returns -32001").
- **RLS policies are not exercised.** The edge function uses service role and bypasses RLS by design. RLS is defense-in-depth for any future client-side query and would require a Postgres-level test harness.
