# Feasibility Assessment: CallVault Strategic Pivot - Thin Out AI, Expose Data via MCP/Plugins

**Date:** 2026-02-17
**Type:** Strategic Architecture Pivot
**Verdict:** Go with conditions

---

## Strategic Summary

This pivot is **strategically sound and technically feasible**. The market is moving in exactly this direction -- Fireflies, Otter.ai, and Gong have all launched MCP servers in the past 6 months. Your true differentiator is the organizational layer (banks, vaults, workspaces, collaboration), not the embedded AI chat. The main risk is the transition itself: removing ~35-40% of a live codebase without breaking things for existing users, and the loss of the "all-in-one" value proposition for users who don't have separate AI subscriptions.

---

## What We're Assessing

A strategic pivot to:

1. **Remove** the majority of AI/chat/RAG/embeddings functionality (~35-40% of codebase by volume)
2. **Keep** the organizational layer: workspaces (banks), hubs (vaults), invite/collaboration, call recording management, folder/tag hierarchy
3. **Add** external LLM integrations: MCP server for Claude Desktop/Gemini/Perplexity, REST API for ChatGPT GPTs
4. **Retain** a minimal chat: users can attach a few calls and chat about them directly (no RAG, no embeddings, no vector store)

### What Would Be Removed

| Category | Volume | Key Components |
|----------|--------|----------------|
| Chat UI | 20 components, ~28K lines | ChatSidebar, ChatInputArea, ChatMessageList, model-selector, tool-call visualization |
| Chat/RAG Hooks | 4 primary hooks, ~34K lines | useChatSession, useChatStreaming, useChatFilters, useAICosts |
| Embedding/Search | 2 hooks, ~12K lines | useRecordingSearch (semantic), useGlobalSearch |
| Backend AI Functions | 23 edge functions, ~15K+ lines | chat-stream-v2, semantic-search, embed-chunks, process-embeddings, rerank-results, content-builder |
| AI Database Tables | ~15 tables | chat_sessions, chunk_embeddings, insights, etc. |
| Infrastructure | - | pgvector, OpenAI embedding API, OpenRouter multi-model, Langfuse observability |

**Total removal: ~89K+ lines of code, 23 edge functions, 15 database tables**

### What Would Stay

| Category | Volume | Key Components |
|----------|--------|----------------|
| Workspace Management | ~44K lines | Banks, vaults, memberships, context switching |
| Call Management | ~20K+ lines | Recording sync (Fathom, Zoom, Google Meet), transcript storage, folder/tag organization |
| Collaboration | ~10K+ lines | Invites, sharing, vault roles, team management |
| Settings/Admin | ~17K lines | User settings, business profiles, billing |
| UI/Shared | ~17K lines | Layout, navigation, shared components |

### What Would Be Added

| Component | Estimated Effort | Description |
|-----------|-----------------|-------------|
| MCP Server | 1-2 weeks | Expose call data via MCP (works with Claude, Gemini, Perplexity) |
| REST API + OpenAPI | 1-2 weeks | Foundation for ChatGPT GPTs and external integrations |
| ChatGPT GPT | 1 week | Custom GPT with Actions using the REST API |
| Minimal Chat | 1-2 weeks | Simple "attach calls, chat about them" with no RAG/embeddings |
| Desktop Extension (.mcpb) | 3-5 days | One-click install for Claude Desktop users |

---

## Technical Feasibility

**Can we build it?**

### MCP Server - HIGH FEASIBILITY

- **Known approaches:** Yes -- Supabase has native MCP server support via `mcp-lite` framework
- **Authentication:** Supabase Auth now supports OAuth 2.1 Server mode with OpenID Connect, which is exactly what MCP remote servers need
- **Architecture:** Deploy as a Supabase Edge Function (Streamable HTTP transport), users connect via Claude Desktop Settings > Connectors
- **Tools to expose:** `search_calls`, `get_transcript`, `get_call_summary`, `list_recent_calls`, `list_vaults`
- **RLS compatibility:** User's auth token flows through, existing RLS policies enforce data isolation
- **Technology maturity:** Proven -- MCP has become the universal standard, adopted by Claude, Gemini, Perplexity, Cursor, VS Code

