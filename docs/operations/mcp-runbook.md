# MCP Server Runbook

**Last updated:** 2026-05-12
**Owner:** Andrew Naegele (naegele412@gmail.com)
**Status:** Production

---

## Canonical MCP URL (READ THIS FIRST)

**The CallVault MCP server has ONE supported public surface:**

| Purpose | URL |
|---|---|
| MCP JSON-RPC endpoint | `https://api.callvaultai.com/mcp` |
| OAuth protected-resource metadata | `https://api.callvaultai.com/.well-known/oauth-protected-resource` |
| OAuth authorization-server metadata | `https://api.callvaultai.com/.well-known/oauth-authorization-server` |
| OIDC discovery | `https://api.callvaultai.com/.well-known/openid-configuration` |
| Dynamic client registration (RFC 7591) | `https://api.callvaultai.com/mcp-register` |
| Authorization endpoint | `https://api.callvaultai.com/auth/v1/oauth/authorize` |
| Token endpoint | `https://api.callvaultai.com/auth/v1/oauth/token` |

These all resolve through the Cloudflare Worker at `cloudflare/api-proxy/worker.ts`
which proxies to the underlying Supabase Edge Functions
(`mcp-server`, `mcp-oauth-metadata`, `mcp-oauth-register`).

**Do NOT use `app.callvaultai.com/api/mcp` or `app.callvaultai.com/.well-known/*`.**
Those legacy Vercel rewrites were removed in the v2.2 MCP debug session
(`.planning/debug/mcp-auth-and-tool-schema.md`) because they were serving
broken host-aware metadata — they accepted traffic on the app domain but
advertised the api domain as the OAuth `resource`, which violated RFC 8707
audience-binding and broke Claude Code's auth flow.

The raw Supabase URL (`https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/mcp-server`)
still works for internal health checks but should NEVER be given to MCP clients —
their OAuth flow needs the discovery documents on the vanity domain.

---

## What is MCP in CallVault?

CallVault exposes a Model Context Protocol (MCP) server so AI clients
(Claude Desktop, Cursor, ChatGPT, Perplexity, custom agents) can act on
behalf of authenticated users — search calls, read transcripts, manage
folders/tags, kick off AI actions like auto-tagging.

The server uses **OAuth 2.1 with PKCE** through Supabase Auth. Clients
register dynamically via `mcp-oauth-register`, get authorization through
`/oauth/consent`, and exchange the code at `mcp-oauth-metadata` for access
+ refresh tokens stored in the `mcp_tokens` table.

**One MCP token per org** (enforced at the service layer — Phase 18-01).

### Tool outputSchema contract

All 41 MCP tools declare `outputSchema` as:

```jsonc
{
  "type": "object",
  "properties": { "text": { "type": "string", "description": "..." } },
  "required": ["text"]
}
```

The MCP spec REQUIRES `outputSchema.type === "object"` at the root. An
earlier shape (`{ type: "string" }`) was added in commit `3263cfe0` to help
ChatGPT structured-output, but it violated the spec and caused Claude Code
and Perplexity to reject the entire tool list. The current shape preserves
the descriptive intent while passing spec validation. Handlers continue to
emit `content: [{ type: "text", text: <string> }]` — the outputSchema is
descriptive only (no tool currently emits `structuredContent`).

## Phase 2 MCP refactor verification

Final module layout after Phase 2:

| Layer | Files |
|---|---|
| HTTP/protocol orchestrator | `supabase/functions/mcp-server/index.ts` |
| Tool registry | `supabase/functions/mcp-server/tools/registry.ts` |
| Tool definitions | `supabase/functions/mcp-server/tools/definitions.ts` |
| Read tools | `supabase/functions/mcp-server/tools/read/*.ts` |
| Write tools | `supabase/functions/mcp-server/tools/write/*.ts` |
| Admin tools | `supabase/functions/mcp-server/tools/admin/*.ts` |
| AI tools | `supabase/functions/mcp-server/tools/ai/*.ts` |

`index.ts` must stay orchestration-only: CORS/non-POST handling, JSON-RPC
parse, MCP auth, protocol methods, plan/category gates, registry lookup,
handler invocation, and unknown-tool error handling. It must not regain inline
tool definitions or a `switch (toolName)` dispatcher.

Final local gates from the Phase 2 close-out session:

```bash
test "$(wc -l < supabase/functions/mcp-server/index.ts)" -le 300
! rg -n "case '.*':" supabase/functions/mcp-server/index.ts
npm test -- --run \
  supabase/functions/mcp-server/__tests__/category-gating.test.ts \
  supabase/functions/mcp-server/__tests__/ai-tools-invariants.test.ts \
  supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts \
  supabase/functions/mcp-server/__tests__/track-ai-usage-registry.test.ts \
  supabase/functions/mcp-server/__tests__/golden-replay.test.ts \
  supabase/functions/mcp-server/__tests__/contract-surface.test.ts
npm run build
deno check supabase/functions/mcp-server/index.ts
```

