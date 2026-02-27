---
phase: 14-foundation
plan: 04
subsystem: ui
tags: [tanstack-router, appshell, routes, zustand, tanstack-query, tauri, clipboard, file-api]

requires:
  - phase: 14-03
    provides: AppShell.tsx with typed AppShellProps (secondaryPane, showDetailPane); panelStore and preferencesStore Zustand v5; _authenticated/index.tsx already renders AppShell

provides:
  - All 9 authenticated route pages wired with AppShell (/, /workspaces, /workspaces/$id, /calls/$id, /folders/$id, /import, /settings, /settings/$category, /sharing)
  - Public shared call view at /s/$token (no auth guard, standalone layout)
  - v1 path blockers at /bank, /vault, /hub returning 404-style pages with "older version" messaging
  - TanStack Query key factory (query-config.ts) covering all v2 domains with FOUND-06 hard boundary documented
  - useClipboard hook abstracting navigator.clipboard for Tauri compatibility
  - useFileOpen hook abstracting file input dialog for Tauri compatibility

affects:
  - 14-05 (billing gating UI wraps within AppShell main content pane — all routes now ready)
  - 15+ (all v2 page routes exist; implementation goes into existing route components)
  - All phases implementing real content (use queryKeys factory for server state, Zustand for UI state)

tech-stack:
  added: []
  patterns:
    - Route-level AppShell composition — each route passes secondaryPane and showDetailPane props
    - FOUND-06 hard boundary — TanStack Query for all server state, Zustand for UI state only, documented in query-config.ts
    - v1 path blockers — createFileRoute on legacy paths returning 404 components with "older version" messaging
    - Public route pattern — /s/$token has no _authenticated prefix, no auth guard, standalone layout

key-files:
  created:
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/workspaces/index.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/workspaces/$workspaceId.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/calls/$callId.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/folders/$folderId.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/import/index.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/settings/index.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/settings/$category.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/sharing/index.tsx
    - /Users/Naegele/dev/callvault/src/routes/s/$token.tsx
    - /Users/Naegele/dev/callvault/src/routes/bank.tsx
    - /Users/Naegele/dev/callvault/src/routes/vault.tsx
    - /Users/Naegele/dev/callvault/src/routes/hub.tsx
    - /Users/Naegele/dev/callvault/src/lib/query-config.ts
    - /Users/Naegele/dev/callvault/src/hooks/useClipboard.ts
    - /Users/Naegele/dev/callvault/src/hooks/useFileOpen.ts
  modified:
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx

key-decisions:
  - "Settings /settings redirects to /settings/account via beforeLoad — avoids blank settings root"
  - "useFileOpen handles cancellation via cancel event listener — resolves null on dialog dismiss without selection"
  - "query-config.ts v2 domains differ from v1 (no chat/contentLibrary/vaults/teams) — aligns with v2 MCP-first architecture"
  - "v1 path blockers use createFileRoute at exact path (not catch-all) — TanStack Router does not need catch-all for exact matches"

patterns-established:
  - "Pattern 11: FOUND-06 hard boundary — always import queryKeys for server data, never store server data in Zustand"
  - "Pattern 12: Public route — place outside _authenticated/ directory, use standalone layout (no AppShell)"
  - "Pattern 13: v1 path blocker — createFileRoute('/legacy-path') with 404 component + link to /"

duration: 3min
completed: 2026-02-27
---

# Phase 14 Plan 04: Route Wiring Summary

**13 route files wired (9 authenticated with AppShell, 1 public standalone, 3 v1 blockers), TanStack Query key factory covering 7 v2 domains with FOUND-06 boundary, and Tauri-compatible clipboard/file hooks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T15:43:48Z
- **Completed:** 2026-02-27T15:46:37Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Every route in the v2 sitemap is now reachable: `/`, `/workspaces`, `/workspaces/:id`, `/calls/:id`, `/folders/:id`, `/import`, `/settings`, `/settings/:category`, `/sharing`, `/s/:token`
- v1 legacy paths `/bank`, `/vault`, `/hub` return 404 pages with "older version" messaging and a link back to `/`
- TanStack Query key factory covers all 7 v2 domains with the FOUND-06 hard boundary documented inline — server state lives in TanStack Query, UI state lives in Zustand
- Browser API hooks `useClipboard` and `useFileOpen` abstract web APIs with Tauri hook comments, ready for desktop app expansion

## Task Commits

Each task was committed atomically (in /dev/callvault repo):

1. **Task 1: Wire all authenticated routes with AppShell** — `6713796` (feat)
2. **Task 2: Query config, browser API hooks, and state management boundary** — `40e891e` (feat)

## Files Created/Modified

