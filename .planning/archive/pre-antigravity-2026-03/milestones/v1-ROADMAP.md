# Milestone v1: Launch Stabilization

**Status:** ✅ SHIPPED 2026-02-21
**Phases:** 1–12 (including inserted phases 3.1, 3.2, 10.2, 10.3; Phase 11 eliminated)
**Total Plans:** 93

## Overview

Stabilize CallVault for public launch by fixing core chat reliability, enabling collaboration features, wiring orphaned functionality, and building the Bank/Vault multi-tenant architecture. This milestone prioritized the core value (reliable conversation intelligence) before polishing demos and shipping differentiators, then extended into a full architectural overhaul and remote MCP deployment.

Started as 9 phases, grew to 12 (+ 4 inserted gap-closure phases) as the work revealed deeper architectural needs.

---

## Phases

### Phase 1: Security Lockdown

**Goal:** All security vulnerabilities eliminated before touching core features
**Depends on:** None (prerequisite for everything)
**Plans:** 6 plans

Plans:
- [x] 01-01-PLAN.md — Delete dangerous code & secure test endpoints (SEC-01, SEC-02, SEC-03)
- [x] 01-02-PLAN.md — Replace PII logging & fix type safety bypasses (SEC-04, SEC-05)
- [x] 01-03-PLAN.md — CORS migration: Group B functions (14 functions, SEC-06 part 1)
- [x] 01-04-PLAN.md — CORS migration: Group C batch 1 (24 functions, SEC-06 part 2)
- [x] 01-05-PLAN.md — CORS migration: Group C batch 2 (23 functions, SEC-06 part 3)
- [x] 01-06-PLAN.md — Security audit & human verification

**Requirements delivered:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06

---

### Phase 2: Chat Foundation

**Goal:** Chat works reliably every single time with proper streaming and tool orchestration
**Depends on:** Phase 1
**Plans:** 12 plans (9 original + 3 gap closures)

Plans:
- [x] 02-01-PLAN.md — Proof-of-concept: streamText + tool on Deno Edge Function
- [x] 02-02-PLAN.md — Fix silent store failures (STORE-01: toast.error on 16 methods)
- [x] 02-03-PLAN.md — Extract search pipeline to shared modules
- [x] 02-04-PLAN.md — Tool call three-state transparency UI (success/empty/error)
- [x] 02-05-PLAN.md — Define all 14 RAG tools with zod schemas + system prompt
- [x] 02-06-PLAN.md — Frontend /chat2 test path for parallel development
- [x] 02-07-PLAN.md — Inline citations with hover preview + bottom source list
- [x] 02-08-PLAN.md — Streaming error handling, retry UX, connection stability
- [x] 02-09-PLAN.md — Switchover: /chat → v2, legacy rename, final verification
- [x] 02-10-PLAN.md — **[GAP FIX]** Call detail panel instead of popup dialog
- [x] 02-11-PLAN.md — **[GAP FIX]** Fix model hallucinating recording IDs
- [x] 02-12-PLAN.md — **[GAP FIX]** Error toast notifications + throttled logging

**Requirements delivered:** CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, STORE-01

---

### Phase 3: Integration OAuth Flows

**Goal:** Users can successfully connect their Zoom and Google accounts to import calls
**Depends on:** Phase 1, Phase 2
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Fix Zoom OAuth redirect URI mismatch (INT-01)
- [x] 03-02-PLAN.md — Verify both OAuth flows end-to-end (INT-01, INT-02, INT-03)

**Requirements delivered:** INT-01, INT-02 (Beta), INT-03

---

### Phase 3.1: Compact Integration UI (INSERTED)

**Goal:** Redesign integration cards to compact button/icon format with reusable connection modal
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [x] 03.1-01-PLAN.md — Core primitives (modal store + compact button component)
- [x] 03.1-02-PLAN.md — Composite components (connect modal + button group)
- [x] 03.1-03-PLAN.md — Wire up Sync page + visual verification

**Requirements delivered:** UI-INT-01, UI-INT-02, UI-INT-03

---

### Phase 3.2: Integration Import Controls (INSERTED)

**Goal:** Add Sources filter control to Sync page for toggling which integrations' meetings are shown
**Depends on:** Phase 3.1
**Plans:** 2 plans

Plans:
- [x] 03.2-01-PLAN.md — Database migration + useSyncSourceFilter hook
- [x] 03.2-02-PLAN.md — SourcesFilterPopover component + SyncTab integration

**Requirements delivered:** UI-INT-04, UI-INT-05, UI-INT-06

---

### Phase 4: Team Collaboration

