# Pitfalls Research

**Domain:** Production MCP infrastructure — per-org auto-provisioning, CRUD + AI tools, plan-tier gating, Supabase Edge Functions
**Researched:** 2026-04-10
**Confidence:** HIGH (primary findings corroborated by CVEs, official Supabase docs, and MCP spec)

---

## Critical Pitfalls

### Pitfall 1: Org Isolation Leak via Missing org_id Filter in MCP Tool Handlers

**What goes wrong:**
An MCP tool handler (e.g., `search_transcripts`) queries Supabase without including `org_id` in the WHERE clause. The token auth is valid, but the query returns data across all orgs. Because MCP tools respond to LLM-generated inputs, the parameters are constructed at runtime — a missing server-side guard means any authenticated MCP client can exfiltrate another org's transcripts by omitting org scoping from the tool call.

Asana's 2025 MCP IDOR bug affected up to 1,000 enterprises this exact way: a logic flaw in access control exposed cross-org objects to any authenticated user.

**Why it happens:**
Developers validate "is this token valid?" but not "does this token's org own this data?" The RLS policies in Supabase apply to the Supabase client's auth context — but MCP tool handlers that use the `service_role` key or construct raw SQL bypass RLS entirely. Rushing to get tools working causes the org filter to be added "later" and forgotten.

**How to avoid:**
- Every MCP tool that touches data MUST resolve `org_id` from the token/JWT before querying, never from the client-supplied tool arguments
- Use a shared middleware function `requireOrgFromToken(token) -> org_id` that all tools call first
- Never use `service_role` key inside MCP tools — use a scoped user JWT or a service-account JWT minted per org with the org's `org_id` embedded
- Write a test that calls `search_transcripts` with a valid token for Org A and asserts zero results from Org B's data

**Warning signs:**
- Tool handlers that accept `org_id` as an input parameter (vs. deriving it from the token)
- Any tool using `supabaseAdmin` (service_role client) instead of a user-scoped client
- Code review showing raw SQL or `.from('calls')` without `.eq('org_id', orgId)`

**Phase to address:**
Token architecture and tool handler scaffolding phase (first MCP tools phase). Must be enforced from day one — retrofitting org filters after tools are built is high-risk.

---

### Pitfall 2: Plan Tier Enforced Only on the Frontend

**What goes wrong:**
The plan gate ("PRO only") is implemented as a React component check — the UI hides the MCP settings pane for free-tier users. But the `/mcp-provision` Edge Function and the MCP server itself have no server-side tier check. A free user who discovers the endpoint URL (or whose token is leaked) gets full MCP access. This is the same class as PAY-05 in v2.0 which left 2 AI features ungated.

**Why it happens:**
Tier enforcement in the UI is fast and visible. Backend enforcement requires querying Polar on every MCP request or storing the tier in the JWT, which feels like extra work. The assumption is "only paying users will ever get here."

**How to avoid:**
- The MCP server's auth middleware must verify plan tier on every connection, not just during provisioning
- Store `plan_tier` in a server-controlled location (Supabase `org_settings` table, NOT the JWT user metadata which users can write) and check it server-side
- On provisioning, gate the trigger itself: the database trigger or Edge Function that creates the MCP row must check org's plan before inserting
- Polar webhooks must update `org_settings.plan_tier` on subscription change events — and MCP auth must re-read from DB, not from a cached JWT claim

**Warning signs:**
- Plan checks only appear in `src/` (frontend) with no matching check in `supabase/functions/`
- `org_settings.plan_tier` column writable via normal user API
- No Polar webhook handler that updates plan tier and invalidates MCP access on downgrade

**Phase to address:**
Plan gating phase. Must include a test: downgrade org to free tier via Polar webhook simulation, attempt MCP connection, assert 403.

---

### Pitfall 3: MCP Token Stored as Long-Lived Static Secret

