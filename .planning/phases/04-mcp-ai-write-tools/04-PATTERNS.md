# Phase 04: mcp-ai-write-tools - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 13
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/functions/mcp-server/tools/write/ingest_transcript.ts` | controller | batch | `supabase/functions/save-pasted-transcript/index.ts` + `supabase/functions/_shared/connector-pipeline.ts` | exact pattern match |
| `supabase/functions/mcp-server/tools/write/append_to_transcript.ts` | controller | CRUD | `supabase/functions/mcp-server/tools/write/create_note.ts` + `supabase/functions/save-pasted-transcript/index.ts` | role-match |
| `supabase/functions/mcp-server/tools/write/update_call_metadata.ts` | controller | CRUD | `supabase/functions/mcp-server/tools/write/rename_call.ts` + `supabase/functions/fathom-refresh/index.ts` | role-match |
| `supabase/functions/mcp-server/tools/write/set_speakers.ts` | controller | CRUD | `supabase/functions/_shared/connector-pipeline.ts` + `supabase/functions/zoom-sync-meetings/index.ts` | role-match |
| `supabase/functions/mcp-server/tools/write/_ingest_helpers.ts` | utility | transform | `supabase/functions/_shared/connector-pipeline.ts` + `supabase/functions/_shared/canonical-recording.ts` | role-match |
| `supabase/functions/mcp-server/tools/definitions.ts` | config | transform | existing write-tool entries in the same file | exact |
| `supabase/functions/mcp-server/tools/registry.ts` | config | transform | existing extracted tool registry in the same file | exact |
| `supabase/functions/_shared/mcp-tool-categories.ts` | config | transform | same file, current write/tool map | exact |
| `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` | test | batch | same file | exact |
| `supabase/functions/mcp-server/__tests__/category-gating.test.ts` | test | batch | same file | exact |
| `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` | test | batch | same file | exact |
| `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` | test | request-response | same file | exact |
| `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` | test | batch | same file | exact |

## Pattern Assignments

### `supabase/functions/mcp-server/tools/write/ingest_transcript.ts` (controller, batch)

**Analog:** `supabase/functions/save-pasted-transcript/index.ts`, `supabase/functions/_shared/connector-pipeline.ts`, `supabase/functions/_shared/canonical-recording.ts`

**Imports / boundary pattern**
```ts
import { authenticateRequest } from "../_shared/auth.ts";
import { runPipeline } from "../_shared/connector-pipeline.ts";
```
Copy the Deno Edge Function shape from `save-pasted-transcript/index.ts:41-43, 117-128`, then keep the tool handler itself in the modular MCP pattern from `create_note.ts:1-87`.

**Provenance pattern**
```ts
const sourceMetadata = {
  external_id: normalized.externalId,
  source_platform: sourceApp,
  import_method: "manual",
  parse_status: normalized.parseStatus,
  transcript_speaker_names: normalized.speakerNames,
  recorded_by_name: normalized.speakerNames[0] ?? null,
  ...normalized.sourceMetadata,
};
```
Mirror the manual-import metadata assembly at `save-pasted-transcript/index.ts:249-266`, and keep canonical field naming aligned with `canonical-recording.ts:103-130`.

**Pipeline-first core pattern**
```ts
const result = await runPipeline(supabase, userId, {
  external_id: normalized.externalId,
  source_app: sourceApp,
  title: payload.title,
  full_transcript: payload.full_transcript,
  source_metadata: sourceMetadata,
});
```
Use `runPipeline()` first, exactly as `save-pasted-transcript/index.ts:415-456` does. The insert path in `connector-pipeline.ts:203-363` is the canonical recording + workspace-entry seam to preserve.

**Non-blocking enrichment pattern**
`connector-pipeline.ts:292-360` shows the right failure posture: create the recording, then treat workspace-entry cleanup as non-blocking. `connector-pipeline.ts:371-435` shows speaker ingestion as best-effort and lowercased/deduped.

**Response pattern**
Return `mcpOk(id, ...)` with a markdown summary, not structured JSON, per `protocol.ts:3-11`.

---

### `supabase/functions/mcp-server/tools/write/append_to_transcript.ts` (controller, CRUD)

**Analog:** `supabase/functions/mcp-server/tools/write/create_note.ts`, `supabase/functions/save-pasted-transcript/index.ts`

**Scope + access pattern**
```ts
if (mcpToken.scope === 'workspace') {
  targetWorkspaceId = mcpToken.workspace_id!;
  if (explicitWorkspaceId && explicitWorkspaceId !== targetWorkspaceId) {
    return mcpError(...);
  }
}
```
Copy the workspace/org split from `create_note.ts:11-51` and the behavioral simulator in `write-tools-boundary.test.ts:251-299`. The workspace ownership check is the critical gate before any transcript mutation.

**Append-not-replace pattern**
`save-pasted-transcript/index.ts:316-360` shows the “update existing row” branch. For Phase 4, keep the mutation additive: fetch the existing transcript, append new text, update `full_transcript`, and preserve current metadata fields unless the caller explicitly requests replace/delete.

**Error handling pattern**
Follow the single-error-return style in `create_note.ts:63-86`: validate inputs early, log DB failures, and return `mcpError` with a concise message.

---

### `supabase/functions/mcp-server/tools/write/update_call_metadata.ts` (controller, CRUD)

**Analog:** `supabase/functions/mcp-server/tools/write/rename_call.ts`, `supabase/functions/fathom-refresh/index.ts`

**Patch-by-default pattern**
```ts
const { error: updateError } = await supabase
  .from('recordings')
  .update({ title })
  .eq('id', recordingId);
