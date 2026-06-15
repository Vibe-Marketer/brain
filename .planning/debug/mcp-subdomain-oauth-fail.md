---
slug: mcp-subdomain-oauth-fail
status: root_cause_found
created: 2026-06-15
updated: 2026-06-15
trigger: |
  DATA_START
  User expected the last milestone to make the MCP connector usable via per-org / per-workspace SUBDOMAINS,
  e.g. "freedomexperience.callvaultai.com/mcp" (org) and "freedomexperience-inbox.callvaultai.com/mcp"
  (org + workspace). Instead:
  1. The Settings MCP setup UI only surfaces client id/secret, never mentions a subdomain, and the user
     reports it only gives the client SECRET (not the id). User believes OAuth should let them simply enter
     the desired subdomain.
  2. Entering "freedomexperience-inbox.callvaultai.com/mcp" in Claude redirected to
     https://app.callvaultai.com/oauth/consent?authorization_id=u7qm5kgxxmotyylmye5amocnnzmjgl7u where the
     user was forced to SELECT an organization AND workspace — which they argue should not be possible if the
     subdomain already pins one specific workspace. Connection then failed:
       "Connection issue — Couldn't connect to the server. Check that the URL points to a valid MCP server."
       "Authorization with the MCP server failed. You can check your credentials and permissions."
       reference: ofid_b8c3f833c18e2cf5
  3. Selecting only the single organization "Freedom Experience" (Client ID 0eaafb77…7d80) also failed:
       "Your account was authorized, but CallVault returned an error when connecting. You can try again, or
        check that the server is working."
       reference: ofid_2d539a9047d3e36e
  DATA_END
---

# Debug: mcp-subdomain-oauth-fail

## Symptoms

### Expected behavior
- A per-workspace subdomain such as `freedomexperience-inbox.callvaultai.com/mcp` should resolve to a valid
  MCP server scoped to exactly that org+workspace, with no org/workspace picker shown during OAuth consent.
- A per-org subdomain such as `freedomexperience.callvaultai.com/mcp` should resolve to that org.
- Settings MCP setup should make the subdomain (and any needed credentials) clear, and OAuth should be the
  connection path rather than manual client id/secret entry.

### Actual behavior
- Settings MCP setup UI is focused entirely on client id/secret; no subdomain field/mention. User reports it
  exposes the client secret but not the client id.
- Subdomain URL redirects to `app.callvaultai.com/oauth/consent` and forces manual org + workspace selection.
- Both attempts (workspace+org selection, and org-only selection) fail at the connect step after authorizing.

### Error messages
- ofid_b8c3f833c18e2cf5: "Couldn't connect to the server. Check that the URL points to a valid MCP server." +
  "Authorization with the MCP server failed. You can check your credentials and permissions."
- ofid_2d539a9047d3e36e: "Your account was authorized, but CallVault returned an error when connecting."
- Client ID observed on second attempt: 0eaafb77…7d80.

### Timeline
- Reported 2026-06-15. Prior milestone (resolved session `claude-mcp-connector-workspace`, 2026-06-02)
  implemented PATH-based workspace scoping: `app.callvaultai.com/mcp/w/{workspace_uuid}`. User believes the
  milestone delivered SUBDOMAIN-based scoping. Possible expectation/implementation mismatch.
- User says this "hasn't been pushed or fully launched or something" — deploy/launch state is uncertain.

### Reproduction
1. In Claude, add a CallVault MCP connector using `freedomexperience-inbox.callvaultai.com/mcp`.
2. Get redirected to `app.callvaultai.com/oauth/consent?authorization_id=...`.
3. Forced to pick org + workspace; connection fails (ofid_b8c3f833c18e2cf5).
4. Retry selecting only the org; connection fails after authorization (ofid_2d539a9047d3e36e).

## USER CORRECTION (2026-06-15, authoritative — overrides any path-based assumption)
- SUBDOMAIN generation is the DECIDED and BUILT approach. Each connector MUST have a unique URL because
  Claude (and other MCP clients) cannot register multiple connectors against the same base URL — so a unique
  per-org / per-workspace subdomain is generated for each connector.
- The old PATH-based style `https://mcp.callvaultai.com/w/{workspace_uuid}` is DEPRECATED and, per the user,
  "not even supposed to be active and/or used anymore." Do NOT recommend reverting to it.
- The user already created a connector via subdomain generation. So subdomains EXIST in the codebase — the
  bug is that the subdomain connector's OAuth consent + connect flow is broken, not that the feature is absent.

