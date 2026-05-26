# Feature Research

**Domain:** MCP Production Infrastructure for Transcript/Call Intelligence Platform
**Researched:** 2026-04-10
**Confidence:** MEDIUM-HIGH (tool landscape verified against Fireflies/Supabase official docs; MCP spec 2025-11-25 verified)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that MCP-enabled platforms ship as baseline. Missing = product feels unfinished or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-provision MCP server on org creation | Users expect their account to "just work" — no manual setup | MEDIUM | Trigger: org_created webhook or DB function. Idempotent upsert into mcp_tokens. Already have table, just need trigger. |
| Per-org token isolation | Security baseline. LLMs must never see another org's data. | LOW | Already have org_id scoping on all queries + RLS. MCP just needs to pass the org's token through. No new architecture needed. |
| Connection string / server URL in settings UI | Users need this to paste into Claude, Cursor, etc. | LOW | Static URL pattern: `https://<project>.supabase.co/functions/v1/mcp/<org_slug>` |
| Token regeneration (revoke + reissue) | Standard for any API key system. Users expect "rotate key" button. | LOW | Delete old token row, insert new. Existing OAuth consent page may need update. |
| `search_transcripts` tool | Core use case. Every MCP-connected call platform exposes this. | MEDIUM | Full-text search via Supabase `tsvector` or `ilike`. Needs org_id scoping enforced server-side. |
| `list_calls` tool with filters | Expected alongside search. "Show me calls from last week with [contact]" | MEDIUM | Supports: date_range, contact, folder, tag, source, duration. Returns paginated list. |
| `get_call` tool | Detail view for a single call: metadata + transcript text | LOW | Returns title, date, duration, participants, full transcript, existing summary if cached |
| `get_transcript` tool | Get raw transcript with speaker labels and timestamps | LOW | Separate from get_call to keep payloads manageable |
| Plan gating — PRO only | SaaS standard. Freemium users hit a wall; upgrade prompt shown. | LOW | Check Polar subscription status at token issue time + on each tool invocation. Already have billing infrastructure. |
| MCP settings section in app | Users expect to find connection info in Settings, not a separate page | LOW | Settings > Integrations > MCP. Show URL, token (masked), copy button, regenerate button. |

### Differentiators (Competitive Advantage)

Features that go beyond what Fireflies/Otter/Grain ship today, or ship with meaningfully better UX.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `summarize_call` tool | "Give me a 3-sentence summary of that call" — most useful single AI tool | MEDIUM | Call Vercel AI SDK with transcript text. Cache result in DB column to avoid re-invoking on repeat queries. |
| `extract_action_items` tool | Surfaces todos without reading transcript | MEDIUM | Structured output: `[{owner, action, due_date_mentioned}]`. Can cache alongside summary. |
| `ask_call` tool (Q&A on single call) | "What did [contact] say about pricing?" — more useful than raw transcript | HIGH | RAG over transcript chunks using pgvector. Requires embedding pipeline. Flag for deeper research. |
| `query_calls` tool (cross-call natural language) | "Which calls mentioned competitor X?" "Summarize all calls with Acme Corp" | HIGH | Requires embeddings across all org transcripts. Most powerful differentiator. Flag for deeper research. |
| `get_sentiment` / `get_coaching_notes` tool | Surfaces tone, talk ratio, key moments. Used by sales coaches. | HIGH | Needs structured analysis prompt. Could be cached per-call. Not blocking for launch. |
| Per-tool capability toggles in settings | Org admins can enable/disable specific tools (e.g., disable AI tools, keep CRUD) | MEDIUM | DreamFactory pattern: toggle each tool on/off in settings UI. Stored in org config. Eliminates surprise AI calls. |
| `create_note` / `add_tag` / `move_to_folder` (write tools) | AI agents can organize the library, not just read it | MEDIUM | Write tools increase blast radius risk. Scope carefully — require explicit confirmation patterns. |
| Capability tiers: CRUD-only vs CRUD+AI | Let orgs choose their exposure surface | LOW | Stored as a column on mcp_tokens or org settings. UI shows which tier is active. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Expose ALL data via MCP with no org check | "Just make everything accessible" — simplest to build | Critical security hole. One leaked token exposes all orgs. | Enforce org_id at the MCP server level, not just in RLS. Defense in depth. |
| Real-time transcript streaming via MCP | Seems powerful — "see the call as it happens" | MCP is request/response, not a streaming pub/sub bus. Adds enormous complexity for very niche use. | Defer to a future webhook/event system. Not MCP's job. |
| One shared MCP server for all orgs | Simplest infrastructure — one endpoint, route by token | A bug in tenant routing leaks cross-org data. Hard to audit. | Per-org URL path or per-org token that encodes org_id server-side. |
| Expose raw DB schema via MCP | "Let AI write arbitrary SQL" | SQL injection surface, full schema exposure, breaks data isolation guarantees | Expose specific tools with typed inputs only. Never pass SQL strings through MCP. |
| Unlimited AI tool invocations on free tier | "AI tools should be free to try" | Unbounded cost. Each summarize/ask_call call hits LLM API. | Gate AI tools at PRO tier. Usage metering is a future milestone. |
| Global cross-org MCP (admin view) | Power users want to see all orgs from one connection | Conflates super-admin and customer concerns. Massive security audit surface. | Explicitly out of scope for v2.1. Stretch goal only with separate auth path. |

