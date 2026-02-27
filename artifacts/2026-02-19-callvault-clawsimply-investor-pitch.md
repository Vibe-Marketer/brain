# CallVault + ClawSimply: Investor Pitch

**Prepared by:** Andrew Naegele
**Date:** February 19, 2026
**Audience:** Angel Investors / Early Stage

---

## I. What We Built

### CallVault: The All-in-One Call Intelligence Platform

CallVault is a SaaS platform for sales teams, coaches, and agencies that imports call recordings from multiple sources, organizes them into collaborative workspaces, and layers AI analysis on top.

**What it does today:**

- **Imports calls from 4 sources** — Fathom, Google Meet, Zoom, and YouTube. Users connect their accounts and calls flow in automatically. No manual uploading.

- **Organizes calls into a workspace hierarchy** — "Banks" are top-level organizations (think companies). "Vaults" are workspaces within them (think teams or projects). Inside vaults: folders, tags, and a full organizational system for structuring call libraries.

- **Multi-tenant collaboration** — Invite links, role-based permissions, vault-level memberships. A sales manager creates a vault, invites their team, and everyone has organized access to the team's call library. This is how it becomes a team tool, not a personal tool.

- **AI-powered analysis** — Full chat system with 14 AI tools for querying across calls, RAG pipeline with vector embeddings for semantic search, automated call processing (summaries, action items, sentiment, auto-tagging), a Content Hub that generates emails/LinkedIn posts/case studies from call data, and a configurable automation rules engine.

- **Export everywhere** — DOCX, PDF, ZIP. Users can pull their data out in any format.

**The original direction** was to be the single destination for call intelligence — import, organize, analyze, generate content, all under one roof. The thesis was: sales teams need one tool that does everything with their call data.

**Current traction:** Early revenue with active beta users. The product is live, functional, and being used in production.

---

## II. What We Learned

We built a genuinely impressive AI layer. Hybrid RAG with vector search, cross-encoder re-ranking, speaker-aware chunking, 14 specialized query tools, a full content generation suite. It's technically sophisticated work.

And it's the wrong thing to be building.

Here's what we realized:

### 1. We're competing with Anthropic, OpenAI, and Google — and losing.

Our chat system uses frontier models (Claude, GPT-4) via API, but wraps them in our own RAG pipeline, our own retrieval logic, our own tool definitions. The result is inevitably worse than what users get when they use those models directly. Claude Opus doesn't need our 14 RAG tools to analyze a transcript — it just needs the transcript.

Every time Anthropic or OpenAI ships a model upgrade, our AI layer gets comparatively worse because we can't keep up with their tooling improvements. We're on a treadmill.

### 2. Every competitor builds the same AI features. Nobody wins on them.

Fireflies, Otter.ai, Gong, Chorus, Avoma — they all have AI summaries, AI chat, AI action items, AI sentiment analysis. It's table stakes. No one is differentiating on AI features because the underlying models are all the same. The AI features are a commodity.

### 3. It's our #1 cost center and maintenance burden.

The AI layer accounts for:
- **~89,000 lines of code** (~35-40% of the total codebase)
- **23 edge functions** (serverless backend functions)
- **15 database tables** (embeddings, chat sessions, processing jobs, etc.)
- **Three external API dependencies** (OpenAI for embeddings, OpenRouter for LLMs, Langfuse for observability)
- **Per-call processing costs** (every imported call triggers embedding generation, metadata enrichment, and queue processing)

Meanwhile, the part of the product that users actually love — the workspace organization, the multi-source import, the team collaboration — runs independently of all of it and is dramatically simpler to maintain.

### 4. We're locking users into our AI choices.

Users can't pick their own model. They can't use their own prompts. They can't bring their preferred tool. In a world where everyone has an AI assistant they already know and pay for, building a proprietary AI layer creates friction, not value.

---

## III. What Changed in the Market

In the last 12 months, the AI ecosystem converged on a single interoperability standard: **MCP (Model Context Protocol)**.

