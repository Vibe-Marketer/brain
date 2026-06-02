# MCP Server Runbook

**Last updated:** 2026-05-28
**Owner:** Andrew Naegele (naegele412@gmail.com)
**Status:** Production

---

## Canonical MCP URL (READ THIS FIRST)

**The CallVault MCP server has two supported public endpoint shapes:**

| Purpose | URL |
|---|---|
| MCP JSON-RPC endpoint (organization-scoped) | `https://mcp.callvaultai.com` |
| MCP JSON-RPC endpoint (workspace-scoped) | `https://mcp.callvaultai.com/w/{workspace_uuid}` |
| OAuth protected-resource metadata (organization-scoped) | `https://mcp.callvaultai.com/.well-known/oauth-protected-resource` |
| OAuth protected-resource metadata (workspace-scoped) | `https://mcp.callvaultai.com/.well-known/oauth-protected-resource/w/{workspace_uuid}` |
| OAuth authorization-server metadata | `https://mcp.callvaultai.com/.well-known/oauth-authorization-server` |
| OIDC discovery | `https://mcp.callvaultai.com/.well-known/openid-configuration` |
| Dynamic client registration (RFC 7591) | `https://mcp.callvaultai.com/mcp-register` |
| Authorization endpoint | `https://mcp.callvaultai.com/auth/v1/oauth/authorize` |
| Token endpoint | `https://mcp.callvaultai.com/auth/v1/oauth/token` |

These all resolve through the Cloudflare Worker at `cloudflare/api-proxy/worker.ts`
which proxies to the underlying Supabase Edge Functions
(`mcp-server`, `mcp-oauth-metadata`, `mcp-oauth-register`).

The legacy `https://api.callvaultai.com/mcp` and
`https://api.callvaultai.com/mcp/w/{workspace_uuid}` routes remain supported
for existing clients, but new setup surfaces should show the `mcp.callvaultai.com`
root endpoints above.

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

Manual tokens and OAuth grants both support multiple active connections per
organization/workspace with independent revoke behavior.

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
the descriptive intent while passing spec validation. `outputSchema` is kept
in the source definitions for contract coverage, but stripped from the
client-visible `tools/list` payload because it is optional MCP metadata and
some remote clients are stricter than the spec baseline. Handlers continue to
emit `content: [{ type: "text", text: <string> }]`.

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
`https://mcp.callvaultai.com` passed:

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
export MCP_URL="https://mcp.callvaultai.com"
export WORKSPACE_UUID="<workspace-uuid>"
export MCP_WS_URL="https://mcp.callvaultai.com/w/${WORKSPACE_UUID}"
```

Invalid bearer must return HTTP 401 and include `WWW-Authenticate`:

```bash
curl -i "$MCP_URL" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

Workspace protected-resource metadata must advertise the workspace resource:

```bash
curl -i -sS "https://mcp.callvaultai.com/.well-known/oauth-protected-resource/w/${WORKSPACE_UUID}" \
  | rg -n "HTTP/|resource"
```

Valid token `initialize` must return structured JSON protocol metadata:

```bash
curl -fsS "$MCP_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"initialize","params":{}}' \
  | jq '.result.serverInfo'
```

The `initialize` result must advertise `protocolVersion: "2025-03-26"` for
remote Streamable HTTP clients.

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

Wrong-workspace access must return HTTP 403 (valid credential, wrong audience):

```bash
export MISMATCH_WORKSPACE_UUID="<different-workspace-uuid>"
curl -i -sS "https://mcp.callvaultai.com/w/${MISMATCH_WORKSPACE_UUID}" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"initialize","params":{}}' \
  | rg -n "HTTP/.*403|403"
```

## OAuth grant revocation behavior

- Revoking an OAuth-connected AI client from CallVault immediately revokes
  access server-side.
- Manual token deletion/revocation also takes effect immediately server-side.
- Some MCP clients cache tool lists and sessions; users may need to refresh or
  reconnect in the client before UI state catches up.

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

## Phase 04 write-tool smoke (workspace endpoint)

Phase 04 adds four write tools (`ingest_transcript`, `append_to_transcript`,
`update_call_metadata`, `set_speakers`). All tool-call responses must remain
markdown in `result.content[0].text` (not structured JSON payloads).

Prerequisites (environment variable names only):

```bash
export WORKSPACE_UUID="<workspace-uuid>"
export MCP_WS_URL="https://mcp.callvaultai.com/w/${WORKSPACE_UUID}"
export CALLVAULT_MCP_TOKEN="<workspace-or-org token with write category>"
# Optional negative-path checks:
export CALLVAULT_READONLY_MCP_TOKEN="<read-only token>"
export MISMATCH_WORKSPACE_UUID="<different-workspace-uuid>"
```

List tools for the workspace endpoint (HTTP 200 expected):

```bash
curl -i -sS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":401,"method":"tools/list","params":{}}'
```

Ingest a synthetic manual transcript (HTTP 200 expected, `Manual MCP Import`
visible in `result.content[0].text`):

