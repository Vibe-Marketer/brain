# CallVaultAI: The Case for Becoming Infrastructure Instead of Another AI App

**Prepared by:** Tyler Naegele
**Date:** February 18, 2026

---

## The Short Version

I want to rip out ~89,000 lines of AI code from CallVault — the RAG pipeline, the embeddings, the chat system, the content generators — and replace it all with a single MCP server that's maybe 2-3,000 lines. The product stops trying to *be* the AI and instead becomes the organized data layer that makes *every* AI smarter about your sales calls.

This isn't retreat. It's positioning. And the market is already telling us this is the right move.

---

## Where CallVault Is Today

CallVault currently maintains an enormous AI surface area alongside its core call management platform:

- **A hybrid RAG pipeline** — pgvector embeddings, HNSW vector search, full-text search, Reciprocal Rank Fusion, cross-encoder re-ranking, diversity filtering
- **A full chat system** — Vercel AI SDK streaming via OpenRouter with 14 hardcoded RAG tools
- **An embedding pipeline** — queue-based workers, adaptive speaker-turn-aware chunking, metadata enrichment, retry logic, progress tracking
- **A Content Hub** — 7+ edge functions for generating emails, LinkedIn posts, blog outlines, case studies
- **Auto-processing** — per-call AI job tracking, configurable preferences, manager notes, action items, summaries, AI titles, auto-tags, sentiment analysis
- **An automation rules engine** — trigger-based system with sentiment AI evaluation, 6 trigger types, 12+ action types
- **AI model management** — OpenRouter model sync, tiered model selection UI
- **Langfuse observability** — full LLM trace lifecycle
- **Semantic search** — standalone global search via embeddings

That's 23 edge functions, 15 database tables, and dependencies on OpenAI, OpenRouter, and Langfuse — just for the AI layer.

Meanwhile, the **core platform** — workspace isolation (banks/vaults), 4-source import (Fathom, Zoom, Google Meet, YouTube), transcript management, folders/tags, invite/share links, export, roles/permissions — works completely independently of all the above. And it's the part that's actually hard to build, actually unique, and actually valuable.

---

## The Problem

We're spending the majority of our engineering effort maintaining an AI layer that:

1. **Is always worse than what users can get elsewhere.** Claude Opus, GPT-5, Gemini — these frontier models are better at analysis, summarization, and content generation than anything we can build in-house. And they're improving every few months. We're running on a treadmill we can never win.

2. **Is what every competitor also builds.** Fireflies, Otter, Gong — they all have AI chat, AI summaries, AI action items. It's table-stakes-that-isn't-actually-a-differentiator. Everyone has it, nobody wins on it.

3. **Costs real money per call.** Embeddings via OpenAI, LLM calls via OpenRouter, vector storage, queue processing. Every imported call triggers a chain of API costs and infrastructure load.

4. **Is the #1 source of bugs and maintenance.** The RAG pipeline alone spans 3+ edge functions, pgvector infrastructure, chunking logic, metadata enrichment, and retry handling. The chat system with its 14 tools is the most fragile edge function in the codebase.

5. **Locks users into our AI choices.** Users can't pick their own model. They can't use their own prompts. They get whatever we built, with whatever model we chose, with whatever RAG strategy we implemented. In a world where everyone has a preferred AI tool, that's a constraint, not a feature.

---

## What Changed: The MCP Convergence

In the last 12 months, the AI ecosystem converged on a single standard for tool integrations: **MCP (Model Context Protocol)**.

| Platform | MCP Support | Status |
|----------|-------------|--------|
| Claude Desktop/Code | Native | Production |
| ChatGPT | Apps SDK (built on MCP) | Production — replaced Actions/Plugins entirely |
| Gemini | Extensions marketplace | Production — 90+ extensions |
| Perplexity | Native MCP | Production |
| Cursor / VS Code | Native MCP | Production |
| OpenClaw | Native MCP | Production |
| Manus | Native MCP | Production |

The critical detail: **OpenAI deprecated GPT Actions and Plugins and replaced them with the Apps SDK, which is built directly on MCP.** This means a single MCP server IS your ChatGPT plugin, your Claude connector, your Gemini extension, and your Cursor integration — simultaneously.

Our competitors already see this:

| Competitor | MCP Server | When |
|------------|-----------|------|
| Fireflies.ai | Yes (beta) | 2025 |
| Otter.ai | Yes (enterprise only) | Oct 2025 |
| Gong | Yes (bidirectional) | Oct 2025 |

MCP isn't a differentiator anymore. It's table stakes. Not having one puts us behind.

---

## The Pivot

