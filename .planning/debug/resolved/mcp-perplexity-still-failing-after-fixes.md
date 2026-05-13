---
status: superseded_by_mcp-dcr-default-auth-method-strict-clients
trigger: "Perplexity STILL fails with DCR_CLIENT_SECRET_REQUIRED after 5 prior fixes. User cannot supply Network DevTools capture because Perplexity's DCR comes from their backend, not the browser."
created: 2026-05-13T04:35:00Z
updated: 2026-05-13T04:50:00Z
resolved: 2026-05-13T04:50:00Z
disposition: deferred_real_bug_found_elsewhere
---

## DISPOSITION: Superseded — fix landed elsewhere

This session identified a real RFC 9728 §3.1 conformance gap (our `WWW-Authenticate` advertises `resource_metadata` without the resource's path suffix `/mcp`). However, BEFORE this fix was applied, the coordinator surfaced stronger published evidence from kirodotdev/Kiro#3908 pointing at a different root cause: `client_secret_basic` rejection by strict DCR response validators.

That fix landed in `mcp-dcr-default-auth-method-strict-clients.md` (resolved 2026-05-13 04:50). Verifying whether Perplexity now works will tell us if the path-suffix issue ALSO needs fixing.

**Followup if Perplexity still fails:** apply the path-suffix fix documented below. It's a one-line change and matches what every other production MCP server (Notion, Linear) emits.

**If Perplexity now works:** keep this open as low-priority polish — the un-suffixed form is non-conformant with RFC 9728 §3.1 even if no current client trips on it.

---


## Current Focus

Sixth iteration. Without a network capture from Perplexity's side, this investigation reads the OAuth specs + samples how production MCP servers (Notion, Linear, Canva) advertise their auth metadata, to identify what we're doing differently. Found a strong candidate: our `WWW-Authenticate` advertises a `resource_metadata` URL that is **non-conformant with RFC 9728 §3.1's well-known URL construction rule**.

## Symptoms

- Perplexity custom-connector wizard rejects `https://api.callvaultai.com/mcp` with `CLIENT_REGISTRATION_FAILED` wrapping `DCR_CLIENT_SECRET_REQUIRED` — their generic "MCP server didn't behave like an OAuth-protected resource" catch-all.
- All 5 prior fixes verified live via curl. Server returns RFC 7591-compliant DCR responses, RFC 9728-compliant WWW-Authenticate, proper 401 on unauth/invalid-bearer, correct grant_types filtering.
- User cannot capture Perplexity's actual request to our server (their backend-to-backend call doesn't show in browser DevTools).

## Eliminated