**What goes wrong:**
Each org's MCP server is issued a token that gets stored in the UI and never expires. When a user leaves an org, their MCP clients (Claude Desktop, Cursor, etc.) still have a working token. When a token is leaked (e.g., pasted into a Slack message, committed to a dotfile), there is no way to revoke access short of reprovisioning the entire server.

Real-world: CVE-2025-6514 (mcp-remote OAuth proxy RCE) and the GitHub MCP prompt injection incident both involved long-lived Personal Access Tokens as the primary attack amplifier.

**Why it happens:**
Static tokens are easy to implement and convenient for users who configure clients once. The complexity of token rotation feels like a future concern.

**How to avoid:**
- MCP tokens must be revocable: store a `mcp_tokens` table with `token_hash`, `org_id`, `created_at`, `revoked_at`
- The token regeneration UI in MCP settings must issue a new token AND immediately invalidate the old one
- Implement token expiry policy: tokens expire after 90 days and require re-generation (surfaced in UI before expiry)
- Hash tokens before storing — never store plaintext

**Warning signs:**
- MCP tokens stored as plaintext in `org_mcp_config` table
- No `revoked_at` column or equivalent invalidation mechanism
- Token regeneration UI that shows the new token but doesn't deactivate the old one

**Phase to address:**
Token storage and management phase. The UI for "regenerate token" must be built alongside the revocation backend — not as a separate phase.

---

### Pitfall 4: Provisioning Race Condition on Org Creation

**What goes wrong:**
A new org is created via the signup flow. A database trigger fires to auto-provision the MCP server row. Simultaneously, the frontend redirects to the dashboard and the user immediately opens MCP settings. The provisioning trigger hasn't completed yet — the `org_mcp_config` row doesn't exist, the UI shows an error or blank state, and the user retries, potentially creating duplicate MCP records.

**Why it happens:**
Database triggers are async in effect from the application's perspective. The frontend assumes provisioning is synchronous. Multiple rapid retries on "provision" endpoints without idempotency guards create duplicates.

**How to avoid:**
- Add a `provisioning_status` column to `org_mcp_config`: `pending | active | failed`
- The MCP settings UI polls or subscribes to this column via Supabase Realtime — shows a "setting up your MCP server..." state until `active`
- Provisioning endpoints must be idempotent: `INSERT INTO org_mcp_config ... ON CONFLICT (org_id) DO NOTHING`
- Add a unique constraint on `org_id` in `org_mcp_config`

**Warning signs:**
- Provisioning endpoint without `ON CONFLICT` handling
- MCP settings UI that does a single fetch and renders empty/error if the row isn't there yet
- No `provisioning_status` tracking

**Phase to address:**
Auto-provisioning phase. Test: create two orgs in rapid succession and assert each has exactly one `org_mcp_config` row.

---

### Pitfall 5: AI Tool Cost Runaway with No Per-Org Limits

**What goes wrong:**
The `summarize_call` or `extract_action_items` MCP tool calls an LLM (OpenRouter / Vercel AI SDK) on every invocation. An LLM agent runs in a loop calling these tools thousands of times — either due to a buggy agent configuration or intentional abuse by a user on a PRO plan. There is no per-org daily token budget, no rate limiting, and no circuit breaker. Costs spike unexpectedly.

**Why it happens:**
AI tool cost control is treated as a billing concern ("add it when we have metered billing") rather than a safety concern. The happy path of one user calling one tool works fine in testing.

**How to avoid:**
- Implement per-org daily LLM call quota stored in `org_mcp_usage` table, checked before every AI tool invocation
- Return a structured error (`429 Too Many Requests` with `retry_after`) when quota exceeded — MCP clients must receive this as a proper MCP error, not an unhandled exception
- Set hard cap on max tokens per tool call (summarize: 2000 output tokens max)
- Log every AI tool invocation to `mcp_ai_tool_log` with token counts — feeds future metered billing