### Stop being an AI app. Start being AI infrastructure.

**Remove:**
- The RAG pipeline and embedding system
- The chat system and its 14 tools
- The Content Hub and its 7 content generators
- PROFITS extraction
- The auto-processing pipeline
- AI model management
- Langfuse observability
- Semantic search (replace with keyword search, which already exists)

**Keep:**
- Bank/vault multi-tenant workspace architecture (this IS the product)
- 4-source call import (Fathom, Zoom, Google Meet, YouTube)
- Transcript storage and editing
- Folders, tags, organization
- Invite links, call sharing, vault memberships, team collaboration
- Export (DOCX, PDF, ZIP) — becomes more important, not less
- Contact tracking (basic, without AI health monitoring)
- Simple automation rules (non-AI: folder assignment, tag-based)
- Basic call analytics (duration, talk time, participation)
- Smart import enrichment (auto-titles, action items, tags, sentiment — runs once at import, low-cost, high-value)

**Build:**
- One MCP server on Cloudflare Workers (~1-2 weeks)
- Supabase OAuth 2.1 for authentication (dashboard toggle — nearly zero code)
- A minimal "attach 2-3 calls and chat" feature as a bridge for non-technical users

### The New Value Prop

> **CallVault: Your conversations, organized. Your AI, supercharged.**

CallVault imports your calls from anywhere, organizes them into isolated collaborative workspaces, and exposes that structured context to whatever AI you already use — Claude, ChatGPT, Gemini, Perplexity, Cursor. One click to connect. Zero lock-in.

---

## Why This Is a Stronger Position

### 1. Our actual moat gets all the investment

The bank/vault/workspace architecture — multi-tenant isolation, roles, permissions, collaboration, invite links, shared libraries — is genuinely hard to build, genuinely valuable, and something no LLM provides. No competitor exposes workspace navigation, folder hierarchies, or cross-call organizational context via their MCP servers. They all offer flat "search + get transcript" tools. We'd offer the organizational layer on top.

### 2. The MCP tool design IS the differentiator

Based on the competitive research, here's what Fireflies, Otter, and Gong expose versus what we would:

