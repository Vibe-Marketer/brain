# Via Negativa: CallVault AI Feature Pruning

**Date:** 2026-02-17
**Framework:** Via Negativa — Improve by removing rather than adding

---

## Current State

CallVault currently maintains an enormous AI surface area alongside its core call management platform:

- **Hybrid RAG pipeline** — pgvector embeddings (OpenAI `text-embedding-3-small`), HNSW vector search, `pg_trgm` full-text search, Reciprocal Rank Fusion, cross-encoder re-ranking, diversity filtering
- **Chat system** — Vercel AI SDK streaming via OpenRouter with **14 hardcoded RAG tools** (speaker search, date range, sentiment, topics, entities, intent signals, tags, categories, advanced multi-filter, call comparison, etc.)
- **Embedding pipeline** — Queue-based worker system (`embedding_queue`), adaptive speaker-turn-aware chunking (500-token target), metadata enrichment (sentiment, topics, entities, intent signals), exponential backoff retry, progress tracking
- **Content Hub** — 7+ edge functions for content generation (emails, LinkedIn posts, blog outlines, case studies, hooks), content library, templates with `{{variable}}` support
- **PROFITS extraction** — AI extracts revenue/profit mentions from transcripts
- **Auto-processing pipeline** — Per-call AI job tracking, configurable auto-processing preferences, manager notes, action items, summaries, AI titles, auto-tags, sentiment
- **Automation rules engine** — Trigger-based system with sentiment AI evaluation, 6 trigger types, 12+ action types
- **AI model management** — OpenRouter model sync, tiered model selection UI, `ai_models` table
- **Langfuse observability** — Full LLM trace lifecycle
- **Semantic search** — Standalone global search via embeddings
- **Contact health monitoring** — AI-adjacent health alerts

Meanwhile, the **core platform** (bank/vault multi-tenancy, 4-source import, transcript management, folders/tags, invite/share links, export, roles/permissions) works independently of all of the above.

---

## Subtraction Candidates

- **Hybrid RAG pipeline + embedding pipeline**: Remove because this is the single largest source of complexity, cost, and maintenance. It spans 3+ edge functions, pgvector infrastructure, OpenAI API costs per call, queue management, chunking logic, metadata enrichment, and hybrid search RPCs. An external LLM with access to raw transcripts (via MCP or export) can do the same job — and the user gets to pick their model. → **Impact:** Eliminates ~40% of edge function code, removes OpenAI embedding dependency entirely, removes `transcript_chunks` table (likely your largest table), removes vector index maintenance, removes embedding queue monitoring.

- **Chat system (chat-stream-v2 + 14 RAG tools)**: Remove because this is the second-largest complexity center. 14 tool definitions, session filter management, business profile injection, message persistence, tool call analytics, Langfuse tracing — all to replicate what Claude Desktop or ChatGPT already do natively and better. → **Impact:** Eliminates the most fragile edge function, removes OpenRouter LLM costs, removes `chat_sessions`/`chat_messages`/`chat_tool_calls` tables, removes streaming infrastructure.

- **Content Hub + Content Libraries**: Remove because content generation is completely commoditized. Every LLM can write an email or LinkedIn post from a transcript. Building and maintaining 7+ content edge functions, a template engine, and multiple library UIs for this is pure overhead. → **Impact:** Removes `content_library`, `templates` tables, 5+ edge functions, 6+ page components, 3 library pages.

- **PROFITS extraction**: Remove because this is a niche AI feature that an external LLM can do from a raw transcript with a single prompt. → **Impact:** Removes edge function + UI components for a feature that likely has low adoption.

- **Auto-processing pipeline**: Remove because this exists solely to chain the other AI features (summarize, extract action items, generate titles, auto-tag, sentiment). If you remove the AI features, the pipeline has nothing to process. → **Impact:** Removes `ai_processing_jobs` table, `auto_processing_preferences` table, multiple edge functions.

- **AI model management/sync**: Remove because this only exists to support the chat system. No chat = no model selection needed. → **Impact:** Removes `ai_models` table, `sync-openrouter-models` function, model selector UI.

- **Langfuse integration**: Remove because this only exists to observe LLM calls. No LLM calls = no observability needed. → **Impact:** Removes a dependency and shared utility code.

- **Automation rules engine (AI-dependent parts)**: Remove the sentiment trigger and `run_ai_analysis` action. Keep simple rule-based automation (folder assignment, tagging based on field matching). → **Impact:** Simplifies rules engine from "AI-powered automation" to "smart filters" — dramatically less fragile.

