# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- 🚧 **v2.0 Launch Readiness** - Phases 11-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation - SHIPPED (pre-GSD, no phase plans)</summary>

Transcript library, filter bar, sorting, global search, URL persistence, folder/tag management, and Playwright infrastructure all shipped. Known issues carried forward into v1.1.

</details>

<details>
<summary>✅ v1.1 Sort/Filter Hardening - ABSORBED INTO v2.0</summary>

Phases 1-10 defined for filter/sort hardening. Milestone absorbed into v2.0 Launch Readiness — all filter/sort requirements carried forward as FILTER-01 through FILTER-06 in v2.0.

Phases 7-10 were stub phases (Drag-to-Folder, YouTube Workspace UI, Global Search/Notifications, Raw Call Details) — never planned, absorbed into v2.0 scope as needed.

</details>

---

### 🚧 v2.0 Launch Readiness (In Progress)

**Milestone Goal:** Get CallVault actually shippable — fix what's broken, get every core flow working end-to-end. New user can sign up, connect call sources, and be productively using CallVault within minutes, with every piece of data strictly scoped to their organization.

- [ ] **Phase 11: Org Segregation + 4-Pane Foundation** — Lock all data to org_id; codify 4-pane layout rules across all pages
- [ ] **Phase 12: Import Flows** — Wire orphaned import detail components into Pane 2/3 layout; all four sources functional
- [ ] **Phase 13: Onboarding E2E** — Verify sign-up through first import works end-to-end; fix any gaps in the wizard flow
- [ ] **Phase 14: Members & Roles** — Align to 4 roles; invite via email + link; remove members; workspace deletion; advanced settings
- [ ] **Phase 15: Filters, Sort & Search** — Fix filter stacking, sort columns, search org-scoping (carried from v1.1)
- [ ] **Phase 16: Payments & Billing** — Add cancel button and usage display; verify Polar checkout + webhooks E2E
- [ ] **Phase 17: MCPs** — Verify MCP OAuth consent flow E2E; ensure org-scoped capabilities functional

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
  4. All major pages (Calls, Import, Members, Settings) follow the Sidebar→List→Workspace→Detail pane hierarchy with no overlapping or drawer-overlay patterns
  5. Complex items (call detail, setup wizards) open as modals; simple config/preview appears in Pane 4
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 11 to break down)

### Phase 12: Import Flows
**Goal**: All four import sources (Fathom, Zoom, YouTube, Upload) are selectable in Pane 2 and show their detail UI in Pane 3, with connect/disconnect and failed-import retry working
**Depends on**: Phase 11
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08
**Success Criteria** (what must be TRUE):
  1. Import page shows Fathom, Zoom, YouTube, and Upload as selectable items in Pane 2; selecting one loads its detail UI in Pane 3 without a full page reload
  2. Fathom: user can search recordings, select multiple, and trigger import — imported calls appear in the transcript library scoped to current org
  3. Zoom: user can search and import Zoom recordings; feature flag removed so all users can access Zoom import
  4. YouTube URL import and file upload dropzone both work and deliver imported calls to the library
  5. User can connect or disconnect each source from the import page; failed imports show with a retry option
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 12 to break down)

### Phase 13: Onboarding E2E
**Goal**: A brand-new user can sign up, complete the onboarding wizard, connect at least one call source, and land in a correctly-rendered default workspace — entirely without assistance
**Depends on**: Phase 12
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03
**Success Criteria** (what must be TRUE):
  1. New user can sign up via email/password, Google OAuth, or magic link and is redirected into the onboarding wizard
  2. Onboarding wizard prompts the user to connect at least one call source and provides working connect flows for Fathom, Zoom, and YouTube
  3. After completing onboarding, user lands in their default workspace with the correct 4-pane layout and can immediately navigate to Calls, Import, or Members
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 13 to break down)

