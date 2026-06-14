---
phase: 23-reporter-comms-in-app
plan: 01
subsystem: database
tags: [postgres, enum, supabase, edge-function, ticket-source, zod, vitest]

requires:
  - phase: 18-source-attribution
    provides: ticket_source enum (manual/sentry/unknown/nightly_qa/internal), src/lib/ticket-display.ts source labels
provides:
  - in_app_user value on the ticket_source enum (applied to live linked DB)
  - server-authoritative source='in_app_user' stamp on new in-app tickets
  - first-class in_app_user source label (no longer a legacy fallback)
  - regenerated ticket_source union + Constants array in generated types
affects: [23-02, 23-03, 23-04, 23-05]

tech-stack:
  added: []
  patterns:
    - "Append-only enum migration (ADD VALUE IF NOT EXISTS), never reorder/rewrite/backfill"
    - "Server-authoritative source stamp at the insert boundary; client never supplies source"

key-files:
  created:
    - supabase/migrations/20260614120000_phase23_source_gate_in_app_user.sql
  modified:
    - src/types/supabase.ts
    - src/lib/ticket-display.ts
    - supabase/functions/send-support-ticket/index.ts
    - supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts
    - src/lib/__tests__/ticket-display.test.ts

key-decisions:
  - "in_app_user added additively; no backfill of historical 'manual' rows (D-00 fail-closed)"
  - "Hand-edited generated types (both union + Constants) rather than full typegen regen — migration applied live, edit matches generated shape, build clean for touched files"
  - "Promoted in_app_user into TICKET_SOURCE_LABELS and removed LEGACY_TICKET_SOURCE_LABELS now that the type includes it"

patterns-established:
  - "Source gate substrate: in_app_user is the single value every Phase 23 comms path gates on"

requirements-completed: [RSP-01]

duration: 18min
completed: 2026-06-14
---

# Phase 23 Plan 01: Source Gate (in_app_user) Summary

**Additive `in_app_user` enum value applied to the live DB, server-side source stamp flipped from `manual` to `in_app_user`, and a first-class source label — the D-00 gate substrate every Phase 23 comms path depends on.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Created and applied (`supabase db push --linked`) the additive enum migration adding `in_app_user` to `public.ticket_source` — existing values untouched, no manual-row backfill.
- Regenerated the generated `ticket_source` union and `Constants` array to include `in_app_user`.
- Flipped the server-authoritative insert stamp in `send-support-ticket` from `'manual'` to `'in_app_user'`; `source` remains absent from `supportTicketSchema` (no client-supplied source).
- Promoted `in_app_user` to a first-class `TICKET_SOURCE_LABELS` entry ("Reported by a person") and removed the legacy fallback map.

## Task Commits

1. **Task 1: Add in_app_user enum value + regenerate types + first-class label** - `c014bbc1` (feat)
2. **Task 2: Stamp in-app tickets as in_app_user server-side + update contract test** - `d20787ef` (feat, TDD RED→GREEN)

## Files Created/Modified
- `supabase/migrations/20260614120000_phase23_source_gate_in_app_user.sql` - Additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'in_app_user'` (applied live)
- `src/types/supabase.ts` - Added `in_app_user` to the `ticket_source` union and the `Constants` array
- `src/lib/ticket-display.ts` - `in_app_user` now first-class in `TICKET_SOURCE_LABELS`; legacy map removed
- `supabase/functions/send-support-ticket/index.ts` - Insert stamp `source: 'in_app_user'` with a D-00 comment
- `supabase/functions/send-support-ticket/__tests__/source-stamping.test.ts` - Contract test now expects `in_app_user`; negative + auth-before-parse assertions kept
- `src/lib/__tests__/ticket-display.test.ts` - Already covered `in_app_user → "Reported by a person"`; passes as first-class

## Decisions Made
- Hand-edited generated types instead of a full typegen regen: the migration was applied to the linked DB, the edits match the generated shape exactly, and `tsc -p tsconfig.app.json` produces zero errors in any touched file.
- No backfill of historical `manual` rows — D-00 requires fail-closed; ambiguous `manual` rows stay customer-silent.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- `tsc -p tsconfig.app.json` reports 322 pre-existing errors on the pristine base commit (root tsconfig is hollow per repo memory; `tsconfig.app.json` surfaces long-standing errors in `panelStore.test.ts`, `preferencesStore.ts`, `folders.ts`, `index.ts`). Verified by stashing my edits and re-running on the clean base — identical 322. None touch `ticket_source` or any file modified by this plan, so per the executor SCOPE BOUNDARY they are out of scope and were not fixed.

## User Setup Required
The enum migration was applied to the linked Supabase project during execution (`supabase db push --linked`). No further manual setup required.

## Next Phase Readiness
- `in_app_user` now exists in the DB enum, generated types, and on newly intaken in-app tickets. Waves 2–3 (trigger, content filter, resolution hook, UI) have a safe value to gate on.

---
*Phase: 23-reporter-comms-in-app*
*Completed: 2026-06-14*
