# Phase 8: Full-Suite Test Recovery - Research

**Researched:** 2026-06-10
**Domain:** Vitest test harness, Edge Function test format, MCP tool registry, React component provider wiring
**Confidence:** HIGH

---

## Summary

`npm test` has 5 failing files and 17 failing tests. Every failure has a known, concrete root cause with a mechanical fix. No behavior changes are needed — only test harness corrections and expectation updates to match what the product code already does.

The failures split cleanly into four categories:

1. **Deno/Vitest format mismatch** — one Edge Function shared-utility test file still uses a bespoke `Deno.test`-based runner built by hand before the project adopted Vitest. The global `Deno` shim in `src/test/setup.ts` stubs `Deno.env` but does NOT stub `Deno.test`, so every call throws at runtime. The fix is a mechanical conversion to standard Vitest `describe`/`it` calls.

2. **Stale tool-count expectations** — `mcp-tool-categories.test.ts` was written when there were 41 tools (17 read + 12 write + 8 admin + 4 ai). Phase 4 added 4 write tools (`ingest_transcript`, `append_to_transcript`, `update_call_metadata`, `set_speakers`), raising the real count to 45 total and 16 write tools. The source files (`src/lib/mcp-tool-categories.ts` and `supabase/functions/_shared/mcp-tool-categories.ts`) are already correct at 45/16. The tests are stale. The byte-match assertion also fails because the test hardcodes `expect(a.length).toBe(41)` after comparing the two files.

3. **Missing auth/org context providers** — `MCPTab.permissions.test.tsx` mocks all hooks that MCPTab imports directly but misses `@/hooks/useMcpOAuthGrants`, which is imported by MCPTab and internally calls `useAuth()`. Since no `AuthProvider` wraps the render, React throws. The same root issue caused `IntegrationsTab.test.tsx` to fail: `IntegrationsTab` renders `<ApiTokensSection />`, which uses `useApiTokens` and `useOrganizations` — both of those hooks call `useAuth()` internally. The fix in both cases is adding a `vi.mock('@/hooks/useMcpOAuthGrants', ...)` / `vi.mock('@/hooks/useApiTokens', ...)` / `vi.mock('@/hooks/useOrganizations', ...)` stub before the component import, following the exact pattern already used in `McpConnectionsTab.test.tsx`.

4. **Fathom adapter fixture drift** — `fathom.test.ts` was written before `mapItem` was extended with four new normalized fields (`syncState`, `recordingUuid`, `localTitle`, `remoteTitle`). The test's `expect(result).toEqual(...)` snapshot is missing these fields, so the deep-equal fails. The source `fathom.ts` adapter is correct. The test fixture just needs the 4 missing fields added.

**Primary recommendation:** Each failing file needs exactly one targeted fix. No production code changes are required. All five fixes are test-only.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vitest test harness (jsdom) | Browser / Client (simulated) | — | Component tests render in jsdom; providers must be provided or mocked |
| Edge Function unit tests | API / Backend (Deno shimmed) | — | Deno.test shim not provided; Vitest globals handle the test lifecycle |
| MCP tool registry (canonical) | API / Backend | Frontend mirror | Canonical file lives in `_shared/`; frontend mirrors it manually |
| Test provider wiring | Browser / Client | — | Hooks that call useAuth need either AuthProvider wrap or full vi.mock |

---

## Project Constraints (from CLAUDE.md)

- **Package manager:** `npm` only — no pnpm, no bun
- **Icons:** `@remixicon/react` only — no Lucide
- **No AI/LLM code in frontend** (AI-02)
- **Tech stack locked:** React 18, Vite 5, TanStack Query, Zustand v5, Vitest
- **Direct-main workflow** — no PR branches unless explicitly requested
- **Verify before claiming done** — must run `npm test`, `npm run type-check`, `npm run build` and see green

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | `connector-function-utils.test.ts` runs under Vitest without Deno.test | Deno.test shim gap identified; Vitest pattern confirmed from vtt-parser.test.ts |
| SC-2 | `MCPTab.permissions.test.tsx` mounts without `useAuth must be used within AuthProvider` | Root cause: missing `vi.mock('@/hooks/useMcpOAuthGrants')`; fix pattern confirmed from McpConnectionsTab.test.tsx |
| SC-3 | `IntegrationsTab.test.tsx` mounts and renders adapter panels | Root cause: `ApiTokensSection` uses `useApiTokens`/`useOrganizations` which call `useAuth`; fix by mocking both hooks |
| SC-4 | MCP tool-category tests expect 45-tool surface and 16 write tools, byte-match still passes | Source files already at 45/16; test hardcodes 41/12; update test expectations only |
| SC-5 | Fathom adapter tests include `syncState`, `recordingUuid`, `localTitle`, `remoteTitle` | Source `fathom.ts` already emits these; test fixture missing 4 fields; add them |
| SC-6 | `npm test`, `npm run type-check`, `npm run build` all green | Gate for phase completion |
</phase_requirements>

