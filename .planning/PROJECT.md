# Callvault (brain)

## What This Is

Callvault is a private transcript library and intelligence platform for sales teams and organizations. Users import meeting recordings from Fathom, Zoom, YouTube, or file upload, then browse, search, filter, and analyze their call library. All data is org-scoped — each user belongs to an organization and should only ever see data within that org.

## Core Value

A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.

## Current Milestone: v2.2 Security Hardening & UI Polish

**Goal:** Close every known production bug, complete remaining security audit items, and ship 3 backlog features so v2.2 is a clean, secure foundation before the next feature push.

**Target features:**
- Auth/signup actually works end-to-end (Google + email + payment gate)
- Shared-call public landing page (Loom-style, no bare signin wall)
- Root-cause fix for UUID/legacy-ID confusion (unblocks auto-AI-tags + Folders column in one shot)
- Standardized selection-state system across sidebar, panes, tabs, modals
- Sidebar reorder + caps + brand polish
- Table & filter cleanup (remove Shared/Folder/Duration filters, fix Contacts + Source, fix sort + cache invalidation)
- Settings > Organizations rework (dropdown selector, org-info header, workspace-update 406 fix)
- DND stability (position-stable, enlarged drag target)
- Imports UI wiring (manual paste/upload entry point, history + add buttons, whole-card clicks)
- Comprehensive security audit (edge functions, RLS, frontend, dependencies)
- Edge Function orphan cleanup (39 dead functions removed from prod)
- Backlog features: Fathom Mirror (instant search) + Fathom re-import/overwrite
- v2.0/v2.1 tech debt closure (PAY-05, MCP-04, 13 deferred verification items)
- QA sweep regression catalog (dev-browser walkthrough of full app)

## Previous: v2.1 Shipped

**v2.1 MCP Production Infrastructure** completed 2026-05-08. 9 phases (19-27), 16 plans, 41 MCP tools, vanity domain, paste-source flow, workspace-type retirement.

**What shipped:** Auto-provisioning MCP per org (PRO+), 17 read tools, 17 write tools incl. notes, 4 AI tools, per-token capability toggles, vanity domain api.callvaultai.com, Fathom share-link paste flow, drag-and-drop workspace reorder.

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

### Validated (v2.1)

- ✓ MCP server auto-provisions per org (PRO+ plan gated) — v2.1
- ✓ Per-org isolation enforced on every MCP tool — v2.1
- ✓ 17 read CRUD tools + 17 write tools + 4 AI tools shipped (41 total) — v2.1
- ✓ Per-token capability toggles in Settings — v2.1
- ✓ Vanity domain api.callvaultai.com via Cloudflare Worker — v2.1
- ✓ Fathom share-link paste flow (zero outbound HTTP to fathom.video) — v2.1
- ✓ Workspace-type retirement (is_default + member_count derivations) — v2.1

### Active (v2.2)

**Auth & Signup (front-door, highest priority)**
- [ ] AUTH-01 — Signup works end-to-end for Google + email accounts
- [ ] AUTH-02 — Pricing/plan selection page shown before account creation
- [ ] AUTH-03 — Payment gate enforced before onboarding (no free bypass)
- [ ] AUTH-04 — Helpful error messages on signup failure (not "unexpected error")

**Shared-Call Public Surface**
- [ ] SHARE-01 — Loom-style shared-call landing page replaces bare signin
- [ ] SHARE-02 — Wrong-account error explains which email was authorized (not "call not found")
- [ ] SHARE-03 — Share Call modal visual cleanup (remove artifact borders, broken icons)

**Critical Root-Cause Bugs**
- [ ] BUG-01 — UUID/legacy-ID fix (root cause for auto-AI-tags broken + Folders column blank)
- [ ] BUG-02 — Workspace update PATCH 406 fix (Failed to update workspace toast)
- [ ] BUG-03 — Call list cache invalidation on mutations (no manual refresh required)
- [ ] BUG-04 — Date sort chronological order (no Apr→Nov→Mar jumps)
- [ ] BUG-05 — Manual paste/upload transcript entry point exposed in UI
- [ ] BUG-06 — Import History button works
- [ ] BUG-07 — Import "+" button works
- [ ] BUG-08 — Auto-creation of Hall of Fame / Manager Reviews folders removed
- [ ] BUG-09 — Dialog accessibility (DialogDescription on all modals)

