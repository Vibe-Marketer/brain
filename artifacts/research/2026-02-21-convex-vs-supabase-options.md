# Options Comparison: Convex vs Supabase for CallVault

**Date:** 2026-02-21
**Decision:** Should CallVault use Convex or Supabase as its backend platform?
**Methodology:** 4 independent research agents (Convex Advocate, Supabase Advocate, Neutral Analyst, Migration Feasibility Analyst) to eliminate first-answer bias

---

## Strategic Summary

Convex offers a genuinely superior developer experience with end-to-end TypeScript, automatic reactivity, and simpler deployment. However, Supabase is the stronger choice for CallVault specifically because of its relational data model (perfect for Banks > Vaults > Folders), database-level Row Level Security (critical for multi-tenancy), OAuth 2.1 server capability (essential for MCP authentication), and the practical reality that 42 Edge Functions, 190 RLS policies, and 30+ tables already run in production.

**The pivot does NOT create a migration window.** It removes AI leaf nodes (easy code), leaving the structural skeleton (auth, permissions, multi-tenant hierarchy, integrations) — which are the hardest things to migrate and actually harder on Convex than Supabase.

---

## Context

CallVault is pivoting from an AI-powered call intelligence platform to a data infrastructure layer that organizes call transcripts and exposes them via MCP to external AIs (Claude, ChatGPT, Gemini). The pivot removes ~35% of the codebase (AI features, embeddings, content generation) while keeping the core: multi-tenant workspace hierarchy, import pipelines, search, team collaboration, and adding an MCP server.

The question has two parts:
1. **Greenfield:** If nothing was built, which platform is objectively better for what we're building?
2. **Reality:** Given where we are, should we switch during this major overhaul?

---

## Decision Criteria

| # | Criterion | Why It Matters | Weight |
|---|-----------|---------------|--------|
| 1 | Data Modeling Fit | CallVault's hierarchy (Banks > Vaults > Folders > Tags > Recordings) is deeply relational | **High** |
| 2 | Multi-Tenancy & Security | B2B SaaS with teams, roles, shared workspaces — security at scale | **High** |
| 3 | MCP Server & OAuth 2.1 | The entire post-pivot strategy depends on exposing data via MCP | **High** |
| 4 | Search Capabilities | Finding things in transcripts is the core user job | **High** |
| 5 | Developer Experience | Solo/small team — DX directly impacts shipping speed | **Medium** |
| 6 | Backend Logic | Import pipelines, webhooks, enrichment, automation | **Medium** |
| 7 | Realtime Needs | Team collaboration, sync status, notifications | **Medium** |
| 8 | Auth Integration | OAuth providers (Fathom, Google, Zoom), JWT, session management | **Medium** |
| 9 | Cost at Scale | Pricing predictability as users grow | **Medium** |
| 10 | Vendor Lock-in | Data portability, exit strategy, enterprise customer concerns | **Medium** |
| 11 | Ecosystem & Community | Hiring, documentation, third-party tools | **Low** |
| 12 | Deployment Simplicity | Fewer moving parts = fewer things to break | **Low** |

---

## Part 1: Greenfield Comparison (Nothing Built Yet)

### Option A: Supabase

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Data Modeling Fit | 9/10 | PostgreSQL is purpose-built for relational hierarchies. Foreign keys with CASCADE, JOINs, CTEs for recursive traversal, partial indexes. The Banks > Vaults > Folders model is textbook relational. |
| Multi-Tenancy & Security | 9/10 | Row Level Security is a killer feature. Policies enforce data isolation at the database level — no application bug can bypass them. `auth.uid()` in SQL = zero-trust at the data layer. |
| MCP Server & OAuth 2.1 | 9/10 | Supabase Auth can act as an OAuth 2.1 server (explicitly built for MCP). `mcp-lite` framework runs on Edge Functions. Direct database access from MCP server with RLS enforcement. This is first-class support. |
| Search Capabilities | 8/10 | pg_trgm (fuzzy/trigram) + tsvector (full-text with BM25-style ranking). Weighted fields, phrase matching, language-aware stemming. All behind RLS automatically. |
| Developer Experience | 7/10 | SQL + TypeScript split. Generated types via `supabase gen types`. TanStack React Query for caching. Good but requires two mental models (SQL + TS). |
| Backend Logic | 7/10 | Deno Edge Functions. 2-second CPU limit but adequate for API-calling enrichment. Shared utilities pattern. Separate deployment from database. |
| Realtime | 7/10 | Postgres Changes (CDC), Broadcast, Presence. Adequate for CallVault's needs (sync progress, notifications). Not the selling point. |
| Auth Integration | 9/10 | 30+ OAuth providers built-in. JWT tokens flow to RLS. OAuth 2.1 server for MCP. Mature and full-featured. |
| Cost at Scale | 8/10 | $25/mo Pro plan. Unlimited queries. Predictable overages. No per-developer seat fees. |
| Vendor Lock-in | 9/10 | Open source (Apache 2.0). PostgreSQL = maximally portable. `pg_dump` to any Postgres host. |
| Ecosystem | 9/10 | 110k+ GitHub stars. Every developer knows SQL. Massive community. |
| Deployment | 6/10 | Multiple services (database, auth, edge functions, storage). Multiple CLIs possible (supabase + wrangler if using CF). |
| **Score** | **8.1/10** | |

