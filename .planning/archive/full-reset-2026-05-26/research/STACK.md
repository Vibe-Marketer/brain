# Stack Research

**Domain:** MCP Production Infrastructure — per-org MCP servers with AI tools, auto-provisioning, plan gating
**Researched:** 2026-04-10
**Confidence:** HIGH (core patterns verified against official docs and existing codebase)

---

## What Already Exists (Do Not Re-Add)

The codebase already has working implementations of:
- `supabase/functions/mcp-server/index.ts` — JSON-RPC 2.0 over HTTP, Bearer token auth via `mcp_tokens` table, 5 CRUD tools
- `supabase/functions/_shared/polar-client.ts` — Polar SDK client (`npm:@polar-sh/sdk`) for subscription state
- AI pattern: `ai@5.0.102` + `@openrouter/ai-sdk-provider@1.2.8` via esm.sh in Edge Functions
- `mcp_tokens` table with org/workspace scoping, token lookup index

The existing MCP server uses hand-rolled JSON-RPC (no MCP SDK). This is intentional and correct for stateless Supabase Edge Functions — do not replace it with the official TypeScript SDK.

---

## Recommended Stack — New Additions Only

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `mcp-lite` | `^0.8.2` | MCP protocol framework for new tools | Zero-dependency, Fetch API native, Deno-compatible, supports protocol versions 2025-03-26 and 2025-06-18. Supabase officially docs it as the recommended approach for Edge Function MCP servers. Replaces hand-rolled JSON-RPC incrementally — use for new tool modules. |
| `ai` (Vercel AI SDK) | `5.0.102` (already in use via esm.sh) | AI tool invocations inside MCP tools | Already proven in `summarize-call`. Use `generateText` + `generateObject` for all AI MCP tools. Keep the exact esm.sh import path pattern. |
| `@openrouter/ai-sdk-provider` | `1.2.8` (already in use via esm.sh) | LLM routing for AI tools | Already in production. OpenRouter gives model-agnostic access. `openai/gpt-5-nano` for fast tools (summarize, extract), `openai/gpt-4o-mini` for deeper analysis (sentiment, cross-call). |
| Supabase Database Webhooks (pg_net) | Built-in | Auto-provision MCP token on org creation | Native to Supabase — no external service needed. A Postgres trigger on `organizations` INSERT calls a webhook to `mcp-provision` Edge Function. Zero infrastructure added. |
| `zod` | `3.23.8` (already in use via esm.sh) | Input validation for new MCP tools | Already used throughout the codebase. MCP tool input schemas defined with Zod, doubles as JSON Schema via `z.toJSONSchema()` for the `tools/list` response. |

### Supporting Libraries (Already Available — Just Use Them)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | `^2` (via esm.sh) | Database queries inside MCP tool handlers | All data access — already proven in existing mcp-server |
| `npm:@polar-sh/sdk` | latest (via npm: specifier) | Check subscription tier before provisioning | Use in `mcp-provision` function to verify org is PRO+ before creating token |
| `langfuse` (shared util) | existing `_shared/langfuse.ts` | Trace AI tool calls | Apply to all AI MCP tools the same way summarize-call uses it |

### New Edge Functions Needed

| Function | Purpose | New Technology Required |
|----------|---------|------------------------|
| `mcp-provision` | Creates `mcp_tokens` row when org is created (PRO+ gate) | None — uses existing Supabase client + Polar client pattern |
| `mcp-server` (extended) | Add AI tools: summarize, extract-actions, cross-call-query, sentiment | `ai@5.0.102` + `@openrouter/ai-sdk-provider` via esm.sh (already used in other functions) |
| `mcp-token-manage` | CRUD for token UI: list, rename, revoke, regenerate | None — pure Supabase queries |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@modelcontextprotocol/sdk` (official TypeScript SDK) | Requires Node.js server process, not Deno-compatible without shims, designed for long-lived stateful connections incompatible with Edge Function ephemeral model. v2.0-alpha only — unstable. | Hand-rolled JSON-RPC (existing pattern) or `mcp-lite` for new tool modules |
| SSE / Streamable HTTP transport (2025-03-26 spec) | Requires persistent connection state that Supabase Edge Functions cannot maintain across invocations. Clients (Claude Desktop, Cursor, etc.) work fine with plain stateless HTTP+JSON. | Stateless HTTP POST (current pattern) — keep it |
| Redis or external session store | MCP tokens are long-lived API keys, not OAuth session tokens. No session state to maintain. | `mcp_tokens` table (already exists) |
| Separate MCP server process / Docker container | Adds infra complexity with no benefit for this scale. Edge Functions cold start is ~50ms at Supabase. | Supabase Edge Function (current approach) |
| `npm:mcp-lite` in Deno functions | mcp-lite is available via npm specifier but the Supabase Edge Runtime imports it more reliably via esm.sh | `https://esm.sh/mcp-lite@0.8.2` if adding mcp-lite to existing function |