---

## Standard Stack

### Test Framework (already installed — no new packages needed)

| Library | Version | Purpose |
|---------|---------|---------|
| Vitest | 4.x | Test runner (all tests) |
| `@testing-library/react` | 16.x | Component render + queries |
| `@testing-library/jest-dom` | — | `toBeInTheDocument()` etc. |
| `@testing-library/user-event` | 14.x | User interaction simulation |

**No new package installs required.** All fixes use the existing test infrastructure.

---

## Package Legitimacy Audit

No external packages are installed by this phase.

---

## Architecture Patterns

### How Vitest Edge Function tests work in this project

Edge Function utilities in `supabase/functions/_shared/` are imported by Vitest under jsdom. The global setup at `src/test/setup.ts` provides:

```typescript
// Deno env shim — allows importing _shared/* modules
if (!globalThis.Deno) {
  globalThis.Deno = { env: { get: (key) => process.env[key] } };
}
```

This shim ONLY provides `Deno.env`. It does NOT provide `Deno.test`. The correct pattern for `_shared/__tests__/*.test.ts` is plain Vitest `describe`/`it`/`expect` — as used in every other test in that directory (`vtt-parser.test.ts`, `grain-connector.test.ts`, etc.).

**Reference pattern** (`supabase/functions/_shared/__tests__/vtt-parser.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { extractVTTMetadata } from '../vtt-parser';

describe('extractVTTMetadata', () => {
  it('returns nothing for a VTT with no NOTE blocks', () => {
    const meta = extractVTTMetadata(vtt);
    expect(meta).toEqual({});
  });
});
```

### How component test provider wiring works

Components that use hooks which call `useAuth()` internally must either:

**Option A (preferred — test-level mock):** Mock the hook at the import path before the component import:
```typescript
vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  useMcpOAuthGrantsList: () => ({ grants: [], isLoading: false, error: null }),
  useRevokeMcpOAuthGrant: () => ({ mutate: vi.fn(), isPending: false }),
}));
```

**Option B (heavier — full provider wrap):** Wrap in `<AuthProvider>` with a mocked Supabase client. This is used by `FoldersTab.integration.test.tsx` but is overkill for unit tests.

The project's established preference is Option A — mock the hook, not the auth layer. `McpConnectionsTab.test.tsx` is the canonical reference for this pattern.

### How to mock `@/contexts/AuthContext` directly (fallback)

If a component calls `useAuth()` itself (not via a hook we can mock), mock the context:
```typescript
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' }, session: null, loading: false }),
}));
```
This pattern is documented in `TESTING.md` under "Common mocked modules."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Deno test runner inside Vitest | Custom Deno.test shim | Standard Vitest `describe`/`it`/`expect` |
| Auth provider in unit tests | Spinning up real AuthContext | `vi.mock('@/contexts/AuthContext')` or mock the hook that calls useAuth |
| New fixtures for adapter shape | Writing out the full expected object manually from scratch | Read `mapItem` in `fathom.ts` and add the 4 missing fields to the existing fixture |

---

## Detailed Fix Map (per failing file)

### Fix 1: `connector-function-utils.test.ts`

**File:** `supabase/functions/_shared/__tests__/connector-function-utils.test.ts`

**Problem:** The file defines its own `describe`/`it` wrappers where `it` calls `Deno.test(name, fn)`. When Vitest runs the file, `Deno.test` is `undefined` because the setup shim only provides `Deno.env`.

**Evidence from reading the file:**
```typescript
function it(name: string, fn: () => void | Promise<void>) {
  Deno.test(name, fn);  // Line 18 — this throws
}
```

**Fix:** Remove the inline `describe`/`it`/`expect`/`assertDeepEqual`/`assertMatchObject` hand-rolled implementations (lines 13–90). Replace the file header with standard Vitest imports:
```typescript
import { describe, it, expect } from 'vitest';
```

Replace `expect(value).resolves.toEqual(x)` calls (which use the custom hand-rolled `.resolves` implementation) with Vitest's native `await expect(promise).resolves.toEqual(x)`.

Replace `expect(value).rejects.toBeInstanceOf(ErrorClass)` with Vitest's `await expect(promise).rejects.toBeInstanceOf(ErrorClass)`.

Replace `expect(value).rejects.toThrow(message)` with Vitest's `await expect(promise).rejects.toThrow(message)`.

Replace `toMatchObject` assertions with Vitest's native `expect(obj).toMatchObject(subset)`.

**Preserved:** The `createMockSupabase` / `MockQuery` helpers at the bottom (lines 384–444) are pure JavaScript — they don't use Deno and don't need changing.

**Key insight:** The hand-rolled wrappers were written to make the file dual-runnable under both Deno (which has `Deno.test`) and Vitest. The dual-runner approach is now moot — this file is only run by Vitest. Removing the wrappers and using native Vitest APIs is cleaner and gives better error messages.

**Verification:** `npx vitest run supabase/functions/_shared/__tests__/connector-function-utils.test.ts`

---

### Fix 2: `mcp-tool-categories.test.ts`

**File:** `src/lib/__tests__/mcp-tool-categories.test.ts`

**Problem:** Tests hardcode expectations from the Phase 23 tool surface (41 total, 12 write). The actual source files were updated in Phase 4 to 45 tools (adding 4 write tools). The test expectations are stale.

**Actual current tool counts (verified by reading both source files):**

| Category | Count | Tools |
|----------|-------|-------|
| read | 17 | search_calls, list_calls, get_transcript, get_recording_context, list_workspaces, list_contacts, get_contact, get_contact_calls, list_folders, get_folder_calls, list_tags, get_tagged_calls, list_speakers, get_speaker_calls, get_action_items, get_call_notes, list_shared_calls |
| write | 16 | rename_call, delete_call, move_calls_to_workspace, copy_calls_to_organization, add_call_to_folder, remove_call_from_folder, tag_call, untag_call, create_note, create_share_link, revoke_share_link, import_youtube_video, **ingest_transcript**, **append_to_transcript**, **update_call_metadata**, **set_speakers** |
| admin | 8 | create_folder, rename_folder, delete_folder, create_tag, rename_tag, delete_tag, create_organization, create_workspace |
| ai | 4 | extract_action_items, ask_call, get_sentiment, get_coaching_notes |
| **Total** | **45** | |

**Both frontend and canonical sibling are already at 45 tools and in sync.** [VERIFIED: reading source files directly]

**Test lines that must change:**

| Line | Current assertion | Correct assertion |
|------|-------------------|-------------------|
| 29 | `toHaveLength(41)` (TOOL_CATEGORIES total) | `toHaveLength(45)` |
| 40–44 | `toHaveLength(12)` (write tools) | `toHaveLength(16)` |
| 146 | `toHaveLength(41)` (TOOL_DESCRIPTIONS total) | `toHaveLength(45)` |
| 222 | `expect(a.length).toBe(41)` (byte-match) | `expect(a.length).toBe(45)` |

**Note:** The 4 new write tools (`ingest_transcript`, `append_to_transcript`, `update_call_metadata`, `set_speakers`) are already present in the test's "contains every D-06 write tool" assertion list (lines 88–104). Only the COUNT assertions need updating. The `it.skip` on TOOL_DESCRIPTIONS byte-match stays skipped (pre-existing drift, tracked separately).

**Test lines that stay correct:** 17 read tools, 8 admin tools, 4 ai tools, D-12 category descriptions, callvault/ prefix checks — all pass today.

**Verification:** `npx vitest run src/lib/__tests__/mcp-tool-categories.test.ts`

---

### Fix 3: `MCPTab.permissions.test.tsx`

**File:** `src/components/settings/__tests__/MCPTab.permissions.test.tsx`

**Problem A — missing hook mock:**
`MCPTab.tsx` imports `useMcpOAuthGrantsList` and `useRevokeMcpOAuthGrant` from `@/hooks/useMcpOAuthGrants` (line 37). `useMcpOAuthGrantsList` calls `useAuth()` at line 31. The test mocks every OTHER hook MCPTab uses but not this one. When React renders MCPTab, `useMcpOAuthGrantsList` executes, hits `useAuth()`, and throws because there is no `AuthProvider` in the test render tree.

**Problem B — stale tool count expectations:**
The test checks `renders correct counts per category section: 17/12/8/4` (line 188-193) and `renders ALL 41 tools` (line 174). Current surface is 45 tools with 16 write tools. The `TOOL_CATEGORIES` import at line 120 already imports the live 45-tool map, so `Object.keys(TOOL_CATEGORIES)` will have 45 keys — the `renders ALL 41 tools` test title and the text it generates will be correct once we also fix the count display check.

**Fix A:** Add before the `MCPTab` import:
```typescript
vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  useMcpOAuthGrantsList: () => ({ grants: [], isLoading: false, error: null }),
  useRevokeMcpOAuthGrant: () => ({ mutate: vi.fn(), isPending: false }),
}));
```

**Fix B:** Update count expectations:
- Line 174: test description update is cosmetic only ("renders ALL 41 tools" can stay as-is since TOOL_CATEGORIES is imported live and the test iterates it)
- Line 189: `expect(text).toMatch(/\(16\)/)` for write (was `\(12\)`)
- Total: the counts in the section headers MCPTab renders come from `Object.keys(TOOL_CATEGORIES).filter(...)` — once the mock is added and MCPTab renders successfully, the section headers will show (17), (16), (8), (4). The test text-matching on line 190 must change from `\(12\)` to `\(16\)`.

**Reference:** `McpConnectionsTab.test.tsx` lines 50-53 show the exact mock shape needed.

**Verification:** `npx vitest run src/components/settings/__tests__/MCPTab.permissions.test.tsx`

---

### Fix 4: `IntegrationsTab.test.tsx`

**File:** `src/components/settings/__tests__/IntegrationsTab.test.tsx`

**Problem:** `IntegrationsTab` renders `<ApiTokensSection />`. `ApiTokensSection` calls `useApiTokensList` (from `@/hooks/useApiTokens`) and `useOrganizations` (from `@/hooks/useOrganizations`). Both of those hooks call `useAuth()` internally (confirmed by reading their source). The test mocks `@/hooks/useOrganizations` (line 64-71) but does NOT mock `@/hooks/useApiTokens`. The `useApiTokensList` hook in `useApiTokens.ts` calls `useAuth()` at line 34, causing the throw.

**Additional missing mock:** `useOrganizations` IS mocked (line 64) but `useApiTokensList`, `useGenerateApiToken`, and `useRevokeApiToken` from `@/hooks/useApiTokens` are NOT mocked.

**Fix:** Add before the `IntegrationsTab` import:
```typescript
vi.mock('@/hooks/useApiTokens', () => ({
  useApiTokensList: () => ({ tokens: [], isLoading: false, error: null }),
  useGenerateApiToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeApiToken: () => ({ mutate: vi.fn(), isPending: false }),
}));
```

**Verification:** `npx vitest run src/components/settings/__tests__/IntegrationsTab.test.tsx`

---

### Fix 5: `fathom.test.ts`

**File:** `src/components/connectors/registry/adapters/__tests__/fathom.test.ts`

**Problem:** The `mapItem` function in `fathom.ts` was extended in Phase 6.3/5 to return 4 new fields on each normalized item: `syncState`, `recordingUuid`, `localTitle`, `remoteTitle`. The test fixture (lines 67-88) was not updated to include these fields. Since `expect(result).toEqual(...)` does a deep equality check, the extra fields in the actual result cause a mismatch.

**Current actual output of `mapItem` for item 1 (recording_id: 123):**
```typescript
{
  externalId: "123",
  title: "Pipeline Review",
  startTime: "2026-05-20T10:00:00Z",
  durationSeconds: 1830,
  participants: [{ name: "Ava", email: "ava@example.com" }],
  alreadyImported: true,
  externalUrl: "https://fathom.video/share/123",
  // MISSING IN TEST FIXTURE:
  syncState: "imported",          // wasAlreadySynced(m) is true, m.sync_state is undefined
  recordingUuid: null,            // m.recording_uuid is undefined
  localTitle: null,               // m.local_title is undefined
  remoteTitle: null,              // m.remote_title is undefined
}
```

**Current actual output of `mapItem` for item 2 (recording_id: 456):**
```typescript
{
  externalId: "456",
  title: "Fallback Start",
  startTime: "2026-05-21T09:00:00Z",
  durationSeconds: null,
  participants: undefined,
  alreadyImported: false,
  externalUrl: "https://fathom.video/calls/456",
  // MISSING IN TEST FIXTURE:
  syncState: "available",         // wasAlreadySynced(m) is false, m.sync_state is undefined
  recordingUuid: null,
  localTitle: null,
  remoteTitle: null,
}
```

**Fix:** Add the 4 missing fields to both item fixtures in the `expect(result).toEqual(...)` block (lines 67-88):

For item 1 (the synced one, `synced: true`):
```typescript
syncState: "imported",
recordingUuid: null,
localTitle: null,
remoteTitle: null,
```

For item 2 (not synced, `synced: false`):
```typescript
syncState: "available",
recordingUuid: null,
localTitle: null,
remoteTitle: null,
```

**Logic for syncState derivation** (from `fathom.ts` mapItem):
```typescript
syncState: m.sync_state ?? (wasAlreadySynced(m) ? "imported" : "available"),
```
Since neither mock item has `sync_state` set, the result is `wasAlreadySynced(m)` driven. Item 1 has `synced: true` → `wasAlreadySynced` returns `true` → `"imported"`. Item 2 has `synced: false` → `"available"`.

**Verification:** `npx vitest run src/components/connectors/registry/adapters/__tests__/fathom.test.ts`

---

## Common Pitfalls

### Pitfall 1: Mock ordering in Vitest
**What goes wrong:** A `vi.mock()` call placed after the component import does not hoist correctly, so the real module runs instead of the mock.
**Why it happens:** Vitest hoists `vi.mock()` calls to the top of the file — but only if they appear in the module scope before any side-effecting imports.
**How to avoid:** All `vi.mock()` calls must appear before the import of the component under test. This is already the pattern in `MCPTab.permissions.test.tsx` (mocks on lines 21-117, component import on line 119).

### Pitfall 2: Forgetting `useRevokeMcpOAuthGrant` when mocking `useMcpOAuthGrants`
**What goes wrong:** Mocking only `useMcpOAuthGrantsList` and not `useRevokeMcpOAuthGrant` causes MCPTab's import of the module to fail if MCPTab uses both from the same module.
**How to avoid:** Mock the entire module — `vi.mock('@/hooks/useMcpOAuthGrants', () => ({ useMcpOAuthGrantsList: ..., useRevokeMcpOAuthGrant: ... }))`.

### Pitfall 3: Byte-match test expectations staying at 41 in mcp-tool-categories.test.ts
**What goes wrong:** After updating count expectations but missing the `expect(a.length).toBe(41)` on the byte-match assertion at line 222, the canonical-sync test still fails.
**How to avoid:** There are TWO places in the file asserting total count — line 29 (TOOL_CATEGORIES) and line 222 (byte-match). Both must change to 45. And line 146 (TOOL_DESCRIPTIONS) changes to 45 as well.

### Pitfall 4: `syncState` logic for items with `sync_state` field set
**What goes wrong:** Adding `syncState: "imported"` to the test fixture when the mock item has no `sync_state` field is correct. But if a test item had `sync_state: "updated_remotely"`, that value would take priority.
**How to avoid:** The mock items in the test don't include `sync_state`, so the fallback logic `wasAlreadySynced(m) ? "imported" : "available"` applies. This is the correct derivation for both test items.

---

## Code Examples

### Pattern: Vitest test file for `_shared/` Edge Function utility

```typescript
// Source: supabase/functions/_shared/__tests__/vtt-parser.test.ts (working reference)
import { describe, it, expect } from 'vitest';
import { extractVTTMetadata } from '../vtt-parser';

describe('myUtility', () => {
  it('does the expected thing', () => {
    expect(myUtility(input)).toEqual(expected);
  });

  it('handles async operations', async () => {
    await expect(asyncFn()).resolves.toEqual(expected);
  });

  it('rejects on error', async () => {
    await expect(asyncFn()).rejects.toBeInstanceOf(MyError);
  });
});
```

### Pattern: Mock a hook that calls useAuth internally

```typescript
// Source: McpConnectionsTab.test.tsx lines 50-53 (established project pattern)
vi.mock('@/hooks/useMcpOAuthGrants', () => ({
  useMcpOAuthGrantsList: () => ({ grants: [], isLoading: false, error: null }),
  useRevokeMcpOAuthGrant: () => ({ mutate: vi.fn(), isPending: false }),
}));
```

### Pattern: MockQuery in connector-function-utils.test.ts (no change needed)

The `createMockSupabase` + `MockQuery` helper at lines 384-444 is pure JavaScript and requires no changes. It simulates Supabase `.from().select().eq().maybeSingle()` chains without any Deno dependencies.

---

## Assumptions Log

All claims in this research were verified by reading source files directly in this session.

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

---

## Open Questions

None. All failure root causes are confirmed from direct source file inspection and live `npm test` output.

---

## Environment Availability

This phase is code/test-only. No external dependencies beyond what `npm test` already uses.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Test runner | Yes | 4.x | — |
| Node.js | npm test | Yes | from Homebrew | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <specific-test-file>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | connector-function-utils runs under Vitest | unit | `npx vitest run supabase/functions/_shared/__tests__/connector-function-utils.test.ts` | Yes (needs fix) |
| SC-2 | MCPTab mounts without AuthProvider error | unit | `npx vitest run src/components/settings/__tests__/MCPTab.permissions.test.tsx` | Yes (needs fix) |
| SC-3 | IntegrationsTab renders connector panels | unit | `npx vitest run src/components/settings/__tests__/IntegrationsTab.test.tsx` | Yes (needs fix) |
| SC-4 | mcp-tool-categories expects 45 tools, 16 write | unit | `npx vitest run src/lib/__tests__/mcp-tool-categories.test.ts` | Yes (needs fix) |
| SC-5 | fathom adapter includes new normalized fields | unit | `npx vitest run src/components/connectors/registry/adapters/__tests__/fathom.test.ts` | Yes (needs fix) |
| SC-6 | Full suite green | all | `npm test` | — |

### Wave 0 Gaps

None — all test files already exist. Only existing tests need modification.

---

## Security Domain

This phase makes no changes to production code, auth flows, or data handling. Security domain is not applicable.

---

## Sources

### Primary (HIGH confidence — direct source file inspection)

- `supabase/functions/_shared/__tests__/connector-function-utils.test.ts` — verified Deno.test usage at line 18
- `src/lib/__tests__/mcp-tool-categories.test.ts` — verified stale 41/12 expectations at lines 29, 40, 146, 222
- `src/lib/mcp-tool-categories.ts` — verified actual 45/16 counts in TOOL_CATEGORIES
- `supabase/functions/_shared/mcp-tool-categories.ts` — verified canonical sibling also at 45/16
- `src/components/settings/__tests__/MCPTab.permissions.test.tsx` — verified missing useMcpOAuthGrants mock
- `src/components/settings/__tests__/IntegrationsTab.test.tsx` — verified missing useApiTokens mock
- `src/components/settings/IntegrationsTab.tsx` — verified ApiTokensSection rendered at line 138
- `src/components/settings/ApiTokensSection.tsx` — verified useApiTokens import at line 40
- `src/hooks/useApiTokens.ts` — verified useAuth call at line 34
- `src/hooks/useMcpOAuthGrants.ts` — verified useAuth call at line 31
- `src/hooks/useOrganizations.ts` — verified useAuth call at line 15
- `src/components/connectors/registry/adapters/__tests__/fathom.test.ts` — verified missing 4 fields in fixture
- `src/components/connectors/registry/adapters/fathom.ts` — verified mapItem returns syncState/recordingUuid/localTitle/remoteTitle
- `src/components/settings/__tests__/McpConnectionsTab.test.tsx` — confirmed mock pattern for useMcpOAuthGrants
- `src/test/setup.ts` — confirmed Deno shim only provides Deno.env, not Deno.test
- `supabase/functions/_shared/__tests__/vtt-parser.test.ts` — confirmed working Vitest pattern for _shared tests

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by reading test infrastructure files directly
- Failing test root causes: HIGH — verified by reading source + running `npm test`
- Fix approach: HIGH — each fix mirrors patterns already used in the codebase

**Research date:** 2026-06-10
**Valid until:** Stable — depends only on local source files, not external APIs or docs