### Option B: Convex

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Data Modeling Fit | 5/10 | Document model with no native JOINs. CallVault's hierarchy requires manual traversal in TypeScript. No foreign key constraints, no CASCADE. Convex acknowledges it "may not be best if your app needs to work with multiple documents or tables at the same time." |
| Multi-Tenancy & Security | 5/10 | No RLS equivalent. Authorization is application-level code in every function. With 5 role levels and bank/vault/team hierarchies, the surface area for missed auth checks is large. |
| MCP Server & OAuth 2.1 | 5/10 | Can serve as MCP backend via HTTP actions, but has NO OAuth 2.1 server capability. You'd need to build or integrate a separate OAuth server. Significant gap for CallVault's architecture. |
| Search Capabilities | 6/10 | Tantivy-based BM25 with prefix matching. Fuzzy matching deprecated (Jan 2025). 1024 result cap per index scan. One search index per table. Adequate but less capable than PostgreSQL's search. |
| Developer Experience | 9/10 | End-to-end TypeScript. Schema = types = validation. `useQuery` replaces React Query + Zustand. Change a field name, get compile errors everywhere. For a solo dev, this is transformative. |
| Backend Logic | 7/10 | Clean separation: queries (read), mutations (write), actions (side effects). TypeScript cron jobs. Durable workflows. But: actions can't access DB directly, 1 MiB per workflow step. |
| Realtime | 9/10 | Every query is a live subscription by default. Sub-50ms latency. No configuration. No channel management. Best-in-class. |
| Auth Integration | 5/10 | Clerk/Auth0 integration. Convex Auth (beta). No OAuth 2.1 server. Would need external auth infrastructure for MCP. |
| Cost at Scale | 6/10 | $25/dev/month (per-seat). 2-person team = $50/mo base. Function calls billed including reactive subscriptions. Less predictable. EU surcharge 30%. |
| Vendor Lock-in | 5/10 | Open-sourced backend (Feb 2025, FSL Apache 2.0). Self-hosting available via Docker. But proprietary query language — all queries are Convex-specific, not transferable. Data export is JSON, not SQL. |
| Ecosystem | 5/10 | ~30k GitHub stars. Smaller community. Convex-specific skills don't transfer. Narrower hiring pool. |
| Deployment | 9/10 | `npx convex deploy` — one command for everything. Schema, functions, cron jobs, HTTP endpoints. Dramatically simpler. |
| **Score** | **6.3/10** | |

### Greenfield Verdict

**Supabase wins 8.1 to 6.3 for CallVault's specific requirements.**

Convex's strengths (realtime, DX, deployment simplicity) are real but don't outweigh Supabase's advantages in the areas that matter most for CallVault: relational data modeling, database-level security, MCP/OAuth 2.1, and search. If CallVault were a collaborative whiteboard app or a Notion-style document editor, Convex would win. But CallVault is a structured data platform with multi-tenant hierarchies — PostgreSQL's home turf.

The **MCP/OAuth 2.1 gap** is particularly decisive. CallVault's entire post-pivot strategy revolves around exposing data via MCP. Supabase has first-class support for this (OAuth 2.1 server + mcp-lite + Edge Functions). Convex has nothing equivalent, requiring additional infrastructure.

---

## Part 2: Reality Assessment (Where We Actually Are)

### Current Supabase Integration Depth

| Component | Count | Migration Effort |
|-----------|-------|-----------------|
| Frontend Supabase calls | ~127 real calls across 40 files | Rewrite all data hooks |
| Edge Functions (staying) | 42 functions (~14,145 lines) | Rewrite all as Convex functions |
| RLS policies (staying) | ~190 policies | Rewrite as imperative auth checks |
| Database tables (staying) | ~30 tables | Redefine as Convex documents |
| Database functions/RPCs | 10+ functions | Rewrite in TypeScript |
| OAuth integrations | 3 platforms x 4 functions | Rewire for Convex auth model |
| Billing (Polar) | 4 functions | Rewire webhooks |

### What the Pivot Actually Removes