**Warning signs:**
- AI tools that call LLM with unbounded `max_tokens`
- No `mcp_ai_tool_log` table or usage tracking
- AI tools callable unlimited times per minute per org

**Phase to address:**
AI tools phase. Quota enforcement must ship with the first AI tool — not deferred.

---

### Pitfall 6: SSE Transport Used for Production MCP (Deprecated)

**What goes wrong:**
The Phase 18 MCP prototype was built with HTTP+SSE transport. In March 2025, MCP deprecated SSE in favor of Streamable HTTP. SSE transport creates fragile long-lived connections that break under load balancers, Cloudflare proxies, and horizontal scaling. At low volume it appears to work; under load or on infrastructure with connection timeouts, MCP clients get mysterious disconnects with no clear error.

**Why it happens:**
The prototype worked with SSE, so the production version inherits the same transport without re-evaluating. The deprecation notice is easy to miss.

**How to avoid:**
- Build production MCP on Streamable HTTP transport from the start
- Supabase Edge Functions have a 30-second hard timeout per invocation — Streamable HTTP fits this model better than long-lived SSE connections
- Test with MCP clients that use connection resumption (Claude Desktop does this) — SSE failures are silent without this test

**Warning signs:**
- MCP server returning `text/event-stream` Content-Type
- Clients report intermittent "MCP server disconnected" errors under normal use
- No test verifying connection behavior across a Cloudflare proxy or load balancer

**Phase to address:**
MCP server transport/architecture phase (first foundational phase). Do not carry SSE transport from the prototype.

---

### Pitfall 7: Tool Poisoning via User-Controlled Tool Descriptions

**What goes wrong:**
The MCP management UI lets org admins configure "capability toggles" — which tools are enabled. If this data flows back into tool descriptions or tool metadata that get sent to the LLM, an admin could inject instructions into the tool description that manipulate the LLM agent's behavior for other users in the org. More critically: if MCP tool descriptions are constructed by concatenating database-stored values (org name, custom labels), those values become prompt injection vectors.

Invariant Labs demonstrated this with WhatsApp MCP in April 2025: malicious instructions in tool metadata exfiltrated an entire message history.

**Why it happens:**
Tool descriptions feel like static configuration. Developers don't sanitize them as user input because they look like code, not data.

**How to avoid:**
- Tool names and descriptions must be hardcoded at the server level — never constructed from user-supplied database values
- If tool descriptions reference org-specific context (org name), treat that value as untrusted and sanitize it (strip special characters, limit length)
- Do not pass transcript content, note content, or any user-submitted text into tool descriptions or system prompts without explicit sanitization

**Warning signs:**
- Tool description strings built with template literals that include database columns
- `tool.description = org.name + "..."` patterns in code
- Dynamic tool registration based on org configuration

**Phase to address:**
Tool definition phase. Code review gate: all tool description strings must be hardcoded constants.

---

### Pitfall 8: MCP Auth Token Returned in Plaintext in API Response

**What goes wrong:**
The provisioning endpoint returns the generated MCP token in the API response so the frontend can display it. This response is logged by Supabase's built-in function logging, intercepted by any network proxy, or persisted in browser history. If anyone with read access to Supabase's function logs can see active MCP tokens for all orgs, the token isolation is broken.

**Why it happens:**
Returning the token once on provisioning is the obvious flow for "show user their connection string." The logging concern is invisible until you check Supabase's default log retention.

**How to avoid:**
- Return the token exactly once — in the response to the initial provisioning/regeneration call — then never again
- Log token_id and org_id in function logs, never the token value
- After the first display, the UI shows only the token prefix (first 8 chars) for identification, with a "Regenerate" button
- In Supabase Edge Function handler, redact sensitive return values before any structured logging

**Warning signs:**
- `console.log(response)` in Edge Functions where response contains `mcp_token`
- Full token stored in `org_mcp_config.token` column (vs. hashed)
- UI that fetches and displays the full token on every page load