---

## Feature Dependencies

```
[Auto-provision on org create]
    └──requires──> [mcp_tokens table] (already exists)
    └──requires──> [Plan gating check] ──requires──> [Polar billing integration] (already exists)

[search_transcripts tool]
    └──requires──> [Per-org token auth in MCP server]
    └──requires──> [calls/transcripts table with org_id] (already exists)

[list_calls with filters]
    └──requires──> [Per-org token auth in MCP server]

[get_call / get_transcript]
    └──requires──> [Per-org token auth in MCP server]

[summarize_call tool]
    └──requires──> [get_transcript] (reads same data)
    └──requires──> [Vercel AI SDK integration in edge function]
    └──enhances──> [get_call] (can return cached summary inline)

[extract_action_items tool]
    └──requires──> [summarize_call] (same LLM call pattern, can share infra)

[ask_call tool]
    └──requires──> [pgvector embeddings per transcript chunk] (NOT yet built — flag for research)
    └──requires──> [embedding pipeline on import] (NOT yet built)

[query_calls tool (cross-call)]
    └──requires──> [ask_call] (same embedding infra, wider scope)

[Per-tool capability toggles]
    └──requires──> [MCP settings UI]
    └──requires──> [org_mcp_config table or column on mcp_tokens]

[MCP settings UI]
    └──requires──> [Auto-provision] (needs a token to display)

[write tools: create_note, add_tag, move_to_folder]
    └──requires──> [CRUD tools proven reliable first]
    └──conflicts──> [read-only blast radius] (write tools need extra consent patterns)
```

### Dependency Notes

- **ask_call and query_calls require embedding infrastructure** that does not exist yet. These are HIGH complexity, flag for a dedicated research phase before committing.
- **summarize_call and extract_action_items share the same LLM call pattern** — build one, the other is a schema change. Build together.
- **Write tools (create_note, add_tag)** conflict with the principle of starting MCP as read-only. Add only after read tools are stable.
- **Plan gating is already partially in place** (Polar billing exists) — MCP gating adds a check at token issuance and per-invocation, not a new billing integration.

---

## MVP Definition

### Launch With (v2.1)

Minimum viable production MCP that validates the "AI-ready" positioning on day one.

- [ ] Auto-provision MCP server on org creation (PRO check at creation)
- [ ] Per-org token issued, stored, retrievable
- [ ] `search_transcripts` — full-text search within org
- [ ] `list_calls` — date/folder/tag/contact/source filters, pagination
- [ ] `get_call` — metadata + cached summary if available
- [ ] `get_transcript` — full text with speaker labels
- [ ] `summarize_call` — LLM-powered, cached after first call
- [ ] `extract_action_items` — LLM-powered, cached
- [ ] Plan gating enforcement (PRO+ only, error message for lower tiers)
- [ ] MCP settings UI section (URL, masked token, copy, regenerate)
- [ ] Token regeneration (revoke + reissue flow)

### Add After Validation (v2.1.x)