```bash
curl -i -sS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":402,
    "method":"tools/call",
    "params":{
      "name":"ingest_transcript",
      "arguments":{
        "workspace_id":"'"$WORKSPACE_UUID"'",
        "title":"MCP Phase 04 Smoke",
        "transcript":"Speaker 1: Quick smoke check.\nSpeaker 2: Confirm write-tool path.",
        "source_date":"2026-05-29",
        "client":"mcp-smoke",
        "original_url":"https://example.com/mcp-phase-04-smoke"
      }
    }
  }'
```

Append transcript content to an existing recording (HTTP 200 expected):

```bash
export RECORDING_ID="<recording-id-from-ingest>"
curl -i -sS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":403,
    "method":"tools/call",
    "params":{
      "name":"append_to_transcript",
      "arguments":{
        "recording_id":"'"$RECORDING_ID"'",
        "append_text":"Speaker 1: Follow-up note from append path."
      }
    }
  }'
```

Merge metadata updates (HTTP 200 expected):

```bash
curl -i -sS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":404,
    "method":"tools/call",
    "params":{
      "name":"update_call_metadata",
      "arguments":{
        "recording_id":"'"$RECORDING_ID"'",
        "title":"MCP Phase 04 Smoke Updated",
        "participants":["Speaker 1","Speaker 2"]
      }
    }
  }'
```

Upsert speakers idempotently (HTTP 200 expected):

```bash
curl -i -sS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":405,
    "method":"tools/call",
    "params":{
      "name":"set_speakers",
      "arguments":{
        "recording_id":"'"$RECORDING_ID"'",
        "speakers":[
          {"name":"Speaker 1","email":"speaker1@example.com"},
          {"name":"Speaker 2"}
        ]
      }
    }
  }'
```

Read-only invisibility/rejection checks (when read-only token is available):

```bash
# Write tools should be absent from tools/list output
curl -fsS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_READONLY_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":406,"method":"tools/list","params":{}}' \
  | jq -r '.result.tools[].name' | rg "ingest_transcript|append_to_transcript|update_call_metadata|set_speakers"

# Direct write-tool call should return -32001 category-disabled error
curl -i -sS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_READONLY_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":407,"method":"tools/call","params":{"name":"ingest_transcript","arguments":{"workspace_id":"'"$WORKSPACE_UUID"'","title":"should fail","transcript":"x"}}}'
```

Wrong-workspace audience rejection (HTTP 403 expected):

```bash
curl -i -sS "https://mcp.callvaultai.com/w/${MISMATCH_WORKSPACE_UUID}" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":408,"method":"initialize","params":{}}'
```

### Phase 04 final verification gate (tools/list + ingest + follow-up)

Run this exact local gate before claiming Phase 04 complete:

```bash
VITEST_INTEGRATION_OK=true npm test -- --run \
  supabase/functions/mcp-server/__tests__/ingest-transcript.integration.test.ts \
  supabase/functions/mcp-server/__tests__/set-speakers.idempotency.test.ts \
  supabase/functions/mcp-server/__tests__/contract-surface.test.ts \
  supabase/functions/mcp-server/__tests__/category-gating.test.ts \
  supabase/functions/mcp-server/__tests__/workspace-scope.integration.test.ts \
  supabase/functions/mcp-server/__tests__/golden-replay.test.ts \
  supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts && npm run build
```

Workspace tools/list should stay in MCP protocol envelope and include write tools:

```bash
curl -fsS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":409,"method":"tools/list","params":{}}' \
  | jq -r '.result.tools[]?.name' \
  | rg "ingest_transcript|append_to_transcript|update_call_metadata|set_speakers"
```

`ingest_transcript` and one follow-up tool must return markdown in `result.content[0].text`:

```bash
# ingest_transcript markdown contract
curl -fsS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":410,
    "method":"tools/call",
    "params":{
      "name":"ingest_transcript",
      "arguments":{
        "workspace_id":"'"$WORKSPACE_UUID"'",
        "title":"MCP Phase 04 Final Gate",
        "transcript":"Speaker 1: Final gate ingest check.",
        "source_date":"2026-05-29",
        "client_name":"mcp-smoke"
      }
    }
  }' \
  | jq -r '.result.content[0].text'

# follow-up tool markdown contract
curl -fsS "$MCP_WS_URL" \
  -H "Authorization: Bearer $CALLVAULT_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":411,
    "method":"tools/call",
    "params":{
      "name":"set_speakers",
      "arguments":{
        "recording_id":"'"$RECORDING_ID"'",
        "speakers":[{"name":"Speaker 1"}]
      }
    }
  }' \
  | jq -r '.result.content[0].text'
```

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

### MCP client gets 403 on workspace endpoint

**Symptom:** Valid token reaches `initialize`, but workspace endpoint call returns 403.

**Cause:** Credential scope does not match requested workspace URL (wrong
workspace audience or revoked workspace grant).

**Fix:**
1. Confirm the URL workspace UUID matches the grant/token workspace scope.
2. If organization-scoped token/grant is intended, use `https://mcp.callvaultai.com`.
3. If workspace-scoped access is intended, reconnect with the correct workspace
   and retry.

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