| Asset | Before | Removed | Remaining | % Removed |
|-------|--------|---------|-----------|-----------|
| Frontend lines | 112,744 | ~40,045 | ~72,699 | 35.5% |
| Edge functions | 65 | 23 | 42 | 35.4% |
| Database tables | ~45 | ~15 | ~30 | 33.3% |
| RLS policies | ~241 | ~50 | ~191 | 20.7% |
| Supabase calls | ~127 | ~18 | ~109 | 14.2% |

**Critical insight: Only 14% of Supabase calls are in code being removed.** The pivot removes AI leaf nodes — the remaining 86% is structural infrastructure (auth, permissions, multi-tenant, integrations).

### Timeline Comparison

| Approach | Duration | Risk |
|----------|----------|------|
| **Pivot only (stay on Supabase)** | 2-3 weeks | Low — removing code is safe |
| **Pivot + Convex migration (parallel)** | 12-19 weeks | Very High — auth migration, data migration, no rollback |
| **Pivot first, then migrate** | 10-17 weeks | High — cleaner but still massive |

### The Migration Window Myth

The pivot creates disruption but does NOT simplify a Convex migration:

- **Auth flows** — untouched by pivot, critical to migrate
- **Multi-tenant hierarchy** — untouched by pivot, hardest to migrate
- **Import pipelines** — untouched by pivot, 12 functions to rewrite
- **Billing** — untouched by pivot, 4 functions to rewire
- **190 RLS policies** — 80% survive the pivot, all need reimplementation

Analogy: You're tearing out the kitchen (AI features). Someone suggests that since contractors are already on site, now is the time to also replace the foundation (auth), plumbing (data layer), and electrical (edge functions). The kitchen removal doesn't make the foundation replacement easier.

---

## Comparison Matrix

| Criterion | Weight | Supabase | Convex | Winner |
|-----------|--------|----------|--------|--------|
| Data Modeling Fit | High | Excellent — relational hierarchy is native | Poor — no JOINs, manual traversal | **Supabase** |
| Multi-Tenancy & Security | High | Excellent — database-level RLS | Poor — application-level only | **Supabase** |
| MCP Server & OAuth 2.1 | High | Excellent — first-class support | Poor — no OAuth 2.1 server | **Supabase** |
| Search Capabilities | High | Excellent — pg_trgm + tsvector | Adequate — BM25, no fuzzy | **Supabase** |
| Developer Experience | Medium | Good — SQL + TS split | Excellent — end-to-end TS | **Convex** |
| Backend Logic | Medium | Good — Edge Functions | Good — typed functions | Tie |
| Realtime | Medium | Adequate — CDC, not primary | Excellent — default reactivity | **Convex** |
| Auth Integration | Medium | Excellent — OAuth 2.1 server | Adequate — Clerk/Auth0, no OAuth server | **Supabase** |
| Cost at Scale | Medium | Better — no per-seat, predictable | Worse — per-seat, less predictable | **Supabase** |
| Vendor Lock-in | Medium | Low — PostgreSQL + open source | Medium — proprietary queries, open backend | **Supabase** |
| Ecosystem | Low | Massive — SQL knowledge universal | Growing — Convex-specific | **Supabase** |
| Deployment Simplicity | Low | Complex — multiple services | Simple — one command | **Convex** |

**Score: Supabase 9 wins, Convex 3 wins, 0 ties (with high-weight criteria dominated by Supabase)**

---

## Recommendation

### Stay on Supabase.

**For the greenfield question:** Even starting from scratch with nothing built, Supabase wins for CallVault's specific requirements. The relational data model, RLS, OAuth 2.1 server, and search capabilities are architectural fits that Convex cannot match. Convex's DX advantage (end-to-end TypeScript, automatic reactivity) is real but doesn't compensate for fundamental mismatches in data modeling and security patterns.

**For the practical question:** Migrating during the pivot would turn a 2-3 week cleanup into a 12-19 week rewrite. The pivot removes 35% of code but only 14% of Supabase calls. The remaining infrastructure (auth, multi-tenant hierarchy, integrations, billing) is untouched by the pivot and represents the hardest migration work. The auth migration alone risks losing active users who'd need to re-authenticate through a new provider.

### Why NOT Convex (Devil's Advocate Response)

The Convex advocate made compelling points:

1. **"Convex's reactive queries eliminate React Query boilerplate"** — True, but CallVault already has a clean TanStack Query hook layer. The boilerplate is written and working.

2. **"TypeScript-native schema eliminates migration files"** — True for new projects, but CallVault's 85+ migrations are an audit trail, not debt. They track why every change was made.

3. **"Convex's enrichment pipeline with `ctx.scheduler` is cleaner"** — True architecturally, but CallVault's enrichment is being simplified post-pivot to one-shot operations at import time. The complex orchestration Convex solves is being removed.

4. **"Convex is open source now"** — True (Feb 2025), but the query language is still proprietary. PostgreSQL's universality remains a stronger portability story.

