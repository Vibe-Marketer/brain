---
phase: 11-ticket-foundation-flag-removal
plan: 03
subsystem: frontend
tags: [tickets, admin, tanstack-query, service-hook-pattern, ui-spec, tdd]

# Dependency graph
requires:
  - phase: 11-ticket-foundation-flag-removal
    plan: 01
    provides: "AdminTab Feature Flags slot cleared (FLAG-01)"
  - phase: 11-ticket-foundation-flag-removal
    plan: 02
    provides: "tickets/ticket_messages/ticket_events live with RLS + status-audit trigger; regenerated types"
provides:
  - tickets.service.ts (getTickets/getTicketDetail/updateTicketStatus — pure async, no React)
  - useTickets/useTicketDetail/useUpdateTicketStatus TanStack Query hooks
  - TicketTable per UI-SPEC (columns, badge mapping, sort, empty states, footer)
  - AdminTab Tickets section with Status/Severity/Source filters between System Overview and User Management
  - TicketDetailDialog (sm:max-w-2xl) with context block, messages, Activity event timeline, 8-value status Select
  - lib/ticket-display.ts shared badge/type display maps
affects: [11-04, 12-sentry, 14-approvals, 15-attachments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ticket display maps (status/severity badge variants, type icons) centralized in src/lib/ticket-display.ts to keep component files fast-refresh clean"
    - "Filtered list + unfiltered total via two useTickets calls sharing the all-'all' queryKey (single fetch when unfiltered)"

key-files:
  created:
    - src/services/tickets.service.ts
    - src/hooks/useTickets.ts
    - src/services/__tests__/tickets.service.test.ts
    - src/components/settings/TicketTable.tsx
    - src/components/settings/TicketDetailDialog.tsx
    - src/components/settings/__tests__/TicketTable.test.tsx
    - src/lib/ticket-display.ts
  modified:
    - src/components/settings/AdminTab.tsx

key-decisions:
  - "status-badge.tsx untouched — all 8 status + 4 severity mappings reuse existing variants via the label prop (UI-SPEC said extend only if missing; nothing was missing)"
  - "getTickets embeds ticket_messages(body, created_at) and derives the Summary column from the chronologically first message; reporter resolved via one batched user_profiles lookup with raw-id fallback"
  - "Display maps moved to src/lib/ticket-display.ts (one extra file vs plan) to fix react-refresh/only-export-components lint warnings introduced by exporting consts from TicketTable.tsx"

# Metrics
duration: ~25min
completed: 2026-06-11
---

# Phase 11 Plan 03: Admin Tickets View (TKT-02) Summary

**One-liner:** Admin Tickets section live in AdminTab — service+hook data layer, UserTable-idiom TicketTable with status/severity/source filters and locked badge mapping, and a detail dialog reconstructing the full ticket lifecycle from the ticket_events Activity timeline with an 8-state admin status control.

## What was built

### Task 1 — Service + hooks (TDD)

- **RED** (5544120): 8 failing unit tests — getTickets ordering/filter-skipping/error labeling/reporter fallback, getTicketDetail messages-asc/events-desc, updateTicketStatus update-by-id + error.
- **GREEN** (9334c23): `tickets.service.ts` (no React imports) — `getTickets({status,severity,source})` applies `.eq` only for non-`'all'` values, orders `created_at desc`, embeds `ticket_messages(body, created_at)` for the Summary excerpt, and batch-resolves reporter display names from `user_profiles` (admin RLS) with reporter_id fallback. `getTicketDetail` returns ticket + messages asc + events desc. `updateTicketStatus` writes via admin JWT — the 11-02 SECURITY DEFINER trigger writes the audit row. `useTickets.ts` wraps all three with queryKeys `['tickets', filters]` / `['ticket', id]`, session-gated, mutation invalidates both keys with UI-SPEC toasts ('Status updated' / 'Failed to update status').

### Task 2 — TicketTable + AdminTab section (e54b942)

- `TicketTable.tsx` mirrors UserTable: `React.memo`, `ui/table` primitives, `useTableSort` + SortButton, Remix icons only. Columns: Type (icon + label), Summary (truncated first-message excerpt), Severity/Status (StatusBadge per locked UI-SPEC mapping), Source (muted), Reporter, Created (date-fns relative, `text-xs text-muted-foreground tabular-nums`). Row click emits ticket id.
- AdminTab gains the Tickets section between System Overview and User Management (heading 'Tickets', subtitle 'Support tickets, bug reports, and tasks across the platform', `space-y-4`, `Separator className="my-16"`), three `sm:w-40` Selects with 'All Statuses'/'All Severities'/'All Sources' first, data exclusively via `useTickets` (zero inline supabase), `RiLoader2Line` loading, dashed `rounded-xl py-12` empty states with exact UI-SPEC copy, footer 'Showing {filtered} of {total} tickets', inline load-error copy + 'Failed to load tickets' toast.
- 6 component tests: rows from props, badge mapping, row-click handler, footer count, both empty-state variants.

### Task 3 — TicketDetailDialog (5014d3e)

- Radix Dialog `sm:max-w-2xl`, controlled `open`/`onOpenChange`/`ticketId`, data via `useTicketDetail`. Title `{Type} · #{6-char id}`; focal badge row (status + severity) beside the status Select offering exactly the 8 locked lifecycle values, disabled while the mutation is pending.
- Context JSONB definition list (URL, App Version, Commit, User Agent, Organization, Workspace) rendered as React text nodes only — no dangerouslySetInnerHTML anywhere (T-11-12).
- Messages list (author_type + body, asc) and 'Activity' timeline: dot marker + human description ('Ticket created', 'Status changed: new → triaged' from old_value/new_value) + relative timestamp, newest first, sourced from ticket_events (TKT-04 surface).
- AdminTab row click opens the dialog with the selected ticket id.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved exported display maps out of TicketTable.tsx**
- **Found during:** post-Task-3 lint gate
- **Issue:** Exporting `ticketStatusBadge`/`ticketSeverityBadge`/`ticketTypeMeta` consts from the component file triggered 3 `react-refresh/only-export-components` warnings (introduced by this plan, not pre-existing)
- **Fix:** New `src/lib/ticket-display.ts` holds the maps; TicketTable + TicketDetailDialog import from it. No behavior change.
- **Files modified:** src/lib/ticket-display.ts (new), TicketTable.tsx, TicketDetailDialog.tsx
- **Commit:** d5d5e52

**2. [Minor] status-badge.tsx not modified**
- Plan listed it under files_modified with the caveat "extend ONLY if a needed label is missing." All 8 status and 4 severity variants already exist and labels pass through the `label` prop — no change needed.

## Verification

- `npx vitest run` on both new test files: 14 passed, 0 failed
- `npm test` full suite: 193 files / 1694 tests passed, 0 failed, exit 0
- `npm run build`: exit 0 (run on content identical to committed tree)
- `npm run lint`: exit 0, 0 errors; zero warnings in any file touched by this plan
- `npm run type-check` (tsc --noEmit): exit 0
- Copy strings verified against 11-UI-SPEC.md Copywriting Contract (empty states, footer, toasts, section heading/subtitle, 'Activity' heading)

### Deferred to orchestrator

- **Execution-time visual verification via dev-browser/Interceptor** (plan `<verification>` item 3): attempted — dev server started on :3002, Interceptor daemon running, but the Chrome Interceptor extension was not reachable from this execution context (probe timeout; extension not loaded in the running Chrome profile). The Tickets section visual check against 11-UI-SPEC.md is NOT claimed as passed and needs an orchestrator/operator follow-up. All structural/copy criteria are covered by the component tests.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. T-11-10/11/12 mitigations applied as planned (isAdmin gate inherited, RLS is the enforcement layer, text-node-only rendering of context/messages).

## Known Stubs

- `onRowClick` → detail dialog wiring is complete; no placeholder data paths. The tickets table is legitimately empty in prod (0 rows post-11-02 cleanup) — the 'No tickets yet' empty state is the expected live render until 11-04 adds admin submission.

## Heads-up for 11-04

- `lib/ticket-display.ts` exports the locked badge/type maps — reuse for the New Ticket dialog rather than redefining
- `useTickets` invalidation key is `['tickets']` prefix — `useCreateTicket` in 11-04 should invalidate the same prefix so the table refreshes
- The section header currently has no 'New Ticket' CTA (TKT-03 scope); UI-SPEC locks its copy and placement (right-aligned in the section header, `RiAddLine`)
- send-support-ticket already accepts optional type/severity (extended in 11-02) for the admin submission path
## Self-Check: PASSED

All 8 claimed files exist on disk; commits 5544120, 9334c23, e54b942, 5014d3e, d5d5e52 verified in git log.