---

## Auto-Provisioning Pattern

The provisioning flow uses Supabase's built-in `pg_net` + Database Webhooks — no external service:

```sql
-- Migration: trigger mcp-provision Edge Function on org creation
SELECT supabase_functions.http_request(
  'POST',
  current_setting('app.edge_function_url') || '/mcp-provision',
  '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}',
  json_build_object('org_id', NEW.id, 'owner_user_id', NEW.owner_user_id)::text,
  5000
)
```

The `mcp-provision` function:
1. Checks org owner's Polar subscription tier (query `user_profiles.subscription_status` + `product_id`)
2. If PRO+: inserts row into `mcp_tokens` with `scope='organization'`, auto-generated token
3. If FREE: skips silently (no error — user can provision manually from settings later)

No new infrastructure. No new SDK. Existing patterns.

---

## AI Tool Pattern for MCP

Reuse the exact pattern from `summarize-call/index.ts`:

```typescript
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateText, generateObject } from 'https://esm.sh/ai@5.0.102';

// Fast tools (summarize, extract-actions): gpt-5-nano — cheap, fast
// Deep tools (sentiment, cross-call): gpt-4o-mini — better reasoning
```

For the new AI MCP tools, the handler fetches the transcript(s) from Supabase, runs the AI call, and returns formatted text in the standard MCP `content: [{ type: "text", text: "..." }]` envelope. No streaming needed — MCP clients handle synchronous tool responses.

---

## Plan Tier Gating Pattern

Gating is enforced at the Edge Function level by querying `user_profiles`:

```typescript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('subscription_status, product_id')
  .eq('user_id', tokenRow.user_id)
  .maybeSingle();

const isPro = profile?.subscription_status === 'active'; // + product_id check for PRO tier
if (!isPro) return mcpError(id, -32001, 'MCP requires a PRO subscription', corsHeaders);
```

This is the existing pattern from `auto-tag-calls/index.ts` and `generate-ai-titles/index.ts`. No new mechanism needed.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Stateless HTTP POST (existing) | Streamable HTTP (2025-03-26 spec) | Spec requires session state — incompatible with stateless Edge Functions. All major MCP clients work with the existing approach. |
| Database webhook for auto-provision | Supabase Auth Hook | Auth hooks fire on user signup, not org creation. Wrong lifecycle event. |
| OpenRouter via `@openrouter/ai-sdk-provider` | Direct OpenRouter REST API | SDK provider gives typed responses, streaming support, and model switching without code changes. Already proven in production. |
| Single `mcp-server` function (extended) | Separate function per tool | Single function reduces cold start surface and simplifies token auth (one auth check per request). Extend existing file with new tool cases. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `ai@5.0.102` (esm.sh) | `@openrouter/ai-sdk-provider@1.2.8` | Confirmed working in `summarize-call` and `generate-ai-titles`. Do not mix `ai@6.x` (frontend) with `ai@5.x` (edge) — they're different packages. |
| `mcp-lite@0.8.2` | Deno / Supabase Edge Runtime | Supabase docs example uses exactly this version. Zero native deps means no compatibility issues. |
| `@supabase/supabase-js@2` (esm.sh) | All existing functions | Stable. All functions pin `@2` (semver range), not a specific minor. |

---

## Installation

No new npm packages are needed in `package.json` — all new dependencies are pulled via esm.sh inside Deno Edge Functions, following the existing pattern.

For mcp-lite (if used in a new function):
```typescript
// In Deno Edge Function only — not package.json
import { McpServer, StreamableHttpTransport } from 'https://esm.sh/mcp-lite@0.8.2';
```

---

## Sources

- [Supabase: Building an MCP Server with mcp-lite](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite) — mcp-lite version, Deno integration pattern
- [Supabase: Deploy MCP Servers](https://supabase.com/docs/guides/getting-started/byo-mcp) — stateless HTTP transport recommendation
- [MCP Transports spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP session requirements
- [MCP TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) — v2.0 still alpha, v1.x stable
- [fiberplane/mcp-lite](https://github.com/fiberplane/mcp-lite) — zero-dep, protocol version support
- [OpenRouter AI SDK Provider](https://github.com/OpenRouterTeam/ai-sdk-provider) — v1.2.8 confirmed for AI SDK v5
- Existing codebase: `supabase/functions/mcp-server/index.ts`, `summarize-call/index.ts`, `polar-customer-state/index.ts` — HIGH confidence, production-proven

---
*Stack research for: CallVault v2.1 MCP Production Infrastructure*
*Researched: 2026-04-10*
