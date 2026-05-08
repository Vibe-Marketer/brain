# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- ✅ **v2.0 Launch Readiness** - Phases 11-18 (shipped 2026-03-30)
- ✅ **v2.1 MCP Production Infrastructure** - Phases 19-27 (shipped 2026-05-08) — see [milestones/v2.1-ROADMAP.md](./milestones/v2.1-ROADMAP.md)
- 📋 **v2.2** - TBD (run `/gsd-new-milestone` to define)

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

---

### 📋 v2.2 — Not Yet Planned

Run `/gsd-new-milestone` to define the next milestone via questioning → research → requirements → roadmap.

## Backlog

(empty — populated when v2.2 starts)

---

*Last updated: 2026-05-08 — v2.1 MCP Production Infrastructure shipped*