MCP lets any data source expose its content as "tools" that AI assistants can use natively. It's like an API, but specifically designed for AI agents — they can discover what tools are available, understand what data they can access, and use it in natural conversation.

**Every major AI platform now supports MCP natively:**

| Platform | MCP Support | Users |
|----------|-------------|-------|
| Claude (Anthropic) | Native connector | ~20M+ users |
| ChatGPT (OpenAI) | Apps SDK, built on MCP | 300M+ users |
| Gemini (Google) | Extensions marketplace | 200M+ users |
| Perplexity | Native MCP | 15M+ users |
| Cursor / VS Code | Native MCP | Millions of developers |

The critical event: **OpenAI deprecated their proprietary Actions/Plugins system and rebuilt it entirely on MCP.** This isn't one company's standard — it's the universal standard. One MCP server works as a plugin for every platform simultaneously.

**Our competitors already see this:**

| Competitor | MCP Server | When |
|------------|-----------|------|
| Fireflies.ai | Yes (beta) | 2025 |
| Otter.ai | Yes (enterprise only) | Oct 2025 |
| Gong | Yes (bidirectional) | Oct 2025 |

Not building an MCP server now means falling behind. But what none of them are doing — and what we intend to do — is rethinking the *entire product* around it.

---

## IV. The Strategic Pivot

### Stop being an AI application. Become AI infrastructure.

Instead of building a worse version of ChatGPT inside CallVault, we make CallVault's **organized data** available to whatever AI the user already loves and pays for.

**The pivot in concrete terms:**

**Remove** (~89K lines of code):
- The RAG pipeline and embedding system
- The chat system and its 14 AI tools
- The Content Hub and its 7 content generators
- The auto-processing pipeline
- AI model management, Langfuse observability, semantic search
- OpenAI, OpenRouter, and Langfuse dependencies — all eliminated

**Keep** (the actual product):
- Bank/vault workspace architecture with multi-tenant isolation
- 4-source call import (Fathom, Zoom, Google Meet, YouTube)
- Transcript storage with non-destructive editing
- Folders, tags, full organizational system
- Invite links, call sharing, vault memberships, team collaboration
- Export (DOCX, PDF, ZIP)
- Contact tracking
- Basic call analytics (duration, talk time, participation)
- Smart import enrichment (auto-titles, action items, tags — runs once at import, low cost, high value)

**Build** (~2-3K lines of code):
- One MCP server on Cloudflare Workers
- OAuth 2.1 authentication (users log in with their existing CallVault account)
- A minimal in-app chat as a bridge for non-technical users

### What the user experience becomes:

**A Claude user:**
1. Open Claude > Settings > Connectors
2. Paste: `https://mcp.callvault.ai/mcp`
3. Sign in with Google (existing CallVault account)
4. Done. Ask Claude anything about your calls.

*"Claude, what objections came up in discovery calls this month?"*
*"Compare my last three calls with Acme Corp and tell me if the deal is progressing."*
*"Prepare me a briefing for tomorrow's meeting with Sarah — pull everything we've discussed."*

**A ChatGPT user:** Same flow, same URL, same experience. Because MCP is universal.

**A non-technical user without an AI subscription:** Minimal in-app chat — select 1-3 calls, ask a question. Simple. No RAG, no embeddings, just the transcript and a question.

### What our MCP exposes that competitors don't:

Every competitor MCP offers flat "search + get transcript" tools. We'd expose the **organizational intelligence** that makes CallVault unique:

