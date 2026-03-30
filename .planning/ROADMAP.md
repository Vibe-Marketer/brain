# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- 🚧 **v2.0 Launch Readiness** - Phases 11-18 (in progress)

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

---

### 🚧 v2.0 Launch Readiness (In Progress)

**Milestone Goal:** Get CallVault actually shippable — fix what's broken, get every core flow working end-to-end. New user can sign up, connect call sources, and be productively using CallVault within minutes, with every piece of data strictly scoped to their organization.

- [x] **Phase 11: Org Segregation + 4-Pane Foundation** — Lock all data to org_id; codify 4-pane layout rules across all pages (completed 2026-03-30)
- [x] **Phase 12: Import Flows + Source Details** — Wire orphaned import detail components into Pane 2/3; show source-specific call metadata in detail view (completed 2026-03-30)
- [x] **Phase 13: Drag-to-Folder + Global Search** — Reconnect severed DnD and global search features (all code exists, wiring only) (completed 2026-03-30)
- [x] **Phase 14: Onboarding E2E** — Verify sign-up through first import works end-to-end; fix any gaps in the wizard flow (completed 2026-03-30)
- [ ] **Phase 15: Members & Roles** — Align to 4 roles; invite via email + link; remove members; workspace deletion; advanced settings
- [ ] **Phase 16: Filters & Sort** — Fix filter stacking, sort columns, inline search syntax (carried from v1.1)
- [ ] **Phase 17: Payments & Billing** — Add cancel button and usage display; verify Polar checkout + webhooks E2E
- [ ] **Phase 18: MCPs** — Verify MCP OAuth consent flow E2E; ensure org-scoped capabilities functional

---

## Phase Details

### Phase 11: Org Segregation + 4-Pane Foundation
**Goal**: Every data query is locked to the current org_id and the 4-pane layout hierarchy is enforced consistently across all major pages
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, PANE-01, PANE-02, PANE-03, PANE-04
**Success Criteria** (what must be TRUE):
  1. A user in Org A sees zero calls, folders, tags, or contacts from Org B in any view, filter popover, or search result
  2. User can switch between organizations they belong to and the entire UI re-scopes to the selected org
  3. Connected accounts (Fathom, Zoom) remain available after org switch; imported data belongs to the org it was imported into
  4. All major pages (Calls, Import, Members, Settings) follow the Sidebar->List->Workspace->Detail pane hierarchy with no overlapping or drawer-overlay patterns
  5. Complex items (call detail, setup wizards) open as modals; simple config/preview appears in Pane 4
**Plans**: 4 plans

Plans:
- [x] 11-01-PLAN.md — Org segregation: audit and enforce org_id on all service-layer queries
- [x] 11-02-PLAN.md — Org switch: full state reset, fade transition, redirect to Calls
- [x] 11-03-PLAN.md — Import page: convert to 4-pane layout with Pane 2 source navigation
- [x] 11-04-PLAN.md — 4-pane audit: CallDetailPage modal pattern, Analytics layout, modal vs Pane 4 rules

### Phase 12: Import Flows + Source Details
**Goal**: All four import sources are selectable in Pane 2 and show their detail UI in Pane 3, with connect/disconnect and failed-import retry working; call detail views show source-specific metadata
**Depends on**: Phase 11
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08, DETAIL-01
**Success Criteria** (what must be TRUE):
  1. Import page shows Fathom, Zoom, YouTube, and Upload as selectable items in Pane 2; selecting one loads its detail UI in Pane 3 without a full page reload
  2. Fathom: user can search recordings, select multiple, and trigger import — imported calls appear in the transcript library scoped to current org
  3. Zoom: user can search and import Zoom recordings; feature flag removed so all users can access Zoom import
  4. YouTube URL import and file upload dropzone both work and deliver imported calls to the library
  5. User can connect or disconnect each source from the import page; failed imports show with a retry option
  6. Call detail view shows source-specific metadata — Zoom meeting ID and participants, Fathom call data, YouTube video stats, or Upload file info — depending on the call's source
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — Wire Fathom/Zoom import detail UIs into Pane 3; add connect/disconnect header bars; surface failed imports in overview
- [x] 12-02-PLAN.md — Add Source Info section to call detail modal with per-source metadata rendering

### Phase 13: Drag-to-Folder + Global Search
**Goal**: Users can drag calls into folders from the transcript table and open a working global search modal — both features existed in v1 and have all code assets; this phase is pure wiring
**Depends on**: Phase 11
**Requirements**: DND-01, DND-02, SEARCH-01, SEARCH-02
**Success Criteria** (what must be TRUE):
  1. User can drag a call row from the transcript table and drop it onto a folder in the sidebar; the call is assigned to that folder immediately
  2. The target folder highlights visually during an active drag to indicate it is a valid drop zone
  3. Cmd+K (and/or a nav trigger) opens the global search modal; the modal is functional with debounced search input
  4. Global search modal returns only results from the current org — calls, transcripts, and summaries — with no cross-org leakage
**Plans**: 2 plans

Plans:
- [x] 13-01-PLAN.md — Wire drag-to-folder: make TranscriptTableRow draggable, add DragOverlay to TranscriptsNew
- [x] 13-02-PLAN.md — Rebuild GlobalSearchModal with Cmd+K shortcut and search button wiring

