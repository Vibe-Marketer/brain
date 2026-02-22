# CallVault

## What This Is

CallVault is a conversation intelligence platform that ingests call recordings from multiple sources (Fathom, Zoom, Google Meet, YouTube), enriches them with AI-powered metadata (topics, sentiment, intent signals, entities), and turns them into actionable intelligence through RAG-powered chat, content generation, and automation. The platform uses a Bank/Vault multi-tenant architecture providing hard tenant isolation alongside collaborative workspace sharing.

v1 shipped with the core platform stabilized, Bank/Vault architecture live, differentiating features delivered (folder-level chat, client health alerts, contacts database, Polar billing, YouTube import), and the MCP server deployed remotely to Cloudflare Workers.

## Core Value

**Users can reliably ask questions across their entire call history and get accurate, cited answers every single time.**

If Chat breaks, nothing else matters. Everything else (content generation, exports, automation) builds on top of reliable conversation intelligence retrieval.

## Requirements

### Validated

*(Shipped in v1 — confirmed working)*

- ✓ Multi-source call ingestion (Fathom, Zoom, Google Meet, YouTube) — v1
- ✓ Transcript storage and display — existing pre-v1
- ✓ Content generation pipeline (4-agent wizard: Classifier → Insight Miner → Hook Generator → Content Builder) — existing pre-v1
- ✓ Export system (13+ formats including Obsidian, LLM Context, Analysis Package) — existing pre-v1
- ✓ Chunk metadata enrichment (topics, sentiment, intent signals, entities) — existing pre-v1
- ✓ Transcript editing (non-destructive) — existing pre-v1
- ✓ Multi-source deduplication (fuzzy matching across platforms) — existing pre-v1
- ✓ Folder and tag organization — existing pre-v1
- ✓ Public sharing with access logging — existing pre-v1
- ✓ Chat works reliably with all 14 RAG tools firing consistently (CHAT-01) — v1
- ✓ Tool calls return results with three-state display (CHAT-02) — v1
- ✓ Streaming stable with error recovery (CHAT-03) — v1
- ✓ Inline citations with hover preview (CHAT-04) — v1
- ✓ Migrated to Vercel AI SDK + OpenRouter (CHAT-05) — v1
- ✓ Silent store failures surface toast errors (STORE-01) — v1
- ✓ Zoom OAuth connection flow works (INT-01) — v1
- ✓ Google OAuth connection flow works — Beta (INT-02) — v1
- ✓ Integration connection errors surface to user (INT-03) — v1
- ✓ Team creation works with multi-team membership (TEAM-01) — v1
- ✓ Team join page at /join/team/:token (TEAM-02) — v1
- ✓ Security hardening: API key removal, CORS migration, PII logging cleanup, dead function deletion (SEC-01–06) — v1
- ✓ All orphaned pages routed (Automation Rules, Analytics, etc.) (WIRE-01, WIRE-02, FIX-01–06) — v1
- ✓ Code health: Chat.tsx refactored, types tightened, deduplication consolidated, dead code removed (REFACTOR/CLEAN series) — v1
- ✓ Infrastructure: cost tracking (26 models), cron parsing, database-backed rate limiting (INFRA-01–03) — v1
- ✓ Folder-Level Chat (DIFF-02) — v1
- ✓ Client Health Alerts with email notifications (DIFF-03) — v1
- ✓ Contacts Database with Settings UI (DIFF-04) — v1
- ✓ Analytics tabs show real data (DIFF-05) — v1
- ✓ Polar 3-tier billing (Solo/Team/Business) (GROW-02) — v1
- ✓ YouTube import with progress tracking (GROW-03) — v1
- ✓ Admin cost dashboard for all OpenRouter models (GROW-05) — v1
- ✓ Compact integration buttons with reusable connection modal (UI-INT-01–03) — v1
- ✓ Per-integration sync source filter with persistence (UI-INT-04–06) — v1
- ✓ Bank/Vault multi-tenant architecture (BANK-01–05) — v1
- ✓ Chat searches scoped to active bank/vault context (GAP-INT-01) — v1
- ✓ Vaults as first-class sidebar page with full CRUD and member management (VAULT-UI-01–07) — v1
- ✓ YouTube vault type with media-row list, video detail modal, YouTube-scoped import + chat (YT-01–06) — v1
- ✓ CallVault MCP remote server on Cloudflare Workers with Supabase OAuth 2.1 (MCP-REMOTE-01–08) — v1

### Active

*(Scope for next milestone — TBD via /gsd-new-milestone)*

*No active requirements defined yet. Run `/gsd-new-milestone` to define v2 scope.*

### Out of Scope

*(Deferred to v2+ — documented but not in current roadmap)*

**UI Polish (15 specs)**
- SPEC-001 through SPEC-011, SPEC-036–038, SPEC-041 — Button positioning, spacing, visual tweaks

**UX Enhancements (7 specs)**
- SPEC-012 through SPEC-014, SPEC-016–017, SPEC-019, SPEC-032 — Nice-to-haves

**Feature Additions (12 specs)**
- SPEC-021 through SPEC-030, SPEC-039, SPEC-040, SPEC-046, SPEC-047 — New capabilities beyond stabilization