### REST API for ChatGPT GPTs - HIGH FEASIBILITY

- **You already have most of this** via Supabase Edge Functions (recording retrieval, transcript access)
- **Need:** OpenAPI 3.0 spec, OAuth callback support, rate limiting
- **Risk:** ChatGPT Actions are being transitioned to "Apps" framework. Existing Actions still work but long-term stability is uncertain (6-12 months)

### Minimal Chat - HIGH FEASIBILITY

- **Approach:** Pass full transcript text directly to LLM (no embeddings needed)
- **Limit:** 2-3 calls per chat session (keeps within context windows)
- **Stack:** Keep Vercel AI SDK + OpenRouter but drastically simplified -- just `streamText()` with transcript content, no tools/RAG
- **Cost:** Minimal -- users only pay for what they use, no background embedding costs

### Codebase Removal - MODERATE FEASIBILITY

- **Risk:** The AI code is deeply integrated into the app. Removing it requires careful untangling
- **Approach:** Feature-flag-then-remove, not surgical deletion
- **Database:** AI tables can be dropped after data migration period, but need to handle existing user data gracefully
- **Testing:** Need comprehensive regression testing after removal

**Technical verdict:** Feasible

---

## Resource Feasibility

**Do we have what we need?**

- **Skills:** Yes -- MCP servers are TypeScript, same stack you already use. Supabase Edge Functions are the deployment target you already know
- **Budget:** Saves money -- eliminates OpenAI embedding costs, reduces OpenRouter usage, fewer edge function invocations
- **Tools/infrastructure:** Already have everything needed (Supabase, Deno, TypeScript)
- **Time:** Full pivot (build integrations + remove old code) estimated at 4-8 weeks

**Resource verdict:** Feasible -- this actually *reduces* resource requirements

---

## External Dependency Feasibility

**Are external factors reliable?**

### MCP Protocol - LOW RISK
- Open standard backed by Anthropic
- Adopted by Google (Gemini), Perplexity, Microsoft (VS Code/Copilot), Cursor
- Growing ecosystem with 90+ extensions in Gemini marketplace alone
- Supabase has first-party support for hosting MCP servers

### ChatGPT Actions - MODERATE RISK
- OpenAI is actively transitioning from Actions to "Apps" framework
- Assistants API sunsets August 26, 2026
- Existing Actions-based GPTs continue working for now
- May require migration within 6-12 months

### User AI Subscription Dependency - MODERATE RISK
- Users need their own Claude Pro / ChatGPT Plus / Gemini subscriptions
- This is an additional cost barrier for users who currently get AI "included"
- Mitigated by: minimal in-app chat covers basic needs, power users already have these subscriptions

**External verdict:** Feasible -- MCP is the safe bet; ChatGPT integration carries some platform risk

---

## Competitive Validation

**This is not a novel strategy.** Your direct competitors are already doing it:

| Product | MCP Server | When | Notes |
|---------|-----------|------|-------|
| **Fireflies.ai** | Yes (beta) | 2025 | Search, transcript, summary tools exposed to Claude |
| **Otter.ai** | Yes (enterprise) | Oct 2025 | Part of enterprise suite, $100M ARR milestone |
| **Gong** | Yes | Oct 2025 | Bidirectional: MCP Gateway (inbound) + MCP Server (outbound) |

**Key insight:** Every major meeting/call platform is adding MCP. This is becoming **table stakes** for the category, not a differentiator. Not doing it puts you behind.

---

## Blockers

