# Requirements: CallVault — Launch Readiness

**Milestone:** v2.0 — Launch Readiness
**Defined:** 2026-03-30
**Core Value:** A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.

## v2.0 Requirements

### Onboarding

- [ ] **ONBOARD-01**: New user can sign up (email, Google, or magic link) and land in onboarding wizard
- [ ] **ONBOARD-02**: Onboarding wizard guides user to connect at least one call source (Fathom, Zoom, or YouTube)
- [ ] **ONBOARD-03**: After onboarding, user lands in default workspace with correct 4-pane layout

### Imports

- [ ] **IMPORT-01**: Import page lists sources (Fathom, Zoom, YouTube, Upload) in Pane 2 as selectable items
- [ ] **IMPORT-02**: Selecting Fathom in Pane 2 shows search/select/import detail UI in Pane 3
- [ ] **IMPORT-03**: Selecting Zoom in Pane 2 shows search/select/import detail UI in Pane 3
- [ ] **IMPORT-04**: Selecting YouTube in Pane 2 shows URL import form in Pane 3
- [ ] **IMPORT-05**: Selecting Upload in Pane 2 shows file upload dropzone in Pane 3
- [ ] **IMPORT-06**: Zoom import enabled for all users (no feature flag)
- [ ] **IMPORT-07**: User can connect/disconnect each source from the import page
- [ ] **IMPORT-08**: Failed imports visible with retry capability

### 4-Pane Architecture

- [ ] **PANE-01**: All major pages follow Sidebar→List→Workspace→Detail hierarchy
- [ ] **PANE-02**: Import page uses Pane 2 for source list selection
- [ ] **PANE-03**: Complex/dynamic items (call detail, setup wizards) open as modals
- [ ] **PANE-04**: Pane 4 shows simple config/detail; complex items escalate to modal

### Org Segregation

- [ ] **ORG-01**: All database queries filter by current org_id (no cross-org data leakage)
- [ ] **ORG-02**: Filter popovers (Tags, Folders, Contacts, Duration, Source, Date) only show org-scoped data
- [ ] **ORG-03**: Search (global modal + inline syntax) returns only current org results
- [ ] **ORG-04**: User can switch between organizations they belong to
- [ ] **ORG-05**: Connected accounts shared across orgs; imported data is org-scoped

### Members & Roles

- [ ] **MEMBER-01**: Owner has full control (manage members, delete workspace, manage all calls)
- [ ] **MEMBER-02**: Admin has owner-equivalent permissions, added by owner
- [ ] **MEMBER-03**: Contributor can route/add calls to workspace; calls permanently copied to owner's account
- [ ] **MEMBER-04**: Member has read/organize access; on removal, owner decides call retention
- [ ] **MEMBER-05**: Owner/Admin can invite via email with role selection
- [ ] **MEMBER-06**: Invite generates shareable link (token-based)
- [ ] **MEMBER-07**: Invited user can join via email link (new or existing account)
- [ ] **MEMBER-08**: Owner/Admin can remove members from workspace
- [ ] **MEMBER-09**: Owner/Admin can change member roles after initial invite
- [ ] **MEMBER-10**: Non-default workspaces can be deleted
- [ ] **MEMBER-11**: Advanced settings panel in Pane 4 is functional
- [ ] **MEMBER-12**: Workspace creation with type selection works

### Filters, Sort & Search

- [ ] **FILTER-01**: All filter popovers correctly apply and clear state
- [ ] **FILTER-02**: Multiple filters stack with AND logic
- [ ] **FILTER-03**: Individual filter removal via pill without affecting others
- [ ] **FILTER-04**: All sort columns work correctly in both directions with indicators
- [ ] **FILTER-05**: Search bar and global search modal return org-scoped results
- [ ] **FILTER-06**: Inline search syntax operators work (participant:, tag:, folder:, source:, duration:, date:, status:)

### Payments & Billing

- [ ] **PAY-01**: Free/Pro/Team plans display correctly with pricing
- [ ] **PAY-02**: User can upgrade from Free to Pro or Team via Polar checkout
- [ ] **PAY-03**: 14-day Pro trial works for new signups
- [ ] **PAY-04**: User can cancel subscription from billing settings
- [ ] **PAY-05**: AI usage limits enforced per tier (Free: 25, Pro: 1000, Team: 5000/month)
- [ ] **PAY-06**: User can see current AI usage/credit count in billing settings
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

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(populated by roadmapper)* | | |

**Coverage:**
- v2.0 requirements: 39 total
- Mapped to phases: 0
- Unmapped: 39

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after milestone v2.0 definition*