### Phase 14: Onboarding E2E
**Goal**: A brand-new user can sign up, complete the onboarding wizard, connect at least one call source, and land in a correctly-rendered default workspace — entirely without assistance
**Depends on**: Phase 12
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03
**Success Criteria** (what must be TRUE):
  1. New user can sign up via email/password, Google OAuth, or magic link and is redirected into the onboarding wizard
  2. Onboarding wizard prompts the user to connect at least one call source and provides working connect flows for Fathom, Zoom, and YouTube
  3. After completing onboarding, user lands in their default workspace with the correct 4-pane layout and can immediately navigate to Calls, Import, or Members
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md — Fix ProtectedRoute auth-only guard, OnboardingModal connect buttons, and post-completion navigation
- [x] 14-02-PLAN.md — Visual E2E verification of complete onboarding flow via dev-browser

### Phase 15: Members & Roles
**Goal**: Workspace membership is fully functional — 4-role system enforced, invite via email and shareable link works, members can be removed, workspaces can be deleted, and advanced settings are functional
**Depends on**: Phase 11
**Requirements**: MEMBER-01, MEMBER-02, MEMBER-03, MEMBER-04, MEMBER-05, MEMBER-06, MEMBER-07, MEMBER-08, MEMBER-09, MEMBER-10, MEMBER-11, MEMBER-12
**Success Criteria** (what must be TRUE):
  1. Workspace shows four roles (Owner, Admin, Contributor, Member) with correct permission boundaries — Owner and Admin can manage all members; Contributor can add calls; Member has read/organize only
  2. Owner/Admin can invite a new member by email with role selection; invitee receives an email with a working join link
  3. Owner/Admin can generate a shareable invite link; anyone with the link can join as a Member (or specified role)
  4. Owner/Admin can remove a member; when removing a Member the system prompts for call retention decision
  5. Owner/Admin can change a member's role after invite; workspace deletion works for non-default workspaces; advanced settings panel in Pane 4 is functional; workspace creation with type selection works
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 15 to break down)

### Phase 16: Filters & Sort
**Goal**: All filter popovers stack with AND logic, individual pills remove cleanly, all sort columns work in both directions, and inline search syntax operators return only org-scoped results
**Depends on**: Phase 11
**Requirements**: FILTER-01, FILTER-02, FILTER-03, FILTER-04, FILTER-05
**Success Criteria** (what must be TRUE):
  1. Each filter popover (Tags, Folders, Contacts, Duration, Source, Date) applies and clears its own state without affecting other active filters
  2. Multiple filters active simultaneously produce an AND-narrowed result set; removing any single pill leaves the others intact
  3. All five sort columns (Title, Date, Duration, Participants, Source) toggle asc/desc with a visible direction indicator; sort applies to the currently-filtered result set
  4. Inline search syntax operators (participant:, tag:, folder:, source:, duration:, date:, status:) parse correctly and return only current-org results
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 16 to break down)

### Phase 17: Payments & Billing
**Goal**: All three plan tiers display correctly, users can upgrade and cancel, trial works for new signups, AI usage is visible and enforced, and Polar webhooks process subscription events reliably
**Depends on**: Phase 11
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07
**Success Criteria** (what must be TRUE):
  1. Billing settings page shows Free, Pro, and Team plans with correct pricing; user's current plan is clearly indicated
  2. User can upgrade from Free to Pro or Team via Polar checkout and the plan change reflects immediately after webhook processing
  3. New signups automatically receive a 14-day Pro trial; user can cancel their subscription from billing settings without leaving the app
  4. Current AI usage and credit count are visible in billing settings; AI features are blocked or degraded when tier limits are reached
  5. Polar webhooks process subscription events correctly (new subscription, cancellation, renewal) — verified via test event replay
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 17 to break down)

### Phase 18: MCPs
**Goal**: Each organization can issue one MCP server that is strictly scoped to org data, capable of reading calls and searching, with a working OAuth consent flow
**Depends on**: Phase 11
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04
**Success Criteria** (what must be TRUE):
  1. Organization settings page allows issuing one MCP server per org; attempting to create a second is blocked
  2. MCP OAuth consent page loads, displays correct org-scoped permissions, and completing consent grants a working token
  3. An MCP client authenticated with the org token can read calls, search transcripts, and perform core operations — and cannot access data from any other org
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 18 to break down)

---

## Progress

**Execution Order:** 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18
(Note: Phases 13, 15, 16, 17, 18 all depend on Phase 11 and can run in parallel after Phase 11 completes. Phase 14 requires Phase 12.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. Sort/Filter Hardening | v1.1 | - | Absorbed into v2.0 | - |
| 11. Org Segregation + 4-Pane Foundation | v2.0 | 4/4 | Complete    | 2026-03-30 |
| 12. Import Flows + Source Details | v2.0 | 2/2 | Complete    | 2026-03-30 |
| 13. Drag-to-Folder + Global Search | v2.0 | 2/2 | Complete    | 2026-03-30 |
| 14. Onboarding E2E | v2.0 | 2/2 | Complete    | 2026-03-30 |
| 15. Members & Roles | v2.0 | 0/TBD | Not started | - |
| 16. Filters & Sort | v2.0 | 0/TBD | Not started | - |
| 17. Payments & Billing | v2.0 | 0/TBD | Not started | - |
| 18. MCPs | v2.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-15 — v1.1 Sort/Filter Hardening*
*Updated: 2026-03-30 — v2.0 Launch Readiness phases 11-17 added*
*Updated: 2026-03-30 — v2.0 regenerated for 44 requirements: Phase 12 absorbs DETAIL-01; Phase 13 added for DND + SEARCH; Phase 18 renumbers from 17; FILTER renumbered 01-05*
*Updated: 2026-03-30 — Phase 11 planned: 4 plans in 2 waves*
*Updated: 2026-03-30 — Phase 12 planned: 2 plans in 1 wave (parallel)*
*Updated: 2026-03-30 — Phase 13 planned: 2 plans in 1 wave (parallel)*
*Updated: 2026-03-30 — Phase 14 planned: 2 plans in 2 waves*
