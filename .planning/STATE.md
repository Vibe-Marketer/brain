---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Launch Readiness
status: verifying
stopped_at: Completed 16-02-PLAN.md
last_updated: "2026-03-30T23:32:07.940Z"
last_activity: 2026-03-30
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 15
  completed_plans: 15
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.
**Current focus:** Phase 16 — filters-sort

## Current Position

Phase: 16 (filters-sort) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-03-30

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:** —

*Updated after each plan completion*
| Phase 11 P02 | 8m | 2 tasks | 2 files |
| Phase 11 P01 | 5 | 3 tasks | 9 files |
| Phase 11 P03 | 3m | 2 tasks | 3 files |
| Phase 11 P04 | 22s | 1 tasks | 3 files |
| Phase 12 P02 | 8 | 2 tasks | 4 files |
| Phase 12-import-flows-source-details P01 | 8 | 2 tasks | 2 files |
| Phase 13 P02 | 2m | 2 tasks | 2 files |
| Phase 13-drag-to-folder-global-search P01 | 4 | 1 tasks | 2 files |
| Phase 14 P01 | 131s | 2 tasks | 4 files |
| Phase 14-onboarding-e2e P02 | 532s | 1 tasks | 8 files |
| Phase 15 P01 | 8m | 2 tasks | 7 files |
| Phase 15 P03 | 93s | 2 tasks | 2 files |
| Phase 15-members-roles P02 | 5 | 2 tasks | 2 files |
| Phase 16-filters-sort P01 | 4m | 2 tasks | 3 files |
| Phase 16-filters-sort P02 | 181s | 2 tasks | 4 files |

## Accumulated Context

### Decisions