```
`rename_call.ts:9-28` is the base write-tool shape: trim inputs, verify access, update a single row, then return `mcpOk`.

**Source-metadata merge pattern**
```ts
const mergedMeta: Record<string, unknown> = {
  ...existingMeta,
  fathom_call_id: rec.legacy_recording_id,
  import_source: "fathom-refresh",
  synced_at: syncedAt,
};
```
Borrow the merge semantics from `fathom-refresh/index.ts:365-390`: preserve existing keys, overwrite only the managed fields, and avoid replacing the whole JSON blob unless the caller explicitly asked for destructive behavior.

**Scope and validation**
Use the same workspace/access guard pattern as `create_note.ts:20-61` before any update.

---

### `supabase/functions/mcp-server/tools/write/set_speakers.ts` (controller, CRUD)

**Analog:** `supabase/functions/_shared/connector-pipeline.ts`, `supabase/functions/zoom-sync-meetings/index.ts`, `supabase/functions/_shared/fireflies-connector.ts`, `supabase/functions/_shared/plaud-connector.ts`

**Idempotent speaker upsert pattern**
```ts
const existingNames = new Set(
  (existingParticipants ?? [])
    .map((participant) => participant.name?.trim().toLowerCase())
    .filter(Boolean),
);
```
`connector-pipeline.ts:371-435` is the best local pattern: normalize names to lowercase, skip `"unknown"`, skip the recorded-by speaker, and log insert errors without aborting the import. `zoom-sync-meetings/index.ts:295-357` shows the same “check existing names first, then insert non-host speakers” flow.

**Best-effort resolution pattern**
`fireflies-connector.ts:425-438` and `plaud-connector.ts:96-110` both dedupe speaker names case-insensitively before emitting them. Reuse that normalization tiering for name-based speaker matching.

**Error posture**
Do not fail the tool if one speaker row cannot be written. Report matched/created/unresolved in markdown and keep the primary recording write successful.

---

### `supabase/functions/mcp-server/tools/write/_ingest_helpers.ts` (utility, transform)

**Analog:** `supabase/functions/_shared/canonical-recording.ts`, `supabase/functions/_shared/connector-pipeline.ts`, `supabase/functions/_shared/fireflies-connector.ts`

**Canonical-shape helper pattern**
Use `canonical-recording.ts:73-130` as the shape gate for any helper that normalizes ingest payloads. The helper should validate required fields, return a compact object, and keep `source_metadata` merges deterministic.

**Lowercasing / dedup helper pattern**
`connector-pipeline.ts:419-435`, `fireflies-connector.ts:425-438`, and `plaud-connector.ts:96-110` all use the same dedup recipe:
```ts
const key = speaker.toLowerCase();
if (seen.has(key)) continue;
seen.add(key);
```
Keep that logic in a shared helper so `ingest_transcript` and `set_speakers` resolve names the same way.

---

### `supabase/functions/mcp-server/tools/definitions.ts` (config, transform)

**Analog:** the existing write-tool section in the same file.

**Schema pattern to copy**
`definitions.ts:389-738` is the exact template: every write tool gets a `name`, a short imperative `description`, an `inputSchema` object-root, and an `outputSchema` whose only required field is `text`.

**Concrete write-tool entries to mirror**
```ts
{
  name: 'create_note',
  description: 'Attach a note to a call recording...',
  inputSchema: { ... workspace_id is optional/required by scope ... },
  outputSchema: { type: 'object', properties: { text: ... }, required: ['text'] },
}
```
Use `rename_call`, `add_call_to_folder`, `tag_call`, `create_note`, and `import_youtube_video` as the style baseline at `definitions.ts:392-738`.

**Phase 4 additions**
Add the four new write tools near the existing write block and keep the descriptions precise enough for the MCP client UX. If a tool accepts partial metadata, document that in the schema descriptions rather than hiding it in implementation.

---

### `supabase/functions/mcp-server/tools/registry.ts` (config, transform)

**Analog:** the current extracted-tool registry in the same file.

**Registry pattern**
```ts
const EXTRACTED_TOOLS: ToolModule[] = [
  renameCallTool,
  moveCallsToWorkspaceTool,
  tagCallTool,
  createNoteTool,
  importYoutubeVideoTool,
];
```
The registry is the canonical import/list/lookup seam. Add new write modules here, then let `buildToolDefinitions()` strip `outputSchema` from the client-visible shape at `registry.ts:100-119`.

**Client-visible tooling pattern**
Keep the client surface derived from the same registry entry and definition name. That is what lets `contract-surface.test.ts:100-113` and `golden-replay.test.ts:115-125` stay strict without separate switches.

---

### `supabase/functions/_shared/mcp-tool-categories.ts` (config, transform)

**Analog:** the current write-category block in the same file.

**Category map pattern**
```ts
// ── write (12 tools) ──────────────────────────────────────────────────────
rename_call: 'write',
tag_call: 'write',
create_note: 'write',
import_youtube_video: 'write',
```
Add Phase 4 tools here and update the matching description map in the same commit. This file is the source of truth for server-side gating and permissions-panel display.

**One-to-one contract pattern**
`contract-surface.test.ts:100-107` asserts the category map keys exactly match `TOOL_DEFINITIONS` names. If the map and definitions drift, the phase fails by design.

---

### `supabase/functions/mcp-server/__tests__/contract-surface.test.ts` (test, batch)

**Analog:** same file, current contract assertions.

**Count / coverage pattern**
```ts
expect(blocks.map((block) => block.name)).toHaveLength(41);
expect(categoryNames).toEqual(toolNames);
expect(sourceCategoryNames).toEqual(toolNames);
```
This file is the guard for tool-count drift, one-to-one category coverage, and outputSchema shape. When Phase 4 lands, update the count and add the four new tool names to the tool-definition block expectations.

**Output contract pattern**
```ts
expect(block.source).toMatch(/outputSchema:\s*\{/);
expect(block.source).toMatch(/required:\s*\[\s*'text'\s*\]/);
expect(PROTOCOL_TS).toMatch(/content:\s*\[\{\s*type:\s*'text',\s*text\s*\}\]/);
```
Keep this file as the canonical static assertion that MCP write tools still return markdown envelopes.

---

### `supabase/functions/mcp-server/__tests__/category-gating.test.ts` (test, batch)

**Analog:** same file, existing whitelist logic and source-level gate checks.

**Gate logic pattern**
```ts
if (!enabledCategories.includes(category)) {
  return {
    allow: false,
    code: -32001,
    messageMatches: /is disabled for this token\. Enable the 'write' category/,
  };
}
```
Use this file to add Phase 4 coverage that write-category tools remain hidden from read-only tokens and fail closed when `enabled_categories` is non-null.

**Ordering pattern**
`category-gating.test.ts:231-248` is the key source-order assertion: plan gate, then category gate, then dispatch. Do not move new write-tool wiring ahead of the gate block.

---

### `supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts` (test, batch)

**Analog:** same file, especially the write-tool simulators.

**Boundary simulator pattern**
`write-tools-boundary.test.ts:251-329` shows the `create_note` simulator, including:
```ts
if (mcpToken.scope === 'workspace') { ... }
if (!entry) return mcpError(...);
const { error: insertError } = await client.from('call_notes').insert(...);
return mcpOk(...);
```
That is the template for Phase 4 write-tool boundary coverage: validate scope first, read ownership/access second, then mutate, then return a markdown confirmation.

**Tag/access simulator pattern**
`write-tools-boundary.test.ts:407-460` shows how `tag_call` first resolves the tag, then checks workspace access, then upserts with `onConflict: 'tag_id,recording_id'`.

**Phase 4 additions**
Add tool-specific cases for transcript append, metadata merge, and speaker upsert. Keep the assertions anchored to the real source bytes so the tests fail if the implementation drifts.

---

### `supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts` (test, request-response)

**Analog:** same file, plus `create_note.ts` and `auth.ts`.

**Workspace route and audience pattern**
```ts
expect(src).toMatch(/parseWorkspaceIdFromMcpPath/);
expect(src).toMatch(/requestedWorkspaceId/);
expect(src).toMatch(/forbiddenResponse\(/);
```
This is the right place to protect Phase 4 tool routing against workspace-audience mismatches. Keep the distinction between 401 unauthenticated and 403 authenticated-but-wrong-workspace intact.

**Category gate preservation**
`workspace-scope.integration.test.ts:37-42` should continue to assert that workspace-routing changes do not weaken category filtering.

---

### `supabase/functions/mcp-server/__tests__/golden-replay.test.ts` (test, batch)

**Analog:** same file, current tool-count and handler anchoring.

**Replay contract pattern**
```ts
expect(toolsList?.expected.toolsCount).toBe(41);
expect(TOOL_CATEGORIES[entry.tool!]).toBe(entry.category);
expect(handlerSource(entry.tool!)).toMatch(/return\s+mcpOk\s*\(/);
```
When the four new write tools land, update the fixture count and add their tool-path mappings so the golden replay still proves the tool surface is coherent.

**Why this file matters**
It catches registry/definition/category mismatches in one place, so Phase 4 should keep using it as the “does the surface still hang together?” check.

## Shared Patterns

### Auth and workspace scope
**Sources:** `supabase/functions/_shared/auth.ts:9-18, 41-75, 112-170, 173-208`, `supabase/functions/mcp-server/tools/write/create_note.ts:11-51`

Use the existing scope split:
```ts
if (mcpToken.scope === 'workspace') { ... } else { ... }
```
Workspace tokens get the bound workspace; organization tokens must supply and prove `workspace_id` access before any mutation.

### Markdown tool results
**Sources:** `supabase/functions/mcp-server/protocol.ts:3-11`, `supabase/functions/mcp-server/__tests__/contract-surface.test.ts:203-207`

Tool calls must return:
```ts
result: { content: [{ type: 'text', text }] }
```
No structured JSON in tool-call responses.

### Pipeline-first ingest
**Sources:** `supabase/functions/save-pasted-transcript/index.ts:285-456`, `supabase/functions/_shared/connector-pipeline.ts:203-363, 462-660`

For ingest, insert the recording first with `runPipeline()`, then apply non-critical enrichments as best effort. This is the canonical shape for `ingest_transcript`.

### Canonical metadata/provenance
**Sources:** `supabase/functions/save-pasted-transcript/index.ts:249-266`, `supabase/functions/_shared/canonical-recording.ts:103-130`, `supabase/functions/fathom-refresh/index.ts:365-390`

Preserve the visible Manual MCP Import identity in the user-facing source label, while keeping client/provider, source URL/domain, and other enrichments in `source_metadata`.

### Lowercase dedup and idempotent upserts
**Sources:** `supabase/functions/_shared/connector-pipeline.ts:371-435`, `supabase/functions/_shared/fireflies-connector.ts:425-438`, `supabase/functions/_shared/plaud-connector.ts:96-110`, `supabase/functions/zoom-sync-meetings/index.ts:295-357`

Normalize names to lowercase, dedupe on lowercase keys, and make speaker/tag resolution idempotent. When a write can partially fail, return warnings in the markdown response instead of aborting the primary ingest.

### Category/registry contract
**Sources:** `supabase/functions/_shared/mcp-tool-categories.ts:27-76, 87-147`, `supabase/functions/mcp-server/tools/registry.ts:45-119`, `supabase/functions/mcp-server/__tests__/contract-surface.test.ts:100-113`

Every new tool must be added in three places together: the module, the registry, and the category map. The contract tests are intentionally strict about one-to-one coverage.

## No Analog Found

None. Every Phase 4 surface has a close existing pattern in the codebase.

## Metadata

**Analog search scope:** `supabase/functions/mcp-server/tools`, `supabase/functions/_shared`, `supabase/functions/save-pasted-transcript`, `supabase/functions/zoom-sync-meetings`, `supabase/functions/fathom-refresh`, and `supabase/functions/mcp-server/__tests__`
**Pattern extraction date:** 2026-05-29
