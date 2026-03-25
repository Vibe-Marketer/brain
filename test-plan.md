# CallVault E2E Test Plan

**Generated:** 2026-03-24
**Framework:** Playwright
**App URL:** http://localhost:3001 (dev) / https://callvault.vercel.app (prod)

---

## 1. Test Coverage Overview

### Existing Coverage (20 specs)
| Spec File | Area | Tests |
|-----------|------|-------|
| auth.setup.ts | Auth bootstrap | 1 |
| filter-stacking.spec.ts | Filter AND logic, pill removal | 5 |
| filter-isolation.spec.ts | Filter isolation | ~ |
| sort-columns.spec.ts | Column sorting | ~ |
| sharing.spec.ts | Sharing features | ~ |
| team-collaboration-flow.spec.ts | Team management | ~ |
| move-copy-invite.spec.ts | Data movement | ~ |
| org-isolation.spec.ts | Organization isolation | ~ |
| automation-rules.spec.ts | Automation rules | ~ |
| templates.spec.ts | Templates | ~ |
| content-library.spec.ts | Content library | ~ |
| accessibility-audit.spec.ts | Accessibility | ~ |
| browser-compatibility.spec.ts | Cross-browser | ~ |
| analytics-data.spec.ts | Analytics data | ~ |
| z-index-check.spec.ts | Z-index | ~ |
| settings-pane-navigation.spec.ts | Settings nav | ~ |
| sorting-tagging-pane-navigation.spec.ts | Sorting/tagging nav | 28 |
| sorting-tagging-folder-workflow.spec.ts | Folder workflow | ~ |
| phase5-verification.spec.ts | Phase 5 | ~ |
| prd-016-fathom-alternative.spec.ts | PRD-016 | ~ |

### New Coverage (14 specs, ~120+ tests)
| Spec File | Area | Priority |
|-----------|------|----------|
| auth-flows.spec.ts | Login, logout, session, invalid creds | P0 |
| dashboard-transcripts.spec.ts | Main page, table rendering, pagination | P0 |
| global-search.spec.ts | Cmd+K modal, search results, filters | P0 |
| call-detail.spec.ts | Call detail pane, transcript view | P0 |
| bulk-actions.spec.ts | Multi-select, delete, tag, move | P1 |
| export-download.spec.ts | Export dialog, formats, per-row download | P1 |
| sidebar-navigation.spec.ts | Sidebar nav, route transitions, active states | P1 |
| workspace-management.spec.ts | Workspace sidebar, folder tree, quick create | P1 |
| settings-categories.spec.ts | All settings tabs, account, billing, integrations | P1 |
| analytics-navigation.spec.ts | Analytics categories, pane navigation | P2 |
| import-page.spec.ts | Import sources, upload, connections | P2 |
| routing-rules.spec.ts | Rules page CRUD | P2 |
| keyboard-shortcuts.spec.ts | Cmd+K, Tab nav, Escape handling | P2 |
| error-handling.spec.ts | Network errors, empty states, 404 | P2 |

---

## 2. Test Scenarios by Feature

### 2.1 Authentication (P0)
- **Happy path:** Login with valid email/password → redirects to dashboard
- **Error:** Invalid credentials → shows error message
- **Error:** Empty fields → validation messages
- **Edge:** Session expiry → redirects to login
- **Edge:** Already authenticated → redirects away from /login
- **Happy:** Logout → clears session, returns to /login

### 2.2 Dashboard / Transcripts (P0)
- **Happy:** Page loads with transcript table visible
- **Happy:** Table shows columns: Title, Date, Duration, Source, Participants
- **Happy:** Click transcript row → opens call detail pane (Pane 4)
- **Happy:** Pagination controls visible with page count
- **Happy:** Navigate between pages → table updates
- **Happy:** Column picker dropdown → toggle columns on/off
- **Edge:** Empty state → shows appropriate message when no calls
- **Edge:** Loading state → shows skeleton/spinner while fetching
- **Perf:** Page load < 5s (networkidle)

### 2.3 Global Search (P0)
- **Happy:** Cmd+K opens search modal
- **Happy:** Type query (≥2 chars) → shows results
- **Happy:** Click result → navigates to call detail
- **Happy:** Escape closes modal
- **Error:** Query < 2 chars → shows "too short" message
- **Edge:** No results → shows empty state
- **Edge:** Source filters narrow results

### 2.4 Call Detail (P0)
- **Happy:** Click call in table → detail pane opens
- **Happy:** Shows call title, date, duration, participants
- **Happy:** Transcript content renders
- **Happy:** Close button dismisses pane
- **Edge:** Pane 3 shrinks to accommodate Pane 4