## Current Focus

- hypothesis: CONFIRMED — subdomain support is partially built but broken at the edge/discovery layer and
  incomplete at the consent + provisioning layer. The subdomain → org/workspace scope mapping never completes
  end to end.
- next_action: ROOT CAUSE FOUND — surface fix options to user.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-15 — git state. `git status`: HEAD == origin/main (0 ahead / 0 behind). Only uncommitted
  files are planning/config docs (.mcp.json, .planning/*). NO uncommitted source code. So whatever subdomain
  code exists is already COMMITTED and (per CI deploy workflow) deployed. The user's "hasn't been pushed/
  launched" intuition is about COMPLETENESS, not uncommitted work — the feature is half-built, not unpushed.

- timestamp: 2026-06-15 — frontend URL builders (src/services/mcp-tokens.service.ts). `buildSubdomainMcpUrl()`
  (L169-172) correctly emits `https://{orgSlug}-{wsSlug}.callvaultai.com/mcp`. BUT `toManualTokenConnection()`
  (L186-197) — the function that produces the URL shown for manual-token connectors — calls the DEPRECATED
  `buildScopedMcpUrl()` (L158-162, emits path-based `mcp.callvaultai.com/w/{uuid}`), NOT the subdomain builder.
  The subdomain builder is only wired into `McpSetupSnippets.tsx` (a copy-snippet card), gated on `orgSlug`.

- timestamp: 2026-06-15 — Settings UI (src/components/settings/MCPTab.tsx L595-744). McpSetupSnippets IS
  rendered (L738) with orgSlug=orgs[0].slug and wsSlug=snippetWorkspaceSlug. The workspace subdomain snippet
  (McpSetupSnippets.tsx L78-86) only renders when `snippetWorkspaceSlug` is non-null, which is only derived
  from an EXISTING workspace-scoped grant/token (MCPTab L616-626). Chicken-and-egg: a user with no prior
  workspace grant never sees the workspace subdomain. Org subdomain snippet shows only if orgs[0].slug exists.

- timestamp: 2026-06-15 — edge function host/scope resolution (supabase/functions/mcp-server/protocol.ts).
  `resolveOriginHost()` (L82-88) recognizes SUBDOMAIN_PATTERN /^[a-z0-9]+(-[a-z0-9]+)?\.callvaultai\.com$/
  but ONLY to echo the host back in WWW-Authenticate discovery URLs. `parseWorkspaceIdFromMcpPath()` (L123-131)
  derives workspace scope ONLY from the PATH (`/w/{uuid}`), NEVER from the subdomain host. The server has no
  Host→org/workspace resolution.

- timestamp: 2026-06-15 — edge function auth (supabase/functions/mcp-server/auth.ts).
  `enforceSubdomainSlugAudience()` (L275-337) reads `x-callvault-org-slug` and `x-callvault-workspace-slug`
  HEADERS (not the Host) to GUARD/refine scope. It is an audience CHECK, not a scope RESOLVER, and it runs
  AFTER OAuth grant selection — it cannot pin the consent screen. When `x-callvault-org-slug` is absent it
  short-circuits `{ok:true}` (L280-281), so the subdomain has ZERO effect unless an upstream proxy injects
  those headers.

- timestamp: 2026-06-15 — header producers. `rg` across the whole repo: NOTHING sets x-callvault-org-slug /
  x-callvault-workspace-slug / x-callvault-host / x-callvault-public-path. There is NO Cloudflare Worker
  source, no wrangler.toml, no worker/ dir in the repo. The audience-check headers the server depends on are
  produced (if at all) only by an out-of-repo Cloudflare Worker.

- timestamp: 2026-06-15 — OAuth consent page (src/pages/OAuthConsentPage.tsx). `deriveOrgSlug()` (L81-96)
  extracts the ORG slug from `authDetails.resource`/`redirect_uri` and pins selectedOrgId (L130-149). BUT it
  drops the workspace half: `hostname.split('.')[0].split('-')[0]` (L87) keeps only the org token. Workspace
  pinning (L151-167) requires `authDetails.workspace_id`, which the subdomain flow never populates → user is
  still shown a WORKSPACE picker on `freedomexperience-inbox`. Org pinning works ONLY if authDetails.resource
  actually carries the subdomain host.

- timestamp: 2026-06-15 — LIVE DNS. dig: mcp/api.callvaultai.com → 172.64.80.1 (Cloudflare). 
  freedomexperience-inbox.callvaultai.com → 172.64.80.1 (same CF IP — wildcard resolves). 
  freedomexperience.callvaultai.com → 172.67.164.99 / 104.21.66.214 (DIFFERENT CF anycast). Subdomains DO
  resolve to Cloudflare; wildcard DNS + TLS are in place.

- timestamp: 2026-06-15 — LIVE HTTP probes (THE connect-failure root cause).
  POST https://mcp.callvaultai.com/mcp → 401 + WWW-Authenticate (works).
  POST https://freedomexperience-inbox.callvaultai.com/mcp → 401 + WWW-Authenticate with
  resource_metadata="https://freedomexperience-inbox.callvaultai.com/.well-known/oauth-protected-resource/mcp"
  (Worker DOES route POST /mcp on the subdomain, and echoes the subdomain in the discovery hint).
  GET https://mcp.callvaultai.com/.well-known/oauth-protected-resource/mcp → 200 JSON.
  GET https://freedomexperience-inbox.callvaultai.com/.well-known/oauth-protected-resource/mcp →
  404 {"error":"not_found"} (cache-busted, stable). Same for freedomexperience.callvaultai.com → 404.
  CONCLUSION: the Cloudflare Worker serves the OAuth `.well-known` discovery routes ONLY for the static
  mcp/api hosts, NOT for per-org/per-workspace subdomains. Claude follows the WWW-Authenticate hint to the
  subdomain discovery URL, gets a 404 instead of JSON → "Couldn't connect to a valid MCP server" /
  "Authorization with the MCP server failed" (ofid_b8c3f833c18e2cf5).

- timestamp: 2026-06-15 — discovery body on working host advertises
  authorization_servers:["https://mcp.callvaultai.com"] (NOT the subdomain). So even where discovery is
  reachable, it routes OAuth back to the static host and loses the subdomain context deriveOrgSlug() needs.

- timestamp: 2026-06-15 — grant selection (supabase/functions/mcp-server/grant-selection.ts L62-72). When a
  user has grants spanning >1 org and no workspace path/subdomain scope resolves, selectOAuthGrant returns
  `multi_org_ambiguity` 403 → "CallVault returned an error when connecting" (ofid_2d539a9047d3e36e, the
  org-only retry). This is the post-auth connect failure on attempt 2.

- timestamp: 2026-06-15 — metadata edge function (supabase/functions/mcp-oauth-metadata/index.ts). ALREADY
  subdomain-aware: resolveOriginHost() (L40-50) accepts SUBDOMAIN_PATTERN hosts and emits
  canonicalOrigin=https://{subdomain} for `resource` + `authorization_servers`. L146-147 names the missing
  out-of-repo component explicitly: `cloudflare/api-proxy/worker.ts`. The function WOULD serve correct
  subdomain discovery IF the Worker forwarded X-Callvault-Host and invoked this fn (?doc=protected-resource)
  for subdomain hosts. The live 404 on the subdomain `.well-known` route proves the Worker does NOT route
  `.well-known/*` for subdomain hosts to this function — only for the two static hosts. THE FIX'S PRIMARY
  SURFACE IS THE OUT-OF-REPO WORKER `cloudflare/api-proxy/worker.ts` (not present in this repo tree).

## Eliminated

- "Subdomain feature was never implemented" — ELIMINATED. buildSubdomainMcpUrl, SUBDOMAIN_PATTERN (both
  protocol.ts and OAuthConsentPage.tsx), enforceSubdomainSlugAudience, deriveOrgSlug, and live Worker routing
  of POST /mcp on the subdomain all exist. The feature is half-wired, not absent.
- "Subdomain DNS/TLS not provisioned" — ELIMINATED. Wildcard *.callvaultai.com resolves to Cloudflare and
  serves TLS; POST /mcp on the subdomain returns a valid 401 envelope.
- "Work is uncommitted / unpushed" — ELIMINATED. HEAD == origin/main; no uncommitted source. Half-built state
  is already deployed.
- "Reverting to path-based /w/{uuid} is the fix" — REJECTED per authoritative USER CORRECTION; not a candidate.

## CORRECTION OF RECORD (2026-06-15, orchestrator — supersedes the "out-of-repo Worker" conclusion above)

The investigation's OBSERVATIONS (live probes, the 404 on the subdomain discovery route) were correct, but
its CONCLUSION about WHERE the fix lives was WRONG:

- The subagent inspected `cloudflare/api-proxy/worker.ts` (which fronts api/mcp.callvaultai.com) and declared
  the real Worker "out of repo" and that "NOTHING in the repo produces x-callvault-org-slug/workspace-slug".
  BOTH FALSE. There is a dedicated **in-repo** Worker `cloudflare/mcp-subdomain-worker/worker.ts` whose
  Cloudflare route is `*.callvaultai.com/*`. It DOES route subdomains, derives `{orgSlug}-{wsSlug}` via
  extractSlugScope(), and DOES inject x-callvault-org-slug / x-callvault-workspace-slug / x-callvault-host /
  x-callvault-internal-secret (worker.ts L211-213, L258-260). The subagent's grep missed this directory.

- ACTUAL fatal bug (verified live): `resolveSubdomainRoute()` in mcp-subdomain-worker handled only the EXACT
  `/.well-known/oauth-protected-resource` path. The MCP server's WWW-Authenticate (RFC 9728 path-insertion)
  points clients at `/.well-known/oauth-protected-resource/mcp` (resource path appended). That suffixed route
  had no handler → uniformNotFound() 404. The Worker's OWN legacy resolver already handled the suffixed form;
  only the subdomain resolver lacked it.

## Resolution

status: fixed (connection blocker + consent pinning); 1 follow-up pending visual verification

root_cause: |
  Subdomain-scoped MCP connectors were partially wired. Breakage, in priority order:

  1. EDGE/DISCOVERY (FATAL — the connect failure, ofid_b8c3f833c18e2cf5): in-repo Worker
     cloudflare/mcp-subdomain-worker/worker.ts routed the subdomain POST /mcp (401 + correct WWW-Authenticate
     hint) but its resolveSubdomainRoute() had NO handler for the suffixed discovery URL
     `/.well-known/oauth-protected-resource/mcp` that the hint points at → 404 → Claude reports "couldn't
     connect to a valid MCP server". (The Worker's legacy resolver already had this route; the subdomain
     resolver did not.)

  2. CONSENT PINNING (the unexpected workspace picker; contributes to ofid_2d539a9047d3e36e): 
     OAuthConsentPage.extractOrgSlugFromUrl() did `split('-')[0]`, discarding the workspace half of the
     subdomain, so the workspace never auto-pinned and the user was shown a picker on `{org}-{ws}` URLs.

  3. PROVISIONING/UI (the "only shows id/secret, no subdomain" complaint): toManualTokenConnection() emits the
     deprecated path URL via buildScopedMcpUrl(); the workspace subdomain snippet only renders when a prior
     workspace grant exists (chicken-and-egg). NOT yet changed — needs visual reproduction of the actual
     Settings UI before editing (the manual-token builder only has workspace_id UUID, not slugs, so a correct
     fix must resolve slugs — non-trivial). Follow-up.

fix: |
  FIX 1 (deployed + verified live): added the suffixed + generic `/.well-known/oauth-protected-resource/...`
  routes to resolveSubdomainRoute() in cloudflare/mcp-subdomain-worker/worker.ts. Deployed via
  `npx wrangler deploy` (Version 6f626b61-673f-4425-b72b-a4c4bcde6048). Re-probe: subdomain discovery URL now
  returns 200 JSON (resource = the subdomain) on both freedomexperience-inbox and org-only freedomexperience.

  FIX 2 (committed; built clean, type-check adds 0 new errors): OAuthConsentPage now parses BOTH org and
  workspace slug from the subdomain (extractScopeFromUrl/deriveScope), resolves the workspace slug against the
  user's workspaces in the org, auto-pins scope='workspace' to it, and renders it LOCKED (no picker) so a
  workspace URL can't be widened to org-wide. Unresolvable workspace slug → access error (never silent widen).

verification:
  - Live: GET https://freedomexperience-inbox.callvaultai.com/.well-known/oauth-protected-resource/mcp → 200
    (was 404). Org-only subdomain → 200. WWW-Authenticate hint unchanged and now resolvable.
  - `npx tsc -p tsconfig.app.json` — touched files add 0 new errors vs baseline (proven via git stash diff).
  - `npm run build` → ✓ built in 8.03s.

follow_up:
  - FIX 3 (manual-token / Settings subdomain surface) pending: reproduce the live Settings → AI connectors UI
    with Interceptor, confirm exactly what the user sees ("only secret, no id, no subdomain"), then scope the
    correct change (likely: emit subdomain URLs needing org+workspace slug resolution; surface workspace
    subdomain without requiring a pre-existing grant).
  - End-to-end OAuth connect from Claude not yet re-tested by the user (interactive; can't curl the full flow).
