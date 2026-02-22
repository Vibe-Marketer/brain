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

**What's next:** Run `/gsd-new-milestone` to define v2 scope

---