**Phase to address:**
Token storage and management phase. Supabase Edge Function logging review should be a checklist item.

---

### Pitfall 9: Edge Function Size Limit Breaks MCP Deployment

**What goes wrong:**
A large MCP server Edge Function (bundled with AI tool logic, schema validators, and utility libraries) exceeds ~15KB and the Supabase MCP deploy tool returns a generic "Function deploy failed due to an internal error" with no indication of the size cause. Development stalls while debugging a non-code issue.

**Why it happens:**
The 15KB threshold is undocumented. Adding CRUD tools, AI tools, and schema validation all in one function (the "fat function" pattern Supabase recommends for cold start performance) can easily hit this limit.

**How to avoid:**
- Split MCP server into: one Edge Function for CRUD tools, one for AI tools, one for auth/provisioning
- Monitor bundle size during development with `supabase functions bundle --size` checks
- Keep AI tool handlers thin — they should call a shared utility, not embed the LLM call inline

**Warning signs:**
- Single monolithic MCP Edge Function file growing past 500 lines
- "Internal error" on deploy with no other error details
- All tool categories in one file

**Phase to address:**
MCP server architecture phase. Decide on function split strategy before writing tool implementations.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Derive org_id from request body instead of token | Simpler tool handler code | Cross-org data leak via IDOR | Never |
| Check plan tier only in UI | Faster to build | Free users bypass gate via direct API | Never |
| Use service_role key in MCP tool handlers | Bypasses RLS, easy auth | Any tool call has full DB access; org isolation breaks | Never |
| Single long-lived static MCP token per org | Simple UX | No revocation, no audit trail, permanent leak on exposure | Never in production |
| Skip AI tool quota enforcement for launch | Ship faster | Cost runaway; no data for future metered billing | Only in internal/preview with monitoring |
| Carry SSE transport from prototype | No re-architecture needed | Fragile under load, deprecated transport | Never for new production deployments |
| Hardcode plan check as `org.plan === 'pro'` | Simple | Breaks when plan names change; doesn't handle grandfathered plans | Only for MVP with documented refactor ticket |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Polar billing | Read plan tier from JWT user metadata (user-writable) | Read from `org_settings.plan_tier` populated by Polar webhook — server-authoritative |
| Polar webhooks | No signature validation on webhook endpoint | Validate with Polar's Standard Webhooks signature on every incoming event |
| Supabase RLS | Create MCP client with service_role key to "make things easy" | Use a user-scoped JWT or org-scoped service account; never service_role in customer-facing code |
| OpenRouter / Vercel AI SDK | No `max_tokens` cap on summarize tool | Always set explicit `max_tokens` per tool; log actual token usage per call |
| Supabase Realtime | Subscribe to `org_mcp_config` changes from the MCP server itself | Subscribe from the frontend only; MCP server reads DB directly, no circular realtime subscriptions |
| mcp-remote (OAuth proxy) | Use unpatched version (CVE-2025-6514) | Pin to latest version; the command injection via `authorization_endpoint` is real and exploited |
| MCP tool naming | Name tools `search`, `list`, `get` | Prefix with domain: `search_transcripts`, `list_calls` — avoids collision when user has multiple MCP servers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| AI tools run synchronously in MCP request cycle | MCP client timeout (>30s Edge Function limit) on large transcript summarization | Stream AI tool responses via Streamable HTTP; for batch ops, return a job ID and poll | Transcripts >30 minutes (~10K tokens) |
| N+1 in `list_calls` tool — fetches transcript content for each call | Tool response time 5-20s for list of 50 calls | `list_calls` returns metadata only; `get_call` fetches content; never join transcript body in list queries | 20+ calls in a single list response |
| Provisioning creates realtime subscription per org on server startup | Memory leak in long-running process; if using Edge Functions, not applicable but auth logic re-runs per cold start | Keep MCP server stateless; all state in DB | 50+ concurrent org connections |
| Full transcript text returned in every tool response | Token costs for LLM agent skyrocket; slow responses | Tool responses return structured summaries + IDs; raw text only when explicitly requested | Transcripts >5K tokens |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `org_id` accepted as tool argument (not derived from token) | Attacker passes any org_id, accesses any org's data (IDOR) | Derive `org_id` exclusively from token claims; reject any tool call that supplies `org_id` as parameter |
| Plan tier stored in JWT user_metadata | User edits their own JWT claims to claim PRO tier | Store tier in server-controlled `org_settings` table; check DB on every MCP connection |
| MCP token displayed on every settings page load | Token captured by browser extension, proxy logs, shoulder surfing | Show token once on creation; display only prefix thereafter |
| Tool descriptions built from user content | Prompt injection / tool poisoning — malicious instructions manipulate LLM agent | Hardcode all tool descriptions as source-code constants; never concatenate user content |
| No rate limit on MCP endpoint | Credential stuffing, scraping, DoS of AI tools | Rate limit by IP and by org_id; 429 with retry_after |
| Transcript content returned verbatim in AI tool errors | Error messages leak data to LLM context / logs | AI tool errors return generic codes, not content |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Token regeneration has no confirmation step | User accidentally regenerates, all existing MCP clients break immediately | Modal with "This will disconnect all existing MCP clients. Continue?" + copy-new-token step |
| MCP settings show "Not connected" when provisioning is still pending | User thinks it failed, retries, gets confused | Show explicit "Setting up your MCP server..." state with estimated time |
| Connection string displayed with no copy button | User manually copies, makes typos in long token strings | One-click copy button; show masked token with explicit reveal toggle |
| AI tool quota exhausted with no forewarning | User hits wall mid-workflow, no explanation | Show "X AI tool calls remaining today" counter in MCP settings; warn at 80% |
| Plan downgrade silently revokes MCP access | User's automated workflows break overnight with no warning | Email notification 7 days before downgrade takes effect; 24h warning in app |

