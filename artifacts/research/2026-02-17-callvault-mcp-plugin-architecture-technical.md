# Technical Research: CallVault MCP Server & Multi-Platform Plugin Architecture

**Date:** 2026-02-17
**Type:** Technical Implementation Research
**Context:** CallVault strategic pivot to thin app + MCP/plugin data layer

---

## Strategic Summary

CallVault should build **one MCP server** deployed as a Supabase Edge Function (Streamable HTTP transport) that simultaneously serves Claude Desktop, Gemini, Perplexity, Cursor, and any MCP-compatible client. A **REST API + OpenAPI spec** built on the same data layer serves ChatGPT GPTs and generic integrations. An **OpenClaw plugin** wraps the same API to serve as a skill inside the OpenClaw agent gateway. The key differentiator isn't parity with Fireflies/Otter/Gong -- it's **cross-call intelligence, multi-source media support, and workspace-aware context** that no competitor exposes via MCP today.

---

## Requirements

- **Must work with:** Claude Desktop/Code, ChatGPT, Gemini, Perplexity, Cursor, OpenClaw, Open WebUI
- **Auth:** OAuth 2.1 via Supabase Auth (MCP standard), API keys for REST fallback
- **Data isolation:** Existing RLS policies must enforce bank/vault boundaries through MCP
- **Content types:** Call transcripts, YouTube videos, uploaded audio/MP3, voice notes, any future media
- **Deployment:** Supabase Edge Functions preferred (existing stack)
- **Non-technical users:** Important but secondary; minimal in-app chat as bridge

---

## Competitor Analysis: What They Expose (and What They Don't)

### Fireflies.ai MCP (Beta, June 2025)
- **Tools exposed:** Search transcripts, get transcript, get summary, get metadata
- **Auth:** OAuth or API key via `Authorization: Bearer`
- **URL:** `https://api.fireflies.ai/mcp`
- **Gaps:** No cross-call analysis tools. No multi-workspace support. No content-type diversity (meetings only). No prompt templates. No resource URIs for browsing.

### Otter.ai MCP (Enterprise, Oct 2025)
- **Tools exposed:** Search meeting transcripts, analyze patterns across meetings, generate content from meeting data
- **Auth:** OAuth with granular permissions
- **Gaps:** Enterprise-only (not available on free/pro tiers). No resource primitives. No workspace/folder navigation. Marketing-light on actual tool definitions.

### Gong MCP (Oct 2025)
- **Architecture:** Bidirectional -- MCP Gateway (inbound: external data into Gong) + MCP Server (outbound: Gong data to external agents)
- **Integrations:** Microsoft Dynamics 365, Salesforce Agentforce, HubSpot
- **Gaps:** Enterprise-focused (4,800+ companies, large-scale). Revenue-team specific tools. Not accessible to individual users. No self-serve MCP connection.

### Key Competitive Gaps (Your Opportunity)

| Gap | Fireflies | Otter | Gong | CallVault Opportunity |
|-----|-----------|-------|------|-----------------------|
| Cross-call analysis tools | No | Limited | Enterprise-only | Expose `compare_calls`, `analyze_patterns`, `track_topic_across_calls` |
| Multi-content-type support | Meetings only | Meetings only | Calls only | Calls + YouTube + audio + voice notes + any transcript |
| Workspace/folder navigation | No | No | No | `list_banks`, `list_vaults`, `browse_folder` with full hierarchy |
| MCP Resources (browsable) | No | No | No | `callvault://banks/{id}/calls` URI scheme for context browsing |
| MCP Prompts (templates) | No | No | No | Pre-built analysis prompts users can invoke with one click |
| Speaker-centric queries | Basic search | No | Enterprise | `get_speaker_history`, `compare_speaker_across_calls` |
| Shareable context | No | No | Enterprise | Share vault links that MCP clients can resolve |
| Free/Pro tier access | Yes (beta) | Enterprise-only | Enterprise-only | Available on all paid tiers |

---

## Approach 1: Supabase Edge Function + mcp-lite (Recommended)

**How it works:** Single Edge Function deployed at `https://<project>.supabase.co/functions/v1/mcp-server/mcp` using the `mcp-lite` framework. Handles all MCP protocol communication via Streamable HTTP transport. Authentication flows through Supabase Auth's OAuth 2.1 server. Same function also exposes REST endpoints for non-MCP clients.