| Capability | Fireflies | Otter | Gong | CallVault |
|------------|-----------|-------|------|-----------|
| Search + get transcript | Yes | Yes | Yes | Yes |
| Browse workspace hierarchy | No | No | No | **Yes** — folders, vaults, banks |
| Speaker history across calls | No | No | Enterprise | **Yes** — all calls with a person, chronologically |
| Cross-call comparison | No | No | Enterprise | **Yes** — side-by-side transcripts |
| Topic tracking over time | No | No | No | **Yes** — how a topic evolves across conversations |
| Pre-built analysis prompts | No | No | No | **Yes** — "prepare for meeting," "weekly digest," etc. |
| Browsable content URIs | No | No | No | **Yes** — `callvault://` scheme for navigation |
| Available on free/pro tiers | Beta | Enterprise-only | Enterprise-only | **All paid tiers** |

---

## V. The Bigger Picture: ClawSimply

Here's where the vision expands beyond a single product.

### The OpenClaw Opportunity

**OpenClaw** is the open-source AI agent that went viral in early 2026 — 100K+ GitHub stars, backed by Peter Steinberger (now joining OpenAI), connecting to WhatsApp, Telegram, Slack, Discord, iMessage, Signal, and more. It's become the default "personal AI assistant" for technically capable users.

The key thing OpenClaw does: it acts as a **gateway** between messaging platforms you already use and AI models, with a plugin/skills system that lets it access external tools and data.

The problem: **OpenClaw is built for developers.** Setting it up requires a terminal, config files, API keys, environment variables. The 99% of users who aren't developers can't touch it.