**Goal:** Teams can be created, users can join teams, team switcher shows current context
**Depends on:** Phase 1, Phase 2
**Plans:** 6 plans

Plans:
- [x] 04-01-PLAN.md — Route registration + URL/expiry fixes (TEAM-02)
- [x] 04-02-PLAN.md — Multi-team support + UX simplification (TEAM-01)
- [x] 04-03-PLAN.md — Team context store + DB migration
- [x] 04-04-PLAN.md — Team switcher in header
- [x] 04-05-PLAN.md — Pending setup tracking for members
- [x] 04-06-PLAN.md — Automated E2E verification of full flow

**Requirements delivered:** TEAM-01, TEAM-02

---

### Phase 5: Demo Polish — Wiring, Fixes & UI Consistency

**Goal:** All built features are accessible, functional, and visually consistent
**Depends on:** Phases 1–4
**Plans:** 7 plans

Plans:
- [x] 05-01-PLAN.md — Route Automation Rules + fix CallDetailPage query (WIRE-01, IMPL-03)
- [x] 05-02-PLAN.md — Fix AutomationRules.tsx type mismatches (REFACTOR-04)
- [x] 05-03-PLAN.md — Runtime test & fix Tags/Rules/Analytics tabs (FIX-01, FIX-02, FIX-03)
- [x] 05-04-PLAN.md — Fix Users & Billing tabs (FIX-04, FIX-05)
- [x] 05-05-PLAN.md — Refactor bulk action toolbar to 4th pane (FIX-06)
- [x] 05-06-PLAN.md — Documentation for export & deduplication (DOC-01, DOC-02)
- [x] 05-07-PLAN.md — Automated verification via Playwright (all 12 requirements verified)

**Requirements delivered:** WIRE-01, WIRE-02, FIX-01–06, REFACTOR-04, IMPL-03, DOC-01, DOC-02

---

### Phase 6: Code Health & Infrastructure

**Goal:** Technical debt cleaned up, monolithic components refactored, types tightened, infrastructure hardened
**Depends on:** Phase 5
**Plans:** 10 plans

Plans:
- [x] 06-01-PLAN.md — Refactor Chat.tsx into sub-components and hooks (REFACTOR-01)
- [x] 06-02-PLAN.md — Write tests for extracted Chat components (TDD)
- [x] 06-03-PLAN.md — Tighten types in panelStore and SyncTab (REFACTOR-03, REFACTOR-06)
- [x] 06-04-PLAN.md — Consolidate deduplication and diversity filter (CLEAN-01, REFACTOR-07)
- [x] 06-05-PLAN.md — Delete dead code: Coach functions, TeamManagement (CLEAN-02)
- [x] 06-06-PLAN.md — Implement summarize-call and extract-action-items (IMPL-01)
- [x] 06-07-PLAN.md — Handle missing table references gracefully (IMPL-02)
- [x] 06-08-PLAN.md — Complete cost tracking with dashboard (INFRA-01)
- [x] 06-09-PLAN.md — Fix cron parsing with validation UI (INFRA-02)
- [x] 06-10-PLAN.md — Database-backed rate limiting (INFRA-03)

**Requirements delivered:** REFACTOR-01, REFACTOR-03, REFACTOR-06, REFACTOR-07, CLEAN-01, CLEAN-02, IMPL-01, IMPL-02, INFRA-01, INFRA-02, INFRA-03

---

### Phase 7: High-Value Differentiators

**Goal:** Unique features shipped that differentiate CallVault from generic transcription tools
**Depends on:** Phase 6
**Plans:** 6 plans

Plans:
- [x] 07-01-PLAN.md — PROFITS Framework extraction and report UI (DIFF-01)
- [x] 07-02-PLAN.md — Folder-Level Chat filtering (DIFF-02)
- [x] 07-03-PLAN.md — Real Analytics Data verification (DIFF-05)
- [x] 07-04-PLAN.md — Contacts Database schema and UI (DIFF-04)
- [x] 07-05-PLAN.md — Client Health Alerts with notifications (DIFF-03)
- [x] 07-06-PLAN.md — **[GAP FIX]** Wire email alerts + NotificationBell (DIFF-03 gaps)

**Requirements delivered:** DIFF-01, DIFF-02, DIFF-03, DIFF-04, DIFF-05

---

### Phase 8: Growth Infrastructure

**Goal:** Post-launch features enabled to support user acquisition and monetization
**Depends on:** Phase 7
**Plans:** 6 plans