- [ ] Per-tool capability toggles in settings — trigger: customer requests to limit AI exposure
- [ ] `ask_call` Q&A tool — trigger: embedding pipeline is built
- [ ] `get_sentiment` / `get_coaching_notes` — trigger: validated user demand
- [ ] Write tools (`create_note`, `add_tag`, `move_to_folder`) — trigger: proven read tools stable

### Future Consideration (v2.2+)

- [ ] `query_calls` cross-call natural language — needs full embedding pipeline across all org transcripts
- [ ] Usage metering + per-tool rate limits
- [ ] Global cross-org MCP (stretch goal, separate auth)
- [ ] MCP marketplace / third-party tool integrations

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auto-provision on org create | HIGH | LOW | P1 |
| search_transcripts | HIGH | MEDIUM | P1 |
| list_calls with filters | HIGH | MEDIUM | P1 |
| get_call / get_transcript | HIGH | LOW | P1 |
| summarize_call | HIGH | MEDIUM | P1 |
| extract_action_items | HIGH | MEDIUM | P1 |
| Plan gating enforcement | HIGH | LOW | P1 |
| MCP settings UI | HIGH | LOW | P1 |
| Token regeneration | MEDIUM | LOW | P1 |
| Per-tool capability toggles | MEDIUM | MEDIUM | P2 |
| ask_call (Q&A on single call) | HIGH | HIGH | P2 |
| get_sentiment / coaching | MEDIUM | HIGH | P2 |
| Write tools (create_note etc.) | MEDIUM | MEDIUM | P2 |
| query_calls (cross-call) | HIGH | HIGH | P3 |
| Global cross-org MCP | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Fireflies MCP | Grain MCP | Our Approach |
|---------|---------------|-----------|--------------|
| Transcript search | get_transcripts action | Present (details unverified) | search_transcripts with org_id hard-enforced server-side |
| Get single transcript | get_transcript_by_id | Present | get_call + get_transcript as separate tools to control payload size |
| AI summaries | Via fetch_ai_app_outputs (indirect) | Unverified | summarize_call as first-class tool, cached in DB |
| Action items | Via fetch_ai_app_outputs | Unverified | extract_action_items as first-class tool |
| Authentication | API key (developer settings) | Unknown | OAuth token per org, auto-provisioned, gated to PRO |
| Per-tool toggles | Not found in public docs | Unknown | Explicit admin UI toggle per tool (DreamFactory pattern) |
| Write tools | None documented | Unknown | Post-validation, read-only first |
| Plan gating | Not documented | Unknown | Hard-enforced at PRO tier via Polar |
| Auto-provisioning | Manual API key setup | Unknown | Automatic on org creation |

---

## Sources

- [Fireflies MCP Server blog](https://fireflies.ai/blog/fireflies-mcp-server/) — tool categories, auth approach
- [Composio Fireflies toolkit](https://composio.dev/toolkits/fireflies) — confirmed 10 tools, tool names
- [Supabase MCP Authentication docs](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) — RLS integration, OAuth 2.1 pattern
- [Supabase mcp-lite Edge Function example](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite) — production tool registration pattern
- [MCP Tool Design — modelcontextprotocol.info](https://modelcontextprotocol.info/docs/concepts/tools/) — naming, schemas, atomic focus principle
- [Production-Ready MCP Servers Guide — webmcpguide.com](https://webmcpguide.com/articles/production-ready-mcp-servers-guide) — table stakes vs differentiators for production
- [Multi-tenant MCP patterns — Medium](https://medium.com/@manikandan.eshwar/multi-tenant-mcp-servers-why-centralized-management-matters-a813b03b4a52) — per-tenant token isolation
- [Per-tool toggle controls — DEV Community](https://dev.to/nicdavidson/we-shipped-per-tool-toggle-controls-for-our-mcp-server-heres-why-it-matters-more-than-it-sounds-4a2f) — DreamFactory pattern, admin UI toggles
- [MCP tool naming conventions — zazencodes.com](https://zazencodes.com/blog/mcp-server-naming-conventions) — snake_case standard, 90%+ adoption
- [MCP 2025-11-25 spec update — WorkOS](https://workos.com/blog/mcp-2025-11-25-spec-update) — OAuth 2.1 finalized, async tasks

---

*Feature research for: MCP Production Infrastructure — Transcript/Call Intelligence Platform*
*Researched: 2026-04-10*