**Eliminated**
- PROFITS Framework frontend trigger — The PROFITS Framework (extract-profits Edge Function) was built in Phase 7 but the frontend trigger was never wired. The entire PROFITS Framework is being dropped for v2.
- Coach collaboration features (COACH-01–03) — Eliminated when Bank/Vault architecture superseded the team/coach model

**Deferred**
- GROW-04: Slack Notification Action — Deferred per original CONTEXT.md decision
- GROW-01: Coach Partner/Affiliate Program — Deferred (coach model eliminated)

## Context

### Current State (post-v1)

**What's Live:**
- Full conversation intelligence platform with 14 RAG tools and inline citations
- Bank/Vault multi-tenant architecture with hard tenant isolation
- Vaults as first-class workspaces for team collaboration on call recordings
- YouTube vault type with thumbnail-first video UX and video detail modal
- Polar billing integration (Solo/Team/Business tiers)
- Remote MCP server at https://callvault-mcp.naegele412.workers.dev/mcp
- 80 v1 requirements shipped (70 complete, 1 Beta, 9 skipped/eliminated/deferred)

**Known Issues / Tech Debt:**
- YouTube import blocked by external runtime issues (YOUTUBE_DATA_API_KEY invalid, transcript provider billing 402)
- Google OAuth is Beta (requires Google Workspace, not fully E2E tested in production)
- TypeScript types need regeneration (`supabase gen types`) to remove `any` casts in useActiveTeam.ts
- Chat.tsx at 689 lines (target was <500 — accepted as essential orchestration logic)
- BankSwitcher.tsx has TODO comments for Create Bank / Manage Banks navigation
- Legacy teams/team-memberships Edge Functions still exist (superseded by banks)
- ALLOWED_ORIGINS env var must be set in Supabase production secrets
- ContentGenerator.tsx needs re-wiring to edge function (stubbed during Phase 1)

**Codebase:** ~112,743 lines TypeScript/React + Supabase Edge Functions (Deno)

**Tech Stack:**
- Frontend: React 18 + Vite, Zustand state, React Query, Vercel AI SDK (`useChat` hook)
- Backend: Supabase (PostgreSQL + Edge Functions on Deno)
- AI: Vercel AI SDK + OpenRouter (300+ models for chat), OpenAI (embeddings only)
- Billing: Polar
- MCP: Cloudflare Workers + Supabase OAuth 2.1
- Chat: Vercel AI SDK `streamText` on Deno, 14 RAG tools with zod schemas

### Architecture

**Bank/Vault Model (live since Phase 9):**
- Banks: Hard tenant isolation (personal vs business)
- Vaults: Collaborative workspaces within banks (team, coach, client, youtube types)
- Recordings: Live in one bank, VaultEntries enable multi-vault sharing
- Multi-tenant chat: Scoped to active bank/vault via hybrid_search_transcripts_scoped RPC

**Remote MCP (live since Phase 12):**
- Stateless Cloudflare Worker with per-request Supabase client factory
- Supabase OAuth 2.1 with Dynamic Client Registration
- 16 operations ported from local stdio to stateless Worker format
- Cursor-based pagination (no KV storage dependency)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vercel AI SDK + OpenRouter for Chat | Manual streaming is fragile, Vercel SDK handles tool orchestration reliably, OpenRouter is OpenAI-compatible | ✓ Chat works reliably — 14 tools fire consistently |
| Prioritize Chat → Security → Teams → Integrations | Chat is core value, security must come first, Teams/Coach needed for launch | ✓ Core value delivered |
| Defer UI polish to v2 | Button positioning doesn't block demos or functionality | ✓ 47 specs deferred, launch unblocked |
| Wire orphaned pages before building new | 652-909 lines of working code just needs routing | ✓ All pages accessible |
| Bank/Vault architecture over Teams | Teams model couldn't support multi-tenant isolation needed for business accounts | ✓ Hard isolation with collaborative vaults |
| PROFITS Framework dropped | Backend built, no frontend trigger ever implemented; framework eliminated for v2 | — Pending v2 direction |
| Stateless Cloudflare Workers for MCP | Simpler Supabase JWT integration without OAuthProvider adapter; DurableObjects billing avoided | ✓ Worker live and responding |
| Per-request Supabase client (not setSession) | Workers runtime lacks browser storage; setSession triggers those code paths | ✓ Clean per-request auth |
| Cursor-based pagination for MCP | Eliminates KV namespace infrastructure dependency for initial deployment | ✓ Deployed without KV |
| createMcpServer factory per-request | No shared state between requests; isolated server with user's supabase client | ✓ Stateless Worker architecture |
| Coach feature eliminated | Bank/Vault architecture superseded team/coach model; coach features never used | ✓ Codebase simplified |
| maxSteps over stopWhen/stepCountIs for streamText | Simpler API, well-documented, same behavior | ✓ Established chat pattern |
| SECURITY DEFINER + role check for admin RPC | Admin-only aggregation needs to bypass RLS but still verify caller role | ✓ Pattern for admin-only functions |
| Decimal phase numbering for insertions | Clear insertion semantics without renumbering existing phases | ✓ 3.1, 3.2, 10.2, 10.3 inserted cleanly |

---
*Last updated: 2026-02-21 after v1 milestone completion*