Plans:
- [x] 08-01-PLAN.md — Polar billing schema and SDK client (GROW-02)
- [x] 08-02-PLAN.md — Polar Edge Functions for subscription lifecycle (GROW-02)
- [x] 08-03-PLAN.md — Polar billing UI and BillingTab integration (GROW-02)
- [x] 08-04-PLAN.md — YouTube import Edge Function (GROW-03)
- [x] 08-05-PLAN.md — YouTube import UI and ManualImport page (GROW-03)
- [x] 08-06-PLAN.md — Admin cost dashboard extension (GROW-05)

**Requirements delivered:** GROW-02, GROW-03, GROW-05

---

### Phase 9: Bank/Vault Architecture

**Goal:** Implement Bank/Vault architecture replacing teams — personal/team vault types with migration from fathom_calls
**Depends on:** Phase 4
**Plans:** 10 plans

Plans:
- [x] 09-01-PLAN.md — Eliminate all coach code (Edge Function, frontend, types)
- [x] 09-02-PLAN.md — Create banks and bank_memberships tables with RLS
- [x] 09-03-PLAN.md — Create vaults and vault_memberships tables with RLS
- [x] 09-04-PLAN.md — Create recordings and vault_entries tables with RLS
- [x] 09-05-PLAN.md — Update signup trigger + drop old team tables + update folders
- [x] 09-06-PLAN.md — Migration function for fathom_calls to recordings/vault_entries
- [x] 09-07-PLAN.md — Bank context store and useBankContext hook
- [x] 09-08-PLAN.md — Bank switcher UI in header
- [x] 09-09-PLAN.md — Banks & Vaults settings tab with vault management
- [x] 09-10-PLAN.md — Wire existing pages to use bank/vault context

**Requirements delivered:** BANK-01, BANK-02, BANK-03, BANK-04, BANK-05

---

### Phase 10: Chat Bank/Vault Scoping (Gap Closure)

**Goal:** Chat searches respect active bank/vault context for proper multi-tenant isolation
**Depends on:** Phase 9
**Plans:** 3 plans

Plans:
- [x] 10-01-PLAN.md — Pass bank_id/vault_id from frontend to chat-stream-v2
- [x] 10-02-PLAN.md — Filter chat searches by active bank/vault context
- [x] 10-03-PLAN.md — Verify multi-tenant isolation end-to-end

**Requirements delivered:** GAP-INT-01

---

### Phase 10.2: Vaults Page (INSERTED)

**Goal:** Make vaults a first-class sidebar page replacing "Collaboration" with full vault management
**Depends on:** Phase 10
**Plans:** 9 plans in 4 waves

Plans:
- [x] 10.2-01-PLAN.md — W1: Foundation — Route, sidebar, vault list pane, useVaults hook, query keys
- [x] 10.2-02-PLAN.md — W2: Vault detail — Recordings (no tabs), member slide-in panel, Recording→Meeting adapter
- [x] 10.2-03-PLAN.md — W2: Vault CRUD — Create/edit/delete dialogs + useVaultMutations
- [x] 10.2-07-PLAN.md — W2: Vault badges — VaultBadge/VaultBadgeList on CallDetailPage + TranscriptTable
- [x] 10.2-04-PLAN.md — W3: Member management — Shareable invite links (no email), roles, remove/leave
- [x] 10.2-05-PLAN.md — W3: Business bank creation — Both CTA and BankSwitcher entry points
- [x] 10.2-08-PLAN.md — W3: Search/filter — Search recordings within vaults by title, sort, date filter
- [x] 10.2-06-PLAN.md — W4: Polish — Empty states, error boundaries, settings migration, mobile verify
- [x] 10.2-09-PLAN.md — W4: Import vault selection — VaultSelector in YouTube import + SyncTab sync flow

**Requirements delivered:** VAULT-UI-01 through VAULT-UI-07

---

### Phase 10.3: YouTube-Specific Vaults & Video Intelligence (INSERTED)

**Goal:** Create dedicated YouTube vault type with thumbnail-first video UX, media-row list layout, video detail modal, and YouTube-scoped import + chat
**Depends on:** Phase 10.2
**Plans:** 6 plans in 3 waves

Plans:
- [x] 10.3-01-PLAN.md — W1: Foundation — DB migration, YouTube types, utilities, vault type configs
- [x] 10.3-02-PLAN.md — W2: YouTube Video List — Media-row components, sort hook, VaultDetailPane conditional rendering
- [x] 10.3-03-PLAN.md — W2: Import Flow — VaultSelector YouTube-only filtering, auto-create YouTube vault on first import
- [x] 10.3-04-PLAN.md — W3: Video Detail Modal — Dialog overlay with summary, collapsible description, transcript, click-to-start chat
- [x] 10.3-05-PLAN.md — [GAP FIX] Add YouTube vault type option in all create surfaces + regression tests
- [x] 10.3-06-PLAN.md — [GAP FIX] Unblock youtube-import 400 chain (status propagation, auth forwarding, deploy + re-UAT gate)

