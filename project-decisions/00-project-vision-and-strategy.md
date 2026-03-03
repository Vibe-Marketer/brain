# Project Vision & Strategy

## What is CallVault?

A conversation intelligence platform that ingests call recordings from multiple sources (Fathom, Zoom, YouTube, file upload), stores transcripts, and turns them into actionable intelligence. Multi-tenant architecture with hard tenant isolation and collaborative workspace sharing.

## The v2 Pivot

v2 is a strategic rebuild — strip ~89K lines of AI/chat/RAG/embeddings from v1, build a clean new frontend repo (Vite 7 + React 19 + TanStack Router) pointing at the same Supabase project.

**New core value:** "Clarity-first organized call workspace. Users can import calls from anywhere, organize them into clear workspaces (Organization > Workspace > Folder), and expose that structured context to whatever AI they already use."

**Position:** MCP-first, not AI-first ("AI-ready not AI-powered")

**Tagline:** "Close more deals from the calls you're already having."

---

## AI Strategy (Locked in Phase 13)

- [ ] CallVault is a data layer, not an AI product
- [ ] MCP is infrastructure, not a premium feature
- [ ] Bridge chat is optional — not the core product story
- [ ] Marketing angle: "Your calls, organized. Your AI, connected."
- [ ] Smart Import kept (auto-title, action items, tags, sentiment) — runs once at import, named feature, no AI label
- [ ] AI-02 hard constraint: zero RAG/embedding code in v2 repo, ever

### Dropped from v1

- [ ] RAG pipeline
- [ ] Embeddings / vector search
- [ ] Content Hub
- [ ] Langfuse
- [ ] Semantic search
- [ ] AI-powered automation

---

## Product Identity (Locked in Phase 13)

- [ ] Primary buyer: Heads of Sales / RevOps at B2B companies with 5-50 reps
- [ ] Secondary: Solo coaches, recruiters, CSMs
- [ ] One-liner: "Close more deals from the calls you're already having."
- [ ] Category: "The operating system for your sales calls."
- [ ] Competitive framing: "Gong is the coach. CallVault is the film room and wiring."

### Hard Anti-Identities

- [ ] NOT a recorder
- [ ] NOT an AI coach
- [ ] NOT an analytics/intelligence platform
- [ ] NOT a CRM
- [ ] NOT "AI-powered everything"

---

## Pricing Model (Locked in Phase 13)

| Tier | Monthly | Annual | Key Limits |
|------|---------|--------|-----------|
| Free | $0 | — | 10 imports/mo, 1 org, 1 workspace, no MCP |
| Pro | $29 | $23/mo ($278/yr) | Unlimited imports, multiple workspaces, personal MCP |
| Team | $79 flat | $63/mo ($758/yr) | Shared workspaces, roles, per-workspace MCP tokens, admin dashboard |

- [ ] Price anchored against Gong ($160-250/user/month + $5K-50K/yr platform fee)
- [ ] Annual discount: 20%, framed as "2 months free" (not "20% off")
- [ ] Price evolution: raise to $39/$99 after first 10 Pro + 5 Team paying customers
- [ ] Gate is MCP access (not AI queries)
- [ ] Free tier feels useful 2-3 weeks, then naturally hits limits

### Never Gated

- [ ] Smart Import
- [ ] Keyword search
- [ ] Unlimited folders
- [ ] Call detail view
- [ ] Export
- [ ] Public sharing
- [ ] Data retention (forever)

### Upgrade UX Pattern

- [ ] Three behaviors: explain the block, show what unlocks, one CTA + "Maybe later"
- [ ] UpgradeGate component wraps any gated feature
- [ ] Copy constants in `src/constants/upgrade-copy.ts`
- [ ] Frontend gate is UX only — backend must independently enforce limits

---

## Two-Repo Workflow

| Repo | Path | Purpose |
|------|------|---------|
| brain | `/Users/Naegele/dev/brain` | Backend (Supabase edge functions, migrations), GSD planning, docs |
| callvault | `/Users/Naegele/dev/callvault` | v2 frontend (Vite 7 + React 19 + TanStack Router) |

- [ ] Planning stays in `brain/.planning/` as single source of truth
- [ ] v1 app stays live in `brain/src/` until v2 confirmed stable
- [ ] GitHub: `Vibe-Marketer/callvault` (private)
- [ ] Production: callvault.vercel.app (auto-deploys from pushes)

---

## Milestones

### v1 Launch Stabilization — COMPLETE

- [ ] Phases 1-12 (including 4 inserted phases: 3.1, 3.2, 10.2, 10.3; Phase 11 eliminated)
- [ ] 93 plans, 80 requirements, ~112,743 lines of TypeScript, 1,310 commits
- [ ] Key wins: Vercel AI SDK + OpenRouter chat with 14 RAG tools, Bank/Vault multi-tenant architecture, YouTube vault type, Polar billing, Cloudflare Workers MCP with Supabase OAuth 2.1

### v2.0 The Pivot — IN PROGRESS

- [ ] Phases 13-22 (continues numbering from v1)
- [ ] 70 requirements defined across 10 categories
- [ ] 5 research documents (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- [ ] New frontend repo at `/dev/callvault/`

---

## Out of Scope for v2

- [ ] No Google Meet (removed entirely — FOUND-09)
- [ ] No custom AI models / fine-tuning
- [ ] No in-house RAG pipeline
- [ ] No Content Hub
- [ ] No Langfuse
- [ ] No semantic/vector search
- [ ] No ClawSimply (v3+)
- [ ] No mobile app (web-first)

## Future (v3+)

- [ ] Grain, Fireflies, tl;dv connectors
- [ ] AI-suggested routing rules, retroactive rule application
- [ ] ClawSimply integration
- [ ] Public REST API, Zapier/Make.com
- [ ] Advanced analytics (speaker analytics, topic trends)