**Libraries/tools:**
- `mcp-lite@0.10.0` -- zero-dependency MCP framework (Supabase-recommended)
- `hono@4.6+` -- HTTP routing (already used by Supabase examples)
- `zod@4.x` -- schema validation for tool inputs/outputs
- Supabase Auth OAuth 2.1 Server (built-in)
- Supabase JS Client (for DB queries respecting RLS)

**Pros:**
- Zero cold starts, global distribution via Supabase Edge
- Direct Postgres access with existing RLS policies
- Same TypeScript/Deno stack you already use
- mcp-lite is lightweight (0 runtime deps), spec-compliant, supports tools + resources + prompts
- OAuth 2.1 auto-discovery at `/.well-known/oauth-authorization-server`
- One deployment serves all MCP clients (Claude, Gemini, Perplexity, Cursor)
- Existing `supabase functions deploy` workflow

**Cons:**
- Edge Function limits: 150s wall clock (sufficient for data queries, tight for heavy aggregation)
- mcp-lite is newer (95 stars, 13 contributors vs official SDK's 11.6K stars)
- No built-in session persistence (stateless by default; adapters needed for SSE streaming)
- Supabase Edge Functions don't support WebSocket (HTTP + SSE only, which is fine for Streamable HTTP)

**Best when:** You want to stay in the Supabase ecosystem, deploy fast, and leverage existing RLS

**Complexity:** S-M

### Architecture Detail

```
Claude Desktop / Gemini / Perplexity / Cursor
        |
        | Streamable HTTP (POST/GET with SSE)
        v
[Supabase Edge Function: /functions/v1/mcp-server/mcp]
        |
        | OAuth 2.1 token validation
        v
[mcp-lite McpServer + Hono router]
        |
        | Supabase JS Client (uses user's auth token)
        v
[Supabase Postgres + RLS]
```

---

## Approach 2: Official MCP TypeScript SDK (@modelcontextprotocol/server)

**How it works:** Use the official Anthropic-maintained TypeScript SDK to build the MCP server. Can deploy on Supabase Edge Functions (with Hono middleware adapter) or as a standalone Node.js server.

**Libraries/tools:**
- `@modelcontextprotocol/server@2.x` (v2 pre-alpha, v1.27.0 stable)
- `@modelcontextprotocol/hono` (optional Hono middleware)
- `zod@4.x` (peer dependency)
- Supabase Auth OAuth 2.1

**Pros:**
- Official SDK, maintained by Anthropic (11.6K stars, 151 contributors)
- Most complete spec implementation including Tasks (experimental), all edge cases
- Best documentation, largest community
- v2 shipping Q1 2026 with split packages (server/client)
- Express + Hono + Node middleware adapters available

**Cons:**
- Heavier than mcp-lite (more dependencies, more abstraction)
- v2 is pre-alpha right now; v1.x is stable but will be legacy in 6 months
- Slightly more complex setup for Supabase Edge Functions (Deno compatibility)
- More code to write for the same functionality

**Best when:** You want maximum spec compliance, long-term community support, and don't mind slightly more setup

**Complexity:** M

---

## Approach 3: Unified REST API + MCP Adapter Layer

**How it works:** Build a clean REST API first (OpenAPI 3.0 spec), then wrap it with a thin MCP adapter layer that translates MCP tool calls into REST API calls. This gives you one API surface that serves MCP clients, ChatGPT GPTs, OpenClaw plugins, and direct API consumers.

**Libraries/tools:**
- Supabase Edge Functions (REST endpoints)
- `mcp-lite` or official SDK (thin MCP wrapper)
- OpenAPI 3.0 spec (hand-written or generated)
- `@asteasolutions/zod-to-openapi` for generating OpenAPI from Zod schemas

**Pros:**
- Single source of truth for all integrations (MCP, ChatGPT, OpenClaw, direct API)
- OpenAPI spec can generate ChatGPT GPT Actions automatically
- REST API is testable independently with curl/Postman
- Easiest to add new platforms later (any client that speaks HTTP)
- API-first design is more resilient to MCP spec changes

**Cons:**
- Extra abstraction layer (MCP → REST → DB instead of MCP → DB directly)
- Slight latency increase from the adapter hop
- More initial design work to get the REST API shape right
- Risk of lowest-common-denominator: MCP features like Resources and Prompts don't map cleanly to REST

**Best when:** Multi-platform support is the primary goal and you want to maintain a single API surface

**Complexity:** M-L

---

## Data Prerequisite: Structured Attendee Names

Before the MCP can expose useful attendee/contact data, the `contacts` and `speakers` tables need `first_name` and `last_name` columns. Currently both store a single `name` TEXT field.

**What to do:**
- Add `first_name TEXT` and `last_name TEXT` columns to `contacts` (and optionally `speakers`)
- Backfill by splitting existing `name` values (first space = split point, or use the full name as `first_name` if no space)
- Update import pipelines to populate `first_name`/`last_name` at import time (Fathom and Google Meet provide structured or parseable names)
- The MCP `get_contacts` and `get_recording_attendees` tools return `{first_name, last_name, email}` -- CRM-ready without downstream parsing

This is a small migration + backfill, not a schema redesign. It makes the MCP output directly usable for CRM integration (HubSpot, Salesforce, Pipedrive all expect first/last name as separate fields).

---

## CallVault MCP Server: Tool Inventory Design

This is where differentiation lives. Every competitor exposes 3-5 basic tools (search, get transcript, get summary). CallVault should expose **three tiers** of increasingly powerful tools.

### Tier 1: Table Stakes (What Competitors Have)

These are required for parity. Without them, you're behind.

| Tool | Input | Output | Notes |
|------|-------|--------|-------|
| `search_recordings` | `query`, `vault_id?`, `folder_id?`, `speaker?`, `date_from?`, `date_to?`, `tags?`, `source?`, `limit?` | Array of recording summaries with IDs, titles, dates, speakers, tags | pg_trgm full-text on transcripts + metadata filters |
| `get_transcript` | `recording_id`, `format?` (full/speaker-turns/timestamps) | Full transcript text, optionally structured by speaker turn | Core data access tool |
| `get_recording_metadata` | `recording_id` | Title, date, duration, speakers, tags, folder, source, talk-time stats | Everything about a recording except the transcript |
| `list_recent_recordings` | `vault_id?`, `limit?`, `offset?` | Recent recordings with basic metadata | Quick access to latest content |
| `list_vaults` | none | User's accessible vaults with names, descriptions, member counts | Workspace navigation |

### Tier 2: Organizational Intelligence (What Competitors Don't Have)

These leverage CallVault's unique bank/vault/folder architecture and multi-source content.

| Tool | Input | Output | Notes |
|------|-------|--------|-------|
| `browse_vault` | `vault_id`, `folder_id?` | Folders, subfolders, recordings in the vault/folder with counts | **No competitor has this.** Navigate the org structure. |
| `get_speaker_history` | `speaker_name`, `vault_id?`, `date_from?`, `date_to?` | All recordings featuring this speaker, chronologically | Contact-centric analysis across calls |
| `get_vault_analytics` | `vault_id`, `date_from?`, `date_to?` | Recording count, total duration, top speakers, most-used tags, activity trends | Vault-level intelligence |
| `search_by_source` | `source` (fathom/zoom/google-meet/youtube/upload), `vault_id?`, `date_from?`, `date_to?` | Recordings filtered by import source | Multi-source awareness |
| `get_tags_and_folders` | `vault_id` | Complete tag taxonomy and folder hierarchy | Lets the AI understand the user's organizational system |
| `get_contacts` | `vault_id?`, `search?` | Contact list with `first_name`, `last_name`, `email`, meeting frequency, last interaction | CRM-ready structured contact data |
| `get_recording_attendees` | `recording_id` | Array of `{first_name, last_name, email}` for all participants/speakers on this recording | Structured attendee extraction for CRM push |

### Tier 3: Cross-Call Intelligence (Your Moat)

These are tools that **no competitor MCP server offers** because they require organizational context that Fireflies/Otter/Gong don't have in their MCP layer.

| Tool | Input | Output | Notes |
|------|-------|--------|-------|
| `compare_recordings` | `recording_ids` (2-5 IDs) | Transcripts side-by-side with metadata for each | Let the LLM do the comparison with full context |
| `get_topic_timeline` | `keyword_or_phrase`, `vault_id?`, `date_from?`, `date_to?` | Timeline of when/where this topic appears across recordings | Track how a topic evolves across conversations |
| `get_speaker_across_recordings` | `speaker_name`, `recording_ids?`, `vault_id?` | Only this speaker's turns extracted from multiple recordings | Isolate one person's statements across meetings |
| `batch_get_transcripts` | `recording_ids` (up to 5), `format?` | Multiple transcripts in one call | Efficient for cross-call analysis; reduces round-trips |
| `get_recording_context` | `recording_id` | Transcript + folder path + tags + related recordings (same folder, same speakers, same week) | Rich context package for deep analysis |

### MCP Resources (Browsable Content)

Resources are URI-identified content that MCP clients can browse and attach to context. **None of the competitors use MCP Resources.**

| Resource URI | Description |
|---|---|
| `callvault://banks` | List of all banks user has access to |
| `callvault://banks/{bank_id}/vaults` | Vaults within a bank |
| `callvault://vaults/{vault_id}/recordings` | Recordings in a vault |
| `callvault://vaults/{vault_id}/folders/{folder_id}` | Recordings in a folder |
| `callvault://recordings/{recording_id}/transcript` | Full transcript as a readable resource |
| `callvault://recordings/{recording_id}/metadata` | Recording metadata as JSON |

Resource templates enable dynamic navigation:
- `callvault://recordings/{recording_id}/transcript` -- parameterized, auto-completable
- `callvault://vaults/{vault_id}/search?q={query}` -- search within a vault

### MCP Prompts (Pre-Built Templates)

Prompts are user-invocable templates (slash commands in Claude Desktop). **None of the competitors use MCP Prompts.**

| Prompt | Arguments | What It Does |
|--------|-----------|-------------|
| `analyze_call` | `recording_id` | Fetches transcript + metadata, instructs LLM to provide structured analysis (key topics, action items, sentiment, next steps) |
| `compare_calls` | `recording_id_1`, `recording_id_2` | Fetches both transcripts, instructs LLM to compare themes, outcomes, speaker dynamics |
| `prepare_for_meeting` | `contact_name`, `vault_id?` | Fetches all past recordings with this contact, instructs LLM to generate a prep briefing |
| `weekly_digest` | `vault_id`, `date_from?` | Fetches all recordings from the past week, instructs LLM to generate an executive summary |
| `extract_action_items` | `recording_id` or `vault_id` + `date_range` | Pulls transcripts and asks LLM to extract all commitments, owners, and deadlines |
| `sales_pipeline_review` | `vault_id`, `date_from?` | Aggregates recent sales calls, instructs LLM to analyze pipeline health, objections, next steps |

---

## Multi-Platform Integration Architecture

### MCP Server (Claude, Gemini, Perplexity, Cursor)

One server serves all MCP-compatible clients.

**Connection methods:**
1. **Claude Desktop/Code:** Settings > Connectors > Add Custom Connector > URL: `https://<project>.supabase.co/functions/v1/mcp-server/mcp`
2. **Gemini:** Extensions marketplace listing or manual MCP URL
3. **Perplexity:** Settings > MCP > Add remote server
4. **Cursor:** `.cursor/mcp.json` config

**One-click install (Desktop Extension):**
Ship a `.mcpb` desktop extension file that auto-configures Claude Desktop. Users click one link and are connected.

### ChatGPT GPT (via REST API + OpenAPI)

ChatGPT GPTs use "Actions" backed by an OpenAPI spec. The same data layer powers this.

**Architecture:**
```
ChatGPT GPT
    |
    | HTTP (Actions based on OpenAPI spec)
    v
[Supabase Edge Function: /functions/v1/api/v1/*]
    |
    | OAuth 2.0 or API key auth
    v
[Same Supabase Postgres + RLS]
```

**Endpoints (map to MCP tools):**
- `GET /api/v1/recordings?q=&vault_id=&speaker=&...` → `search_recordings`
- `GET /api/v1/recordings/{id}` → `get_recording_metadata`
- `GET /api/v1/recordings/{id}/transcript` → `get_transcript`
- `GET /api/v1/vaults` → `list_vaults`
- `GET /api/v1/vaults/{id}/browse` → `browse_vault`
- `GET /api/v1/contacts?vault_id=&search=` → `get_contacts`
- `POST /api/v1/recordings/compare` → `compare_recordings`

**Risk:** ChatGPT Actions are transitioning to "Apps" framework. Build the REST API as stable foundation regardless.

### OpenClaw Plugin

OpenClaw is a self-hosted AI agent gateway for WhatsApp, Telegram, Discord, iMessage. A CallVault plugin would let users query their call data from any messaging app.

**Plugin structure:**
```
@callvault/openclaw-plugin/
  openclaw.plugin.json     # manifest
  index.ts                 # plugin entry
  skills/
    callvault/
      SKILL.md             # AgentSkills-compatible skill definition
```

**Plugin manifest (`openclaw.plugin.json`):**
```json
{
  "id": "callvault",
  "name": "CallVault",
  "version": "1.0.0",
  "description": "Access your CallVault call transcripts, recordings, and organizational data",
  "configSchema": {
    "type": "object",
    "properties": {
      "apiUrl": { "type": "string", "default": "https://<project>.supabase.co/functions/v1/api/v1" },
      "apiKey": { "type": "string" }
    },
    "required": ["apiKey"]
  },
  "uiHints": {
    "apiKey": { "label": "CallVault API Key", "sensitive": true },
    "apiUrl": { "label": "API URL", "placeholder": "https://your-project.supabase.co/functions/v1/api/v1" }
  }
}
```

**Plugin registers tools as OpenClaw agent tools** that call the CallVault REST API:
```typescript
export default function(api) {
  api.registerTool('callvault_search', {
    description: 'Search CallVault recordings by keyword, speaker, date, or tags',
    parameters: { query: 'string', vault_id: 'string?', speaker: 'string?', ... },
    handler: async (args, ctx) => {
      const response = await fetch(`${config.apiUrl}/recordings?q=${args.query}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
      return { content: [{ type: 'text', text: JSON.stringify(await response.json()) }] };
    }
  });
  // ... register other tools
}
```

**OpenClaw skill (`SKILL.md`):**
```markdown
---
name: callvault
description: Search and analyze your call recordings, transcripts, and meeting data from CallVault
metadata: {"openclaw": {"requires": {"config": ["plugins.entries.callvault.enabled"]}, "primaryEnv": "CALLVAULT_API_KEY"}}
---

