# CallVault AI Strategy

**Version:** v2.0
**Status:** FINAL — This document is the authoritative answer. It is not open for revisiting.
**Date:** 2026-02-27

---

## Executive Summary

CallVault is an MCP-first call workspace. Calls are captured, organized, and made available to whatever AI the user already uses — Claude, ChatGPT, Gemini, and others — via the Model Context Protocol. The only in-app AI is a lightweight bridge chat for quick questions about selected transcripts. This is the decision. Not a recommendation. Not a comparison. The decision.

---

## The Decision

**MCP-first** means CallVault's AI value proposition is delivery, not intelligence:

- CallVault stores, organizes, and structures call data.
- Users connect their AI of choice (Claude, ChatGPT, Gemini, Perplexity, etc.) via MCP.
- Their AI does the reasoning. CallVault does the organizing and wiring.

The only in-app AI feature is a lightweight bridge chat:

- Transcript-in-context. No RAG. No sessions.
- Designed for quick questions about the call currently on screen.
- Optional. Architecture decided in Phase 21 (AI-01).
- If built: OpenRouter dependency is contained entirely here.

---

## What We Keep

**Smart Import** — the only AI enrichment that runs at import time.

Every call that enters CallVault receives:
- An auto-generated title
- Suggested action items
- Starter tags
- Sentiment signal

This runs once, at import, using existing edge functions. It is not interactive. It is not a chat. It is not a pipeline.

**In-product label:** "Auto-generated — edit anytime"
**Framing:** "Calls arrive pre-organized."
**Do not call it AI.** Do not label it with an AI badge. Smart Import is a named feature — not a marketing claim.

---

## What We Drop

The following are eliminated from v2. No exceptions. No revisiting.

| Feature | Status |
|---------|--------|
| Full RAG pipeline | Dropped |
| Vector embeddings | Dropped |
| Vector search | Dropped |
| Content Hub | Dropped |
| Langfuse observability | Dropped |
| AI-powered automation rules | Dropped |
| Semantic search | Dropped |

**Per-call embedding cost in v2: $0.**

No new embedding jobs are written. No existing embedding infrastructure is migrated forward. Keyword search (pg_trgm) replaces semantic search.

---

## What Is Optional Later

**Bridge chat** — transcript-in-context, no RAG, no sessions.

This is not built in v2 core. Architecture is decided in Phase 21 (AI-01). If built:
- Scope is narrow: one call, one context window, one question.
- OpenRouter is the only AI dependency, contained to this feature.
- No session history. No multi-call reasoning. No embeddings.

---

## Marketing Angle

**The tagline:** "AI-ready, not AI-powered."

**Never say "AI-powered."** If the phrase "AI-powered" appears anywhere in product copy, marketing, or UI, it is wrong.

**Lead with outcome, explain MCP one layer down:**
- Hero: "Ask AI about any call, instantly."
- How it works: "CallVault organizes your calls and makes them available to whatever AI you already use."
- Subtext: "Works with Claude, ChatGPT, Gemini, Perplexity and more."

**Dev and integrations page** may lead with "MCP-native call workspace" — this audience wants the mechanism first.

**What "AI-ready" means in practice:**
- Calls are structured and organized the moment they arrive (Smart Import)
- Calls are accessible to any MCP-compatible AI client
- Users bring their own AI and get immediate value — no lock-in, no new AI to learn

---

## What This Means for Development

These are constraints, not guidelines. Every future phase builds against them.

1. **No RAG code in the new repo. Ever.** This is an AI-02 constraint.
2. **No embeddings.** No embedding tables, no embedding jobs, no vector columns.
3. **No vector search.** pg_trgm keyword search replaces it.
4. **Smart Import enrichment continues.** It runs at import time via existing edge functions. It is not refactored away — it is the AI work we keep.
5. **OpenRouter dependency is contained.** If bridge chat is built (Phase 21), OpenRouter is used only for that feature. It does not spread to other parts of the codebase.
6. **MCP is the AI delivery mechanism.** Every AI integration decision flows through this: "Does this work via MCP?" If yes, it belongs. If it requires a new AI pipeline, it doesn't.

---

## Decision Confidence

This document is the authoritative answer to the question: "What kind of AI product is CallVault?"

The answer is: **MCP-first, with a bounded Smart Import enrichment and an optional bridge chat.**

This is not a comparison document. There are no alternatives listed because no alternatives are being considered. The work of evaluating alternatives was completed before this document was written. That work is done.

Anyone who reads this document and asks "but what about [alternative AI approach]?" should be directed here: the decision is made. The value of this document is its finality.

**This document is not open for revisiting.**