As of 2026-05-28, the targeted MCP tests pass and `npm run build` passes.
`deno check supabase/functions/mcp-server/index.ts` still fails because Deno
resolves incompatible external `ai@5.0.102` and OpenRouter provider type
versions, and because Supabase nested-select generated types surface array-vs-
object cast drift in extracted modules. Treat the replacement type gate as:
targeted MCP tests + `npm run build` + deployed smoke, until the external type
drift is fixed deliberately.

Phase 2 close-out deployed smoke on 2026-05-28 against
`https://api.callvaultai.com/mcp` passed:

- Invalid bearer: HTTP 401 with `WWW-Authenticate`
- Valid-token `initialize`: HTTP 200 with `serverInfo.name = callvault`
- Valid-token `tools/list`: HTTP 200 with 41 tools
- Valid-token `list_calls`: HTTP 200 with `content[0].type = text`

Candidate read-path timing after deploy, using 10 `list_calls` invocations with
20-second spacing, returned HTTP 200 for all calls with median total 0.459s and
p95 total 0.747s. No pre-refactor baseline timing was captured before deploy, so
the required 30% cold-start improvement is not verified from this evidence.

Use these commands before and after MCP refactor deploys. They intentionally
target the public vanity endpoint, not the raw Supabase function URL.

Prerequisites:

```bash
export CALLVAULT_MCP_TOKEN="<valid mcp token>"
export MCP_URL="https://api.callvaultai.com/mcp"
```

Invalid bearer must return HTTP 401 and include `WWW-Authenticate`:

```bash
curl -i "$MCP_URL" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

Valid token `initialize` must return structured JSON protocol metadata:

```bash
curl -fsS "$MCP_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"initialize","params":{}}' \
  | jq '.result.serverInfo'
```

Valid token `tools/list` must return 41 tools through the structured protocol
result:

```bash
curl -fsS "$MCP_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}' \
  | jq '.result.tools | length'
```

Representative read tool calls must return the tool envelope with
`content[0].type == "text"`:

```bash
curl -fsS "$MCP_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_calls","arguments":{"limit":1}}}' \
  | jq '.result.content[0].type'
```

Capture the pre-refactor baseline read-path timing before deploy:

```bash
for i in $(seq 1 10); do
  curl -o /dev/null -sS -w "baseline iteration=$i http=%{http_code} starttransfer=%{time_starttransfer} total=%{time_total}\n" "$MCP_URL" \
    -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"list_calls","arguments":{"limit":1}}}'
  sleep 20
done
```

Capture the deployed candidate read-path timing after deploy with the same
token, endpoint, payload, and network:

```bash
for i in $(seq 1 10); do
  curl -o /dev/null -sS -w "candidate iteration=$i http=%{http_code} starttransfer=%{time_starttransfer} total=%{time_total}\n" "$MCP_URL" \
    -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":20,"method":"tools/call","params":{"name":"list_calls","arguments":{"limit":1}}}'
  sleep 20
done
```

Phase 2 cannot be marked fully verified from build output alone. The deployed
candidate must show measured read-path cold-start improvement, or the phase
summary must explicitly record cold-start verification as not verified and
explain the limitation.

## Health check

```bash
# 1. OAuth 2.1 discovery is reachable
curl -fsS https://vltmrnjsubfzrgrtdqey.supabase.co/.well-known/oauth-authorization-server | jq .issuer

# 2. MCP server responds (replace TOKEN with a valid Supabase anon JWT)
curl -fsS https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/mcp-server \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1}' | jq .result.serverInfo

