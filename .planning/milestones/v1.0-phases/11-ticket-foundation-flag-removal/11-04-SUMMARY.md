---
phase: 11-ticket-foundation-flag-removal
plan: 04
subsystem: frontend
tags: [tickets, admin, tanstack-query, service-hook-pattern, ui-spec, tdd]

# Dependency graph
requires:
  - phase: 11-ticket-foundation-flag-removal
    plan: 02
    provides: "send-support-ticket Edge Function accepting optional type/severity (zod enums, DB-first intake)"
  - phase: 11-ticket-foundation-flag-removal
    plan: 03
    provides: "tickets.service/useTickets data layer, TicketTable, AdminTab Tickets section, ['tickets'] query-key prefix"
provides:
  - createTicket() service invoking send-support-ticket with type/severity + auto-attached context
  - useCreateTicket mutation invalidating ['tickets'] with UI-SPEC toasts
  - NewTicketDialog (bug|task, four severities default medium, required description)
  - AdminTab Tickets header 'New Ticket' CTA (RiAddLine, right-aligned)
affects: [12-sentry, 14-approvals, 15-attachments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single intake path: admin submission reuses the support-form Edge Function; getAppVersion/getCommit helpers exported from support-ticket.service.ts and shared (no divergent copies)"

key-files:
  created:
    - src/components/settings/NewTicketDialog.tsx
    - src/components/settings/__tests__/NewTicketDialog.test.tsx
  modified:
    - src/services/tickets.service.ts
    - src/services/support-ticket.service.ts
    - src/hooks/useTickets.ts
    - src/components/settings/AdminTab.tsx
    - src/services/__tests__/tickets.service.test.ts

key-decisions:
  - "getAppVersion/getCommit exported from support-ticket.service.ts and imported by tickets.service.ts (plan's preferred 'single copy' option) — submitSupportTicket behavior unchanged"
  - "AdminTicketType = Extract<TicketType, 'bug' | 'task'> encodes the TKT-03 two-type constraint at the type level; the Edge Function enum still accepts all four for the support form"
  - "Dialog closes via per-call mutate onSuccess; hook-level onSuccess owns invalidation + toast — failure path leaves the dialog open with state intact"

# Metrics
duration: ~20min
completed: 2026-06-11
---

# Phase 11 Plan 04: Admin Ticket Submission (TKT-03) Summary

**One-liner:** In-app admin ticket submission live — NewTicketDialog (bug|task, four severities defaulting medium) submits through the same send-support-ticket intake with URL/user-agent/org/workspace/appVersion/commit auto-attached, and the Tickets list refreshes via ['tickets'] invalidation.

## What was built

### Task 1 — createTicket service + NewTicketDialog wired to the Tickets CTA (TDD)

- **RED** (5126d5a): 4 failing tests in `tickets.service.test.ts` — payload shape (message/type/severity + url/userAgent/ids), optional identity fields omitted when absent, appVersion/commit from stubbed env vars, throw on Edge Function error. Supabase mock extended with `functions.invoke`.
- **GREEN** (eeefc75):
  - `createTicket()` in `tickets.service.ts` builds the payload exactly like `submitSupportTicket` (shared `getAppVersion`/`getCommit` now exported from `support-ticket.service.ts` — single copy, behavior identical) plus flat `type`/`severity` fields matching the 11-02 zod schema, invokes `supabase.functions.invoke('send-support-ticket')`, throws on error.
  - `useCreateTicket()` in `useTickets.ts`: mutation invalidating the `['tickets']` prefix on success with `toast.success('Ticket created')` / `toast.error('Ticket could not be created')` per UI-SPEC.
  - `NewTicketDialog.tsx` on the SupportTicketDialog shell analog: `sm:max-w-lg`, title 'New Ticket', type Select limited to bug|task (TKT-03), severity Select (critical|high|medium|low, default medium), required Textarea (maxLength 5000, whitespace-only blocked), 'Create ticket' submit disabled while pending or description empty, resetForm + close on success only.
  - AdminTab Tickets section header: right-aligned `New Ticket` Button (`variant="default"`, leading `RiAddLine`) per the UI-SPEC focal-point contract; dialog mounted alongside TicketDetailDialog.

### Task 2 — NewTicketDialog tests + phase-level regression sweep (5a70d03)

- 4 component tests (QueryClientProvider + mocked service/contexts/sonner, Select/Dialog primitive mocks in the WorkspaceManagement test idiom): locked copy with exactly bug/task and four severities defaulting medium; submit disabled on empty and whitespace-only description; success path asserting `createTicket({type:'task', severity:'high', message, userId, organizationId, workspaceId})`, 'Ticket created' toast, and dialog close; failure path asserting 'Ticket could not be created' toast with the dialog still open.
- Phase sweep: full `npm test` 194 files / 1702 tests passed (4 files / 93 tests skipped, pre-existing), `npm run build` exit 0, FLAG-01 grep (`rg -n "useFeatureFlags|isFeatureEnabled" src/`) → 0 matches.

## Deviations from Plan

None - plan executed exactly as written. (Helper sharing used the plan's explicitly offered "extract shared helpers, keep submitSupportTicket behavior identical" option.)

**Note on the docs commit:** `.planning/STATE.md` and `.planning/ROADMAP.md` carried small uncommitted recalc hunks from a concurrently running phase-06 agent (phase-06 plan counts). They are accurate disk-state recalcs and ride along in this plan's `docs(11-04)` commit; no phase-06 source files were touched.

## Verification

- `npx vitest run src/services/__tests__/tickets.service.test.ts`: 12 passed (8 existing + 4 new), 0 failed
- `npx vitest run src/components/settings/__tests__/NewTicketDialog.test.tsx`: 4 passed, 0 failed
- `npm test` full suite: 194 files / 1702 tests passed, 0 failed, exit 0
- `npm run build`: exit 0 (run on content identical to committed tree)
- `npx eslint` on all six touched files: 0 errors, 0 warnings; `npm run lint` exit 0
- `npm run type-check` (tsc --noEmit): exit 0
- Key link greps: `functions.invoke('send-support-ticket'` present in tickets.service.ts; `invalidateQueries({ queryKey: ['tickets'] })` in useCreateTicket
- FLAG-01 phase regression: `rg -n "useFeatureFlags|isFeatureEnabled" src/` → 0 matches
- Copy verified against 11-UI-SPEC.md Copywriting Contract ('New Ticket' CTA + dialog title, 'Create ticket' submit, 'Ticket created' / 'Ticket could not be created' toasts)

### Deferred to orchestrator

- **Execution-time dev-browser check** (plan `<verification>` item 3: submit a task ticket, see it in the list, open detail and see the 'created' event): attempted — Interceptor daemon is running but the Chrome bridge/extension was not reachable from this execution context (`tab_create` timeout, same condition 11-03 hit). NOT claimed as passed. All structural/copy/wiring criteria are covered by the 16 ticket-related unit/component tests. Note: prod tickets table has ≥1 real row (demo ticket 6a7c2cc9) — the live check should expect a non-empty list.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. T-11-13 (reporter from JWT inside the Edge Function; the dialog cannot set reporter_id) and T-11-14 (server-side zod enums reject invalid type/severity; UI Selects are convenience) hold as designed in 11-02.

## Known Stubs

None — the dialog is fully wired to the live intake path; no placeholder data flows.

## Self-Check: PASSED

All claimed files exist on disk; commits 5126d5a, eeefc75, 5a70d03 verified in git log.