- **Semantic search**: Remove because this depends on embeddings. Replace with enhanced `pg_trgm` full-text search on raw transcripts (which you already have the infrastructure for). → **Impact:** Search still works, just keyword-based instead of semantic. Users who want semantic search use their external LLM.

---

## Keep (Passed the Test)

- **Bank/Vault architecture**: Keep because this IS the product. Multi-tenant workspace isolation with roles and permissions is genuinely hard, genuinely valuable, and not something Claude Desktop or ChatGPT provide. This is your moat.

- **4-source call import** (Fathom, Google Meet, Zoom, YouTube): Keep because import is the top of the funnel. Making it easy to get calls in is core to the value prop. No external tool replaces this.

- **Transcript storage + editing**: Keep because this is the data layer everything depends on. Non-destructive editing is a nice touch.

- **Folders, tags, organization**: Keep because this is what users do between importing and analyzing. Simple, useful, no AI required.

- **Invite links + call sharing + vault memberships**: Keep because collaboration is the multiplier. This is what makes CallVault a team tool, not a personal tool. External LLMs can't share organized call libraries across a team.

- **Export functionality** (DOCX, PDF, ZIP): Keep because this is the bridge to external tools. Users export transcripts and drop them into Claude/ChatGPT. This becomes MORE important if you remove built-in AI.

- **Contact tracking** (basic, without AI health monitoring): Keep because knowing who you've talked to and when is useful metadata. Remove the AI health alerting, keep the contact roster.

- **Polar billing**: Keep obviously.

- **Simple automation rules** (non-AI): Keep folder assignment and tagging rules based on field matching. Remove sentiment triggers and AI actions.

- **Basic call analytics** (duration, talk time, participation): Keep because these are computed from transcript data, not AI. They're lightweight and useful.

---

## After Subtraction

CallVault becomes: **"The operating system for your sales calls"** — it imports, organizes, shares, and exports call transcripts across isolated workspaces. It does one thing and does it extremely well.

The product surface shrinks dramatically:
- **~15 edge functions removed** (all AI/content/embedding functions)
- **~8 database tables removed** (transcript_chunks, embedding_queue, embedding_jobs, chat_sessions, chat_messages, chat_tool_calls, content_library, templates, ai_processing_jobs, auto_processing_preferences, ai_models)
- **OpenAI dependency eliminated entirely**
- **OpenRouter dependency eliminated entirely**
- **Langfuse dependency eliminated**
- **Per-call AI processing costs drop to $0**

What you build instead: **a clean API or MCP server** that exposes:
1. List banks/vaults the user has access to
2. List calls with filters (date, speaker, tags, folder, vault)
3. Get full transcript for a call
4. Get call metadata (participants, duration, tags, summary if manually added)
5. Search calls by keyword (pg_trgm full-text)

This lets Claude Desktop, ChatGPT, Cursor, or any MCP-compatible tool become the AI layer. The user picks their AI. You maintain the data layer.

**Minimal chat option** (if you keep anything): A simple "paste transcript context + ask question" flow using a single OpenRouter call — no RAG, no embeddings, no tools, no session management. Just: select 1-3 calls → their transcripts become the context → user asks a question → streamed response. This could be ~100 lines of edge function code instead of the current ~2000+.

---

## What to Say No To

- **"We should add our own fine-tuned model"** — No. Let users bring their own.
- **"We need better embeddings / a better RAG pipeline"** — No. Remove the pipeline entirely.
- **"Competitors have AI features"** — Yes, and they're spending 80% of their engineering budget maintaining them. You'll ship workspace features 5x faster.
- **"Users want AI summaries built in"** — Build the MCP/plugin. They'll get better summaries from their chosen tool.
- **"We should add more content generators"** — No. This is exactly the kind of feature that LLMs already do natively.
- **"What about users who aren't technical enough for MCP?"** — This is the one legitimate pushback. Offer the minimal chat option as a bridge, and invest in dead-simple "Open in Claude" / "Open in ChatGPT" one-click flows rather than building your own AI stack.

---

## The Core Tension

Your non-technical users won't set up MCP servers. The answer isn't to rebuild a worse version of ChatGPT inside CallVault — it's to make the bridge effortless. A "Chat about this call" button that opens Claude.ai with the transcript pre-loaded, or a Chrome extension, or a one-click export-to-AI flow. Meet users where they already are instead of building where you'll always be second-best.
