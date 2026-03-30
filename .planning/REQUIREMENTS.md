# Requirements: CallVault — Launch Readiness

**Milestone:** v2.0 — Launch Readiness
**Defined:** 2026-03-30
**Core Value:** A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.

## v2.0 Requirements

### Onboarding

- [x] **ONBOARD-01**: New user can sign up (email, Google, or magic link) and land in onboarding wizard
- [x] **ONBOARD-02**: Onboarding wizard guides user to connect at least one call source (Fathom, Zoom, or YouTube)
- [x] **ONBOARD-03**: After onboarding, user lands in default workspace with correct 4-pane layout

### Imports

- [x] **IMPORT-01**: Import page lists sources (Fathom, Zoom, YouTube, Upload) in Pane 2 as selectable items
- [x] **IMPORT-02**: Selecting Fathom in Pane 2 shows search/select/import detail UI in Pane 3
- [x] **IMPORT-03**: Selecting Zoom in Pane 2 shows search/select/import detail UI in Pane 3
- [x] **IMPORT-04**: Selecting YouTube in Pane 2 shows URL import form in Pane 3
- [x] **IMPORT-05**: Selecting Upload in Pane 2 shows file upload dropzone in Pane 3
- [x] **IMPORT-06**: Zoom import enabled for all users (no feature flag)
- [x] **IMPORT-07**: User can connect/disconnect each source from the import page
- [x] **IMPORT-08**: Failed imports visible with retry capability

### 4-Pane Architecture

- [x] **PANE-01**: All major pages follow Sidebar→List→Workspace→Detail hierarchy
- [x] **PANE-02**: Import page uses Pane 2 for source list selection
- [x] **PANE-03**: Complex/dynamic items (call detail, setup wizards) open as modals
- [x] **PANE-04**: Pane 4 shows simple config/detail; complex items escalate to modal

### Org Segregation

- [x] **ORG-01**: All database queries filter by current org_id (no cross-org data leakage)
- [x] **ORG-02**: Filter popovers (Tags, Folders, Contacts, Duration, Source, Date) only show org-scoped data
- [x] **ORG-03**: Search (global modal + inline syntax) returns only current org results
- [x] **ORG-04**: User can switch between organizations they belong to
- [x] **ORG-05**: Connected accounts shared across orgs; imported data is org-scoped

### Drag-to-Folder

- [x] **DND-01**: User can drag a call from the transcript table and drop it onto a folder in the sidebar to assign it
- [x] **DND-02**: Drop target folder highlights with visual feedback during drag to indicate valid drop zone

### Call Details

- [x] **DETAIL-01**: Call detail view shows source-specific metadata (Zoom: meeting ID + participants; Fathom: call data; YouTube: video stats; Upload: file info)

### Global Search

- [x] **SEARCH-01**: Global search modal opens via keyboard shortcut (Cmd+K) and/or nav trigger — UI must be rebuilt (deleted in commit 2ae0e175)
- [x] **SEARCH-02**: Global search modal returns only current-org results with debounced search across titles, transcripts, and summaries

### Members & Roles

- [x] **MEMBER-01**: Owner has full control (manage members, delete workspace, manage all calls)
- [x] **MEMBER-02**: Admin has owner-equivalent permissions, added by owner
- [x] **MEMBER-03**: Contributor can route/add calls to workspace; calls permanently copied to owner's account
- [x] **MEMBER-04**: Member has read/organize access; on removal, owner decides call retention
- [x] **MEMBER-05**: Owner/Admin can invite via email with role selection
- [x] **MEMBER-06**: Invite generates shareable link (token-based)
- [x] **MEMBER-07**: Invited user can join via email link (new or existing account)
- [x] **MEMBER-08**: Owner/Admin can remove members from workspace
- [x] **MEMBER-09**: Owner/Admin can change member roles after initial invite
- [x] **MEMBER-10**: Non-default workspaces can be deleted
- [x] **MEMBER-11**: Advanced settings panel in Pane 4 is functional
- [x] **MEMBER-12**: Workspace creation with type selection works

### Filters & Sort

- [x] **FILTER-01**: All filter popovers correctly apply and clear state
- [x] **FILTER-02**: Multiple filters stack with AND logic
- [x] **FILTER-03**: Individual filter removal via pill without affecting others
- [x] **FILTER-04**: All sort columns work correctly in both directions with indicators
- [x] **FILTER-05**: Inline search syntax operators work (participant:, tag:, folder:, source:, duration:, date:, status:)

### Payments & Billing

- [x] **PAY-01**: Free/Pro/Team plans display correctly with pricing
- [ ] **PAY-02**: User can upgrade from Free to Pro or Team via Polar checkout
- [ ] **PAY-03**: 14-day Pro trial works for new signups
- [x] **PAY-04**: User can cancel subscription from billing settings
- [ ] **PAY-05**: AI usage limits enforced per tier (Free: 25, Pro: 1000, Team: 5000/month)
- [x] **PAY-06**: User can see current AI usage/credit count in billing settings
- [ ] **PAY-07**: Polar webhooks process subscription events correctly

### MCP

- [ ] **MCP-01**: Each organization can have one MCP server issued
- [ ] **MCP-02**: MCP server scoped to organization data only
- [ ] **MCP-03**: MCP can read calls, search, and perform core operations within org scope
- [ ] **MCP-04**: MCP OAuth consent flow works end-to-end

## Future Requirements (Post-Launch)

### AI Chat

- **CHAT-01**: User can open a simple chat interface
- **CHAT-02**: User can attach 1-3 call transcripts to the chat
- **CHAT-03**: User can converse about attached calls
- **CHAT-04**: Chat uses AI credits from user's tier allowance
- **CHAT-05**: User can add/remove transcripts from active chat