- `/Users/Naegele/dev/callvault/src/routes/_authenticated/index.tsx` — Updated with "All Calls" heading, folder sidebar, proper route path breadcrumb
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/workspaces/index.tsx` — /workspaces list page with org sidebar
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/workspaces/$workspaceId.tsx` — /workspaces/:id detail page with folder tree sidebar, Route.useParams()
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/calls/$callId.tsx` — /calls/:id detail page, showDetailPane=true, Route.useParams()
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/folders/$folderId.tsx` — /folders/:id view page with subfolder sidebar, Route.useParams()
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/import/index.tsx` — /import hub with Fathom/Zoom/YouTube/File Upload cards (no Google Meet)
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/settings/index.tsx` — /settings redirect to /settings/account via beforeLoad
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/settings/$category.tsx` — /settings/:category with settings nav sidebar and active state
- `/Users/Naegele/dev/callvault/src/routes/_authenticated/sharing/index.tsx` — /sharing (Shared With Me) full-width page
- `/Users/Naegele/dev/callvault/src/routes/s/$token.tsx` — /s/:token public view (no auth, no AppShell, standalone centered layout)
- `/Users/Naegele/dev/callvault/src/routes/bank.tsx` — /bank v1 blocker, 404 with "older version" message
- `/Users/Naegele/dev/callvault/src/routes/vault.tsx` — /vault v1 blocker, 404 with "older version" message
- `/Users/Naegele/dev/callvault/src/routes/hub.tsx` — /hub v1 blocker, 404 with "older version" message
- `/Users/Naegele/dev/callvault/src/lib/query-config.ts` — queryKeys factory, 7 domains, FOUND-06 boundary comment
- `/Users/Naegele/dev/callvault/src/hooks/useClipboard.ts` — navigator.clipboard abstraction with Tauri future comment
- `/Users/Naegele/dev/callvault/src/hooks/useFileOpen.ts` — hidden input dialog abstraction with cancel handler and Tauri future comment

## Decisions Made

- **Settings redirect via beforeLoad**: `/settings` uses `beforeLoad` to throw a `redirect` to `/settings/account`. This avoids a blank settings root page — users always land on a specific category.
- **useFileOpen cancel handling**: Added `input.addEventListener('cancel', ...)` to resolve `null` when the user dismisses the file dialog without selecting. Some browsers fire `cancel` directly on the input; without this handler the Promise would never resolve.
- **v2 queryKeys domains are narrower than v1**: v1 had `chat`, `contentLibrary`, `vaults`, `teams`, `contacts`, `templates`, `notifications`. v2 drops all of these in line with the MCP-first pivot (no RAG, no Content Hub, no team management in v2 Phase 14 scope). The key factory is intentionally minimal — domains will be added as features are built.
- **v1 blockers use exact path createFileRoute**: `/bank`, `/vault`, `/hub` each register an exact path. TanStack Router will match these and render the 404 component for those exact paths. Sub-paths like `/bank/something` will fall through to TanStack Router's not-found handler, which is acceptable behavior.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All v2 routes are wired and reachable (FOUND-05 satisfied)
- FOUND-06 hard boundary is documented in query-config.ts and ready for enforcement
- Plan 05 (billing gates, UpgradeGate component, tier detection) can immediately wrap any route's content inside `<UpgradeGate>`
- All route components follow the plan-specified pattern: `font-montserrat font-extrabold text-xl uppercase tracking-wide` headings, muted breadcrumb path, `Coming soon` placeholder divs
- TypeScript compiles with zero errors in strict mode

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/routes/_authenticated/index.tsx | FOUND |
| src/routes/_authenticated/workspaces/index.tsx | FOUND |
| src/routes/_authenticated/workspaces/$workspaceId.tsx | FOUND |
| src/routes/_authenticated/calls/$callId.tsx | FOUND |
| src/routes/_authenticated/folders/$folderId.tsx | FOUND |
| src/routes/_authenticated/import/index.tsx | FOUND |
| src/routes/_authenticated/settings/index.tsx | FOUND |
| src/routes/_authenticated/settings/$category.tsx | FOUND |
| src/routes/_authenticated/sharing/index.tsx | FOUND |
| src/routes/s/$token.tsx | FOUND |
| src/routes/bank.tsx | FOUND |
| src/routes/vault.tsx | FOUND |
| src/routes/hub.tsx | FOUND |
| src/lib/query-config.ts | FOUND |
| src/hooks/useClipboard.ts | FOUND |
| src/hooks/useFileOpen.ts | FOUND |
| Commit 6713796 (Task 1) | FOUND |
| Commit 40e891e (Task 2) | FOUND |
| TypeScript type check | PASS (zero errors) |
| No AI/RAG routes | PASS |
| HARD BOUNDARY comment in query-config.ts | PASS |
| enforced by convention comment in query-config.ts | PASS |

---
*Phase: 14-foundation*
*Completed: 2026-02-27*