### 2.5 Bulk Actions (P1)
- **Happy:** Select multiple calls via checkboxes → bulk toolbar appears
- **Happy:** Select all checkbox selects visible rows
- **Happy:** Bulk delete → confirmation dialog → items removed
- **Happy:** Bulk tag → tag assignment dialog → tags applied
- **Happy:** Bulk move to workspace → workspace picker
- **Edge:** Deselect all → bulk toolbar hides
- **Error:** Delete confirmation cancel → no action taken

### 2.6 Export / Download (P1)
- **Happy:** Export button opens SmartExportDialog
- **Happy:** Select format (PDF, DOCX, TXT, JSON, CSV, MD)
- **Happy:** Select organization type (single, individual, weekly)
- **Happy:** Include options toggleable (summaries, transcripts, etc.)
- **Happy:** Per-row download popover → quick format pick
- **Edge:** Export with 0 selected → disabled/hidden

### 2.7 Sidebar Navigation (P1)
- **Happy:** All nav items visible: All Calls, Shared, Import, Rules, Settings
- **Happy:** Click nav item → route changes, active state updates
- **Happy:** Active item shows orange pill indicator
- **Happy:** Sidebar collapse/expand toggle
- **Edge:** Feature-flagged items conditionally rendered

### 2.8 Workspace Management (P1)
- **Happy:** Workspace sidebar (Pane 2) shows folder tree
- **Happy:** Quick create folder → new folder appears
- **Happy:** Folder selection filters transcripts
- **Happy:** Workspace switcher changes active workspace

### 2.9 Settings (P1)
- **Happy:** Navigate to /settings → categories pane renders
- **Happy:** All categories visible: Account, Contacts, Workspaces, People, Billing, Integrations, AI, Admin
- **Happy:** Click category → detail pane opens with correct content
- **Happy:** Role-restricted categories hidden for non-admins
- **Edge:** Keyboard navigation (↑↓ arrows, Enter, Home/End)

### 2.10 Analytics (P2)
- **Happy:** Navigate to /analytics → categories render
- **Happy:** Categories: Overview, Duration, Participation, Talk Time, Tags, Content
- **Happy:** Click category → detail chart/data renders
- **Edge:** Empty data → appropriate empty state

### 2.11 Import Page (P2)
- **Happy:** Navigate to /import → shows import sources
- **Happy:** Connected sources displayed with status
- **Edge:** No sources connected → setup prompts

### 2.12 Routing Rules (P2)
- **Happy:** Navigate to /rules → rules list renders
- **Happy:** Create new rule form
- **Edge:** No rules → empty state

### 2.13 Keyboard Shortcuts (P2)
- **Happy:** Cmd+K → opens global search
- **Happy:** Escape → closes modals/dialogs
- **Happy:** Tab navigation through interactive elements
- **Happy:** Enter/Space activates buttons

### 2.14 Error Handling (P2)
- **Happy:** Network error mock → error UI displayed
- **Happy:** 404 route → redirects to /
- **Edge:** API timeout → graceful degradation
- **Accessibility:** Error messages announced to screen readers

---

## 3. Technical Configuration

### Playwright Config
- **Retries:** 2 (all environments)
- **Timeout:** 120s per test, 30s assertions
- **Traces:** on-first-retry
- **Videos:** retain-on-failure
- **Screenshots:** on failure
- **Projects:** chromium (primary), firefox, webkit, edge
- **Parallelism:** fullyParallel: true

### Page Object Model
- `BasePage` — shared navigation, wait helpers
- `LoginPage` — auth form interactions
- `TranscriptsPage` — table, filters, pagination, bulk actions
- `CallDetailPane` — detail view interactions
- `SettingsPage` — category navigation
- `AnalyticsPage` — analytics categories
- `SearchModal` — global search interactions
- `ExportDialog` — export form interactions

### Data Strategy
- Auth: Pre-authenticated via auth.setup.ts (storage state reuse)
- API Mocking: `page.route()` for deterministic test data
- Fixtures: Reusable mock data objects
- Cleanup: No side effects between tests

### Accessibility Checks
- axe-core integration via @axe-core/playwright
- ARIA labels on all interactive elements
- Keyboard navigability verified
- Focus management on modal open/close

---

## 4. Coverage Targets

| Area | Target | Method |
|------|--------|--------|
| Routes | 100% of protected routes | Direct navigation tests |
| User Flows | 100% happy paths | E2E scenarios |
| Error States | 80%+ | API mocking |
| Accessibility | WCAG 2.1 AA | axe-core scans |
| Performance | <5s page load | networkidle timing |
| Browsers | Chromium + Firefox + WebKit | Multi-project config |
