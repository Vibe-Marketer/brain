---
status: resolved
trigger: "SDK auth failed: Protected resource https://api.callvaultai.com/mcp does not match expected https://app.callvaultai.com/api/mcp (or origin)  +  41 tools failed schema validation: outputSchema.type is not 'object' on any of them"
created: 2026-05-12T00:00:00Z
updated: 2026-05-12T22:25:00Z
resolved: 2026-05-12T22:25:00Z
---

## Current Focus

Both defects RESOLVED. End-state: Claude Code shows `callvault: https://api.callvaultai.com/mcp (HTTP) - ✓ Connected`, all 41 tools have spec-compliant outputSchema, and `tools/call` returns real data.

## Symptoms

### Thread 1 — URL mismatch
expected: Claude Code SDK authenticates and obtains a token.
actual: `SDK auth failed: Protected resource https://api.callvaultai.com/mcp does not match expected https://app.callvaultai.com/api/mcp (or origin)`

### Thread 2 — Invalid outputSchema on all 41 tools
expected: Claude Code lists all 41 tools.
actual: "All 41 tools failed schema validation: outputSchema.type is not 'object'."

## Root cause (plain English)

Thread 1: Claude Code was talking to URL A (app domain) and the server's metadata said "I'm URL B" (api domain). The "host-aware" code that was supposed to fix this never fired in production because Supabase Edge Runtime ignores client-set forwarding headers, and Vercel's rewrite path was the only one calling the function from the app domain.

Thread 2: All 41 tools declared their output type as a bare string (`{ type: 'string' }`). The MCP spec requires the output type to be `'object'` with `properties` inside. Spec-compliant clients (Claude Code, Perplexity) refuse the entire tool list when any tool is malformed.

## Fix (deployed)

Single canonical surface: `https://api.callvaultai.com/mcp`. All other paths removed.

**Repo commits (pushed to main):**
- `d9aa4393 fix(mcp): wrap outputSchema in object root for spec compliance` — 41 tools
- `33177a52 refactor(mcp): remove dead app-domain back-compat in resource resolution` — drops dead branches in `mcp-oauth-metadata` and `mcp-server`
- `bbce66f7 chore(vercel): drop legacy /api/mcp rewrites — canonical URL is api.callvaultai.com/mcp` — vercel.json + Cloudflare Worker now routes `/mcp-register`
- `3ca14e92 docs(mcp): document api.callvaultai.com/mcp as canonical` — runbook canonical-URL section + outputSchema contract

**Deploys executed:**
- `supabase functions deploy mcp-server --use-api` -> deployed
- `supabase functions deploy mcp-oauth-metadata --use-api` -> deployed
- `git push origin main` -> Vercel deployed `dpl_6TVqyqRqXxPAyLEMiDi5UoPR1foz` to app.callvaultai.com
- `wrangler deploy` -> Cloudflare Worker version `9e65172d-2655-4636-b0ff-217940f0ee37`

**Local edit (not committed):**
- `~/.claude.json` -> `mcpServers.callvault.url = "https://api.callvaultai.com/mcp"` (backup saved at `~/.claude.json.bak-mcp-url-fix.<timestamp>`)

## Verification (executed post-deploy)

| # | Check | Result |
|---|---|---|
| a | `curl https://api.callvaultai.com/.well-known/oauth-protected-resource` advertises `resource: "https://api.callvaultai.com/mcp"` | PASS |
| b | `curl https://app.callvaultai.com/.well-known/oauth-protected-resource` no longer serves OAuth metadata | PASS (returns SPA index.html — legacy Vercel rewrite removed; would be cleaner as 404, see Followups) |
| c | `curl https://app.callvaultai.com/api/mcp` no longer routes to mcp-server | PASS (returns 405 SPA fallback — clients hitting this fail discovery) |
| d | `curl https://api.callvaultai.com/.well-known/oauth-authorization-server` advertises canonical issuer + endpoints | PASS — registration_endpoint is now `https://api.callvaultai.com/mcp-register` |
| e | `tools/list` via api domain returns 41 tools, every `outputSchema.type === "object"` | PASS (41/41) |
| f | `tools/call list_workspaces` returns real workspace data | PASS (6 workspaces returned) |
| g | `/mcp-register` route on Cloudflare Worker accepts RFC 7591 registrations | PASS (HTTP 201 with client_id + client_secret) |
| h | Claude Code `claude mcp list` shows `callvault: https://api.callvaultai.com/mcp (HTTP) - ✓ Connected` | PASS |

## Followups (not blocking)

- **Vercel SPA fallback on legacy MCP paths**: After removing the rewrites, `/.well-known/oauth-*` and `/api/mcp` on app.callvaultai.com now fall through to the SPA `/(.*)→/index.html` catch-all, returning HTML with HTTP 200. Cleaner UX: add explicit 410 Gone or 404 responses for those paths so any stale MCP clients get an unambiguous failure instead of HTML. Filed as low-priority polish in v2.2 BACKLOG.
- **Dynamic registration test client cleanup**: The verification probe registered a client (`client_id 117609d5-4af6-47a4-a304-0745685ce4ff`). It is harmless (test redirect URI, no consents granted) but should be deleted from `mcp_oauth_clients` if hygiene matters.

## Resolution

root_cause:
  Thread 1 — protected-resource metadata advertised api.callvaultai.com/mcp on every host because Supabase Edge Runtime ignored client-set x-forwarded-host on Vercel-rewritten requests; Claude Code's registered URL was app.callvaultai.com/api/mcp -> RFC 8707 audience-binding violation.
  Thread 2 — all 41 tools declared `outputSchema: { type: 'string', ... }`, which violates the MCP spec requirement that outputSchema be a JSON Schema object with `type: "object"` at the root.

fix:
  Thread 1 — single canonical surface at api.callvaultai.com/mcp via Cloudflare Worker; removed dead app-domain back-compat branches in `resolveResourceContext()` and `resolveResourceMetadataUrl()`; removed legacy Vercel rewrites from `vercel.json`; pointed registration_endpoint at the vanity domain and added `/mcp-register` routing to the Cloudflare Worker; repointed `~/.claude.json` to the canonical URL.
  Thread 2 — reshape all 41 tool `outputSchema` declarations to `{ type: 'object', properties: { text: { type: 'string', description: <preserved> } }, required: ['text'] }`. Handlers emit `content: [{ type: 'text', text: ... }]`, so this is the most accurate object-rooted shape.

verification:
  41/41 tools spec-compliant in live tools/list response. list_workspaces tool call returned 6 real workspaces. Claude Code MCP list shows callvault as Connected. Dynamic client registration at api.callvaultai.com/mcp-register succeeds.

files_changed:
  - supabase/functions/mcp-server/index.ts (outputSchema reshape on 41 tools + dead branch removal)
  - supabase/functions/mcp-oauth-metadata/index.ts (canonical-only metadata)
  - vercel.json (legacy MCP rewrites removed)
  - cloudflare/api-proxy/worker.ts (added /mcp-register route + updated header doc)
  - docs/operations/mcp-runbook.md (canonical URL section + outputSchema contract)
  - ~/.claude.json (local — repointed callvault to canonical URL; backed up before edit)
