---
phase: 16
plan: 01
subsystem: admin-center
tags: [admin, shell, dashboard, tickets, cmdk, sidebar]
requires:
  - 11-03 tickets schema + TicketTable
  - 11-04 TicketDetailDialog
  - 11-05 NewTicketDialog + pagination
provides:
  - /admin route (AppShell 4-pane shell, AdminGuard-gated)
  - Sidebar ADMIN entry (isAdmin-gated)
  - Admin Dashboard (live counts, deploy card, runner card, Needs You)
  - Tickets section mounting main's live ticket components
  - ⌘K AdminCommandPalette (cmdk)
affects:
  - src/App.tsx (lazy routes)
  - src/components/ui/sidebar-nav.tsx (ADMIN item)
  - src/components/settings/AdminTab.tsx (pointer card)
  - src/routes.manifest.ts (QA crawl coverage)
tech-stack:
  added: [cmdk ^1.1.1]
  patterns: [service+hook separation, Zustand v5 double-invocation, AppShell secondaryPane]
key-files:
  created:
    - src/components/ui/command.tsx
    - src/components/admin/AdminGuard.tsx
    - src/components/admin/__tests__/AdminGuard.test.tsx
    - src/components/admin/AdminCommandPalette.tsx
    - src/components/panes/AdminCategoryPane.tsx
    - src/stores/adminDetailStore.ts
    - src/services/admin-dashboard.service.ts
    - src/services/__tests__/admin-dashboard.service.test.ts
    - src/hooks/useAdminDashboard.ts
    - src/pages/admin/AdminCenter.tsx
    - src/pages/admin/DashboardSection.tsx
    - src/pages/admin/TicketsSection.tsx
  modified:
    - src/App.tsx
    - src/components/Layout.tsx
    - src/components/ui/sidebar-nav.tsx
    - src/components/ui/__tests__/sidebar-nav.test.tsx
    - src/routes.manifest.ts
    - src/lib/query-config.ts
    - src/components/settings/AdminTab.tsx
    - package.json
decisions:
  - "Wave 1 categories limited to Dashboard + Tickets — no stub sections for Users/QA/Audit (they land in later waves with real implementations)"
  - "tagNeedsYou lives in admin-dashboard.service (not tickets.service) to avoid touching files shared with the 15-01 workstream"
  - "Needs You rebound to live statuses: awaiting_approval / escalated / critical-aging (>24h critical in active status)"
  - "Deploy card compares bundle SHA vs GitHub API main HEAD best-effort; degrades to 'unavailable from browser' (repo may be private to unauthenticated API)"
  - "runner_state queried untyped with graceful 'not deployed yet' until Phase 13 ships the table"
  - "command.tsx uses sr-only DialogTitle instead of phantom @radix-ui/react-visually-hidden transitive dep"
metrics:
  duration: ~75 minutes
  completed: 2026-06-11
  tasks: 5
  tests-added: 19 (11 dashboard service, 3 AdminGuard, 2 sidebar visibility + manifest sync coverage)
---

# Phase 16 Plan 01: Admin Center Shell Port Summary

Admin Center shipped: sidebar ADMIN entry opens /admin — an AppShell 4-pane shell with a live Dashboard (user/ticket counts, measured DB health, deployed-SHA card, runner card, Needs You queue) and the full live Tickets queue, all behind AdminGuard with a ⌘K palette.

## What Is Now Visible at /admin

- **Sidebar:** ADMIN entry (shield-star icon) appears for platform admins only, navigates to /admin/dashboard. Hidden for FREE/PRO/TEAM.
- **Dashboard section:** Needs You queue (awaiting-approval / escalated / critical-aging tickets, click-through to the ticket dialog), Users by Role, Tickets by Status (all 8 live statuses), Tickets Last 7d, Deployment card (deployed commit vs main HEAD), System Health (measured DB round-trip ms, runner heartbeat with "not deployed yet" until Phase 13).
- **Tickets section:** main's live TicketTable + TicketDetailDialog + NewTicketDialog mounted in the shell with status/severity/source filters and pagination — composition only, zero edits to the 15-01-owned components.
- **⌘K palette:** section jump, active-ticket search, "mark ticket resolved" quick actions.
- **Settings → Admin tab:** System Overview + Tickets sections replaced by an "Admin Center moved" pointer card; User Management stays (Wave 2 ports the richer UsersSection).

## Port Map Executed

All ports from `git show worktree-admin-center:<path>`, rebound to live schema:

