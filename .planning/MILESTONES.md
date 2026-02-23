# Project Milestones: CallVault

---

## v1 Launch Stabilization (Shipped: 2026-02-21)

**Delivered:** Stabilized CallVault for public launch — fixed core chat reliability, built Bank/Vault multi-tenant architecture, shipped all differentiating features, and deployed the MCP server remotely to Cloudflare Workers.

**Phases completed:** 1–12 (including inserted phases 3.1, 3.2, 10.2, 10.3; Phase 11 eliminated)

**Key accomplishments:**

- Migrated chat from fragile manual SSE streaming to Vercel AI SDK + OpenRouter with 14 RAG tools, five-state tool call display, and inline citations with hover preview
- Eliminated all security vulnerabilities: API key exposure, unauthenticated endpoints, PII logging, wildcard CORS across 61+ Edge Functions
- Built Bank/Vault multi-tenant architecture from scratch, replacing the teams model with hard tenant isolation (banks) + collaborative workspaces (vaults) — including Vaults as a first-class sidebar page with full CRUD, member management, and vault-scoped chat
- Shipped YouTube vault type with thumbnail-first media-row list, video detail modal, and YouTube-scoped import + chat
- Delivered full growth infrastructure: Polar 3-tier billing, YouTube import, admin cost dashboard covering 26 AI models
- Deployed CallVault MCP as stateless Cloudflare Worker with Supabase OAuth 2.1, enabling any MCP client to connect by pasting a URL and signing in with their Google account

**Stats:**

- Phases: 12 (+ 4 inserted: 3.1, 3.2, 10.2, 10.3)
- Plans: 93 total
- Requirements: 80 total (70 complete, 1 Beta, 9 skipped/eliminated/deferred)
- Lines of code: ~112,743 TypeScript
- Timeline: ~91 days (2025-11-22 → 2026-02-21)
- Commits: 1,310

**Architecture highlights:**
- Bank/Vault multi-tenant with hard RLS isolation
- Remote MCP at https://callvault-mcp.naegele412.workers.dev/mcp
- Vercel AI SDK `streamText` on Deno with 14 RAG tools and zod schemas

**What's next:** ~~Run `/gsd-new-milestone` to define v2 scope~~ → v2.0 defined (see below)

**v1 archives:**
- Roadmap: `.planning/milestones/v1-ROADMAP.md`
- Requirements: `.planning/milestones/v1-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1-MILESTONE-AUDIT.md`
- Phase folders: `.planning/phases/01/` through `.planning/phases/12/`

---

## v2.0 The Pivot (In Progress — started 2026-02-22)

**Strategic direction:** Strip ~89K lines of AI/chat/RAG/embeddings. New frontend repo (`/dev/callvault/` — sibling of this repo). Same Supabase project. Clarity-first workspace model (Organization → Workspace → Folder). Import routing rules. MCP expansion. Minimal bridge chat.

**Phases:** 13–22 (continues numbering from v1)

**What's being built:**
- Phase 13: Strategy + Pricing — product identity, AI strategy validation, pricing before code
- Phase 14: Foundation — new `callvault/` repo at `/dev/callvault/`, Vite 7 + React 18, zero AI code
- Phase 15: Data Migration — fathom_calls → recordings, RLS verified
- Phase 16: Workspace Redesign — Organization → Workspace → Folder (replaces Bank/Vault/Hub)
- Phase 17: Import Connector Pipeline — shared 5-stage utility, extensible (new source ≤230 lines)
- Phase 18: Import Routing Rules — condition builder, live preview, priority, default destination
- Phase 19: MCP Audit + Workspace Tokens — full audit, per-workspace scoped tokens
- Phase 20: MCP Differentiators — 6 tools competitors don't have, prompts, callvault:// URIs
- Phase 21: AI Bridge + Export + Sharing — bridge chat, AI-optimized export, public sharing
- Phase 22: Backend Cleanup — drop ~15 AI tables + ~23 edge functions after 30 days stable

**Stats so far:**
- Requirements: 70 defined across 10 categories
- Research: 5 documents (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)

**Current files:**
- Roadmap: `.planning/ROADMAP.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Phase folders: `.planning/phases/13/` through `.planning/phases/22/` — created as each phase is planned
- Research: `.planning/research/`

**Repo structure:**
- Planning: `brain/` (this repo) — `.planning/` is the source of truth for all v2 planning
- App code: `callvault/` (new repo, created in Phase 14) — `/dev/callvault/`, GitHub: `Vibe-Marketer/callvault`
- v1 app: `brain/src/` — stays live in production until v2 confirmed stable, then archived

---