### YouTube Workspace UI

- **YT-01**: YouTube workspace type renders YouTubeVideoList instead of TranscriptTable
- **YT-02**: YouTube video detail modal fully functional (chat section removed, needs TODO resolution)

### Notifications

- **NOTIF-01**: Notification bell in app header with unread count badge
- **NOTIF-02**: Notification panel with list, mark-as-read, and delete actions

### Ideas

- **IDEA-01**: Import from other users as a source (like Fathom/Zoom import but for shared calls)
- **IDEA-02**: Ownership transfer for workspaces

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Future milestone |
| Mobile native app | Future milestone |
| Cross-org admin view | Breaks org isolation intentionally |
| Advanced AI features beyond simple chat | Post-launch |
| Stripe integration | Using Polar — Stripe keys are legacy |
| Payment history / invoices UI | Handled by Polar dashboard |
| Refund handling | Handled by Polar dashboard |
| Workspace types beyond personal/team | Schema exists, defer UI |
| YouTube workspace type UI | Post-launch (components 90% built, need integration point) |
| Notification bell + panel | Post-launch (hook + backend complete, UI deleted) |

## Implementation Context (from whats-next.md audit)

Key facts for planning — code state as of 2026-03-30:

| Feature | Existing Code | What's Needed |
|---------|--------------|---------------|
| Drag-to-Folder | DndCallProvider.tsx, FolderDropZone.tsx, useFolderAssignment.ts — ALL complete | 4 wiring points: wrap TranscriptTable, DraggableCallRow, FolderSidebar items |
| Fathom Import Detail | FathomImportDetail.tsx (265+ lines) — complete but orphaned | Wire into Pane 3 when Fathom selected in Pane 2 |
| Zoom Import Detail | ZoomImportDetail.tsx (280+ lines) — complete but orphaned | Wire into Pane 3 when Zoom selected in Pane 2; remove beta_zoom flag |
| Global Search Modal | useGlobalSearch.ts hook — complete | Rebuild modal UI (~200 lines) + Cmd+K shortcut; hook handles all data |
| Raw Call Details | raw-calls.service.ts — full per-source dispatcher | Build UI section in call detail view; per-source rendering (Zoom/Fathom/YouTube/Upload) |
| Commit 2ae0e175 | Mar 26 aggressive cleanup | Deleted GlobalSearchModal, NotificationBell, NotificationPanel, WorkspaceDetailPane (485 lines) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORG-01 | Phase 11 | Complete |
| ORG-02 | Phase 11 | Complete |
| ORG-03 | Phase 11 | Complete |
| ORG-04 | Phase 11 | Complete |
| ORG-05 | Phase 11 | Complete |
| PANE-01 | Phase 11 | Complete |
| PANE-02 | Phase 11 | Complete |
| PANE-03 | Phase 11 | Complete |
| PANE-04 | Phase 11 | Complete |
| IMPORT-01 | Phase 12 | Complete |
| IMPORT-02 | Phase 12 | Complete |
| IMPORT-03 | Phase 12 | Complete |
| IMPORT-04 | Phase 12 | Complete |
| IMPORT-05 | Phase 12 | Complete |
| IMPORT-06 | Phase 12 | Complete |
| IMPORT-07 | Phase 12 | Complete |
| IMPORT-08 | Phase 12 | Complete |
| DETAIL-01 | Phase 12 | Complete |
| DND-01 | Phase 13 | Complete |
| DND-02 | Phase 13 | Complete |
| SEARCH-01 | Phase 13 | Complete |
| SEARCH-02 | Phase 13 | Complete |
| ONBOARD-01 | Phase 14 | Complete |
| ONBOARD-02 | Phase 14 | Complete |
| ONBOARD-03 | Phase 14 | Complete |
| MEMBER-01 | Phase 15 | Complete |
| MEMBER-02 | Phase 15 | Complete |
| MEMBER-03 | Phase 15 | Complete |
| MEMBER-04 | Phase 15 | Complete |
| MEMBER-05 | Phase 15 | Complete |
| MEMBER-06 | Phase 15 | Complete |
| MEMBER-07 | Phase 15 | Complete |
| MEMBER-08 | Phase 15 | Complete |
| MEMBER-09 | Phase 15 | Complete |
| MEMBER-10 | Phase 15 | Complete |
| MEMBER-11 | Phase 15 | Complete |
| MEMBER-12 | Phase 15 | Complete |
| FILTER-01 | Phase 16 | Complete |
| FILTER-02 | Phase 16 | Complete |
| FILTER-03 | Phase 16 | Complete |
| FILTER-04 | Phase 16 | Complete |
| FILTER-05 | Phase 16 | Complete |
| PAY-01 | Phase 17 | Complete |
| PAY-02 | Phase 17 | Pending |
| PAY-03 | Phase 17 | Pending |
| PAY-04 | Phase 17 | Complete |
| PAY-05 | Phase 17 | Pending |
| PAY-06 | Phase 17 | Complete |
| PAY-07 | Phase 17 | Pending |
| MCP-01 | Phase 18 | Pending |
| MCP-02 | Phase 18 | Pending |
| MCP-03 | Phase 18 | Pending |
| MCP-04 | Phase 18 | Pending |

**Coverage:**
- v2.0 requirements: 53 total (ONBOARD×3 + IMPORT×8 + PANE×4 + ORG×5 + DND×2 + DETAIL×1 + SEARCH×2 + MEMBER×12 + FILTER×5 + PAY×7 + MCP×4)
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 — Added DND, DETAIL, SEARCH requirements; split FILTER-05 into SEARCH category; deferred YouTube Workspace UI + Notifications*
*Updated: 2026-03-30 — Traceability populated; coverage corrected to 53 (actual count); all requirements mapped to phases 11-18*