| Branch file | Disposition |
|---|---|
| ui/command.tsx | Ported (sr-only title instead of VisuallyHidden) |
| AdminGuard.tsx + test | Ported verbatim; test rebound to main's useUserRole shape |
| adminDetailStore.ts | Ported verbatim |
| AdminCategoryPane.tsx | Ported; categories cut to Wave 1 set; Flags entry stripped |
| AdminCommandPalette.tsx | Ported; rebound to live tickets vocab; users/flags/automation/qa groups stripped |
| AdminCenter.tsx | Ported; Wave 1 sections only; branch detail-pane (dead-schema TicketDetailView) dropped in favor of main's dialog |
| DashboardSection.tsx | Ported; rebound (see below) |
| admin-dashboard.service.ts + test | Ported; fully rebound to live tickets/user_roles; support_tickets/ticket_events automation queries dropped |
| Sidebar diff | Ported; useFeatureFlags gate stripped (flags deleted on main), pure isAdmin gate |
| FlagsSection / SupportSection / AutomationSection / QaSection / AuditSection / UsersSection | NOT ported (Wave 2+ / deferred per context) |

## Rebinding Details

- `support_tickets` → `tickets`; status vocab → new/triaged/in_progress/awaiting_approval/awaiting_user/resolved/rejected/escalated
- `tagNeedsYou()`: needs_review/revert_available event tags → status-driven awaiting_approval/escalated + critical_aging (critical severity, active status, >24h)
- `runner_runs` → `runner_state` (untyped read, graceful absence → "not deployed yet")
- Deployed-SHA card: `VITE_COMMIT_SHA`/`VITE_VERCEL_GIT_COMMIT_SHA` from the running bundle vs `api.github.com/repos/Vibe-Marketer/brain/commits/main` (best-effort fetch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phantom dependency in ported command.tsx**
- **Found during:** Task 1
- **Issue:** Branch imported `@radix-ui/react-visually-hidden`, which is only a transitive dep on main
- **Fix:** Replaced with `<DialogTitle className="sr-only">` — same a11y outcome, no new dep
- **Files modified:** src/components/ui/command.tsx
- **Commit:** fc7b739

**2. [Rule 2 - Missing critical] TopBar page label for /admin**
- **Found during:** Task 4
- **Issue:** Layout's getPageLabel() would show "HOME" on /admin routes
- **Fix:** Added `/admin` → "ADMIN" mapping in Layout.tsx
- **Commit:** 459f79c

**3. [Process] Accidental `git stash` during a baseline check stashed 5 uncommitted files**
- **Found during:** Task 4 verification
- **Fix:** Immediately verified stash@{0} contained exactly the 5 in-flight files and popped it; all edits restored and re-verified before commit. No data lost, no foreign stash touched.

## Known Stubs

| Stub | File | Reason |
|---|---|---|
| Runner card "not deployed yet" | DashboardSection.tsx / admin-dashboard.service.ts | Intentional: `runner_state` ships with Phase 13; the read is wired now per context |
| Deploy card "main HEAD unavailable" fallback | admin-dashboard.service.ts | Intentional: unauthenticated GitHub API cannot read a private repo from the browser; card always shows the real deployed SHA |
| "Advanced user management coming soon" toast | AdminTab.tsx (pre-existing, untouched) | Wave 2 ports UsersSection + admin-manage-user Edge Function |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: egress | src/services/admin-dashboard.service.ts | New browser-side fetch to api.github.com (read-only, no credentials, graceful failure) |

## Verification

- vitest: 1749 passed, 0 failed (full suite, includes 19 new/ported tests)
- eslint: 0 errors on all touched files (1 pre-existing-pattern fast-refresh warning in AdminCategoryPane, same as branch)
- tsc scoped: 0 errors in all NEW files (repo baseline of 766 pre-existing errors untouched; sidebar-nav.test.tsx matcher-type errors pre-exist in baseline log)
- npm run build: exit 0 on the committed tree
- Pushed: main == origin/main == 9e767f04

## Commits

| Hash | Message |
|---|---|
| fc7b739 | feat(16-01): add cmdk command palette primitive |
| 36ac41a | feat(16-01): port admin shell primitives from worktree-admin-center |
| f15ca66 | feat(16-01): admin dashboard rebound to live schema |
| 459f79c | feat(16-01): mount /admin shell — routes, sidebar entry, tickets section, command palette |
| 9e767f0 | feat(16-01): Settings AdminTab points to Admin Center |

## Live Verification

- Prod bundle at https://app.callvaultai.com bakes `VITE_VERCEL_GIT_COMMIT_SHA = 9e767f04e705…` — exactly main HEAD (`gh api repos/Vibe-Marketer/brain/commits/main` returns the same SHA)
- Lazy chunk `AdminCenter-DT6tpYTw.js` served from prod and contains the Admin Center shell

## Self-Check: PASSED

All 12 created source files + SUMMARY exist on disk; all 5 commits present in git log; main == origin/main == deployed SHA.
