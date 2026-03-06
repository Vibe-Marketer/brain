# Phase 2: Chat Foundation - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make chat work reliably every single time — proper streaming via Vercel AI SDK, tool orchestration with transparent status, inline citations, and error surfacing. This phase replaces the hand-rolled 1993-line `chat-stream` monolith with a clean Vercel AI SDK implementation, fixes tool call transparency (no more green checkmarks on empty/failed results), wires consistent citations, and surfaces all silent errors.

**Out of scope:** New chat features (folders, search, bookmarking), UI redesign beyond tool/citation changes, Chat.tsx refactor (that's Phase 7 REFACTOR-01).

</domain>

<decisions>
## Implementation Decisions

### SDK Migration Strategy
- **Full replacement** of the backend `chat-stream` Edge Function using Vercel AI SDK `streamText()` + native `tool()` definitions
- **Parallel development:** Build as a NEW Edge Function (`chat-stream-v2` or similar) accessible via a `/chat2` test path. The existing `chat-stream` continues serving `/chat` untouched until the new one is proven
- **Switchover criteria:** Feature parity with the current implementation PLUS noticeable improvements (faster streaming, better tool handling, cleaner errors) before replacing `/chat`
- **Post-switchover:** Keep the old `chat-stream` renamed as `chat-stream-legacy` as a fallback. Delete after a week or two of confidence
- **Claude's discretion on code structure** — single file vs modular (tools in `_shared/`, search logic extracted, etc.). Let the AI SDK migration dictate the natural structure
- **Key reference:** `docs/reference/technical-reverse-engineering-report-ACQai.md` — this documents how ACQ AI implements `streamText()` + parallel tool execution + streaming tool inputs. The new implementation should follow this architecture pattern
- **Query expansion:** Tool design should encourage multiple semantically diverse queries per search (ACQ AI fires 6-8 parallel queries per user question). This is a system prompt + tool design concern, not a separate feature — bake it into the new tool definitions from the start

### Tool Call Transparency
- **Three distinct visual states** for tool calls (critical — current system only has one):
  1. **Success with results** — ✅ green indicator + result count (e.g., "Searched Transcripts (7 results)")
  2. **Success but empty** — ⚠️ amber/gray indicator + zero count (e.g., "Searched By Speaker (0 results)")
  3. **Actual failure** — ❌ red indicator + "Failed" label (e.g., "Search By Date Range — Failed")
- **Status line always visible, details collapsed** — user sees icon + name + count at a glance. Expand to see query and full results
- **Streaming query visibility** — while a tool is running, show the query being constructed in real-time (e.g., "🔄 Searching Transcripts: 'quarterly sales calls with objections'..."). Matches ACQ AI's streaming tool inputs pattern
- **Flat list layout** — each tool gets its own line, in the order they fire. No grouping by execution wave

### Citation Behavior
- **Both inline AND bottom source list** — inline numbered markers `[1]`, `[2]` appear in the response text next to claims they support, AND a full source list appears at the bottom for scanning
- **Numbered markers with hover preview** — `[1]` is clean and unobtrusive inline. Hovering shows call title + speaker + date as a tooltip
- **Click behavior:** Clicking an inline `[1]` marker OR clicking the corresponding source in the bottom list both open the CallDetailDialog (same behavior, consistent)
- **Citations MUST persist across page reload** — if citations disappear when a chat is saved and reloaded, that's a bug. Tool result data must survive the serialization round-trip

### Error & Recovery UX
- **Streaming failure:** Toast notification ("Connection lost") + partial response preserved + "Retry" button to resend the message. No inline recovery indicators
- **Tool failure with partial success:** Continue generating response from successful tools + model explicitly discloses the gap (e.g., "Note: I couldn't search [source] due to an error — this answer is based on [N] other sources"). Failed tool shows ❌ in the tool list
- **Store errors (STORE-01):** `toast.error()` on every failure — "Couldn't save content item. Please try again." Immediate, clear feedback. No more silent null returns
- **Connection status indicator:** Claude's discretion on whether to show a persistent indicator or keep it reactive-only

### Claude's Discretion
- Code structure of the new chat-stream Edge Function (single file vs modular)
- Connection status indicator approach (persistent dot vs reactive-only)
- Exact visual design of tool status indicators (icons, colors, animations)
- Loading skeleton and transition states during tool execution
- System prompt design for query expansion (guided by ACQ AI reference)

</decisions>

<specifics>
## Specific Ideas

- **ACQ AI as the architectural blueprint** — `docs/reference/technical-reverse-engineering-report-ACQai.md` documents exactly how a production Vercel AI SDK chat with `streamText()`, parallel tool execution, and streaming tool inputs works. The new implementation should mirror this pattern adapted for CallVault's 14 RAG tools and Supabase/pgvector backend
- **The zod bundling issue** is why the backend was hand-rolled in the first place (comment in `chat-stream/index.ts` line 4-6: "safeParseAsync is not a function"). Other Edge Functions (`generate-ai-titles`, `auto-tag-calls`) already use `@openrouter/ai-sdk-provider` with `generateText()` successfully — but not with streaming + tools together. The migration needs to verify this works before committing to the approach
- **Query expansion modeled after ACQ AI** — one user question becomes multiple semantically diverse retrieval queries fired in parallel. This is how the new tool definitions and system prompt should work from day one
- **"Green checkmark on empty results" is the #1 UX frustration** — users see ✅ and think data was found, but it wasn't. The three-state system (success/empty/failed) with visible counts is the core fix for CHAT-02

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-chat-foundation*
*Context gathered: 2026-01-28*