## CallVault Integration

You have access to CallVault tools for searching and analyzing call recordings.
Use `callvault_search` to find recordings, `callvault_transcript` to get full transcripts,
and `callvault_compare` to compare multiple calls.
```

### Open WebUI Integration

Open WebUI (282M+ downloads, 124K GitHub stars) is a self-hosted AI interface. Integration via:

1. **Tool/Function:** Open WebUI supports Python tools/functions that users install from the community. A CallVault function would call the REST API.
2. **MCP Support:** Open WebUI is adding MCP client support. Once available, users connect the same MCP server URL.

---

## Deployment Approach Tradeoffs

| Aspect | Supabase Edge Functions | Standalone Node Server | Cloudflare Workers |
|--------|------------------------|----------------------|-------------------|
| **Infra cost** | Included in Supabase plan | Separate hosting needed | Separate CF plan |
| **DB latency** | Direct Postgres (same region) | Network hop to Supabase | Network hop |
| **Auth** | Native Supabase Auth OAuth 2.1 | Must proxy to Supabase Auth | Must proxy |
| **RLS** | Works automatically | Must forward user token | Must forward |
| **Deployment** | `supabase functions deploy` | Docker/PM2/whatever | `wrangler deploy` |
| **Cold starts** | Zero (Edge Functions stay warm) | Depends on hosting | Zero |
| **Max execution** | 150s wall clock | Unlimited | 30s (50ms CPU on free) |
| **Stack alignment** | Same Deno/TS you already use | Node.js | Workers runtime |
| **Session state** | Stateless (adapters for SSE) | Full control | KV/Durable Objects |

**Recommendation:** Supabase Edge Functions. The direct Postgres access + automatic RLS + zero-config OAuth 2.1 makes this the clear winner for your stack. The 150s limit is not a concern for data queries.

---

## Comparison

| Aspect | Approach 1: mcp-lite on Supabase | Approach 2: Official SDK | Approach 3: REST API + Adapter |
|--------|----------------------------------|--------------------------|-------------------------------|
| Complexity | S-M | M | M-L |
| Performance | Good (direct DB, zero deps) | Good (more abstraction) | OK (extra hop) |
| Maintainability | Good (simple, small) | Good (large community) | Good (single API surface) |
| Multi-platform | MCP only; REST separate | MCP only; REST separate | All platforms from one API |
| Spec compliance | High (v2025-06-18) | Highest | MCP via adapter layer |
| Time to build | 1-2 weeks | 2-3 weeks | 3-4 weeks |
| Future-proof | Depends on mcp-lite adoption | Strongest (Anthropic-backed) | Most platform-resilient |

---

## Recommendation

**Approach 1 (mcp-lite on Supabase Edge Functions) for the MCP server, paired with a REST API layer for ChatGPT/OpenClaw/generic clients.**

Rationale:
1. **mcp-lite is what Supabase officially recommends** for their Edge Functions. It's built for your exact deployment target.
2. **The REST API is additive, not alternative.** Build it alongside the MCP server in the same Edge Function (different routes). One function, two interfaces.
3. **Start shipping in 1-2 weeks.** The mcp-lite API surface is minimal and spec-compliant. Don't over-engineer.
4. **Differentiate through tool design, not infrastructure.** Your moat is the tool inventory (cross-call intelligence, workspace navigation, prompt templates, resource URIs) -- not the transport layer.
5. **The official SDK is insurance.** If mcp-lite stalls, migration to `@modelcontextprotocol/server` is straightforward since both implement the same protocol.

---

## Implementation Context

<claude_context>
<chosen_approach>
- name: mcp-lite MCP Server + REST API on Supabase Edge Functions
- libraries:
  - mcp-lite@0.10.0 (MCP server framework)
  - hono@4.6.14 (HTTP routing)
  - zod@4.x (schema validation)
  - @supabase/supabase-js (DB client with RLS)
- install: npm create mcp-lite@latest (scaffold), supabase functions deploy (ship)
</chosen_approach>
<architecture>
- pattern: Single Edge Function with dual interface (MCP + REST)
- components:
  1. MCP Server (mcp-lite) - tools, resources, prompts exposed via Streamable HTTP
  2. REST API (Hono routes) - same data operations exposed as OpenAPI endpoints
  3. Auth layer - Supabase Auth OAuth 2.1 for MCP, API keys for REST
  4. Data layer - Supabase JS Client with user token forwarding for RLS
  5. OpenClaw plugin - separate npm package wrapping REST API
  6. ChatGPT GPT - separate GPT config pointing at REST API with OpenAPI spec
- data_flow:
  MCP Client → Streamable HTTP POST → Edge Function → mcp-lite → Supabase Client (with user token) → Postgres (RLS enforced) → Response
  REST Client → HTTP GET/POST → Edge Function → Hono handler → Supabase Client → Postgres → JSON Response
</architecture>
<files>
- create:
  - supabase/functions/mcp-server/index.ts (main entry: Hono app + MCP server)
  - supabase/functions/mcp-server/tools/ (tool definitions, one file per tier)
  - supabase/functions/mcp-server/resources/ (resource definitions)
  - supabase/functions/mcp-server/prompts/ (prompt definitions)
  - supabase/functions/mcp-server/api/ (REST API routes)
  - supabase/functions/mcp-server/lib/db.ts (shared Supabase client factory)
  - supabase/functions/mcp-server/lib/auth.ts (token validation helpers)
  - supabase/functions/mcp-server/deno.json (Deno imports)
  - packages/openclaw-plugin/ (OpenClaw plugin package)
  - docs/api/openapi.yaml (OpenAPI 3.0 spec for REST API)
- structure:
  supabase/functions/mcp-server/
    index.ts
    deno.json
    tools/
      search.ts
      recordings.ts
      vaults.ts
      cross-call.ts
      contacts.ts
    resources/
      banks.ts
      recordings.ts
    prompts/
      analyze.ts
      compare.ts
      prepare.ts
    api/
      v1/routes.ts
    lib/
      db.ts
      auth.ts
      schemas.ts
- reference:
  - Existing Supabase Edge Functions in supabase/functions/
  - Existing RPC functions and RLS policies
  - Existing recording/transcript/vault data models
</files>
<implementation>
- start_with: Tier 1 tools (search, get_transcript, get_metadata, list_recent, list_vaults) + basic MCP server skeleton
- order:
  1. Scaffold mcp-lite server on Supabase Edge Function
  2. Implement Supabase Auth OAuth 2.1 (enable OAuth server, build authorize endpoint)
  3. Build Tier 1 tools (5 tools) with Zod schemas
  4. Test with Claude Desktop (add as custom connector)
  5. Build REST API endpoints (same data, Hono routes)
  6. Build Tier 2 tools (6 tools: vault browsing, speaker history, analytics)
  7. Add MCP Resources (callvault:// URI scheme)
  8. Add MCP Prompts (6 prompt templates)
  9. Build Tier 3 tools (5 tools: cross-call intelligence)
  10. Generate OpenAPI spec, create ChatGPT GPT
  11. Build OpenClaw plugin package
  12. Ship desktop extension (.mcpb) for one-click Claude install
- gotchas:
  - OAuth 2.1 setup is the critical path. Test the full authorize → token exchange → MCP connection flow early.
  - Edge Function 150s timeout: all queries must be efficient. Use LIMIT, avoid full-table scans.
  - Transcript size: full transcripts of 1-hour calls can be 30K+ tokens. Offer format options (full, speaker-turns only, summary-with-excerpts).
  - RLS must flow through: always create Supabase client with the user's access token, never use service role in MCP handlers.
  - mcp-lite is stateless by default. For SSE streaming (GET endpoint), you'll need InMemorySessionAdapter.
  - ChatGPT Actions platform risk: build REST API as stable foundation regardless of OpenAI changes.
  - Zod v4 is required by both mcp-lite and the official SDK. Pin versions carefully.
- testing:
  - MCP Inspector (npx @modelcontextprotocol/inspector) for protocol compliance testing
  - Claude Code: `claude mcp add callvault -t http <url>` for real-world testing
  - curl for REST API endpoints
  - Supabase local dev: `supabase functions serve --no-verify-jwt mcp-server` for local testing
  - Test with multiple user accounts to verify RLS isolation
</implementation>
</claude_context>

**Next Action:** Build the MCP server skeleton with Tier 1 tools. The OAuth 2.1 setup should be validated within the first 3 days -- if users can't connect Claude Desktop to their CallVault account in <2 minutes, the entire strategy is at risk.

---

## Sources

- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/concepts/architecture) - Feb 2026
- [MCP Tools Specification](https://modelcontextprotocol.io/docs/concepts/tools) - Protocol v2025-06-18
- [MCP Resources Specification](https://modelcontextprotocol.io/docs/concepts/resources) - Protocol v2025-06-18
- [MCP Prompts Specification](https://modelcontextprotocol.io/docs/concepts/prompts) - Protocol v2025-06-18
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - v1.27.0 stable, v2 pre-alpha
- [mcp-lite Framework](https://github.com/fiberplane/mcp-lite) - v0.10.0
- [Supabase MCP Server with mcp-lite](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite) - Feb 2026
- [Supabase Auth MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) - Feb 2026
- [Fireflies MCP Server (beta)](https://fireflies.ai/blog/fireflies-mcp-server/) - Jun 2025
- [Otter.ai MCP Enterprise](https://otter.ai/blog/otter-for-enterprise-connect-ai-to-ai-with-otters-mcp) - Oct 2025
- [Gong MCP Support](https://www.gong.io/press/gong-introduces-model-context-protocol-mcp-support-to-unify-enterprise-ai-agents-from-hubspot-microsoft-salesforce-and-others) - Oct 2025
- [Anthropic Desktop Extensions (.mcpb)](https://www.anthropic.com/engineering/desktop-extensions) - 2025
- [OpenClaw Documentation](https://docs.openclaw.ai) - Feb 2026
- [OpenClaw Plugin System](https://docs.openclaw.ai/tools/plugin.md) - Feb 2026
- [OpenClaw Skills](https://docs.openclaw.ai/tools/skills.md) - Feb 2026
- [Open WebUI](https://openwebui.com) - 282M+ downloads, 124K GitHub stars
- [ChatGPT Actions (GPTs)](https://platform.openai.com/docs/actions/introduction) - transitioning to Apps framework