| Blocker | Severity | Mitigation |
|---------|----------|------------|
| Existing users rely on embedded chat | High | Phase out gradually with feature flags; provide minimal chat as bridge |
| AI code deeply integrated into app | Medium | Feature-flag approach; disable before removing; thorough regression testing |
| Existing embedding/vector data in production | Medium | Migration period: keep tables read-only, then archive, then drop |
| ChatGPT Actions platform instability | Medium | Build REST API as the foundation (stable regardless of OpenAI changes) |
| Users without AI subscriptions lose functionality | Medium | Minimal in-app chat covers basic use case; position as "works with the AI you already use" |
| Revenue model shift | High | Need to rethink pricing -- can't charge for AI features you don't provide; charge for organization/collaboration value |

---

## De-risking Options

### 1. Build MCP First, Remove Nothing Yet
- **Risk reduction:** Validates demand before committing to removal
- **Cost:** 1-2 weeks of additive work, no destruction
- **Benefit:** If users love it, you have confidence. If they don't engage, you keep what works

### 2. Feature-Flag the AI Layer
- **Risk reduction:** Disable AI features without deleting code. Revert if needed
- **Cost:** 3-5 days to wrap AI features in flags
- **Benefit:** Reversible. Can A/B test "with AI" vs "without AI" cohorts

### 3. Keep "Smart Import" AI Features
- **Risk reduction:** Don't remove the AI that runs at import time (auto-tagging, action item extraction, sentiment analysis, title generation)
- **Cost:** These are small, background processes -- low maintenance burden
- **Benefit:** Calls arrive pre-enriched with metadata. This is valuable even without chat

### 4. Keep Keyword Search, Drop Semantic Search
- **Risk reduction:** Users can still search calls without embeddings
- **Cost:** Keyword search already exists alongside semantic search
- **Benefit:** Removes pgvector dependency and embedding costs while keeping search functional

---

## What NOT to Remove

Some AI features are better characterized as **"smart data enrichment"** rather than "AI chat." These should stay:

| Feature | Why Keep It |
|---------|-------------|
| `generate-ai-titles` | Better UX for organizing calls -- runs once at import |
| `extract-action-items` | High-value metadata -- runs once at import |
| `auto-tag-calls` | Organization feature, not chat -- runs once at import |
| `automation-sentiment` | Pre-computed metadata, useful for filtering |
| `generate-meta-summary` | One-time summary at import, not interactive AI |
| `content-classifier` | Categorization feature, runs at import |
| Keyword search | Basic search without vector dependencies |

**What TO remove:** chat-stream-v2, semantic-search, embed-chunks, process-embeddings, rerank-results, content-builder, the full chat UI, RAG tool framework, vector storage

---

## Overall Verdict

### **Go with conditions**

**Reasoning:**

1. **Market alignment** -- Competitors are doing exactly this. MCP is the universal standard. Building your own chat is swimming upstream against Claude/GPT-5/Gemini
2. **Focus on what's unique** -- No one else has your bank/vault/workspace architecture for call data. That's the moat
3. **Dramatic simplification** -- 35-40% less code to maintain, lower hosting costs, fewer API bills
4. **Better AI for users** -- Claude Opus 4.6 and GPT-5.2 are better than anything you can build in-house. Let users bring the best
5. **One MCP server = many platforms** -- Single build serves Claude, Gemini, Perplexity, Cursor, and more

**Conditions:**

1. **Build MCP server before removing anything** -- Validate the approach works, give users the "new" before taking away the "old"
2. **Keep smart import features** -- Auto-tagging, action items, sentiment, summaries at import time. These are data enrichment, not chat
3. **Keep keyword search** -- Drop semantic/vector search, keep basic search functional
4. **Provide minimal in-app chat** -- Simple "attach 2-3 calls, chat about them" for users without external AI subscriptions
5. **Phase the removal over 2-3 releases** -- Don't rip everything out at once. Feature-flag, deprecate, then remove
6. **Rethink pricing** -- Your value prop shifts from "AI-powered call intelligence" to "organized call workspace that works with any AI." Price accordingly

