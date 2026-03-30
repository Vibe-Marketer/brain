# Callvault (brain)

## What This Is

Callvault is a private transcript library and intelligence platform for sales teams and organizations. Users import meeting recordings from Fathom, Zoom, YouTube, or file upload, then browse, search, filter, and analyze their call library. All data is org-scoped — each user belongs to an organization and should only ever see data within that org.

## Core Value

A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.

## Current Milestone: v2.0 Launch Readiness

**Goal:** Get CallVault actually shippable — fix what's broken, get every core flow working end-to-end, no new complexity.

**Target features (priority order):**
1. Onboarding works end-to-end — new user sign up, connect Fathom/Zoom/YouTube
2. Imports functional — Fathom search/select/import (restore broken UI), Zoom, YouTube, uploads
3. 4-pane architecture rules codified — Sidebar→List→Workspace→Detail hierarchy enforced consistently
4. Org segregation — GoHighLevel-style subaccounts, complete data isolation per org
5. Workspace member management — email invites + shareable link, 4 roles (Owner/Admin/Contributor/Member), workspace deletion, advanced settings
6. MCPs — one per org, full org-scoped capabilities
7. Minimal AI chat — attach 1-3 transcripts, simple chat, uses credits

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

- [ ] New user can complete onboarding and connect at least one call source (Fathom, Zoom, YouTube, upload)
- [ ] Fathom import: search, select, and import calls (restore broken flow)
- [ ] Zoom, YouTube, and upload import flows functional
- [ ] 4-pane layout rules enforced: imports in Pane 2, workspace in Pane 3, detail/config in Pane 4, complex in modals
- [ ] Complete org segregation — all data, all queries, all views scoped to current org
- [ ] Workspace invites via email + shareable link
- [ ] 4 workspace roles: Owner, Admin, Contributor, Member with industry-standard permissions
- [ ] Contributor role: can route/add calls to workspace (permanently copied to owner's account)
- [ ] Member role: read/organize access, removable with call retention decision
- [ ] Workspace deletion functional
- [ ] Advanced settings panel functional
- [ ] Filters and sort working correctly (absorbed from v1.1)
- [ ] MCP per organization with full org-scoped capabilities
- [ ] Minimal AI chat: attach 1-3 transcripts, simple conversation, credit-based

### Out of Scope

- Real-time collaboration features — future milestone
- Mobile native app — future milestone
- Cross-org admin view — not for this milestone
- Import from other users as a source (like Fathom/Zoom import but for shared calls) — future idea captured
- Ownership transfer — future idea captured
- Advanced AI features beyond simple chat — future milestone

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
*Last updated: 2026-03-30 — Milestone v2.0 Launch Readiness started*
