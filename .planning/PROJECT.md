# Callvault (brain)

## What This Is

Callvault is a private transcript library and intelligence platform for sales teams and organizations. Users import meeting recordings from Fathom, Zoom, YouTube, or file upload, then browse, search, filter, and analyze their call library. All data is org-scoped — each user belongs to an organization and should only ever see data within that org.

## Core Value

A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.

## Current Milestone: v2.1 MCP Production Infrastructure

**Goal:** Production-grade MCP servers that auto-provision per org, expose full CRUD + AI tools, and are gated to PRO plan or higher — ready for customers to connect on day one.

**Target features:**
- Auto-provisioning: MCP server created automatically when an org is created (PRO+ only)
- Per-org isolation: Each MCP server only accesses data within its org
- Full CRUD tools: Search transcripts, list/filter calls, organize (folders, tags, notes), get call details
- AI-powered tools: Summarize calls, extract action items, cross-call queries, sentiment/coaching analysis
- Plan gating: MCP access enforced at PRO tier or higher via Polar billing
- Management UI: Settings section for MCP connection details, token regeneration, capability toggles
- Optional global MCP: Cross-org MCP for unified access (stretch goal)
- Reliable on-demand provisioning at scale

## Previous: v2.0 Shipped

**v2.0 Launch Readiness** completed 2026-03-30. 8 phases, 21 plans, 51/53 requirements satisfied.

**What shipped:**
- Org segregation with complete data isolation per org
- 4-pane layout enforced across all pages
- All 4 import sources functional (Fathom, Zoom, YouTube, Upload)
- Drag-to-folder and global search (Cmd+K)
- Onboarding wizard E2E working
- 4-role workspace membership (Owner/Admin/Contributor/Member)
- Email + shareable link invites
- Polar billing with cancel, AI usage display, and tier enforcement
- MCP server per org with OAuth consent

**Known tech debt:** PAY-05 partial (2 AI features ungated), MCP-04 operational config, 13 human verification items deferred.

## Requirements

### Validated

- ✓ Transcript import from Fathom, Zoom, YouTube, file upload — v1.0
- ✓ Transcript library table with pagination — v1.0
- ✓ Folder hierarchy (workspace + personal) — v1.0
- ✓ Tag management (org + user level) — v1.0
- ✓ URL-based filter state persistence — v1.0
- ✓ Analytics filter bar (time range, chart toggles) — v1.0
- ✓ Global search modal — v1.0

### Active

- [ ] MCP server auto-provisions when org is created (PRO+ plan required)
- [ ] Each MCP server scoped to its org — complete data isolation
- [ ] MCP CRUD tools: search transcripts, list/filter calls, organize (folders, tags, notes), get call details
- [ ] MCP AI tools: summarize calls, extract action items, cross-call queries, sentiment/coaching analysis
- [ ] Plan gating: MCP access enforced at PRO tier or higher via Polar billing
- [ ] MCP management UI in settings: connection details, token regeneration, capability toggles
- [ ] Optional global MCP for cross-org unified access (stretch)
- [ ] On-demand provisioning reliable at scale — no manual intervention

### Out of Scope

- Real-time collaboration features — future milestone
- Mobile native app — future milestone
- Cross-org admin view — not for this milestone
- Import from other users as a source (like Fathom/Zoom import but for shared calls) — future idea captured
- Ownership transfer — future idea captured
- MCP marketplace / third-party tool integrations — future milestone
- MCP rate limiting / usage analytics dashboard — future milestone (basic gating is in scope)

## Context

- **Stack:** React 18 + TypeScript + Vite + Supabase + Zustand + TanStack Query
- **4-Pane Architecture:** Sidebar (Pane 1, nav) → List (Pane 2, selection/search) → Workspace (Pane 3, main work area) → Detail (Pane 4, config/preview). Complex items → modal. Similar to Microsoft Loop layout.
- **Org model:** GoHighLevel-style subaccounts. Complete data isolation per org. Only shared: user identity + connected accounts (Fathom, Zoom, etc.)
- **Workspace roles:** Owner (full control) > Admin (owner-equivalent, added by owner) > Contributor (can add/route calls, calls permanently copied to owner) > Member (read/organize, removable with retention decision)
- **Filter state:** URL params via `filtersToURLParams()` / `urlParamsToFilters()` in `filter-utils.ts`
- **Filter components:** `FilterBar.tsx` aggregates TagFilterPopover, FolderFilterPopover, ContactsFilterPopover, DurationFilterPopover, SourceFilterPopover
- **Org context:** `useOrgContext` hook — org_id must be passed to all queries
- **Known issues:** Fathom import UI broke during updates, filter popovers missing org_id, filters don't stack, advanced settings non-functional
- **E2E tests exist** at `e2e/` using Playwright (port 3001)

## Constraints

- **Tech stack:** React + TypeScript — no framework changes
- **Backend:** Supabase only — no alternative DB
- **Org isolation:** All queries MUST include org_id filter — this is a hard security requirement
- **Test coverage:** Every fix must have a corresponding Playwright test

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix in-place vs rebuild filter system | Rebuild would take too long; fix existing architecture | — Pending |
| URL param persistence kept | Working feature, just needs org scoping | — Pending |
| v1.1 absorbed into v2.0 | Filter/sort hardening is needed for launch but not the whole story — broader launch readiness milestone replaces it | ✓ Good |
| Org model = GoHighLevel subaccounts | Complete isolation per org, only shared: user identity + connected accounts | — Pending |
| 4 workspace roles | Owner > Admin > Contributor > Member — industry standard, clarity over clever | — Pending |
| Contributor role (not Manager/Team) | Emphasizes what they DO (contribute calls), less ambiguous than Manager | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 — Milestone v2.1 MCP Production Infrastructure started*