# 3. Confirm at least one row in mcp_tokens for a known org (psql or SQL Editor)
SELECT organization_id, count(*) FROM mcp_tokens GROUP BY organization_id;
```

If all three return without error, the MCP plane is healthy.

## Common failure modes

### "Invalid Request" on /oauth/consent

**Symptom:** User navigating to `/oauth/consent` (no `authorization_id` param)
sees an Invalid Request error card.

**Cause:** Expected behavior — the consent page requires a valid `authorization_id`
from a registered client.

**Fix:** None. This is the guard. Confirm the calling MCP client is hitting
`/oauth/consent?authorization_id=<id>` with a real ID from a `mcp-oauth-register`
response.

### "Authorization Expired" error

**Symptom:** User clicks an OAuth consent link and sees Authorization Expired.

**Cause:** The pending authorization row in `mcp_oauth_authorizations` has
exceeded its TTL (default 5 minutes).

**Fix:** User restarts the MCP client's connect flow — it will issue a fresh
authorization. If this happens repeatedly, check the system clock on the MCP
client machine.

### MCP client gets 401 on tool call

**Symptom:** Claude Desktop / Cursor connects but every tool call returns 401.

**Cause:** Either the access token expired (1-hour TTL) and refresh failed,
OR the `mcp_tokens` row was deleted (e.g. the org was deleted).

**Fix:**
1. Query `mcp_tokens` for the org: `SELECT * FROM mcp_tokens WHERE organization_id = '<org>';`
2. If empty → user must reconnect via the MCP client.
3. If present but `expires_at` is in the past → the refresh path is broken;
   check `mcp-server` function logs in Supabase dashboard for refresh errors.

### AI tool calls return rate-limit errors

**Symptom:** `tools/call` returns 429 RATE_LIMITED.

**Cause:** `MCP_RATE_LIMIT_PER_MINUTE` (default 60) was exceeded for the token.

**Fix:** Wait one minute, or raise `MCP_RATE_LIMIT_PER_MINUTE` in the Supabase
function secrets. Repeated abuse from a client → revoke the token via
`DELETE FROM mcp_tokens WHERE id = '<id>';`.

### Slow tool calls (>5s)

**Symptom:** `tools/call` (especially AI tools — summarize_call, auto_tag)
takes more than 5 seconds.

**Cause:** OpenRouter upstream latency, or a large transcript hitting the
15k-char truncation budget on every call.

**Fix:**
1. Check Langfuse (if `LANGFUSE_PUBLIC_KEY` is set) for the upstream-latency
   breakdown.
2. If OpenRouter is the bottleneck, no fix locally — wait or switch the model
   parameter in `_shared/llm.ts`.

## Reset / restart procedure

The MCP server is a stateless Supabase Edge Function — there is nothing to
restart. To "reset" a misbehaving deployment:

```bash
# 1. Redeploy the function (picks up latest env vars from Supabase secrets)
cd /Users/Naegele/dev/brain
supabase functions deploy mcp-server --use-api

# 2. Optionally invalidate all live tokens for an org
psql "$DATABASE_URL" -c "DELETE FROM mcp_tokens WHERE organization_id = '<org-uuid>';"
```

Force-reset env vars:

```bash
supabase secrets set MCP_RATE_LIMIT_PER_MINUTE=60 OPENROUTER_API_KEY=...
```

## Logs and observability

- **Supabase function logs:** Dashboard → Edge Functions → `mcp-server` → Logs.
  Filter `level=error` for recent failures.
- **Langfuse traces:** every AI tool call writes a trace
  (`https://cloud.langfuse.com` → project → traces, filter by `name=mcp-server`).
- **Frontend Sentry:** the OAuth consent page reports to `VITE_SENTRY_DSN`
  (same DSN as the main app). Filter by URL `/oauth/consent` for consent-page
  exceptions.

## OAuth 2.1 dashboard config (Supabase)

The MCP server depends on Supabase's OAuth 2.1 provider feature being enabled
for this project. To configure (one-time, requires Supabase dashboard owner):

1. Open https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/auth/providers
2. Locate **OAuth 2.1 Providers** in the auth providers list.
3. Enable. Set issuer URL = project URL
   (`https://vltmrnjsubfzrgrtdqey.supabase.co`).
4. Allowed redirect URIs (one per line):
   - `https://app.callvaultai.com/oauth/consent`
   - `http://localhost:3001/oauth/consent` (dev)
   - `claude://oauth/callback` (Claude Desktop's custom-scheme callback)
   - `cursor://oauth/callback` (Cursor's callback)
5. Save and confirm the discovery doc at
   `https://vltmrnjsubfzrgrtdqey.supabase.co/.well-known/oauth-authorization-server`
   returns `issuer`, `authorization_endpoint`, `token_endpoint`.

Until step 5 returns 200, full E2E MCP client flows will fail at the
authorization step. This is captured as a deferred operator-setup item in
`.planning/phases/41-v2-tech-debt-closure/41-03-DEBT-03-AUDIT.md` (item E3).

## Who to contact

- **Andrew Naegele** — naegele412@gmail.com — owns CallVault end-to-end.
- For OAuth 2.1 provider issues: Supabase support
  (https://supabase.com/dashboard/support/new).
- For Fathom / Zoom API outages (which break MCP tools that touch those APIs):
  check their public status pages first.

## Env var reference

See `.env.example` "MCP — Model Context Protocol Server" section. All MCP
env vars are optional in development (the server falls back to safe defaults);
in production the only required upstream secret is `OPENROUTER_API_KEY` for
AI-flavored tool calls.

| Env var | Default | Purpose |
|---|---|---|
| `MCP_PUBLIC_BASE_URL` | request origin | Override base URL in discovery doc |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60` | Per-token AI tool call rate limit |
| `MCP_ACCESS_TOKEN_TTL_SECONDS` | `3600` | Access token lifetime |
| `MCP_REFRESH_TOKEN_TTL_SECONDS` | `2592000` | Refresh token lifetime (30 d) |

## Related references

- Original design: `.planning/milestones/v2.0-phases/18-mcps/18-CONTEXT.md`
- Server implementation: `supabase/functions/mcp-server/index.ts`
- OAuth metadata: `supabase/functions/mcp-oauth-metadata/index.ts`
- OAuth register: `supabase/functions/mcp-oauth-register/index.ts`
- Consent page: `src/pages/OAuthConsent.tsx`
