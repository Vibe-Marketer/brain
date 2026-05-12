# Plan 39-01 Summary — fathom_raw_calls Mirror Schema

**Status:** COMPLETE (code) / PENDING-DEPLOY (DB migration)
**Date:** 2026-05-12

## Deliverables

- `supabase/migrations/20260512000001_fathom_raw_calls_mirror_columns.sql`
  - ADD COLUMN `mirror_version` (INT NOT NULL DEFAULT 1)
  - ADD COLUMN `import_source_id` (UUID FK to `import_sources(id)` ON DELETE SET NULL)
  - Backfill `import_source_id` from each user's primary active fathom source
  - Indexes: partial on `import_source_id`, DESC on `synced_at`, composite
- `src/test/migrations/phase39-fathom-mirror-schema.integration.test.ts`
  - Donor-user pattern (reuses existing `fathom_raw_calls.user_id`)
  - Asserts `mirror_version=1` default, `import_source_id` nullable+FK, `synced_at` populated
  - Asserts ON CONFLICT idempotency on `(recording_id, user_id)`
  - 2 tests pass on a DB with the migration applied; auto-skip without env

## Operator action required

```bash
supabase db push --linked --include-all   # applies 39-01 migration + others pending
npm test -- --run src/test/migrations/phase39-fathom-mirror-schema   # verifies
```