---

## Implementation Context

<claude_context>
<if_go>
- approach: Build MCP server on Supabase Edge Functions using mcp-lite, with OAuth 2.1 via Supabase Auth. Then build minimal REST API with OpenAPI spec for ChatGPT GPTs. Then feature-flag AI, then remove
- start_with: MCP server (1-2 weeks). This validates the entire strategy and gives immediate value
- critical_path: OAuth authentication must work seamlessly. If users can't connect Claude Desktop to their CallVault account in <2 minutes, the strategy fails
</if_go>
<risks>
- technical: Deep integration of AI code makes removal complex; regression risk is real
- external: ChatGPT Actions platform is unstable (transitioning to Apps); MCP is stable
- revenue: Pricing model needs rethinking -- can't charge for AI you don't provide
- adoption: Users may not have separate AI subscriptions; minimal chat bridges this
- mitigation: Feature-flag approach makes everything reversible. Build MCP first to validate before removing. Keep minimal chat as safety net
</risks>
<alternatives>
- if_blocked: Keep AI layer but stop investing in it. Add MCP server as additive feature alongside existing chat. Let it coexist
- simpler_version: Just build MCP server, keep everything else as-is. Let market adoption data guide the removal decision in 3-6 months
</alternatives>
</claude_context>

---

## Recommended Phased Approach

### Phase 1: Add (Weeks 1-3)
- Build MCP server with 4-6 tools (search_calls, get_transcript, get_summary, list_recent, list_vaults)
- Set up Supabase Auth OAuth 2.1 for MCP authentication
- Build REST API + OpenAPI spec
- Create ChatGPT GPT with Actions
- Ship. Announce. Measure adoption

### Phase 2: Simplify (Weeks 4-6)
- Build minimal in-app chat (no RAG, no embeddings, just transcript-in-context)
- Feature-flag the full chat, RAG, and embedding features
- Stop running embedding jobs on new calls
- Keep smart import features (titles, action items, tags, sentiment)
- Replace semantic search with keyword-only search

### Phase 3: Remove (Weeks 7-10)
- Archive embedding data (don't delete, just stop using)
- Remove feature-flagged chat/RAG code
- Drop AI-specific edge functions (chat-stream, semantic-search, embed-chunks, etc.)
- Remove AI-specific dependencies
- Clean up database (archive, then later drop AI tables)
- Update pricing and positioning

---

## Sources

- [Supabase MCP Documentation](https://supabase.com/docs/guides/getting-started/mcp)
- [Supabase MCP Authentication (OAuth 2.1)](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Building MCP Server with mcp-lite](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [One-click MCP Installation (Desktop Extensions)](https://www.anthropic.com/engineering/desktop-extensions)
- [Claude Desktop MCP Setup](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
- [Remote MCP Servers for Claude](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [OpenAI GPT Actions Documentation](https://platform.openai.com/docs/actions/introduction)
- [OpenAI Assistants API Deprecation (Aug 2026)](https://community.openai.com/t/assistants-api-beta-deprecation-august-26-2026-sunset/1354666)
- [Google MCP Support Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
- [Gemini CLI Extensions (90+ marketplace)](https://blog.google/technology/developers/gemini-cli-extensions/)
- [Perplexity MCP Support](https://www.perplexity.ai/help-center/en/articles/11502712-local-and-remote-mcps-for-perplexity)
- [Fireflies MCP Server (beta)](https://fireflies.ai/blog/fireflies-mcp-server/)
- [Otter.ai MCP Enterprise Launch](https://otter.ai/blog/otter-for-enterprise-connect-ai-to-ai-with-otters-mcp)
- [Gong MCP Support (Oct 2025)](https://www.gong.io/press/gong-introduces-model-context-protocol-mcp-support-to-unify-enterprise-ai-agents-from-hubspot-microsoft-salesforce-and-others)
