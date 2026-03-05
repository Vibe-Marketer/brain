# Codebase Analysis & Audits

Analysis performed at two points: 2026-01-26 (stack/conventions) and 2026-02-09 (architecture/concerns).

**Note:** The codebase docs in `.planning/codebase/` reflect the brain/v1 architecture. The active v2/callvault frontend has since moved to a different stack.

---

## v1 Stack (brain repo — legacy)

- [ ] Frontend: React 18.3.1, Vite 5.4.19, React Router 6.30.1, Tailwind 3.4.18
- [ ] Backend: Supabase Edge Functions (Deno runtime), PostgreSQL
- [ ] AI: Vercel AI SDK + OpenRouter
- [ ] Testing: Vitest 4.0.16, Playwright 1.57.0
- [ ] Package manager: npm

## v2 Stack (callvault repo — active)

- [ ] Frontend: React 19.2, Vite 7.3.1, TanStack Router v1, Tailwind v4
- [ ] State: Zustand v5 (UI) + TanStack Query v5 (server)
- [ ] Animations: Motion for React v12
- [ ] Components: shadcn/ui + Radix UI
- [ ] Icons: Remix Icons only
- [ ] Package manager: pnpm

---

## Chat Backend Architecture (v1 — for reference)

- [ ] 14 RAG tools in 4 categories: Core Search (4), Metadata Search (5), Analytical (3), Advanced (2)
- [ ] Vercel AI SDK `streamText()` with `toUIMessageStreamResponse()` via SSE
- [ ] Pipeline: embedding (200-500ms) -> hybrid search (50-200ms) -> re-ranking (300-800ms) -> diversity filter -> share URL lookup
- [ ] OpenRouter for 300+ models, DB-driven model configuration
- [ ] Total pipeline: 600-1500ms per tool call; typical response: 2-10 seconds
- [ ] Langfuse tracing integration (non-blocking)

### Known Weaknesses

- [ ] No result caching — every request re-executes full pipeline
- [ ] Blocking re-ranking — serial HuggingFace calls, 45 second worst case
- [ ] Single point of failure on OpenAI embeddings
- [ ] Monolithic edge function (1,410 lines, 14 tools inline)
- [ ] No streaming cancellation (no AbortController)
- [ ] No per-user cost limits

---

## MCP Server Analysis

- [ ] Dual deployment: local stdio mode (Claude Desktop) + Cloudflare Worker (StreamableHTTP)
- [ ] 4 meta-tools: discover, get_schema, execute, continue (pagination)
- [ ] 16 operations across 6 categories
- [ ] 5 prompt templates
- [ ] Stateless JWT validation via Supabase JWKS
- [ ] Dual-schema fallback: recordings table first, then fathom_calls
- [ ] Deployed to: mcp.callvaultai.com
- [ ] Known gap: sessionsCache in-memory Map lost between Worker isolates
- [ ] Known gap: contacts.list and search.semantic lack bank_id filtering

---

## Security Concerns Identified

- [ ] Users can set `filter_recording_ids` to any recording IDs — no DB validation
- [ ] `hybrid_search_transcripts()` can be called directly bypassing vault scoping
- [ ] `chat_tool_calls.tool_input` accepts arbitrary JSONB with no validation
- [ ] Migration history: 3 fix migrations in 2 days indicates testing gaps

---

## Database Schema Concerns

- [ ] `transcript_chunks`: FK to deprecated `fathom_calls` table (not `recordings`)
- [ ] `chat_sessions`: Missing `bank_id` and `vault_id` (fixed in isolation debug sessions)
- [ ] `filter_recording_ids` uses BIGINT[] but recordings table uses UUID PKs
- [ ] Missing indexes: composite (user_id, call_date), partial (user_id WHERE embedding IS NOT NULL)
- [ ] Storage projection: ~7KB/row, 700MB per user at 100k chunks, 7TB at 1000 users

---

## Legacy Archive Operation (2026-02-11)

- [ ] Moved to `.planning/archive/legacy-tooling/`: `.auto-claude`, `.claude`, `.serena`, `ralph-archived`, `PRPs`, `specs`
- [ ] docs/specs archived to `docs/archive/specs-legacy/`
- [ ] Keep-worthy items migrated to `.planning/todos/tech-debt/`
- [ ] 11 spec files audited: 2 implemented, 4 partially, 2 not implemented, 3 docs-only
- [ ] 46 PRDs audited: 8 fully implemented, 2 partially, 2 de-scoped, 34 unknown
- [ ] Several specs contradict current Bank/Vault architecture

---

## Quick Tasks Completed (v1)

### Quick-001: Workspace/Hub Tab Indicator
- [ ] Changed active tab from underline to horizontal floating pill
- [ ] Codified: "One primary active affordance (pill) over stacked accent signals"

### Quick-002: UI Brand Audit + HUB Header Fix
- [ ] Icon-led HUB header with stacked workspace context
- [ ] Pane header tokens aligned across 4 pane types
- [ ] Brand guidelines bumped to v4.2.1: rounded pill tabs canonical, clip-path markers legacy

### Quick-003: Run Migration + Sync Hub Naming
- [ ] Applied folders/tags bank_id migration
- [ ] Orphaned rows (users without banks) caused NOT NULL constraint failure — deleted orphans before constraint
- [ ] "Sync to vault" renamed to "Sync to Hub"