**Requirements delivered:** YT-01, YT-02, YT-03, YT-04, YT-05, YT-06

**Note:** External runtime blockers remain (YOUTUBE_DATA_API_KEY invalid, transcript provider billing 402). Import flow code is complete.

---

### Phase 11: PROFITS Frontend Trigger — ELIMINATED

**Status:** Eliminated. The PROFITS Framework backend (extract-profits Edge Function) was built in Phase 7 but the frontend trigger was never implemented. The PROFITS Framework is being dropped entirely for v2. No plans executed.

---

### Phase 12: Deploy CallVault MCP as Remote Cloudflare Worker with Supabase OAuth 2.1

**Goal:** Convert the local stdio CallVault MCP server into a hosted remote MCP server on Cloudflare Workers with Supabase OAuth 2.1 authentication
**Depends on:** None (independent separate codebase)
**Plans:** 5 plans in 4 waves

Plans:
- [x] 12-01-PLAN.md — W1: Project scaffolding, RequestContext type, per-request Supabase factory, Workers-compatible utils
- [x] 12-02-PLAN.md — W2: Thread RequestContext through all 16 handler operations (6 handler files + router)
- [x] 12-03-PLAN.md — W3: Worker entry point with createMcpServer, JWT auth middleware, CORS, well-known endpoints
- [x] 12-04-PLAN.md — W2: OAuth consent page in CallVault frontend (/oauth/consent route)
- [x] 12-05-PLAN.md — W4: Supabase dashboard setup, deploy to Cloudflare, MCP Inspector + client verification

**Requirements delivered:** MCP-REMOTE-01 through MCP-REMOTE-08

**Live URL:** https://callvault-mcp.naegele412.workers.dev/mcp

---

## Milestone Summary

### Key Decisions

- **Security first** — Eliminated API key exposure, unauthenticated endpoints, PII logging, wildcard CORS before any feature work
- **Vercel AI SDK + OpenRouter for chat** — Replaced fragile manual SSE streaming with proper tool orchestration
- **Bank/Vault architecture** — Replaced teams with hard tenant isolation (banks) + collaborative workspaces (vaults)
- **Phase numbering continuity** — Decimal phases (3.1, 3.2, 10.2, 10.3) for inserted work; no phase number restart
- **Coach feature eliminated** — Coach collaboration removed from scope (Phase 9 superseded with Bank/Vault)
- **Stateless Workers for MCP** — createMcpServer factory pattern over McpAgent/DurableObjects; cleaner Supabase JWT integration
- **Per-request Supabase client** — Workers runtime lacks browser storage; per-request auth without storage side effects

### Issues Resolved

- Chat working ~50% of time → 14 RAG tools firing reliably with proper tool orchestration
- Zoom OAuth redirect URI mismatch → Exact URI match with production credentials
- Team creation failing silently → Working with multi-team membership
- 4 orphaned pages with no routes → All wired and accessible
- Bank/vault chat scoping gap → chat-stream-v2 fully scoped to active bank/vault
- YouTube vault type missing from create surfaces → Exposed in all Hubs + Settings create flows

### Issues Deferred

- Google OAuth marked Beta (not fully E2E tested in production Workspace environment)
- YouTube import external blockers: YOUTUBE_DATA_API_KEY invalid, transcript provider billing 402
- Chat.tsx at 689 lines (target was <500, accepted as essential orchestration logic)
- BankSwitcher.tsx TODOs for Create Bank / Manage Banks navigation
- Legacy teams/team-memberships Edge Functions not cleaned up
- PROFITS Framework orphaned backend (extract-profits) — entire framework dropped for v2

### Technical Debt Incurred

- TypeScript types need regeneration (`supabase gen types`) to remove `any` casts in useActiveTeam.ts
- ContentGenerator.tsx needs re-wiring to edge function (stubbed during Phase 1)
- Stale config.toml entry for deleted test-env-vars function
- ALLOWED_ORIGINS env var must be set in Supabase production secrets
- MCP Worker uses cursor-based pagination (not KV-backed sessions) — clients pass offset param

---

*Archived: 2026-02-21 as part of v1 milestone completion*
*For current project status, see .planning/ROADMAP.md (created for next milestone)*