Also critical: **OpenClaw has explicitly disabled native MCP support** (GitHub issue #4834, closed as "not planned" on Feb 1, 2026). This means the most popular open-source AI agent can't easily connect to the MCP ecosystem that every major platform has adopted.

### ClawSimply: OpenClaw for Everyone

**ClawSimply** is our fork of OpenClaw that solves both problems:

1. **A simple, visual interface** for connecting your AI agent to the apps you already use — Gmail, Zoom, Calendly, Google Calendar, Slack, CRMs — via OAuth. No terminal. No config files. No API keys. Click "Connect Gmail," sign in with Google, done.

2. **Native MCP support re-enabled and improved**, so ClawSimply can connect to any MCP server — including CallVault's.

3. **CallVault as a first-party plugin**, pre-installed and one click to activate. Your AI agent instantly has access to your entire organized call library.

### The Ecosystem Play

Here's how the pieces fit together:

```
┌─────────────────────────────────────────────────────┐
│                    ClawSimply                         │
│           "Your AI agent, simplified"                 │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │  Gmail    │ │  Zoom    │ │ Calendly │ │  Slack  │ │
│  │  (OAuth)  │ │  (OAuth) │ │  (OAuth) │ │ (OAuth) │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │            │            │             │      │
│       v            v            v             v      │
│  ┌──────────────────────────────────────────────┐    │
│  │          AI Agent (Claude / GPT / etc.)       │    │
│  │        with persistent memory & context       │    │
│  └──────────────────┬───────────────────────────┘    │
│                     │                                 │
│                     │ MCP                             │
│                     v                                 │
│  ┌──────────────────────────────────────────────┐    │
│  │              CallVault Plugin                  │    │
│  │    Your organized call library as context      │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**What this enables:**

- Your AI agent can pull from your call library to **draft follow-up emails** (via Gmail) based on what was actually discussed
- It can **check your calendar** (via Calendly/Google Calendar) and **prep briefings** from past calls with that contact
- It can **generate content** (social posts, case studies, blog ideas) from call insights and post them where they need to go
- It can **update your CRM** with action items and next steps extracted from calls
- It can build **persistent memories** from your conversations — your agent actually knows your business context because it has access to every conversation you've had

**The critical insight:** All of this AI work happens in the agent layer (OpenClaw/ClawSimply) — not in CallVault. CallVault doesn't need to build any of this. It just needs to make its organized data accessible. The MCP server is the bridge.

### Why Fork OpenClaw?

1. **OpenClaw disabled MCP.** Our fork re-enables it properly, with first-class support for remote MCP servers.

2. **OpenClaw is for developers.** Our fork is for everyone. The UI/UX layer that makes OAuth connections trivial is the product.

3. **OpenClaw is going to a foundation.** Steinberger joining OpenAI means the project's future governance is in flux. A focused fork with a clear product vision (simplicity for non-technical users) has room to thrive.

4. **We control the integration.** CallVault as a first-party plugin inside ClawSimply means the experience is seamless — not a third-party afterthought.

---

## VI. The Moat

Let's be direct about what's defensible here.

### What's NOT a moat:
- AI features (commodity — every LLM does them)
- MCP servers (anyone can build one)
- Content generation (ChatGPT does this out of the box)

### What IS a moat:

**1. The organized data layer.**
Importing calls from 4+ sources, normalizing them into a consistent format, organizing them into collaborative workspaces with folders/tags/permissions — this is genuinely hard to build, genuinely useful, and not something any AI assistant provides on its own. Claude doesn't have a vault system. ChatGPT doesn't have team workspaces. The organizational layer is the product.

**2. Multi-tenant collaboration.**
Banks, vaults, invite links, role-based permissions, team-level call libraries. This is what makes CallVault a team tool, not a personal tool. A sales manager creates a vault for their team, invites everyone, and the entire team's call history is organized and accessible — to humans AND to AI agents. No competitor exposes this via MCP.

**3. Cross-call intelligence via MCP.**
The tools we expose — topic tracking over time, speaker history across calls, cross-call comparison, workspace-level analytics — aren't just "search + get transcript." They're organizational intelligence. The AI gets context that spans months of conversations across an entire team. This is unique to our MCP design.

**4. The ClawSimply distribution play.**
If ClawSimply becomes the "easy mode" for OpenClaw, it becomes the front door for non-technical users to access AI agents. CallVault comes pre-installed. Every ClawSimply user is a potential CallVault user. The agent platform distributes the data platform.

**5. Aggregation from everywhere.**
The ability to pull calls from Fathom, Zoom, Google Meet, YouTube — and in the future, more sources — aggregate them into one place, organize them, and then pipe them to *any* AI... that's the value. Users don't want to teach Claude about their Fathom calls AND their Zoom calls AND their Google Meet calls separately. They want one organized library that any AI can access.

---

## VII. Business Model

### CallVault (the data layer):
- **Free tier:** Import, organize, export. Limited calls/month.
- **Pro tier ($X/month):** Unlimited calls, MCP access (connect to any AI), team features.
- **Team tier ($X/user/month):** Multi-user workspaces, advanced roles/permissions, vault-level analytics.

The pricing shifts from "pay for AI features" to "pay for organization, collaboration, and access." This is actually a stronger value prop — you're paying for the workspace, not for AI you can get elsewhere.

### ClawSimply (the agent layer):
- **Free tier:** Self-hosted, basic app connections, community plugins.
- **Pro tier ($X/month):** Managed hosting, premium integrations, priority plugin support.
- **Team tier ($X/user/month):** Shared agent configurations, team memories, admin controls.

### The flywheel:
ClawSimply users discover they need organized call data → they sign up for CallVault. CallVault users discover they want an AI agent that uses their call data everywhere → they sign up for ClawSimply. Each product drives adoption of the other.

---

## VIII. What We're Asking For

**Use of funds:**

1. **Complete the MCP pivot** (4-6 weeks) — Build the MCP server, strip the AI layer, refine the workspace features that become the core product.

2. **Ship ClawSimply v1** (6-8 weeks) — Fork OpenClaw, build the simplified OAuth UI, re-enable MCP, integrate CallVault as first-party plugin.

3. **Go-to-market** — Position CallVault in the MCP ecosystem (Claude connector directory, ChatGPT app marketplace). Position ClawSimply as "OpenClaw for normal people."

4. **Expand import sources** — More call platforms, CRM integrations, general audio/video upload. The more sources we aggregate from, the stronger the moat.

---

## IX. Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **MCP Server** | Weeks 1-2 | CallVault MCP live on Cloudflare Workers. Works with Claude + ChatGPT. |
| **Simplify CallVault** | Weeks 3-5 | Feature-flag AI layer. Minimal in-app chat. Keyword search replaces semantic. |
| **Remove AI Layer** | Weeks 6-8 | Strip ~89K lines. Drop AI dependencies. Repricing. |
| **ClawSimply MVP** | Weeks 6-12 | Fork OpenClaw. Simplified UI. OAuth app connections. CallVault plugin. |
| **Launch** | Week 12+ | Both products in market. Flywheel begins. |

---

## X. The Bottom Line

The AI application market is being commoditized in real time. Every SaaS company has bolted on AI features. Nobody is winning on them because the underlying models are improving faster than anyone can build proprietary layers on top.

The winners in this next phase won't be the ones building AI. They'll be the ones **organizing the data that makes AI useful.**

CallVault is the organized data layer for your conversations. ClawSimply is the simplified agent that connects everything together. Together, they let non-technical users — sales teams, coaches, agencies, small businesses — get the full power of frontier AI applied to their actual business conversations, without touching a terminal, writing a config file, or learning what "RAG" means.

We're not competing with AI companies. We're making AI companies more useful.

---

## Appendix: Supporting Research

| Document | What It Covers |
|----------|---------------|
| [Via Negativa Analysis](./research/2026-02-17-callvault-via-negativa.md) | Feature-by-feature pruning: what to remove, what to keep, what the product looks like after |
| [Strategic Pivot Feasibility](./research/2026-02-17-callvault-strategic-pivot-thin-app-mcp-feasibility.md) | Full feasibility study — technical, resource, competitive. Verdict: "Go with conditions" |
| [MCP Architecture Technical (v1)](./research/2026-02-17-callvault-mcp-plugin-architecture-technical.md) | Tool inventory design (3 tiers, 17 tools), MCP Resources/Prompts, multi-platform architecture |
| [MCP Architecture Technical (v2)](./research/2026-02-18-callvault-mcp-plugin-architecture-technical.md) | Updated for ChatGPT MCP convergence. Cloudflare Workers + Supabase OAuth 2.1 recommendation |
| [MCP Client Compatibility](../.planning/phases/12-deploy-callvault-mcp-as-remote-cloudflare-worker-with-supabase-oauth-2-1/RESEARCH-mcp-client-compat.md) | Cross-platform testing: Claude, ChatGPT, OpenClaw, OAuth flows, CORS, pitfalls |

## Appendix: OpenClaw Context

- **OpenClaw** — Open-source AI agent, 100K+ GitHub stars, created by Peter Steinberger
- Steinberger announced joining OpenAI on Feb 14, 2026; project moving to open-source foundation
- Supports WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Google Chat, Microsoft Teams, and more
- Uses AgentSkills-compatible skill folders and ClawHub skill registry
- **Native MCP support is explicitly disabled** (GitHub #4834, closed "not planned" Feb 1, 2026)
- ClawSimply fork addresses: MCP support gap, developer-only UX, need for simplified OAuth onboarding

### Sources

- [OpenClaw GitHub](https://github.com/openclaw/openclaw) — 100K+ stars
- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [What is OpenClaw? | DigitalOcean](https://www.digitalocean.com/resources/articles/what-is-openclaw)
- [How OpenClaw Works | Medium](https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764)
- [Fireflies MCP Server](https://fireflies.ai/blog/fireflies-mcp-server/)
- [Otter.ai MCP Enterprise](https://otter.ai/blog/otter-for-enterprise-connect-ai-to-ai-with-otters-mcp)
- [Gong MCP Support](https://www.gong.io/press/gong-introduces-model-context-protocol-mcp-support-to-unify-enterprise-ai-agents-from-hubspot-microsoft-salesforce-and-others)
- [Cloudflare: Build a Remote MCP Server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Supabase OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)
- [OpenAI Apps SDK / MCP](https://developers.openai.com/apps-sdk/concepts/mcp-server/)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
