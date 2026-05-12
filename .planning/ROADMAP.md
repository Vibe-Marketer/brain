# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- ✅ **v2.0 Launch Readiness** - Phases 11-18 (shipped 2026-03-30)
- ✅ **v2.1 MCP Production Infrastructure** - Phases 19-27 (shipped 2026-05-08) — see [milestones/v2.1-ROADMAP.md](./milestones/v2.1-ROADMAP.md)
- ✅ **v2.2 Security Hardening & UI Polish** - Phases 29-41 (shipped 2026-05-12) — see [milestones/v2.2-ROADMAP.md](./milestones/v2.2-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Foundation - SHIPPED (pre-GSD, no phase plans)</summary>

Transcript library, filter bar, sorting, global search, URL persistence, folder/tag management, and Playwright infrastructure all shipped. Known issues carried forward into v1.1.

</details>

<details>
<summary>✅ v1.1 Sort/Filter Hardening - ABSORBED INTO v2.0</summary>

Phases 1-10 defined for filter/sort hardening. Milestone absorbed into v2.0 Launch Readiness — all filter/sort requirements carried forward as FILTER-01 through FILTER-05 in v2.0.

Phases 7-10 were stub phases (Drag-to-Folder, YouTube Workspace UI, Global Search/Notifications, Raw Call Details) — never planned, absorbed into v2.0 scope as needed.

</details>

<details>
<summary>✅ v2.0 Launch Readiness - SHIPPED (2026-03-30)</summary>

8 phases (11-18), 21 plans, 53 requirements. Org segregation, 4-pane layout, import flows, drag-to-folder, global search, onboarding E2E, members & roles, filters & sort, payments & billing, MCPs. See `milestones/v2.0-ROADMAP.md` for full details.

**Known tech debt:** 2 partial requirements (PAY-05 AI gate incomplete, MCP-04 operational config), 13 deferred human verification items.

</details>

<details>
<summary>✅ v2.1 MCP Production Infrastructure - SHIPPED 2026-05-08</summary>

9 phases (19-27), 16 plans, 26 active requirements satisfied + 5 WS reqs traced. Production-grade MCP server with auto-provisioning, plan gating, full read/write/AI/admin tool surface (41 tools), per-token capability toggles, vanity domain at api.callvaultai.com, paste-source recording flow, workspace_type retirement. 311 automated tests across 20 test files (Nyquist coverage for phases 19, 21-25). See `milestones/v2.1-ROADMAP.md` for full details.

**Phase highlights:**
- [x] Phase 19: Provisioning Foundation (auto-provision, plan gating, token regeneration)
- [x] Phase 20: Read CRUD Tools (17 read tools, backfilled)
- [x] Phase 21: Write CRUD Tools (17 write tools incl. create_note + call_notes table)
- [x] Phase 22: AI Tools (4 LLM tools: extract_action_items, ask_call, get_sentiment, get_coaching_notes)
- [x] Phase 23: Management UI (per-token capability toggles, dynamic categorized tool list)
- [x] Phase 24: Fathom Share-Link Save (paste-source recording flow, zero outbound HTTP)
- [x] Phase 25: Workspace Type Retirement (is_default + member_count derivations, drag-and-drop reorder)
- [x] Phase 26: MCP Polish (vanity domain api.callvaultai.com via Cloudflare Worker, UI cleanup)
- [x] Phase 27: v2.1 Audit Close-out (PROV-02 re-enabled, types regen, RPC fix, REQUIREMENTS traceability)

**Deferred to v2.2 backlog:** Phase 28 Security Hardening (3 Critical / 6 High findings from 2026-05-07 audit), MCP search_calls full_transcript scope, destructive-tools UAT, free-tier user live UAT.

</details>

<details>
<summary>✅ v2.2 Security Hardening & UI Polish - SHIPPED 2026-05-12</summary>

13 phases (29-41), 73 v2.2 requirements + 22 QA-NN findings + 3 v2.0/v2.1 DEBT items rolled in (95/95 satisfied). UUID/Legacy-ID root cause closed (BUG-01), full auth/signup flow with external pricing redirect + payment gate, public shared-call landing with Loom-style state machine, canonical selection-state primitive across 5 surfaces, complete edge function security hardening (SEC-06..12 + 26 functions migrated to `_shared/auth.ts` + 39 orphans deleted), frontend security audit with CI-enforced RLS regression test, Fathom mirror with daily reconcile cron (p95 154ms — 10-45× speedup), Fathom re-import preserving UUID/workspace/tags, and full v2.0/v2.1 tech debt closure. See `milestones/v2.2-ROADMAP.md` for full details.

**Phase highlights:**
- [x] Phase 29: QA Sweep & Regression Catalog — 22 QA-NN entries
- [x] Phase 30: UUID / Legacy-ID Root-Cause Fix — BUG-01 closed, 91 orphan rows backfilled
- [x] Phase 31: Auth, Signup & Payment Gate — external pricing flow + grandfathered column
- [x] Phase 32: Shared-Call Public Landing Page — WRONG_RECIPIENT signal + Loom-style landing + free-tier signup
- [x] Phase 33: Selection State System — `<SelectionButton>` canonical primitive across 5 surfaces
- [x] Phase 34: Sidebar, Layout & Brand Polish — emoji→Remix + UPPERCASE + per-route top-bar title
- [x] Phase 35: Table, Filters & DND Cleanup — Folders column dual-key, DND target enlarged
- [x] Phase 36: Critical Bug Sweep — atomic set_default_workspace RPC, cache invalidation, date sort, DialogDescription a11y
- [x] Phase 37: Edge Function Security Hardening — SEC-06..12 closed, OAUTH_ENCRYPTION_KEY pattern, 39 orphans deleted (77→38)
- [x] Phase 38: Frontend Security & RLS Audit — npm audit clean, RLS CI gate, 34/34 service-role rationale
- [x] Phase 39: Fathom Mirror — pg_cron daily reconcile + new-user backfill + p95 154ms benchmark
- [x] Phase 40: Fathom Re-import / Overwrite — refresh button with preservation invariants
- [x] Phase 41: v2.0 / v2.1 Tech Debt Closure — DEBT-01/02/03 closed (16 items audited)

**Operator-action items (documented handoffs, not gaps):** `OAUTH_ENCRYPTION_KEY` + `SELECT encrypt_existing_oauth_tokens(...)`; `RECONCILE_SECRET` env + DB setting; `VITE_POLAR_FREE_PRODUCT_ID` in Vercel; `callvaultai.com/pricing/` marketing page (returns 404); Resend DNS; Polar webhook dashboard config; Supabase OAuth 2.1 provider dashboard.

**Tech debt (routed to v2.3 backlog):** 17 items including `generate-content` latent createClient bug, esbuild/vite moderate npm-audit findings, QA-14 Call Detail Pane 4 refactor (resolved: modal stays canonical), SEC-08 streaming uploads, edge-function `_shared` unit tests, 15 legacy debug-session markers, 7 unfinished quick-task drafts.

</details>

---

*Last updated: 2026-05-12 — v2.2 milestone closed.*
