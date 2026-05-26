---
slug: ci-drift-after-connection
status: resolved
trigger: "CI report shows two test jobs now connecting after b2526c3b workflow repair, but both expose drift: RLS Regression fails because organizations.owner_user_id column doesn't exist (schema drift); E2E API Smoke fails because MCP response is missing the content property (API shape drift)."
created: 2026-05-20T13:36:02Z
updated: 2026-05-20T14:05:00Z
goal: find_and_fix
tdd_mode: false
---

# Debug Session — CI Drift After Connection Repaired

## Symptoms

**Expected behavior:** Both CI jobs (RLS Regression, E2E API Smoke) pass against the configured Supabase + staging environment now that workflow connectivity is repaired.

**Actual behavior:**
- **RLS Regression** (`src/test/rls-regression.test.ts` via `npx vitest run`): connects to Supabase, then fails when inserting into `organizations` because the schema does not have a column named `owner_user_id`.
- **E2E API Smoke** (Playwright `--project=api` → `e2e/mcp-server.spec.ts`): connects to the staging MCP endpoint, then fails because the response body is missing the `content` property (e.g. `expect(result).toHaveProperty('content')` at line 200, 225, 232, 242).

**Error messages (from CI report):**
- "Now CONNECTS, exposes schema drift: organizations.owner_user_id column doesn't exist"
- "Now CONNECTS, exposes API shape drift: response missing content property"

**Timeline:** Surfaced immediately after commit `b2526c3b fix(ci): repair unit test workflow failures` — that commit repaired the connectivity layer, exposing the next failure layer underneath.

**Reproduction:**
- RLS: `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` with `VITE_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` env vars set.
- API Smoke: `npx playwright test --project=api` with `BASE_URL=https://brain-govibey.vercel.app` + `VITE_SUPABASE_*` env.

## Evidence

### Thread 1 — RLS schema drift

- timestamp: 2026-05-20T13:55Z
  source: `supabase/migrations/20260131000005_create_banks_tables.sql:13-20`
  finding: `banks` table created with columns `id, name, type, cross_bank_default, created_at, updated_at`. No `owner_user_id` column.
- timestamp: 2026-05-20T13:55Z
  source: `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql:5`
  finding: `ALTER TABLE banks RENAME TO organizations;` — `organizations` inherits the `banks` schema. Same columns. No `owner_user_id`.
- timestamp: 2026-05-20T13:55Z
  source: `supabase/migrations/20260131000005_create_banks_tables.sql:48-55`
  finding: Owner relationship lives in `bank_memberships` (renamed to `organization_memberships`) with `role` column. Original roles: `bank_owner|bank_admin|bank_member`.
- timestamp: 2026-05-20T13:55Z
  source: `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql:38-44`
  finding: Role values updated: `bank_owner → organization_owner`, `bank_admin → organization_admin`. Final CHECK: `role IN ('organization_owner', 'organization_admin', 'manager', 'member', 'guest')`. Test currently uses `'owner'` — not a valid value.
- timestamp: 2026-05-20T13:56Z
  source: `supabase/migrations/20260131000005_create_banks_tables.sql:16`
  finding: `type TEXT NOT NULL CHECK (type IN ('personal', 'business'))`. Test omits `type` on organizations insert — would fail NOT NULL even if `owner_user_id` were dropped.
- timestamp: 2026-05-20T13:57Z
  source: `src/test/rls-regression.test.ts:124, 139, 153, 156`
  finding: Test inserts `owner_user_id` (does not exist) and uses `role: 'owner'` (not in CHECK constraint). Also omits required `type`.

### Thread 2 — MCP API shape drift

- timestamp: 2026-05-20T14:00Z
  source: `supabase/functions/mcp-server/index.ts:106-120`
  finding: Two response helpers exist. `mcpOk(id, data)` wraps in `result.content[].text`. `mcpJsonResult(id, result)` returns `result` raw — no `content`.
- timestamp: 2026-05-20T14:00Z
  source: `supabase/functions/mcp-server/index.ts:1188-1203`
  finding: `initialize` returns `mcpJsonResult({ protocolVersion, capabilities, serverInfo, instructions })` — NO `content` wrapper. `tools/list` returns `mcpJsonResult({ tools: TOOLS })` — NO `content` wrapper.
- timestamp: 2026-05-20T14:00Z
  source: `e2e/mcp-server.spec.ts:200, 212`
  finding: Test asserts `result.content` for `initialize` and `tools/list`. **Wrong** — these endpoints intentionally return structured JSON directly, not the text-content envelope.