**Selection State System**
- [ ] VIS-01 — Canonical selection pattern (orange pill left, bold not italic, white/black icon bg + orange ring, gray highlight) applied to sidebar
- [ ] VIS-02 — Same pattern applied to 2nd-pane workspace selector
- [ ] VIS-03 — Same pattern applied to Settings tab list (replaces orange underline)
- [ ] VIS-04 — Same pattern applied to Call Detail modal tabs
- [ ] VIS-05 — Settings > Organizations org-tab strip replaced with 2nd-pane dropdown

**Sidebar & Brand Polish**
- [ ] BRAND-01 — Sidebar reorder: CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION
- [ ] BRAND-02 — All sidebar titles UPPERCASE
- [ ] BRAND-03 — Workspace title bold-only (remove italic)
- [ ] BRAND-04 — Org box top of 2nd pane fills full width with equal padding
- [ ] BRAND-05 — Header org selector width matches 2nd pane
- [ ] BRAND-06 — "ALL" link in Home 2nd pane darkened for visibility
- [ ] BRAND-07 — Doubled X close button fixed
- [ ] BRAND-08 — Global search box rounded corners + brand polish
- [ ] BRAND-09 — Memberships card spurious borders removed
- [ ] BRAND-10 — Settings > Organizations header shows selected org name + info

**Table & Filters**
- [ ] TABLE-01 — Shared column removed from 3rd pane
- [ ] TABLE-02 — Folders column always reflects assignment
- [ ] TABLE-03 — Standardized column alignment (left-aligned)
- [ ] FILTER-01 — Folder filter removed (redundant with 2nd pane)
- [ ] FILTER-02 — Duration filter removed
- [ ] FILTER-03 — Contacts filter queries full contacts DB (not just invitees)
- [ ] FILTER-04 — Source filter overflow + second row visibility fixed

**DND**
- [ ] DND-01 — Drag target position-stable regardless of selection state
- [ ] DND-02 — Drag target enlarged to left ⅓–½ of card

**Card Click Targets**
- [ ] CARD-01 — Whole workspace card clickable (not just chevron)
- [ ] CARD-02 — Same applied to org cards and any similar pattern

**Security Hardening**
- [ ] SEC-01 — 5 remaining Medium/Low items from 2026-05-07 audit closed
- [ ] SEC-02 — Fresh comprehensive edge-function audit
- [ ] SEC-03 — Frontend security review (XSS, secrets, npm audit)
- [ ] SEC-04 — RLS / database policy audit (org isolation defense-in-depth)
- [ ] SEC-05 — Edge Function orphan cleanup (39 dead functions removed from prod)

**Backlog Features**
- [ ] FEAT-01 — Fathom Mirror (read from `fathom_raw_calls` for instant search)
- [ ] FEAT-02 — Fathom re-import / overwrite existing calls

**Tech Debt**
- [ ] DEBT-01 — PAY-05 — gate the 2 remaining ungated AI features
- [ ] DEBT-02 — MCP-04 — operational config completed
- [ ] DEBT-03 — Close the 13 deferred v2.0 human-verification items

**Foundation**
- [ ] QA-01 — Full dev-browser QA sweep produces regression catalog (Phase 1 of v2.2)

### Out of Scope

- Real-time collaboration features — future milestone
- Mobile native app — future milestone
- Cross-org admin view — not for this milestone
- Import from other users as a source (like Fathom/Zoom import but for shared calls) — future idea captured
- Ownership transfer — future idea captured
- MCP marketplace / third-party tool integrations — future milestone
- MCP rate limiting / usage analytics dashboard — future milestone (basic gating is in scope)
- Public share-link option (no account required to view) — captured in BACKLOG, v2.3+
- "View without account" mode on shared-call landing page — captured in BACKLOG, v2.3+
- Markdown rendering throughout app surfaces — captured in BACKLOG, v2.3+

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
*Last updated: 2026-05-11 — Milestone v2.2 Security Hardening & UI Polish started*
