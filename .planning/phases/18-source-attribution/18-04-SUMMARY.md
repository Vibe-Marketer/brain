---
phase: 18-source-attribution
plan: 04
subsystem: ui
tags: [react, tickets, source-attribution, admin-center]

requires:
  - phase: 18-source-attribution
    provides: ticket_source enum values, source metrics RPC, and TicketSource types
provides:
  - Plain-English source labels for current and Phase 18 ticket sources
  - Admin Tickets source filter covering every supported source value
  - Opt-in source grouping and source mix inside the existing Tickets surface
affects: [phase-20-nightly-qa, phase-21-sentry, phase-23-reporter-comms]

tech-stack:
  added: []
  patterns:
    - Centralized ticket source labels in ticket-display.ts
    - Loaded-page source grouping in TicketTable

key-files:
  created:
    - src/lib/__tests__/ticket-display.test.ts
    - .planning/phases/18-source-attribution/18-04-browser.png
  modified:
    - src/lib/ticket-display.ts
    - src/components/settings/TicketTable.tsx
    - src/components/settings/__tests__/TicketTable.test.tsx
    - src/pages/admin/TicketsSection.tsx

key-decisions:
  - "Unknown, empty, and future ticket source values render as Unknown source instead of prettified machine text."
  - "Grouping stays inside TicketTable as optional loaded-page group headers, preserving existing row clicks and pagination."
  - "Source mix is computed from the loaded page and used as a one-click source filter without adding a new route or tab."

patterns-established:
  - "Ticket source labels and filter labels come from ticket-display.ts, not local page strings."
  - "Operator-facing source UI uses plain-English labels only; machine values remain filter payloads."

requirements-completed: [SRC-02]

duration: 8min
completed: 2026-06-13
---

# Phase 18: Source Attribution Plan 04 Summary

**Admin Tickets now exposes source attribution as plain-English labels, filter options, source mix, and opt-in grouping in the existing Tickets surface.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-13T17:59:15Z
- **Completed:** 2026-06-13T18:07:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Locked `ticketSourceLabel()` to the UI-SPEC label table and made unrecognized source values render as `Unknown source`.
- Expanded the Admin Tickets source filter to all Phase 18 values in the required order.
- Added loaded-page source mix cards and an opt-in `Group by source` switch inside the existing Tickets section.
- Added regression coverage proving source cells do not render raw machine values.

## Task Commits

1. **Task 1: Lock source labels and no-raw-enum fallback** - `bae61cba` (`feat(18)`)
2. **Task 2: Expand Tickets source filter and add group-by-source view** - `23ddc24f` (`feat(18)`)

## Files Created/Modified

- `src/lib/ticket-display.ts` - Central source label table, source order, and filter options.
- `src/lib/__tests__/ticket-display.test.ts` - Locked label and unknown fallback coverage.
- `src/components/settings/TicketTable.tsx` - Optional source grouping rows and updated filtered empty-state copy.
- `src/components/settings/__tests__/TicketTable.test.tsx` - Source-label and grouping regression coverage.
- `src/pages/admin/TicketsSection.tsx` - Source filter options, source mix cards, and group-by-source switch.
- `.planning/phases/18-source-attribution/18-04-browser.png` - Browser verification screenshot of `/admin/tickets`.

## Decisions Made

- Kept the group-by-source behavior as an optional `TicketTable` prop so the existing ungrouped table remains the default.
- Computed source mix from already-loaded rows to preserve bounded pagination and avoid adding a service/RPC dependency in this UI-only plan.
- Kept source values server-owned: UI controls only filter/group and do not edit ticket source.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The saved Playwright auth state redirected to `/login`; a real browser check was completed by loading repo credentials into the Playwright process without printing them.
- The raw enum grep also scanned `.test.tsx`; the table test avoids raw machine-value literals while still asserting they do not render.

## Verification

- `npm test -- src/lib/__tests__/ticket-display.test.ts src/components/settings/__tests__/TicketTable.test.tsx` - passed, 19 tests.
- `npm run type-check` - passed with 0 new errors; existing baseline remains 347/776.
- `! grep -RnE "nightly_qa|in_app_user|internal" src/pages/admin src/components/settings --include='*.tsx'` - passed.
- Browser verification at `http://127.0.0.1:3001/admin/tickets` - reached authenticated Tickets surface, saw Source mix, Group by source, all five plain-English labels, no raw `nightly_qa`/`in_app_user` leakage, and no console errors. Source dropdown order matched the UI-SPEC list exactly.
- Linked schema verification - `supabase db push --linked --include-all --yes` reported remote database up to date; regenerated `src/types/supabase.ts` had no diff; live `ticket_source` enum returned `manual`, `sentry`, `unknown`, `nightly_qa`, `internal`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

SRC-02 operator filtering/grouping is ready for downstream QA and Sentry phases. Source metrics from prior Phase 18 plans can now use the same labels when surfaced elsewhere.

---
*Phase: 18-source-attribution*
*Completed: 2026-06-13*
