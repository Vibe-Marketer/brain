---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Security Hardening & UI Polish
status: planning
last_updated: "2026-05-11T00:00:00.000Z"
last_activity: 2026-05-11
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** A new user can sign up, connect their call sources, and be productively using CallVault within minutes — with every piece of data strictly scoped to their organization.
**Current focus:** Phase 29 — QA Sweep & Regression Catalog (not started)

## Current Position

Phase: 29 — QA Sweep & Regression Catalog
Plan: —
Status: Not started — roadmap defined, ready to plan Phase 29
Last activity: 2026-05-11 — v2.2 roadmap created (Phases 29-41)

Progress: [░░░░░░░░░░] 0% (0/13 phases complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 19 | 3 | - | - |

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
| Phase 17 P01 | 231s | 2 tasks | 4 files |
| Phase 17 P03 | 73s | 1 tasks | 0 files |
| Phase 17-payments-billing P04 | 4min | 2 tasks | 2 files |
| Phase 18-mcps P02 | 5 | 1 tasks | 0 files |
| Phase 18-mcps P01 | 115s | 2 tasks | 2 files |
| Phase 24-fathom-share-link-save P01 | ~70min | 4 tasks | 15 files |

## Accumulated Context

### Roadmap Evolution

- Phase 25 added (2026-05-07): Workspace Type Retirement — eliminate personal/team workspace_type distinction, replace with is_default + member_count derivations, add per-user sort_order with drag-and-drop reorder
- v2.2 roadmap defined (2026-05-11): 13 phases (29-41), 55 requirements. Phases sequenced by subsystem + risk profile + independent shippability.

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
- [Phase 17]: Cancel button is link-style text not red button — avoids alarming paid users; polar-cancel retains subscription_id and period_end so access continues until billing end
- [Phase 17]: Deployment-only plan: all three functions passed code review without modifications — polar-cancel, track-ai-usage, polar-webhook all deployed ACTIVE
- [Phase 17-payments-billing]: useAiGate trackAction pattern is the established pattern for all AI consumers — call before edge function, return early on !allowed
- [Phase 18-mcps]: OAuth consent page code is complete and correct — no code changes required
- [Phase 18-mcps]: Full E2E testing blocked on Supabase OAuth 2.1 provider dashboard configuration (not yet set up)
- [Phase 18-mcps]: [18-01] One MCP token per org enforced at service layer and UI — defense-in-depth without DB constraints
- [Phase 18-mcps]: [18-01] MCP server curl tests require Supabase anon JWT for gateway pass-through — function-level auth then checks mcp_tokens table
- [Phase 24]: [24-01] Plan referenced bank_id but actual column is organization_id — recordings.bank_id renamed to organization_id in 20260301000001. Migration + edge fn use organization_id throughout.
- [Phase 24]: [24-01] Populate both share_token AND source_call_id columns — defense-in-depth dedup on both new partial unique index AND existing global (organization_id, source_app, source_call_id) constraint
- [Phase 24]: [24-01] @shared Vite alias added (→ supabase/functions/_shared) — only zero-dep pure-TS modules (no Deno.* / esm.sh / Node) safe to import this way; documented in vite.config comment
- [Phase 24]: [24-01] Pure-TS Fathom parser shared between Deno edge runtime and Vite client — guarantees live preview matches server-stored segments byte-for-byte
- [Phase 24]: [24-01] Explicit select-then-insert/update pattern for deterministic upsert action labels — supabase.upsert + onConflict alone can't return 'created' vs 'updated' deterministically
- [Phase 24]: [24-01] User-as-actor / UGC legal posture — zero outbound HTTP from server to fathom.video, verified by `git diff | grep` review gate; CallVault is a notes app, not a Fathom client
- [Phase 24]: [24-01] Modal CTA placed via absolute positioning over PageHeader instead of modifying ImportOverviewDashboard — keeps the dashboard component out of files_modified scope
- [Phase 22]: [22-02] Plan 22-02 case-block was swept into Phase 23 executor's commit bb98b2bd — code is intact and deployed; commit attribution split across e868688d (artifacts) and bb98b2bd (case-block)
- [Phase 22]: [22-02] ai_usage.action_type CHECK constraint was stale — accepted only legacy 4 types. Dropped via 20260507140000_relax_ai_usage_action_type_check.sql; whitelist now lives only in track-ai-usage VALID_ACTION_TYPES + McpAiActionType union (single source of truth, app-layer)
- [Phase 22]: [22-02] Tier 2 cache check uses Array.isArray(cached.items) only (no length>0 requirement) — empty arrays are valid LLM results meaning "no action items found", saves an LLM call on next invocation

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
- v2.2 Phase 30 (BUG-01): UUID/legacy-ID bug — code path passes numeric Fathom source_call_id where recording UUID is required; unblocks AI tags + Folders column

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 29 (QA Sweep) must complete before any fix phases begin — catalog drives scope
- Phase 30 (UUID fix) must complete before Phase 35 (TABLE-02 Folders column depends on it)
- Phase 31 (Auth) must complete before Phase 32 (Shared-call landing page uses auth flows)
- Phase 33 (Selection state) should complete before Phase 34 (Brand polish builds on canonical state)
- Phase 37 (Edge function security) should complete before Phase 38 (Frontend security builds on it)
- Phase 39 (Fathom Mirror) must complete before Phase 40 (Re-import uses mirror as data source)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260404-0wz | Redesign account settings page with standard layout sections | 2026-04-04 | b28be1d8 | [260404-0wz-redesign-account-settings-page-with-stan](./quick/260404-0wz-redesign-account-settings-page-with-stan/) |
| 260416-u43 | Audit Polar.sh billing setup - identify remaining work | 2026-04-17 | 8b55a65b | [260416-u43-audit-polar-sh-billing-setup-identify-re](./quick/260416-u43-audit-polar-sh-billing-setup-identify-re/) |
| 260421-itf | Standardize active states, icons, and switch visibility | 2026-04-21 | d63b871a | [260421-itf-standardize-icons-selection-switches](./quick/260421-itf-standardize-icons-selection-switches/) |
| 260421-dw8 | Standardize pane headers across all panes | 2026-04-21 | eaba5cb5 | [260421-dw8-standardize-pane-headers-across-all-pane](./quick/260421-dw8-standardize-pane-headers-across-all-pane/) |
| 260421-ejo | Add standardized pane footers across all panes | 2026-04-21 | 1fbb614c | [260421-ejo-add-standardized-pane-footers-across-all](./quick/260421-ejo-add-standardized-pane-footers-across-all/) |
| 260421-hoi | Standardize icon boxes, active indicators, and spacing | 2026-04-21 | df12515a | [260421-hoi-standardize-icon-boxes-active-indicators](./quick/260421-hoi-standardize-icon-boxes-active-indicators/) |

## Session Continuity

Last session: 2026-05-11
Stopped at: v2.2 roadmap defined — 13 phases (29-41), 55 requirements mapped
Resume file: .planning/ROADMAP.md

## Operator Next Steps

- Run `/gsd-plan-phase 29` to plan the QA Sweep & Regression Catalog phase