- NOT a DCR response shape problem.
- NOT a token validation bypass.
- NOT a CORS / Cloudflare routing issue.
- NOT a discovery doc body problem (compared ours line-by-line to Notion's; bodies are equivalent).

## Evidence

### RFC 9728 §3.1 normative text

> "inserting the well-known URI string into the protected resource's resource identifier between the host component and the path and/or query components, if any"

For our resource `https://api.callvaultai.com/mcp`:
- Host = `api.callvaultai.com`
- Path = `/mcp`
- Constructed well-known URL = `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp` (path-suffixed)

### Comparison with production MCP servers

| Server | resource | `WWW-Authenticate.resource_metadata` | Path-suffixed? |
|---|---|---|---|
| Notion | `https://mcp.notion.com/mcp` | `https://mcp.notion.com/.well-known/oauth-protected-resource/mcp` | YES |
| Linear | `https://mcp.linear.app` | `https://mcp.linear.app/.well-known/oauth-protected-resource/mcp` | YES |
| Canva | (omits resource_metadata) | n/a | n/a |
| **Ours** | `https://api.callvaultai.com/mcp` | `https://api.callvaultai.com/.well-known/oauth-protected-resource` | **NO** |

We are the only major MCP server in the sample that omits the path suffix from the advertised `resource_metadata` URL. RFC 9728 §3.1 is explicit that the path component (`/mcp`) is part of the well-known URL construction when the resource has a path.

### What our server already serves correctly

- `https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp` returns the correct metadata body (HTTP 200, same as un-suffixed). The Cloudflare Worker's `resolveTarget()` routes both forms to `mcp-oauth-metadata?doc=protected-resource`.
- The metadata body advertises `resource: "https://api.callvaultai.com/mcp"` and `authorization_servers: ["https://api.callvaultai.com"]`.

So the FIX is purely a 1-line change in the `WWW-Authenticate` header value: append `/mcp` to the `resource_metadata` URL. The underlying well-known endpoint already serves the path-suffixed URL correctly.

### Additional smaller alignment with industry pattern (optional)

- `realm="callvault"` → `realm="OAuth"` (Linear, Notion, Canva all use "OAuth"; some case-insensitive parsers might prefer the standard token).
- Add RFC 6750 §3.1 error attributes: `error="invalid_token", error_description="Missing or invalid access token"`.

These are not blocking — Canva omits resource_metadata entirely and works — but they're harmless and align with the convention spec-strict clients have been tested against.

## Root cause (best current hypothesis, plain English)

Every other major MCP server (Notion, Linear) advertises the auth metadata URL with the resource path appended — i.e., `/.well-known/oauth-protected-resource/mcp`. We advertise it WITHOUT the `/mcp` suffix. RFC 9728 §3.1 requires the suffix when the resource has a path. Perplexity has presumably been tested against Notion/Linear-style URLs and may either (a) strictly validate the RFC 9728 construction rule, or (b) apply a fallback lookup that fails on our shape. Either way, aligning our `WWW-Authenticate` to the path-suffixed form costs nothing and matches the spec.

## Variant URL probing — defensive fallbacks NOT needed

Probed every plausible DCR path variant a client might guess:

| URL | Method | Result |
|---|---|---|
| `/mcp-register` | POST | 201 (works, advertised) |
| `/mcp/register` | POST | 401 (MCP server gate, no DCR) |
| `/oauth/register` | POST | 404 |
| `/register` | POST | 404 |
| `/oauth/v1/register` | POST | 404 |

None of the 404 variants is a DCR convention Perplexity has been observed using. Adding defensive redirects to them would be speculative and potentially mask future bugs. NOT recommended unless Perplexity's network capture later proves they use one of these paths.

## Things I could NOT investigate

- **Perplexity's published docs:** there is NO documented spec for their MCP custom connector / DCR client. `docs.perplexity.ai/llms.txt` has zero mentions of "custom connector", "MCP client", "third-party MCP", or DCR. Everything in their docs is about Perplexity AS an MCP server, not Perplexity AS a client. Their consumer help center (`www.perplexity.ai/help-center/`) returns 403 to curl (Cloudflare bot block). No actionable contract from their side.
- **Perplexity's backend IP range:** not published. WAF allow-list speculative without confirmed signal.
- **Supabase function logs:** queried — no real-world traffic to `mcp-oauth-register` from Perplexity in the last 24h. Either (a) they never reach DCR (their pre-DCR probe fails), or (b) they hit Cloudflare and get rejected before Supabase, or (c) Supabase log retention is too short for the trace.
- **Verbose request logging on our DCR endpoint:** would help if Perplexity ever reaches it, but increases risk of logging client secrets. Held back pending a clearer signal.

## Fix plan (single edit, single deploy)

**File:** `supabase/functions/mcp-server/index.ts`

**Change:** Update the canonical resource-metadata URL constant from
```
'https://api.callvaultai.com/.well-known/oauth-protected-resource'
```
to
```
'https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp'
```

Also (optional, low-risk):
- Update the `WWW-Authenticate` header value built by `unauthorizedResponse()` to include `error="invalid_token", error_description="Missing or invalid access token"` and change `realm="callvault"` to `realm="OAuth"`.

**Why no `mcp-oauth-metadata` function change is needed:** the Cloudflare Worker already routes BOTH `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` to the same function (which returns the same body). The only change is which URL we ADVERTISE in `WWW-Authenticate`.

**Commit:** `fix(mcp): advertise path-suffixed resource_metadata in WWW-Authenticate (RFC 9728 §3.1 conformance)`
**Deploy:** `supabase functions deploy mcp-server --use-api`

## Verification (after deploy)

1. `curl -i -X POST https://api.callvaultai.com/mcp -H "Content-Type: application/json" -d '{}'` -> WWW-Authenticate now advertises `.../oauth-protected-resource/mcp`
2. `curl https://api.callvaultai.com/.well-known/oauth-protected-resource/mcp` -> HTTP 200 with correct metadata (regression — already worked)
3. `curl https://api.callvaultai.com/.well-known/oauth-protected-resource` -> HTTP 200 (regression — un-suffixed form still served for back-compat with whatever was using it)
4. Claude Code regression: still Connected, 41/41 spec-compliant tools, `tools/call list_workspaces` returns 6 workspaces
5. Ask user to retry Perplexity. Expect success — if not, fall back to verbose logging on `/mcp-register` (see Followups).

## If this still doesn't fix it (followups)

- **Add temporary verbose request logging to `/mcp-register`.** Log full request headers (redact `Authorization` value), body parsed-but-redacted of any client_secret echo, and the response shape. Mark with a `REVERT-ME` comment. Deploy, ask user to retry Perplexity, capture the actual request, then revert.
- **Reach out to Perplexity support.** Their custom-connector flow is undocumented; an unmodified spec-compliant MCP server failing is something only they can debug.
- **Ask the user to test with another client.** Cursor and Claude Desktop both implement OAuth-enabled MCP — if those work and Perplexity doesn't, the bug is Perplexity-side. Claude Desktop is easy to set up with the same URL.

## Resolution

root_cause: (high-confidence hypothesis) Our `WWW-Authenticate` header advertised `resource_metadata="https://api.callvaultai.com/.well-known/oauth-protected-resource"` (no path suffix). RFC 9728 §3.1 requires the well-known URL to be constructed by inserting the well-known string BETWEEN host and path of the resource identifier — so the conformant URL is `.../oauth-protected-resource/mcp`. Every other production MCP server (Notion, Linear) emits the path-suffixed form; we were the only outlier in the sample.

fix: (pending checkpoint approval) Update `CANONICAL_RESOURCE_METADATA_URL` in `mcp-server/index.ts` to include the `/mcp` path suffix. Optionally also align `realm` value and add RFC 6750 error attributes for stronger compatibility.

verification: pending checkpoint approval.

files_changed: []