**What they have (and we'd have too — table stakes):**
- Search recordings, get transcript, get metadata, list recent, list workspaces

**What none of them have (our differentiation):**
- `browse_vault` — navigate the full folder/subfolder hierarchy
- `get_speaker_history` — all recordings featuring a person, chronologically
- `get_vault_analytics` — recording counts, top speakers, activity trends
- `compare_recordings` — side-by-side transcripts for LLM comparison
- `get_topic_timeline` — track how a topic evolves across conversations over time
- `get_speaker_across_recordings` — isolate one person's statements across meetings
- `batch_get_transcripts` — efficient multi-call context loading
- `get_recording_context` — transcript + folder path + tags + related recordings in one call

Plus **MCP Resources** (browsable `callvault://` URI scheme — no competitor uses these) and **MCP Prompts** (pre-built analysis templates like "prepare for meeting with [contact]" or "weekly digest" — no competitor uses these either).

### 3. The math works dramatically in our favor

**What gets removed:**
- ~89,000 lines of code (~35-40% of codebase)
- 23 edge functions
- 15 database tables
- OpenAI API dependency (eliminated entirely)
- OpenRouter API dependency (eliminated entirely)
- Langfuse dependency (eliminated)
- Per-call AI processing costs drop to $0

**What gets added:**
- ~2-3,000 lines of MCP server code
- One Cloudflare Worker deployment

That's a mass reduction in attack surface, hosting costs, API bills, and ongoing maintenance burden. Every hour not spent debugging the RAG pipeline is an hour spent making the workspace experience better.

### 4. Users get better AI, not worse

This is the counterintuitive part. By removing our AI, users get *better* AI. They get Claude Opus 4.6, GPT-5, Gemini — frontier models that are better at every task than our in-house pipeline. They get to use their own prompts, their own preferences, their own model selection. They get the AI they already pay for and already know how to use.

The user who's already paying for Claude Pro doesn't want a worse version of Claude inside CallVault. They want CallVault's *data* inside Claude.

### 5. Ship speed increases dramatically

Every feature we build from here on out is a workspace feature, an import feature, or an organizational feature — our core competency. No more debugging embedding queues. No more tuning RAG retrieval. No more keeping up with the latest model releases. We ship the thing we're actually good at, 5x faster.

---

## The User Experience

### For a Claude Desktop user:
1. Open Claude Desktop > Settings > Connectors
2. Enter: `https://callvault-mcp.callvault.workers.dev/mcp`
3. Browser opens > Sign in with Google (existing CallVault account)
4. Done. Ask Claude anything about your calls.

"Hey Claude, what did Sarah say about the pricing concerns in last Tuesday's call?"
"Compare the last three discovery calls and tell me which prospect is most likely to close."
"Prepare me a briefing for my meeting with Acme Corp tomorrow."

### For a ChatGPT user:
Same flow — paste the URL, authenticate, done. ChatGPT's Apps SDK uses MCP natively now.

### For a non-technical user who doesn't have Claude/ChatGPT:
Minimal in-app chat: select 1-3 calls, their transcripts become the context, ask a question. ~100 lines of code instead of the current ~2,000+. No RAG, no embeddings, just "here's the transcript, here's the question."

---

## Risk and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing users rely on embedded chat | High | Phase out gradually with feature flags. Minimal chat as bridge. Build MCP first before removing anything |
| Users without AI subscriptions lose functionality | Medium | Minimal in-app chat covers basics. Position as "works with the AI you already use" |
| "All-in-one" marketing story weakens | Medium | New story is stronger: "works with every AI" is better than "has its own worse AI" |
| Revenue model shift | High | Can't charge for AI features we don't provide. Charge for organization, collaboration, workspace value. The thing that's actually hard |
| Competitors still market "AI-powered" | Low | They're all adding MCP too. The market is moving this direction regardless |

### The de-risk path:
1. **Build the MCP server first, remove nothing yet** (1-2 weeks). Validate that users actually connect and use it.
2. **Feature-flag the AI layer** (3-5 days). Disable without deleting. Reversible.
3. **Measure.** If MCP adoption is strong, proceed with removal. If not, keep both and reassess.

---

## The Timeline

| Phase | Duration | What Happens |
|-------|----------|-------------|
| **Phase 1: Add** | Weeks 1-2 | Build MCP server on Cloudflare Workers. Enable Supabase OAuth 2.1. Deploy. Test with Claude Desktop + ChatGPT. Ship and announce. |
| **Phase 2: Simplify** | Weeks 3-5 | Build minimal in-app chat (no RAG/embeddings). Feature-flag the full AI layer. Stop running embedding jobs. Replace semantic search with keyword search. Keep smart import features. |
| **Phase 3: Remove** | Weeks 6-8 | Archive embedding data. Remove feature-flagged code. Drop AI edge functions. Remove AI dependencies. Clean up database. Update pricing and positioning. |

Total: ~8 weeks from "let's do this" to a dramatically simpler, cheaper, faster product that gives users better AI than we ever could have built.

---

## The Bottom Line

CallVault has been trying to be two things: (1) the best place to organize and collaborate on sales call data, and (2) an AI-powered analysis tool. We're genuinely great at #1. We'll never be great at #2 because we're competing against Anthropic, OpenAI, and Google — companies spending billions on the exact capabilities we're trying to replicate.

The strategic move is to stop competing where we lose and double down where we win. Become the operating system for sales conversations — the layer between where calls happen and where AI happens. Import from anywhere. Organize for teams. Expose to any AI.

One MCP server. Every platform. Zero lock-in. And a codebase that's 40% smaller, infinitely more maintainable, and entirely focused on what makes CallVault actually unique.

---

## Supporting Research

The following research documents contain the detailed technical analysis behind this pitch:

1. **[Via Negativa Analysis](./research/2026-02-17-callvault-via-negativa.md)** — Feature-by-feature assessment of what to remove, what to keep, and what the product looks like after subtraction. Uses the "improve by removing" framework.

2. **[Strategic Pivot Feasibility Assessment](./research/2026-02-17-callvault-strategic-pivot-thin-app-mcp-feasibility.md)** — Full feasibility study covering technical, resource, and external dependency analysis. Competitive validation (Fireflies, Otter, Gong all launching MCP). Phased implementation plan. Verdict: "Go with conditions."

3. **[MCP Plugin Architecture Technical Research (v1)](./research/2026-02-17-callvault-mcp-plugin-architecture-technical.md)** — Original technical deep-dive: tool inventory design (3 tiers, 17 tools), MCP Resources/Prompts design, multi-platform integration architecture (Claude, ChatGPT, Gemini, OpenClaw, Open WebUI), deployment approach comparison.

4. **[MCP Plugin Architecture Technical Research (v2)](./research/2026-02-18-callvault-mcp-plugin-architecture-technical.md)** — Updated research reflecting the ChatGPT MCP convergence. Confirms single MCP server serves ALL platforms. Recommends Cloudflare Workers + Supabase OAuth 2.1. Implementation-ready architecture with code examples.