---

## "Looks Done But Isn't" Checklist

- [ ] **Org isolation:** UI works correctly for Org A — but has it been tested by calling the tool with Org B's data from Org A's token? Verify with a cross-org call test.
- [ ] **Plan gating:** MCP settings pane is hidden for free users — but can a free user call `/mcp-provision` directly via curl? Verify server-side gate exists.
- [ ] **Token revocation:** "Regenerate" button shows new token — but is the old token actually rejected? Test old token after regeneration.
- [ ] **AI tool costs:** `summarize_call` works on a 5-minute call — but what happens on a 90-minute call? Test token count logging and max_tokens enforcement.
- [ ] **Provisioning idempotency:** First org provisions cleanly — but what if the trigger fires twice? Verify `ON CONFLICT DO NOTHING` and that there's a unique constraint on org_id.
- [ ] **SSE vs Streamable HTTP:** MCP server responds correctly — but which transport? Verify Content-Type header is NOT `text/event-stream` for production deployment.
- [ ] **Tool description injection:** Tool descriptions look static — but are any strings built from DB values? Grep for template literals in tool definition files.
- [ ] **Polar webhook handling:** Plan shows PRO in UI — but is there a webhook handler that updates `org_settings.plan_tier` on cancellation? Test by simulating a `subscription.canceled` webhook.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Org isolation leak discovered post-launch | HIGH | Audit all MCP tool call logs for cross-org queries; notify affected orgs; patch tool handlers; add server-side org_id validation immediately |
| Plan tier bypass discovered | MEDIUM | Deploy server-side tier check immediately; audit org_mcp_config for free-tier orgs with active MCP; revoke unauthorized access |
| Token leaked in logs | MEDIUM | Rotate all tokens (mass regeneration job); notify affected orgs; add log redaction; review Supabase function log retention settings |
| AI cost runaway | MEDIUM | Kill switch: add `mcp_ai_tools_enabled` flag to `org_settings`; disable globally; add quotas; re-enable per org |
| SSE transport failures under load | MEDIUM | Deploy Streamable HTTP transport; update connection strings for existing users; SSE and Streamable HTTP can coexist briefly during migration |
| Provisioning duplicates | LOW | Dedup script: identify org_ids with multiple mcp_config rows; keep newest, archive others; add unique constraint in migration |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Org isolation leak via missing org_id | Token architecture + tool handler scaffolding | Cross-org data access test: Org A token cannot retrieve Org B data |
| Plan tier frontend-only enforcement | Plan gating phase | Direct API call from free-tier token returns 403 |
| Long-lived static MCP tokens | Token storage and management phase | Old token rejected after regeneration; token stored hashed |
| Provisioning race condition | Auto-provisioning phase | Rapid dual-org creation yields exactly one mcp_config row each |
| AI tool cost runaway | AI tools phase | 1000 calls in test env hits quota at configured limit |
| SSE deprecated transport | MCP server architecture phase | Response Content-Type is not text/event-stream |
| Tool poisoning via dynamic descriptions | Tool definition phase | Code review: zero template literals in tool description strings |
| Token in plaintext logs | Token storage phase | Grep function logs after provisioning: no full token string present |
| Edge Function size limit | MCP server architecture phase | `supabase functions bundle` shows each function under 12KB |
| Polar webhook gap on downgrade | Plan gating phase | Simulate cancellation webhook; MCP access revoked within 60s |