### Phase 14: Members & Roles
**Goal**: Workspace membership is fully functional — 4-role system enforced, invite via email and shareable link works, members can be removed, workspaces can be deleted, and advanced settings are functional
**Depends on**: Phase 11
**Requirements**: MEMBER-01, MEMBER-02, MEMBER-03, MEMBER-04, MEMBER-05, MEMBER-06, MEMBER-07, MEMBER-08, MEMBER-09, MEMBER-10, MEMBER-11, MEMBER-12
**Success Criteria** (what must be TRUE):
  1. Workspace shows four roles (Owner, Admin, Contributor, Member) with correct permission boundaries — Owner and Admin can manage all members; Contributor can add calls; Member has read/organize only
  2. Owner/Admin can invite a new member by email with role selection; invitee receives an email with a working join link
  3. Owner/Admin can generate a shareable invite link; anyone with the link can join as a Member (or specified role)
  4. Owner/Admin can remove a member; when removing a Member the system prompts for call retention decision
  5. Owner/Admin can change a member's role after invite; workspace deletion works for non-default workspaces; advanced settings panel in Pane 4 is functional
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 14 to break down)

### Phase 15: Filters, Sort & Search
**Goal**: All filter popovers stack with AND logic, individual pills remove cleanly, all sort columns work in both directions, and search returns only org-scoped results
**Depends on**: Phase 11
**Requirements**: FILTER-01, FILTER-02, FILTER-03, FILTER-04, FILTER-05, FILTER-06
**Success Criteria** (what must be TRUE):
  1. Each filter popover (Tags, Folders, Contacts, Duration, Source, Date) applies and clears its own state without affecting other active filters
  2. Multiple filters active simultaneously produce an AND-narrowed result set; removing any single pill leaves the others intact
  3. All five sort columns (Title, Date, Duration, Participants, Source) toggle asc/desc with a visible direction indicator; sort applies to the currently-filtered result set
  4. Main search bar, global search modal, and all inline syntax operators (participant:, tag:, folder:, source:, duration:, date:, status:) return only current-org results
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 15 to break down)

### Phase 16: Payments & Billing
**Goal**: All three plan tiers display correctly, users can upgrade and cancel, trial works for new signups, AI usage is visible and enforced, and Polar webhooks process subscription events reliably
**Depends on**: Phase 11
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07
**Success Criteria** (what must be TRUE):
  1. Billing settings page shows Free, Pro, and Team plans with correct pricing; user's current plan is clearly indicated
  2. User can upgrade from Free to Pro or Team via Polar checkout and the plan change reflects immediately after webhook processing
  3. New signups automatically receive a 14-day Pro trial; user can cancel their subscription from billing settings without leaving the app
  4. Current AI usage and credit count are visible in billing settings; AI features are blocked or degraded when tier limits are reached
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 16 to break down)

### Phase 17: MCPs
**Goal**: Each organization can issue one MCP server that is strictly scoped to org data, capable of reading calls and searching, with a working OAuth consent flow
**Depends on**: Phase 11
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04
**Success Criteria** (what must be TRUE):
  1. Organization settings page allows issuing one MCP server per org; attempting to create a second is blocked
  2. MCP OAuth consent page loads, displays correct org-scoped permissions, and completing consent grants a working token
  3. An MCP client authenticated with the org token can read calls, search transcripts, and perform core operations — and cannot access data from any other org
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 17 to break down)

---

## Progress

**Execution Order:** 11 → 12 → 13 → 14 → 15 → 16 → 17
(Note: Phases 14 and 15 both depend on Phase 11 and can run in parallel after Phase 11 completes.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10. Sort/Filter Hardening | v1.1 | - | Absorbed into v2.0 | - |
| 11. Org Segregation + 4-Pane Foundation | v2.0 | 0/TBD | Not started | - |
| 12. Import Flows | v2.0 | 0/TBD | Not started | - |
| 13. Onboarding E2E | v2.0 | 0/TBD | Not started | - |
| 14. Members & Roles | v2.0 | 0/TBD | Not started | - |
| 15. Filters, Sort & Search | v2.0 | 0/TBD | Not started | - |
| 16. Payments & Billing | v2.0 | 0/TBD | Not started | - |
| 17. MCPs | v2.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-15 — v1.1 Sort/Filter Hardening*
*Updated: 2026-03-30 — v2.0 Launch Readiness phases 11-17 added*
