# Phase 2: MCP Monolith Refactor - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 9
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/functions/mcp-server/index.ts` | edge orchestrator | JSON-RPC request-response | current monolith `Deno.serve` auth -> protocol -> plan gate -> category gate -> switch | exact |
| `supabase/functions/mcp-server/protocol.ts` | utility | JSON-RPC envelope transform | `mcpOk`, `mcpJsonResult`, `mcpError`, `unauthorizedResponse` in current `index.ts` | exact |
| `supabase/functions/mcp-server/auth.ts` | service utility | bearer-token auth | current hex-token service-role lookup and JWT/auth-client branch in `index.ts` | exact |
| `supabase/functions/mcp-server/gating.ts` | policy utility | token/category/plan gating | current plan-gating and category-gating blocks in `index.ts` | exact |
| `supabase/functions/mcp-server/tools/_types.ts` | type contract | tool handler interface | existing `JsonRpcRequest`, `McpToken`, `McpResult`, and `TOOL_CATEGORIES` usage | role-match |
| `supabase/functions/mcp-server/tools/registry.ts` | dispatch registry | handler lookup | current `TOOLS` array + `switch (toolName)` dispatch | role-match |
| `supabase/functions/mcp-server/tools/{read,write,admin,ai}/*.ts` | tool modules | DB/API call -> markdown text | matching `case '<tool>':` block in current `index.ts` | exact |
| `supabase/functions/mcp-server/__tests__/*.test.ts` | source/behavior tests | source anchor + simulated behavior | existing `category-gating`, `ai-tools-invariants`, `write-tools-boundary` tests | exact |
| `docs/operations/mcp-runbook.md` | operational docs | production contract | existing MCP URL and `content[].text` runbook sections | exact |

## Pattern Assignments

### `index.ts`

Use the current monolith as the behavioral source of truth. Keep the top-level order stable until the final trim: public CORS, non-POST 401 with `WWW-Authenticate`, JSON-RPC parse, bearer auth, protocol methods, paid-plan gate, category gate, then handler dispatch. Do not replace MCP auth with `_shared/auth.ts`.

### `protocol.ts`

Move the current JSON-RPC helpers without changing envelopes. Tool calls must return `content: [{ type: "text", text }]`; `initialize` and `tools/list` remain structured JSON protocol results. `unauthorizedResponse` must preserve HTTP 401 plus `WWW-Authenticate`.

### `auth.ts`

Preserve the two-token-family split exactly. Legacy 64-character hex tokens are looked up through the service-role Supabase client. Supabase OAuth JWTs are validated through `authClient.auth.getUser(rawToken)`, then org bindings are loaded with the service-role client.

### `gating.ts`

Preserve paid-plan gating before category gating and category gating before dispatch. Category enforcement uses `TOOL_CATEGORIES`; unknown tools fail closed when `enabled_categories` is non-null. Existing `enabled_categories: null` tokens keep full-access compatibility.

### `tools/_types.ts` and `tools/registry.ts`

Use one `ToolModule` contract with `{ definition, category, handler }`. `definition` must preserve the existing `TOOLS` entry including `outputSchema`; `category` must match `TOOL_CATEGORIES`; `handler` receives already-authenticated context and returns an MCP `Response` through protocol helpers.

### Tool modules

Each tool module starts from its exact existing `case` block. Preserve table names, filters, error messages, markdown formatting, cache order, usage gates, and source metadata quirks. AI modules are the only files allowed to dynamically import `@openrouter/ai-sdk-provider`, `ai`, and `zod`.

### Tests

Follow the current source-anchor pattern. Tests may mirror logic when Deno imports cannot run in Vitest, but each mirrored behavior needs an anchor against live source so refactors cannot leave stale test copies passing.

## Shared Patterns

- One Edge Function only: all new files live under `supabase/functions/mcp-server/`.
- No visible behavior changes in Phase 2. Per-workspace URLs and new write tools are deferred to later phases.
- Tool count is 41 in current production code; plan and tests must audit actual code, not stale roadmap wording.
- `npm run build` is mandatory before push because `mcp-server/index.ts` is touched.