- [Pre-GSD]: Fix in-place vs rebuild — fix existing architecture (rebuild too slow)
- [Pre-GSD]: URL param persistence kept — working feature, just needs org scoping
- [v2.0]: v1.1 absorbed into v2.0 — filter work still needed, broader scope required for launch
- [v2.0]: Org model = GoHighLevel subaccounts — complete isolation, only user identity + connected accounts shared
- [v2.0]: 4 workspace roles: Owner > Admin > Contributor > Member
- [v2.0]: Phase 11 is foundation — all other phases depend on org scoping being correct first
- [v2.0 regen]: DND-01/02 and SEARCH-01/02 share Phase 13 — all code exists, wiring only
- [v2.0 regen]: DETAIL-01 absorbed into Phase 12 — source-specific metadata is natural companion to import flows
- [v2.0 regen]: FILTER-05 is inline search syntax (old FILTER-06 renumbered); global search moved to SEARCH category
- [v2.0 regen]: MCP phase renumbered 17→18 to accommodate new Phase 13
- [Phase 11]: Force-unpinned Pane 4 on org switch — pin state should not survive an org context change
- [Phase 11]: CSS transition-opacity (not motion/react springs) for org switch fade — utility transition not UI animation
- [Phase 11]: Filter/sort reset via navigation to '/' — state is URL-based, navigation naturally clears it
- [Phase 11]: getImportCounts switched from RPC to direct query — RPC only accepted user_id, not org-scoped
- [Phase 11]: Tag count/rule org filtering via tag ID subset — call_tag_assignments and tag_rules have no organization_id column
- [Phase 11]: Defense-in-depth pattern: explicit org_id filter on recording detail fetches even with RLS coverage
- [Phase 11]: Zoom shown unconditionally on Import page — removed showZoom/beta_zoom flag per Plan 11-03
- [Phase 11]: YouTube import inline in Pane 3 (no Dialog) — more natural in 4-pane layout
- [Phase 11]: CallDetailPage replaced with redirect to /?callId=<id> — modal pattern via CallDetailDialog (D-07)
- [Phase 11]: Modal vs Pane 4 rules documented in AppShell.tsx JSDoc (D-08/D-09/D-10)
- [Phase 12]: useRawCallData inline query key ['raw-call-data', recordingId, sourceApp] — rawCalls factory has per-source keys, unified dispatcher key is cleaner inline
- [Phase 12]: SourceInfoSection uses useState toggle not Radix Collapsible — simpler for single collapsible section
- [Phase 12-01]: FathomImportDetail/ZoomImportDetail own their connected/disconnected UI states — ImportPage passes isConnected+onConnect+onDisconnect props only
- [Phase 12-01]: Disconnect flows through AlertDialog confirmation before mutating — one dialog at ImportPage root level serves both Fathom and Zoom
- [Phase 12-01]: YouTube deriveSourceStatus returns 'connected' unconditionally — no OAuth, always available
- [Phase 13]: Cmd+K registered in GlobalSearchModal via useSearchShortcut, not in top-bar — modal owns its own shortcut
- [Phase 13]: GlobalSearchModal mounted inside <header> in TopBar — globally available without AppShell changes
- [Phase 13-drag-to-folder-global-search]: 13-01: Drag ID string parsing — useDraggable IDs are recording-N strings; handleDragEnd now parses numeric IDs before passing to assignToFolder(number[])
- [Phase 13-drag-to-folder-global-search]: 13-01: DragOverlay placed inside DndContext after dialog elements — follows existing pattern from DndCallProvider
- [Phase 14]: ProtectedRoute is now a pure auth guard — Layout.tsx owns all onboarding concerns
- [Phase 14]: Connect source buttons use window.open(_blank) so OnboardingModal stays mounted during OAuth flow
- [Phase 14]: Post-onboarding navigation in Layout via handleOnboardingComplete wrapper calling navigate('/')
- [Phase 14-onboarding-e2e]: Ghost OS MCP tools unavailable in parallel executor — Playwright used instead for equivalent E2E verification
- [Phase 14-onboarding-e2e]: user_profiles uses user_id FK column (not id) for Supabase auth linkage
- [Phase 14-onboarding-e2e]: HowItWorksContent Step 2 has 6 sub-cards — navigation requires Next×5 + Got it
- [Phase 15]: contributor replaces manager in 4-role workspace model; guest upgraded to member in migration
- [Phase 15]: ChangeRoleDialog owner self-demotion guard hides radio group when target user is current user and role is workspace_owner
- [Phase 15]: Advanced settings collapsible uses useState toggle — same pattern as SourceInfoSection, not Radix Collapsible
- [Phase 15]: Danger Zone hidden (not disabled) for non-owners — consistent with hide-what-you-cant-do philosophy from CONTEXT.md
- [Phase 15]: Default workspace shows cannot-delete message rather than disabled delete button — clearer UX signal
- [Phase 15-members-roles]: AlertDialog for removal: title 'Remove [name]?' + 'Their calls will remain in the workspace.' matches CONTEXT.md spec
- [Phase 15-members-roles]: WorkspaceJoin redirect to /login for unauthenticated users deemed sufficient (login page has sign-up flow)
- [Phase 16-filters-sort]: SourceFilterPopover staged Apply/Clear: controlled Popover + stagedSources state matching all other 5 popovers
- [Phase 16-filters-sort]: Filter integration tests at pure data layer (no React rendering) — tests filter spread/removal logic directly
- [Phase 16-filters-sort]: status filter applied client-side in workspace path only — recordings-table rows are always synced:true so ALL CALLS PATH deferred
- [Phase 16-filters-sort]: status: operator has no short alias — unambiguous and matches plan spec

### Known Facts (from codebase audit)

- Fathom/Zoom import detail components (FathomImportDetail.tsx, ZoomImportDetail.tsx) EXIST but are orphaned — need wiring into Pane 2/3
- Import page does not use Pane 2 at all — needs rearchitecting
- DndCallProvider.tsx, FolderDropZone.tsx, useFolderAssignment.ts all exist and are complete — need 4 wiring points only
- GlobalSearchModal deleted in commit 2ae0e175 — need ~200-line rebuild; useGlobalSearch.ts hook is complete
- raw-calls.service.ts exists with full per-source dispatcher — need UI section in call detail view
- DB has 5 workspace roles (owner/admin/manager/member/guest) — must align to 4 (Owner/Admin/Contributor/Member)
- Polar.sh billing integrated — missing cancel button and usage display only
- MCP OAuth consent page exists — needs E2E verification
- Filter/sort broken from v1.1 — absorbed into Phase 16
- Onboarding wizard exists and mostly works — needs E2E verification and gap fixes

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 11 must complete before Phase 12, 13, 14, 15, 16, 17, 18 (org_id foundation)
- Phase 14 (Onboarding E2E) requires Phase 12 (Import Flows) to be complete first
- Role DB alignment (5→4 roles) needed before Phase 15 invite/permission work

## Session Continuity

Last session: 2026-03-30T23:32:03.698Z
Stopped at: Completed 16-02-PLAN.md
Resume file: None
