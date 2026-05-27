# Multi-Workspace MCP Architecture Research

**Researched:** 2026-05-27
**Targeted MCP spec:** **2025-06-18** (current stable as of Q1-Q2 2026)
**Confidence:** HIGH on patterns 1, 2, 4, 5 (verified against spec + production servers). MEDIUM on pattern 3 (write-tool shape — fewer production reference points).
**Scope:** Workstream 4 (MCP-01 through MCP-05) — per-workspace endpoints, "Connect to AI" UX, token management, AI write tools, monolith refactor.

---

## Executive Summary

Use **path-based per-workspace endpoints** of the form `https://api.callvaultai.com/mcp/w/{workspace_id}` — this is what Notion, Linear, Cloudflare's own servers, and every conformant remote MCP server in production does (single host, distinguishing path). Each path is a **separate OAuth 2.1 resource identifier** per RFC 8707, so existing PKCE flow keeps working with a one-line change: the `resource` parameter now binds to the workspace URL, not the bare `/mcp` URL. The `mcp_tokens` schema already supports this — `workspace_id` is the path slug, full stop, no migration.

Refactor the 3,921-line monolith into a **registry-of-handlers pattern inside a single Edge Function** (NOT split into many functions — Supabase officially recommends "fat functions" to avoid multiplying cold starts). Folder layout: `mcp-server/tools/{toolName}.ts`, each exporting `{ definition, handler }`, aggregated by `mcp-server/tools/registry.ts`. The Cloudflare Worker stays single-target — it just forwards `/mcp/w/{id}` to the same `mcp-server` function with the workspace ID parsed from the path.

For write tools, follow Workato's "one tool, one action" principle but add **one optimized composite tool** — `ingest_transcript` — that accepts transcript + metadata + tags + speakers + source date in a single call. This is the high-leverage AI-ingestion path the milestone is unlocking; everything else (note, rename, tag, folder) stays atomic. Anti-pattern to avoid: a generic `update_call(action, ...)` god-tool.

---

## 1. Per-Workspace Endpoint Pattern

### Recommendation: Path-based, single host

**Pattern:**
```
https://api.callvaultai.com/mcp                          ← org-default (existing, unchanged)
https://api.callvaultai.com/mcp/w/{workspace_uuid}       ← per-workspace (new)
```

Single host. Workspace identifier in path. **Not subdomain, not query parameter, not separate Edge Function.**

### Rationale

1. **MCP 2025-06-18 explicitly blesses this.** The spec's "Canonical Server URI" examples include `https://mcp.example.com/server/mcp` and note: *"when path component is necessary to identify individual MCP server"* — i.e., the path can encode which logical MCP server the client is connecting to. The `resource` parameter (RFC 8707) becomes the full path, and audience binding happens at that granularity. Source: [MCP 2025-06-18 Authorization spec — Canonical Server URI](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#canonical-server-uri).

2. **Every conformant production MCP server uses path-based identity.** Notion: `https://mcp.notion.com/mcp`. Linear: `https://mcp.linear.app/mcp`. Cloudflare: `/mcp`. Slack: `/mcp`. None of them use subdomains per tenant — workspace selection happens **after** OAuth, server-side, via the token-to-workspace binding. Notion's hosted blog confirms: *"Our MCP server manages sessions and securely stores the API token from the OAuth exchange"* — i.e., one URL, server-side scoping. ([Notion blog](https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look))

3. **CallVault has a stronger product reason to break that mold than Notion does.** Notion treats workspace selection as session state because *the user picks one workspace per OAuth flow*. CallVault wants AI clients (Claude Desktop, Cursor) to see workspaces as **separate connections** — so a user can have `Sales Workspace` and `Engineering Workspace` both connected, side-by-side, in Claude Desktop's MCP sidebar, with separate names and tool surfaces. Path-based per-workspace URLs is the only way to make that work because **Claude Desktop and Cursor key MCP connections off the URL** — same URL = same connection, dedupe collapse.

4. **No subdomain because:** subdomains require Cloudflare wildcard certs + DNS records per workspace, raise the operational floor, and don't add anything path-routing doesn't already give you. They also complicate CORS and cookie-domain logic for no benefit.

5. **No query parameter because:** the MCP spec **forbids** putting auth-relevant identifiers in query strings (RFC 8707 Section 2 — `resource` MUST be a canonical URI without query parameters affecting the resource identity). Putting `?workspace_id=...` would silently violate audience-binding in conformant clients.

### URL Structure Detail

```
/mcp                                     → org-scoped (legacy + default)
/mcp/w/{workspace_uuid}                  → workspace-scoped
/.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}
                                         → PRM per workspace (RFC 9728 path-suffixed form)
```

The `/w/` segment is there to make the URL human-readable in the "Connect to AI" snippet and to leave room for future segments (`/mcp/o/{org_id}` if you ever want explicit org URLs, `/mcp/s/{shared_link}` if you ever expose shared-link MCPs).