5. **"241 RLS policies have recursion bugs"** — Some did. They were fixed. The fix migrations prove the system is being hardened, not that it should be abandoned.

### Runner-up

**Convex** — Choose this if:
- You were building a greenfield app with heavy realtime collaboration (not CallVault's profile)
- You had zero existing infrastructure
- MCP/OAuth 2.1 wasn't a core requirement
- You were a solo developer who valued DX above all else
- Multi-tenancy was simple (user_id-based, not hierarchical)

---

## Implementation Context

### Chosen: Supabase (Continue)

- **What to do now:** Execute the pivot as planned (2-3 weeks)
- **MCP server:** Build on Supabase Edge Functions with `mcp-lite`, or Cloudflare Workers calling Supabase
- **OAuth 2.1:** Use Supabase Auth's OAuth 2.1 server (already partially built — `OAuthConsentPage`)
- **Search:** Replace semantic search with pg_trgm keyword search
- **Enrichment:** Simplify to one-shot Edge Function calls at import time

### Runner-up: Convex

- **When it becomes the better choice:** If Supabase's Edge Function limitations become blocking, if realtime collaboration becomes a primary feature, or if the data model shifts away from hierarchical multi-tenancy
- **Switch cost:** 10-17 weeks for a solo developer. Auth migration is the highest-risk component.
- **Reevaluation trigger:** If after 3 months post-pivot you find yourself fighting Supabase rather than building on it

### Integration Notes

- **Existing code:** The TanStack Query hook layer provides a clean abstraction. If you ever do migrate, only the hooks need changing, not every component.
- **Gotchas:** Supabase Edge Function 2-second CPU limit can be tight for complex enrichment — use background jobs via `ctx.scheduler` pattern (schedule edge function calls from other edge functions)
- **Testing:** Continue using Playwright for E2E, Vitest for unit tests. RLS policies should have dedicated test coverage.

---

## The "Sunk Cost" Question

**Is staying with Supabase sunk cost fallacy?**

No. Sunk cost fallacy applies when past investment has no bearing on future value. CallVault's Supabase infrastructure is not a past-tense artifact — it's actively running production services. The 42 remaining Edge Functions serve real users. The 190 RLS policies enforce real security. The OAuth tokens enable real integrations.

The question isn't "should we keep our past work?" but "does replacing working infrastructure provide enough future value to justify the cost?" For CallVault, the answer is no — Supabase's strengths align with the post-pivot architecture, and Convex's strengths (realtime, DX) solve problems CallVault doesn't prioritize.

---

## Sources

### Convex
- [Convex Documentation](https://docs.convex.dev/) - Feature reference
- [Convex Pricing](https://www.convex.dev/pricing) - Current pricing tiers
- [Convex vs Supabase (Makers' Den)](https://makersden.io/blog/convex-vs-supabase-2025) - Third-party comparison
- [Convex vs Supabase (ScratchDB)](https://scratchdb.com/compare/convex-vs-supabase/) - Feature matrix
- [Convex Open Source Announcement](https://news.convex.dev/convex-goes-open-source/) - Self-hosting details
- [Convex Full Text Search](https://docs.convex.dev/search/text-search) - Search capabilities
- [Convex Authentication](https://docs.convex.dev/auth) - Auth options
- [Convex MCP Server](https://docs.convex.dev/ai/convex-mcp-server) - MCP integration
- [Row Level Security in Convex](https://stack.convex.dev/row-level-security) - Auth patterns
- [Convex Self-Hosting](https://docs.convex.dev/self-hosting) - Deployment options
- [ConvexDB Pricing Guide (Airbyte)](https://airbyte.com/data-engineering-resources/convexdb-pricing) - Cost analysis

### Supabase
- [Supabase Documentation](https://supabase.com/docs) - Feature reference
- [Supabase Pricing](https://supabase.com/pricing) - Current pricing tiers
- [Supabase OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server) - OAuth server capability
- [Supabase MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) - MCP auth flows
- [Supabase MCP Server](https://supabase.com/docs/guides/getting-started/mcp) - MCP integration
- [Building MCP with mcp-lite](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite) - Edge Function MCP
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) - Function capabilities
- [Supabase Realtime](https://supabase.com/features/realtime-postgres-changes) - Realtime features
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) - Security model
- [Supabase Pricing (UI Bakery)](https://uibakery.io/blog/supabase-pricing) - Cost analysis
- [Supabase Pricing (Metacto)](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance) - Cost analysis

---

**Next Action:** Execute the pivot on Supabase as planned. Build MCP server on Edge Functions with `mcp-lite`. Use Supabase Auth's OAuth 2.1 server for MCP authentication. Ship in 2-3 weeks instead of 12-19.
