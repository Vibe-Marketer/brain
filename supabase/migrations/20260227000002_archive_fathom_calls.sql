-- Archive fathom_calls after successful migration to recordings table.
-- Per Phase 15 CONTEXT: rename, NOT drop. No RLS needed — table is dormant.
-- 30-day clock starts when v2 goes live to real users (not from migration completion).
-- Scheduled for DROP in Phase 22 (Backend Cleanup).

SET lock_timeout = '5s';
ALTER TABLE fathom_calls RENAME TO fathom_calls_archive;

COMMENT ON TABLE fathom_calls_archive IS
  'Archived by Phase 15 data migration. Original fathom_calls data. Do NOT query directly.
   30-day hold from v2 go-live. Scheduled for DROP in Phase 22 (Backend Cleanup).
   Migration date: 2026-02-27.';