### Existing schema is already compatible

`mcp_tokens.scope IN ('workspace', 'organization')` and `mcp_tokens.workspace_id UUID` already exist. The code path at `mcp-server/index.ts:1118+` already branches on scope. **No migration needed.** The only DB change is making `name` and `enabled_categories` writable from the new token-management UI, which they already are.

### Production server examples confirming path-based identity

| Server | URL | Workspace scoping |
|---|---|---|
| Notion | `https://mcp.notion.com/mcp` | Server-side (session token holds workspace) |
| Linear | `https://mcp.linear.app/mcp` | Server-side (token holds team/workspace) |
| Slack | `https://*.slack.com/mcp` | Per-workspace subdomain (Slack-style) |
| GitHub | `https://api.githubcopilot.com/mcp/` | OAuth scope-based |
| Cloudflare's own | `/mcp` per service | One URL per service, not per-tenant |

Slack is the only major exception with subdomain-per-tenant, but that's because Slack already has subdomain-per-workspace as their native URL pattern — CallVault doesn't. ([Slack MCP docs](https://docs.slack.dev/ai/slack-mcp-server/))

---

## 2. OAuth Token Minting + Config Snippet UX

### Recommendation: Stay on the existing hex-token flow for "Connect to AI" buttons. Add a one-click "copy config" UX with a JSON snippet AI clients consume verbatim.

The existing OAuth 2.1 + PKCE + DCR flow is good — keep it for clients that auto-discover (Claude Desktop's "Connect to MCP server" wizard). **But the per-workspace UX should be hex tokens minted in your dashboard**, because:

1. **Real MCP clients accept either flow.** Claude Desktop's config file (`~/Library/Application Support/Claude/claude_desktop_config.json`) and Cursor's `.cursor/mcp.json` both accept a plain URL + bearer token via `headers.Authorization`. No OAuth dance needed.
2. **One-click UX requires no browser hop.** OAuth-via-DCR is *fast* (5–10 seconds, browser hop, consent screen) — but a copy-pasted snippet with a pre-minted token is *instant*. For the "Connect Sales Workspace to AI" button, instant wins.
3. **The OAuth path is still there** for clients that won't accept bearer tokens (rare but present — some ChatGPT custom-GPT flows insist on DCR).

### Recommended UX flow

1. User clicks **"Connect to AI"** on a workspace card.
2. Modal opens. Three tabs: **Claude Desktop**, **Cursor**, **Generic (mcp-remote)**.
3. Each tab shows a copy-button JSON snippet pre-filled with the workspace's URL and a freshly-minted hex token.
4. Token is created server-side with `scope='workspace'`, `workspace_id=<this_ws>`, default name = `"Claude Desktop — {workspace_name}"`.
5. Click "Copy" → token is now in `mcp_tokens`; user pastes into their client config; done.

### Snippet shapes (verified against current client docs)

**Claude Desktop / Cursor (`mcpServers` object — both clients use identical shape):**

```json
{
  "mcpServers": {
    "callvault-sales": {
      "type": "http",
      "url": "https://api.callvaultai.com/mcp/w/3a7c1f88-...-...",
      "headers": {
        "Authorization": "Bearer cv_ws_e7f2a3b9c4d5..."
      }
    }
  }
}
```

**Generic stdio bridge (for clients without native HTTP transport — e.g., older Continue/Cline versions):**

```json
{
  "mcpServers": {
    "callvault-sales": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://api.callvaultai.com/mcp/w/3a7c1f88-...-...",
        "--header",
        "Authorization: Bearer cv_ws_e7f2a3b9c4d5..."
      ]
    }
  }
}
```

The `mcp-remote` npm package is the canonical stdio→HTTP bridge. Both Notion's docs and Linear's docs ship this exact format for older-client compatibility. ([MCP config files guide](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable))

### Token prefix convention

Change hex tokens from raw `[0-9a-f]{64}` to a **prefixed format**: `cv_ws_<hex>` for workspace tokens, `cv_org_<hex>` for org tokens. This:

- Makes tokens self-describing in logs and snippets ("oh, that's a workspace token")
- Enables GitHub-style secret scanning (Vercel, GitHub Actions, and AWS now scan for prefixed credential patterns and notify if leaked)
- Is backward-compatible — the existing `isHexToken = /^[0-9a-f]{64}$/.test(rawToken)` check at `mcp-server/index.ts:1110` becomes `isCvToken = /^cv_(ws|org)_[0-9a-f]{64}$/.test(rawToken)` with a fallback to the old pattern for tokens minted before the change.

### Token management UI requirements (MCP-03)

Mirror GitHub's PAT page exactly — operators know that shape:

| Column | Source |
|---|---|
| Name | `mcp_tokens.name` (user-editable) |
| Workspace / Scope | resolved from `workspace_id` / `org_id` |
| Created | `created_at` |
| Last used | `last_used_at` (already updated fire-and-forget at `mcp-server/index.ts:1133`) |
| Tool categories | `enabled_categories` (already exists, displayed as chips) |
| Actions | Revoke (DELETE row), Rotate (DELETE + new INSERT, same name + scope) |

**Never show the token after creation.** Display once, copy-button, then mask. The schema already supports this (the token column is plaintext but the UI commits to one-time display).

### OAuth flow (kept for spec-strict clients)

The existing PKCE + DCR flow at `/oauth/consent` stays as-is. The only change: when an OAuth-issued JWT is presented to `/mcp/w/{workspace_id}`, the server checks that the user (resolved from JWT) is a member of the workspace's org, then synthesizes an `McpToken` with `scope='workspace'` and `workspace_id` from the path. This requires updating the JWT branch at `mcp-server/index.ts:1138+` to read workspace_id from the URL path, not from a binding table.

---

## 3. MCP Write-Tool Design for AI Ingestion

### Recommendation: Atomic tools for everything except transcript ingestion, where ONE composite tool (`ingest_transcript`) accepts the full envelope in a single call.

### The general principle (from the spec + Workato + Anthropic engineering)

Workato, Anthropic's engineering blog, and the MCP spec working group all converge on: **one tool, one action, no hidden side effects**. ([Workato MCP tool design](https://docs.workato.com/en/mcp/mcp-server-tool-design.html), [Anthropic — Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp))

So your 19 existing write tools (`create_note`, `rename_call`, `tag_call`, `create_folder`, etc.) are **already correctly shaped** — keep them atomic. Don't merge `tag_call` + `add_call_to_folder` into a "categorize_call" god-tool.

### The exception that justifies composite shape: transcript ingestion

The reason to make `ingest_transcript` composite is **AI ergonomics, not API ergonomics**:

- An AI agent that just transcribed a 60-minute Zoom call has the transcript text, the inferred title, the auto-extracted speakers, the source date, and probably some inferred tags — **all in one context window, all at once**.
- Forcing the agent to call `create_recording` → `add_transcript` → `set_speakers` → `tag_call` → `move_to_workspace` burns 5 tool round-trips, 5 latency hops, and 5 chances for partial-failure inconsistency.
- This is the same reason Notion ships `create-a-page` accepting `properties` + `children` in one call, instead of separate `create_blank_page` + `add_blocks` + `set_properties` tools.

### Recommended `ingest_transcript` shape

```typescript
{
  name: 'ingest_transcript',
  description:
    'Ingest a transcript with full metadata in one call. Use this when you have a transcript ' +
    'plus the metadata you want associated with it (title, speakers, source date, tags, notes). ' +
    'For just adding a note to an existing recording, use create_note instead.',
  inputSchema: {
    type: 'object',
    properties: {
      // Required
      transcript: {
        type: 'string',
        description: 'Full transcript text. Plain text or VTT/SRT/JSON formats accepted.',
      },
      title: { type: 'string', description: 'Recording title.' },

      // Optional metadata bundle
      workspace_id: {
        type: 'string',
        description: 'Workspace UUID. Required for org-scoped tokens; ignored for workspace-scoped (auto-resolves from token).',
      },
      source_date: {
        type: 'string',
        description: 'ISO 8601 datetime when the recording happened. Defaults to now if omitted.',
      },
      duration_seconds: { type: 'number' },
      source_app: {
        type: 'string',
        description: 'Source identifier: "zoom", "fathom", "manual", "ai_agent", etc.',
      },
      external_url: {
        type: 'string',
        description: 'Original URL (Zoom recording page, Fathom share link, etc.) if available.',
      },

      // Composable optional bundles
      speakers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['host', 'participant', 'guest'] },
          },
          required: ['name'],
        },
        description: 'Speaker list. Each entry creates a contact + call_speaker row.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tag names (NOT IDs). Existing tags are reused; new names are created.',
      },
      notes: {
        type: 'string',
        description: 'Initial note to attach to the recording (single note, plain text).',
      },
      folder_id: {
        type: 'string',
        description: 'Folder UUID to add the recording to.',
      },
    },
    required: ['transcript', 'title'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description:
          'Markdown summary of what was created — recording_id, share_url, list of ' +
          'new vs reused entities (tags, contacts, folders), warnings about any partial ' +
          'failures (e.g., transcript saved but speaker resolution failed).',
      },
    },
    required: ['text'],
  },
}
```

### Why this shape works

1. **Required surface is minimal.** Just `transcript` + `title`. Agents that have nothing else can still call it.
2. **Optional fields are atomic units.** Each top-level optional field maps to one DB write. If `speakers` fails, the recording + tags still succeed. The output text reports partial failures so the agent knows what to retry.
3. **Names not IDs for fuzzy fields.** `tags: ['sales-call', 'q2-2026']` not `tag_ids: ['uuid', 'uuid']` — agents have names, not UUIDs. Server-side: dedupe by lowercase name match, create missing.
4. **Workspace resolution matches existing pattern.** Token determines scope; if workspace-scoped, `workspace_id` param is ignored. Mirrors `list_calls` at `mcp-server/index.ts:1402+`.
5. **No hidden side effects.** All effects are declared in the schema. Compare to `update_order(id, status)` that also sends emails — NOT what this is.

### Other write tools — keep them atomic

| Existing tool | Verdict | Reason |
|---|---|---|
| `create_note` | Keep | One side effect: insert a note row |
| `rename_call` | Keep | One field update |
| `move_calls_to_workspace` | Keep (batch OK) | "Batch single-action" ≠ god-tool — same action over many rows |
| `delete_call` | Keep | One side effect |
| `create_folder` / `rename_folder` / `delete_folder` | Keep | Each is one action |
| `tag_call` / `untag_call` | Keep | Each is one assignment toggle |
| `create_share_link` / `revoke_share_link` | Keep | Each is one action |
| `import_youtube_video` | Already composite — keep as-is | YouTube URL → recording is one logical "ingest from URL" action |
| `create_organization` / `create_workspace` | Keep | Structural setup, low call frequency |

### Anti-patterns to avoid here (specific to write-tool design)

1. **Generic `update_call(field, value)` god-tool.** Looks elegant. Forces the agent to know the schema. Hides side effects. Hard to validate. Workato explicitly calls this out. Don't.
2. **`ingest_transcript_step_1` / `ingest_transcript_step_2`.** If you find yourself splitting `ingest_transcript` into stages, you're optimizing for the wrong principal — humans organize APIs; agents organize prompts.
3. **`bulk_ingest_transcripts` accepting an array.** Tempting for AI batch flows. Skip it for now — `ingest_transcript` is already the high-cost composite; making it array-shaped adds partial-failure complexity that the agent has to reason about. If agents need bulk, they can loop.
4. **Returning structured JSON instead of `content[].text`.** The current `outputSchema` shape (single `text` property) is a deliberate workaround — see `docs/operations/mcp-runbook.md` "Tool outputSchema contract". Keep that shape; emit a markdown-flavored summary that's both human- and agent-readable.

### Additional write tools the milestone justifies adding

Based on the AI-ingestion use case, these gaps are worth filling:

- **`append_to_transcript`** — append text to an existing recording's transcript (live transcription scenarios)
- **`update_call_metadata`** — narrow update of title + summary + source_date + external_url only (no tags/speakers — those have their own tools)
- **`set_speakers`** — replace the speaker list for a recording (idempotent, useful for re-ingesting with corrected names)

These three + `ingest_transcript` = the agent ingestion surface. Total MCP tool count goes from 36 → 40, all atomic except `ingest_transcript`.

---

## 4. Monolith → Modular Refactor Pattern

### Recommendation: Keep ONE Edge Function (`mcp-server`). Refactor internals into a tool-registry pattern. Do NOT split into many Edge Functions.

### Why one function, not many

Supabase officially recommends **"fat functions"** to minimize cold starts. From their docs: *"To reduce cold starts and increase performance, combine multiple actions into a single Edge Function. This way only one instance needs to be booted and it can handle multiple requests to different actions."* ([Supabase routing docs](https://supabase.com/docs/guides/functions/routing))

For an MCP server specifically, this is doubly true:
- Cold start cost is paid per Edge Function. Splitting into 36 functions = 36 cold starts.
- MCP clients call many tools per session. One warm function serves the whole session.
- Tool dispatch is microseconds. The "cost" of the monolith isn't runtime — it's source-file maintainability. Fix that with module structure, not function splitting.

### Recommended file structure

```
supabase/functions/mcp-server/
├── index.ts                       ← entrypoint (~200 LOC: HTTP, auth, dispatch only)
├── auth.ts                        ← token validation (hex + JWT paths, workspace resolution)
├── routing.ts                     ← URL parsing: extract workspace_id from /mcp/w/{id}
├── plan-gating.ts                 ← isPaidTier() + tier check
├── tools/
│   ├── registry.ts                ← single source of truth — imports all tools, exports TOOLS array + handler map
│   ├── _shared.ts                 ← shared helpers (orgWorkspaceIds, error mapping, formatting)
│   ├── _types.ts                  ← ToolDefinition + ToolHandler types + McpToken
│   │
│   ├── read/
│   │   ├── search-calls.ts        ← { definition, handler }
│   │   ├── list-calls.ts
│   │   ├── get-transcript.ts
│   │   ├── ... (one file per existing read tool)
│   │
│   ├── write/
│   │   ├── ingest-transcript.ts   ← the new composite (highest LOC)
│   │   ├── create-note.ts
│   │   ├── rename-call.ts
│   │   ├── ... (one file per existing write tool)
│   │
│   └── ai/
│       ├── extract-action-items.ts ← AI-flavored tools that hit OpenRouter
│       ├── ask-call.ts
│       └── ...
```

### Tool module contract

```typescript
// supabase/functions/mcp-server/tools/_types.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface McpToken {
  id: string;
  user_id: string;
  org_id: string | null;
  workspace_id: string | null;
  scope: 'workspace' | 'organization';
  name: string;
  enabled_categories: ToolCategory[] | null;
}

export interface ToolContext {
  supabase: SupabaseClient;
  token: McpToken;
  corsHeaders: Record<string, string>;
  requestId: string | number | null;
}

export type ToolHandler = (
  params: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<Response>;

export interface ToolModule {
  definition: {
    name: string;
    description: string;
    inputSchema: object;
    outputSchema: object;
  };
  handler: ToolHandler;
  category: ToolCategory;
}
```

```typescript
// supabase/functions/mcp-server/tools/write/create-note.ts
import { mcpOk, mcpError } from '../_shared.ts';
import type { ToolModule } from '../_types.ts';

export const createNoteTool: ToolModule = {
  definition: {
    name: 'create_note',
    description: 'Attach a note to a recording.',
    inputSchema: { /* ... */ },
    outputSchema: { /* ... */ },
  },
  category: 'notes',
  handler: async (params, { supabase, token, corsHeaders, requestId }) => {
    const recordingId = typeof params.recording_id === 'string' ? params.recording_id : '';
    if (!recordingId) return mcpError(requestId, -32602, 'recording_id is required', corsHeaders);

    // ... existing create_note logic, but with `token` and `supabase` injected
    return mcpOk(requestId, 'Note created.');
  },
};
```

```typescript
// supabase/functions/mcp-server/tools/registry.ts
import { searchCallsTool } from './read/search-calls.ts';
import { listCallsTool } from './read/list-calls.ts';
// ... import all tools

import { createNoteTool } from './write/create-note.ts';
import { ingestTranscriptTool } from './write/ingest-transcript.ts';
// ...

const ALL_TOOLS = [
  searchCallsTool,
  listCallsTool,
  createNoteTool,
  ingestTranscriptTool,
  // ... 40 total
];

export const TOOLS = ALL_TOOLS.map((t) => t.definition);  // for tools/list response
export const HANDLERS = new Map(ALL_TOOLS.map((t) => [t.definition.name, t.handler]));
export const CATEGORIES = new Map(ALL_TOOLS.map((t) => [t.definition.name, t.category]));
```

```typescript
// supabase/functions/mcp-server/index.ts (~200 LOC after refactor)
import { TOOLS, HANDLERS, CATEGORIES } from './tools/registry.ts';
import { authenticateMcpRequest } from './auth.ts';
import { resolveWorkspaceFromPath } from './routing.ts';
import { checkPlanTier } from './plan-gating.ts';

Deno.serve(async (req) => {
  // CORS, JSON-RPC parse, host resolution (unchanged)
  // ...

  // Auth — moved into auth.ts, returns McpToken with workspace_id resolved from path
  const authResult = await authenticateMcpRequest(req, supabase);
  if (authResult instanceof Response) return authResult;
  const { token } = authResult;

  // initialize / tools/list — handled inline (small)
  if (method === 'initialize') return mcpJsonResult(id, { /* ... */ });
  if (method === 'tools/list') return mcpJsonResult(id, { tools: TOOLS });

  // Plan gating — moved into plan-gating.ts
  const planCheck = await checkPlanTier(supabase, token);
  if (planCheck instanceof Response) return planCheck;

  // Dispatch — handler map lookup
  const toolName = method === 'tools/call' ? (params.name as string) : method;
  const handler = HANDLERS.get(toolName);
  if (!handler) return mcpError(id, -32601, `Unknown tool: ${toolName}`, corsHeaders);

  // Category gating (unchanged, uses CATEGORIES map)
  if (token.enabled_categories !== null && method === 'tools/call') {
    const cat = CATEGORIES.get(toolName);
    if (!cat || !token.enabled_categories.includes(cat)) {
      return mcpError(id, -32001, `Tool '${toolName}' is disabled for this token.`, corsHeaders);
    }
  }

  return handler({ ...params, ...(params.arguments as object ?? {}) }, {
    supabase, token, corsHeaders, requestId: id,
  });
});
```

### Cold-start tradeoff for Deno Edge Functions

- **ESZip format bundles the entire module graph at deploy.** All `tools/**/*.ts` imports are resolved once at `supabase functions deploy --use-api` time and packed into one ESZip. No runtime import cost. ([Supabase Edge Functions architecture](https://supabase.com/docs/guides/functions/architecture))
- **Cold start grows with bundle parse time, not file count.** Splitting one 4,000-line file into forty 100-line files **does not slow cold start** — the bytes-to-parse stay roughly the same. (Actually slightly smaller because `import` deduplication and tree-shaking get better with explicit modules.)
- **What DOES slow cold start:** heavy top-level imports. `import { generateText } from 'https://esm.sh/ai@5.0.102'` is loaded for every request, even read-only ones. **Mitigation: dynamic-import AI deps inside AI tool handlers only.** Example:

```typescript
// tools/ai/extract-action-items.ts
export const extractActionItemsTool: ToolModule = {
  // ...
  handler: async (params, ctx) => {
    // Dynamic import — only loaded when this tool actually runs
    const { generateText } = await import('https://esm.sh/ai@5.0.102');
    const { createOpenRouter } = await import('https://esm.sh/@openrouter/ai-sdk-provider@1.2.8');
    // ...
  },
};
```

This is the single biggest cold-start win available. The current monolith imports `ai` and `@openrouter/ai-sdk-provider` at the top of `mcp-server/index.ts:2-3`, so every `list_calls` cold-start pays for AI SDK parse. Dynamic imports defer that cost to AI tool calls only.

### Migration plan (suggested phasing inside MCP-05)

1. **Phase A — Extract types + helpers.** Create `tools/_types.ts`, `tools/_shared.ts`, `auth.ts`, `routing.ts`. Move existing helpers (`fetchOrgWorkspaceIds`, `unauthorizedResponse`, etc.) into their new homes. `index.ts` imports from new locations but body is unchanged. **No behavior change. PR is mechanical, should be safe to ship.**
2. **Phase B — Extract one tool as a pattern.** Pick `search_calls` (highest-volume, exercises both scope branches, exercises org-boundary helper). Move into `tools/read/search-calls.ts` using the `ToolModule` contract. Update `index.ts` switch to call its handler. Tests + interceptor verification.
3. **Phase C — Extract the remaining 35 tools.** Each is its own commit. ~1 commit per 3-4 tools. Build runs after every batch. CI's RLS regression test runs unchanged.
4. **Phase D — Move dispatch to the handler map.** Delete the giant `switch` statement; switch to `HANDLERS.get(toolName)`. Smallest commit, biggest leverage.
5. **Phase E — Add per-workspace path routing (MCP-01).** New tools added: `ingest_transcript`, `append_to_transcript`, `update_call_metadata`, `set_speakers`.
6. **Phase F — Dynamic-import AI deps in AI handlers.** Cold-start optimization.

### Existing references inside repo that constrain the refactor

- `_shared/mcp-tool-categories.ts` — used by category gating at `mcp-server/index.ts:1245+`. Move the import into `tools/registry.ts`; categories now live on each `ToolModule.category` field.
- `_shared/track-ai-usage-inline.ts` — AI tools call `enforceMcpAiUsage()`. Stays in `_shared/`; AI-flavored tool modules import it directly.
- `_shared/cors.ts` `getPublicCorsHeaders()` — unchanged, imported by `index.ts`.

---

## 5. Cloudflare Worker Routing

### Recommendation: Keep single backend Edge Function. Update Worker to forward `/mcp/w/{workspace_uuid}` and `/mcp` to the same `mcp-server` function. Update PRM document to reflect the per-workspace resource identifier.

### Current Worker (verified at `cloudflare/api-proxy/worker.ts:143-145`)

```typescript
if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
  const tail = url.pathname.slice(4); // strip "/mcp"
  return `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`;
}
```

This already forwards `/mcp/anything` to `mcp-server/anything`. So `/mcp/w/3a7c1f88-...` already routes through. **The Worker needs almost no change.** The work is server-side: `mcp-server/index.ts` (or its new `routing.ts` module) parses `req.url.pathname` to extract workspace_id.

### Server-side path parsing

```typescript
// supabase/functions/mcp-server/routing.ts
const WORKSPACE_PATH_RE = /^\/functions\/v1\/mcp-server\/w\/([0-9a-f-]{36})$/;

export function resolveWorkspaceFromPath(req: Request): string | null {
  const url = new URL(req.url);
  const m = url.pathname.match(WORKSPACE_PATH_RE);
  return m?.[1] ?? null;
}
```

When the Worker forwards `https://api.callvaultai.com/mcp/w/{id}` it becomes `https://<supabase>/functions/v1/mcp-server/w/{id}`. The regex catches that. If null returned: it's the bare `/mcp` endpoint (legacy + org-scoped).

### PRM (Protected Resource Metadata) per workspace

RFC 9728's path-suffixed form already handles this. The Worker needs one new route for the per-workspace PRM document:

```typescript
// add to worker.ts resolveTarget()
if (url.pathname.startsWith("/.well-known/oauth-protected-resource/mcp/w/")) {
  // Strip the well-known prefix to get "/mcp/w/{id}", pass to metadata function
  const resourcePath = url.pathname.replace("/.well-known/oauth-protected-resource", "");
  return `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent(resourcePath)}`;
}
```

`mcp-oauth-metadata` updates: when `resource_path` is present, advertise `resource: "https://<host>${resource_path}"` instead of the bare `/mcp` URL. This is what makes RFC 8707 audience binding work per-workspace.

### Audience validation at the server

When a token (hex or JWT) is presented to `/mcp/w/{id}`:

1. Parse workspace_id from path.
2. Validate token (existing logic).
3. **NEW: cross-check** — token's `workspace_id` must equal path's workspace_id (for workspace-scoped tokens), OR the workspace must belong to the token's org (for org-scoped tokens hitting a workspace path).
4. If mismatch: 403 (NOT 401 — token is valid, but not for this resource).

This is the RFC 8707 audience binding the spec demands.

### Other Worker changes (none required)

- `/auth/v1/*` transparent proxy — unchanged, Supabase Auth handles OAuth flow as-is.
- `/.well-known/oauth-authorization-server` — unchanged. Authorization server is the same for all workspaces (it's Supabase Auth).
- `/mcp-register` (DCR endpoint) — unchanged. DCR is per-issuer, not per-resource.
- `/fireflies-webhook`, `/logo.png` — unchanged.

### Optional polish: human-friendly workspace slugs

Nice-to-have, NOT required for MCP-01. Add a `workspaces.slug TEXT UNIQUE` column. Worker accepts both `/mcp/w/{uuid}` and `/mcp/w/{slug}`. Server-side: if path segment isn't a UUID, lookup by slug. Slug-based URLs in "Connect to AI" snippets are more readable (`/mcp/w/sales-q2-2026` vs `/mcp/w/3a7c1f88-...`). Skip in v1 of this milestone — UUID URLs are functionally correct; slugs are aesthetic.

---

## Anti-Patterns to Avoid

Specific things half-built multi-tenant MCPs get wrong, with sources or repro evidence.

### 1. Putting tenant ID in a query parameter (`?workspace=foo`)

**Why it's wrong:** Violates RFC 8707 canonical URI rules (fragments forbidden, query parameters not part of resource identity). Conformant clients will compute a different `resource` value than the server expects, audience validation fails, OAuth flow silently breaks. The CallVault MCP debug history (`docs/operations/mcp-runbook.md`) already records one variant of this: Perplexity rejected the server when discovery returned a non-matching `resource` field.

### 2. Wildcard subdomain per workspace without DNS automation

**Why it's wrong:** Requires Cloudflare wildcard cert + DNS records per workspace. Operational burden grows linearly with customers. Half-built version: subdomain manually provisioned for the founder's account, every other customer routes through the bare URL — silent two-tier UX.

### 3. Trusting the JWT `org_id` claim without verifying workspace membership

**Why it's wrong:** Confused deputy attack. User has a valid JWT for org A; they construct a request to `/mcp/w/{workspace_in_org_B}`. If the server only checks `JWT.org_id == workspace.org_id` instead of `workspace.org_id == JWT.org_id`, they get into org B's workspace. Defense: ALWAYS resolve workspace → org, then compare to token's org, NOT the reverse.

### 4. Forwarding the user's MCP bearer token to upstream APIs

**Why it's wrong:** The MCP spec (2025-06-18 §Token Passthrough) explicitly forbids this. CallVault's MCP server already does this correctly — it uses the Supabase service-role key, not the MCP bearer, when calling Supabase. Don't regress during refactor. If a new MCP tool calls OpenRouter or Whisper, it MUST use the Edge Function's own server-side key, never the user's MCP token.

### 5. `tools/list` returning all 40 tools to every token regardless of scope/category

**Why it's wrong:** Information disclosure. A workspace-scoped token doesn't need to know `create_organization` exists. Half-built mitigation: tool exists in `tools/list` but errors at call-time — wastes the agent's context window AND tips off probing actors about available tools. **Fix:** filter `tools/list` by `token.enabled_categories` (existing infrastructure — just needs the dispatch in `tools/list` handler). MCP spec SEP-1881 ("Scope-Filtered Tool Discovery") blesses this pattern as of November 2025. ([SEP-1881](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1881))

### 6. One Edge Function per tool

**Why it's wrong:** Multiplies cold-start latency by N. Each function pays its own cold-start tax. Supabase explicitly documents this as the wrong split. ([Supabase functions routing docs](https://supabase.com/docs/guides/functions/routing))

### 7. Composite tools that do everything (`update_call(action, ...)`, `manage_workspace(op, ...)`)

**Why it's wrong:** Hides side effects from the agent's tool-selection prompt. Forces server-side branching that's impossible to validate at the schema level. Workato calls this out as the #1 anti-pattern. ([Workato MCP tool design](https://docs.workato.com/en/mcp/mcp-server-tool-design.html))

### 8. Returning structured JSON in `tool/call` result instead of `content[].text`

**Why it's wrong:** MCP spec requires `result.content` to be an array of `{type, text|data}` blocks. Some clients (Claude Code, Perplexity in late 2025) strictly validate this and reject the whole response. CallVault already has this fix recorded in `docs/operations/mcp-runbook.md` — don't regress it during the refactor.

### 9. Caching `tools/list` aggressively at the CDN

**Why it's wrong:** If `tools/list` is per-token (categories) or per-workspace (which tools are enabled), CDN cache leaks one tenant's tool surface to another. Today the Worker doesn't cache MCP responses; keep that — don't add `Cache-Control: public` to MCP endpoints.

### 10. Naming workspaces "default" or letting all tokens share the same default workspace slug

**Why it's wrong:** Two users' "default" workspaces collide in the URL space. Half-built version: `/mcp/w/default` works for one tenant, breaks for everyone else. UUIDs (or per-org-unique slugs) prevent this by construction.

---

## References

### MCP Spec (current — 2025-06-18)

- [MCP 2025-06-18 — Authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) — HIGH confidence, official spec
- [MCP 2025-06-18 — Tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) — HIGH
- [Auth0 — MCP June 2025 spec update analysis](https://auth0.com/blog/mcp-specs-update-all-about-auth/) — MEDIUM (third-party analysis verified against spec)
- [ForgeCode — MCP 2025-06-18 update overview](https://forgecode.dev/blog/mcp-spec-updates/) — MEDIUM
- [SEP-1881 — Scope-Filtered Tool Discovery (Nov 2025)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1881) — HIGH (official proposal)
- [SEP-1821 — Dynamic Tool Discovery](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1821) — HIGH
- [MCP blog — Evolving OAuth Client Registration](https://blog.modelcontextprotocol.io/posts/client_registration/) — HIGH (official blog)
- [MCP blog — Server Instructions field](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/) — HIGH

### Production MCP Servers (verified URL patterns)

- [Notion — MCP get started](https://developers.notion.com/guides/mcp/get-started-with-mcp) — `https://mcp.notion.com/mcp`
- [Notion blog — hosted MCP inside look](https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look)
- [Notion MCP server GitHub (makenotion/notion-mcp-server)](https://github.com/makenotion/notion-mcp-server) — 22 tools, includes recent composite write tools
- [Linear — MCP server docs](https://linear.app/docs/mcp) — `https://mcp.linear.app/mcp`
- [Slack — MCP server overview](https://docs.slack.dev/ai/slack-mcp-server/) — workspace-subdomain pattern (exception, justified by Slack's existing URL model)
- [Cloudflare's own MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/) — one URL per service

### Tool Design Authoritative Sources

- [Workato — MCP server tool design](https://docs.workato.com/en/mcp/mcp-server-tool-design.html) — HIGH (production guidance)
- [Anthropic engineering — Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) — HIGH
- [Merge.dev — MCP tool descriptions, examples, best practices](https://www.merge.dev/blog/mcp-tool-description) — MEDIUM

### Multi-Tenant + Refactor Patterns

- [Streamable HTTP MCP server template (iceener)](https://github.com/iceener/streamable-mcp-server-template) — production-ready template with multi-tenant sessions
- [Cloudflare — Build a remote MCP server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/) — HIGH
- [Cloudflare — OAuth with MCP servers](https://developers.cloudflare.com/agents/guides/oauth-mcp-client/) — HIGH
- [Cloudflare — Streamable HTTP transport announcement](https://blog.cloudflare.com/streamable-http-mcp-servers-python/) — HIGH
- [Descope — MCP gateways developer guide](https://www.descope.com/blog/post/developer-guide-mcp-gateways) — MEDIUM
- [Descope — MCP authorization spec deep dive](https://www.descope.com/blog/post/mcp-auth-spec) — MEDIUM

### Supabase Edge Functions

- [Supabase — Edge Functions architecture](https://supabase.com/docs/guides/functions/architecture) — HIGH (official, ESZip / cold start)
- [Supabase — Handling routing in functions](https://supabase.com/docs/guides/functions/routing) — HIGH (fat function guidance)
- [Supabase — Bundle size issues troubleshooting](https://supabase.com/docs/guides/troubleshooting/edge-function-bundle-size-issues) — HIGH

### Client Configuration Formats (verified)

- [MCP config files complete guide](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable) — MEDIUM
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) — HIGH (official Anthropic)
- [VS Code MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration) — HIGH (official)

### Internal references (CallVault repo)

- `.planning/PROJECT.md` (Workstream 4 — MCP-01 through MCP-05)
- `.planning/codebase/INTEGRATIONS.md:211-222` (current MCP setup)
- `.planning/codebase/CONCERNS.md:101-105` (monolith concern)
- `supabase/functions/mcp-server/index.ts` (current 3,921-line monolith)
- `supabase/functions/mcp-server/index.ts:212-225` (host resolution — already production-tested)
- `supabase/functions/mcp-server/index.ts:1080-1180` (auth + workspace scope branching — direct extension point for path-based workspace)
- `supabase/migrations/20260310160000_mcp_tokens.sql` (schema already supports workspace scope)
- `supabase/migrations/20260415120000_mcp_oauth_org_bindings.sql` (OAuth JWT→org binding)
- `cloudflare/api-proxy/worker.ts:143-145` (Worker forward rule — already handles `/mcp/*`)
- `docs/operations/mcp-runbook.md` (canonical MCP URLs + outputSchema contract)

---

*Research complete. Ready to feed roadmap creation for Workstream 4.*