- timestamp: 2026-05-20T14:01Z
  source: `supabase/functions/mcp-server/index.ts:1228-1235, 3911-3913`
  finding: Tool dispatch unwraps `tools/call` method into `params.name`. Bare method names like `callvault/list_workspaces` are NOT in the dispatch switch → fall to `default:` returning `-32601 Method not found` (no `result`, only `error`).
- timestamp: 2026-05-20T14:02Z
  source: `e2e/mcp-server.spec.ts:222, 229, 236, 249`
  finding: Test sends `method: 'callvault/list_workspaces'`, `'callvault/list_calls'`, `'callvault/search_calls'`, etc. — bare prefixed names. These miss the switch, return error, fail `result.content` assertion.
- timestamp: 2026-05-20T14:03Z
  source: `supabase/functions/mcp-server/index.ts:252` + tool count
  finding: TOOLS array has **41 entries**. Test asserts `tools.length === 5` (line 216) — also outdated.
- timestamp: 2026-05-20T14:04Z
  source: Live curl to `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/mcp-server`
  finding: Server is up and routes correctly — confirmed `{"error":{"code":-32001,"message":"Invalid token"}}` on invalid auth. MCP_URL in test is correct (no host drift); the issue is purely test-side method shape and assertion shape.

## Eliminated

- ❌ BASE_URL drift to `mcp.callvaultai.com` — MCP_URL in spec is `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/mcp-server` (direct edge function), not a Vercel host. Hostname change is irrelevant.
- ❌ Auth failure (token shape) — invalid token shape would have been caught in CI before any `result.content` assertion. The reported failure is on the assertion itself, meaning the request *succeeded* (200) but the body lacked `content`.
- ❌ JSON-RPC envelope removal — envelope is intact, but two endpoint classes (`initialize`/`tools/list` vs tool calls) use different `result` shapes, and the test conflates them.
- ❌ Test DB on older schema — `organizations.owner_user_id` was NEVER created in any migration. Not a missing forward migration; it's a phantom column the test author imagined.

## ROOT CAUSE

**Thread 1 (RLS Regression) — test references a column and role values that never existed in the actual schema.**
- `organizations.owner_user_id` doesn't exist (and never did — the table was renamed from `banks`, which had no such column).
- `role: 'owner'` violates the CHECK constraint; valid values are `organization_owner | organization_admin | manager | member | guest`.
- `type` is NOT NULL but omitted from the test's organizations insert.

The test was authored 2026-05-12 (commit `a8749ef6`) against an imagined schema. It never ran successfully on the real DB — it was simply gated off CI by missing secrets until commit `b2526c3b` repaired connectivity.

**Thread 2 (E2E API Smoke) — test method shapes and assertion shapes don't match the actual MCP server implementation.**
- `initialize` and `tools/list` return `result: <structured JSON>` (no `content` wrapper) but test asserts `result.content` for both.
- Tool calls send method `'callvault/<name>'` instead of MCP-spec `'tools/call'` with `params: { name, arguments }` — these fall through to the `default:` arm returning `-32601 Method not found`.
- `tools/list` length assertion is `=== 5` but the actual TOOLS array has 41 entries.

## FIX

### Thread 1 — `src/test/rls-regression.test.ts`

Replace `organizations` inserts (lines 120-148) to:
- drop `owner_user_id` field
- add `type: 'personal'` (NOT NULL)

Replace `organization_memberships` role inserts (lines 153, 156):
- `role: 'owner'` → `role: 'organization_owner'`

### Thread 2 — `e2e/mcp-server.spec.ts`

- Lines 200-206 (`initialize` test): remove `result.content` expectation; assert `result.protocolVersion`, `result.serverInfo` directly.
- Lines 208-217 (`tools/list` test): remove `result.content` expectation; assert `result.tools` array directly; relax length assertion to `>= 5` (or `=== 41` if we want it strict; relaxed is more durable).
- Lines 221-243 (tool tests): change `method: 'callvault/list_workspaces'` etc. to `method: 'tools/call'` with `params: { name: 'list_workspaces', arguments: {...} }`. The bare-name routing was an undocumented shortcut that was either never supported or removed; MCP spec is `tools/call`.

## Resolution

- root_cause: Two independent test-vs-implementation drifts. RLS test was authored against a phantom schema (column + role values that never existed); MCP smoke test was authored against either an older response/dispatch shape or simply imagined wrong (initialize/tools/list use raw-JSON result, not content-wrapped; tool calls require MCP-spec `tools/call` envelope, not bare prefixed names).
- fix: Update both tests to match the actual schema + actual MCP server implementation. No production code changes needed.
- verification: Local vitest + playwright runs (pending live secrets). Static check against migrations + Edge Function source confirms shape matches.
- files_changed:
  - src/test/rls-regression.test.ts
  - e2e/mcp-server.spec.ts