---

## Sources

- [MCP Security Survival Guide — Towards Data Science](https://towardsdatascience.com/the-mcp-security-survival-guide-best-practices-pitfalls-and-real-world-lessons/)
- [MCP Server Security Best Practices 2026 — Data Science Collective](https://medium.com/data-science-collective/why-your-mcp-server-is-a-security-disaster-waiting-to-happen-660577d8077c)
- [State of MCP Server Security 2025 — Astrix](https://astrix.security/learn/blog/state-of-mcp-server-security-2025/)
- [Timeline of MCP Security Breaches — AuthZed](https://authzed.com/blog/timeline-mcp-breaches)
- [Tool Poisoning Attacks — Invariant Labs](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)
- [MCP Prompt Injection — Simon Willison](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/)
- [Protecting Against Indirect Injection in MCP — Microsoft Dev](https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp)
- [CVE-2025-6514 mcp-remote command injection — JFrog](https://jfrog.com/blog/mcp-prompt-hijacking-vulnerability/)
- [Why MCP Deprecated SSE — fka.dev](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP Streamable HTTP Auth — Auth0](https://auth0.com/blog/mcp-streamable-http/)
- [Deploy MCP Servers — Supabase Docs](https://supabase.com/docs/guides/getting-started/byo-mcp)
- [MCP Authentication — Supabase Docs](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Token Security and RLS — Supabase Docs](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [MCP Tool Name Collisions — Cursor Community Forum](https://forum.cursor.com/t/mcp-tools-name-collision-causing-cross-service-tool-call-failures/70946)
- [Tool-Space Interference — Microsoft Research](https://www.microsoft.com/en-us/research/blog/tool-space-interference-in-the-mcp-era-designing-for-agent-compatibility-at-scale/)
- [MCP Security Top Practices 2026 — akto.io](https://www.akto.io/blog/mcp-security-best-practices)
- [Edge Function Shutdown Reasons — Supabase Docs](https://supabase.com/docs/guides/troubleshooting/edge-function-shutdown-reasons-explained)
- [MCP Supabase Edge Function Deploy Size Issue — GitHub](https://github.com/supabase-community/supabase-mcp/issues/102)

---
*Pitfalls research for: Production MCP infrastructure on Supabase — per-org provisioning, CRUD + AI tools, plan-tier gating*
*Researched: 2026-04-10*
