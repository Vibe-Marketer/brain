# Phase 09 Plan 06: Migration Function Summary

**Completed:** 2026-01-31
**Duration:** ~20 minutes

## One-Liner

Idempotent SQL migration functions and admin-only Edge Function to convert fathom_calls to recordings + vault_entries with automatic bank/vault creation for legacy users.

---

## What Was Built

### Task 1: Migration SQL Functions

**File:** `supabase/migrations/20260131000008_migration_function.sql`
**Commit:** `0531fb9`

Created three SQL functions for data migration:

1. **`migrate_fathom_call_to_recording(p_recording_id, p_user_id)`**
   - Migrates a single fathom_call to recordings + vault_entries
   - Creates personal bank/vault if user doesn't have one (legacy user support)
   - Idempotent: returns existing recording ID if already migrated
   - Uses SECURITY DEFINER for privileged operations

2. **`migrate_batch_fathom_calls(p_batch_size DEFAULT 100)`**
   - Processes batches of unmigrated calls
   - Returns `(migrated_count, error_count)` for monitoring
   - Continues on errors (logs warning, doesn't abort)

3. **`get_migration_progress()`**
   - Returns `(total_fathom_calls, migrated_recordings, remaining, percent_complete)`
   - Helper for monitoring migration status

### Task 2: Background Migration Edge Function

**File:** `supabase/functions/migrate-recordings/index.ts`
**Commit:** `0a25847`

- **Admin-only access:** Checks `user_roles` table for ADMIN role
- **Service role client:** Bypasses RLS for migration operations
- **Batch processing:** Calls `migrate_batch_fathom_calls` RPC with batch size 100
- **Progress tracking:** Returns before/after stats for monitoring
- **Early exit:** Returns immediately if migration already complete
- **Logging:** Logs progress to console for server-side monitoring

---

## Key Implementation Decisions

### Column Mapping Adaptation

The plan referenced `audio_url`, `video_url`, `duration` columns that don't exist in fathom_calls. Adapted:
- `url` → `audio_url` (fallback)
- `share_url` → `video_url` (fallback)
- `duration` → `NULL` (not available)

### Source Metadata Preservation

Built comprehensive `source_metadata` JSONB object preserving:
- `recorded_by_name`, `recorded_by_email`
- `calendar_invitees`
- `meeting_fingerprint`
- `google_calendar_event_id`, `google_drive_file_id`
- `sentiment_cache`
- `original_metadata` (the full fathom_calls.metadata)

### Legacy User Handling

Migration function auto-creates personal bank and vault for users who signed up before Bank/Vault architecture. This ensures ALL users get their data migrated regardless of when they created their account.

---

## Deviations from Plan

### [Rule 3 - Blocking] Adapted column mapping for actual schema

**Found during:** Task 1 implementation
**Issue:** Plan assumed fathom_calls had `audio_url`, `video_url`, `duration` columns
**Fix:** Used `url` as audio_url fallback, `share_url` as video_url fallback, NULL for duration
**Files modified:** `supabase/migrations/20260131000008_migration_function.sql`

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260131000008_migration_function.sql` | Three migration functions (single, batch, progress) |
| `supabase/functions/migrate-recordings/index.ts` | Admin-only Edge Function for batch migration |

---

## Verification

- [x] Migration file applies without errors
- [x] Functions exist in database after migration
- [x] Edge Function follows existing patterns (CORS, auth, error handling)
- [x] Admin-only access control implemented
- [x] Progress tracking returns meaningful stats

---

## Usage

### Running Migration

Call the Edge Function repeatedly until `complete: true`:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/migrate-recordings \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json"
```

### Response Format

```json
{
  "success": true,
  "batch": {
    "migrated": 100,
    "errors": 0,
    "batch_size": 100
  },
  "overall": {
    "total_calls": 5000,
    "migrated": 1500,
    "remaining": 3500,
    "complete": false
  }
}
```

### Checking Progress

```sql
SELECT * FROM get_migration_progress();
```

---

## Next Steps

- **09-07:** Bank context store and useBankContext hook (partially started)
- **09-08:** Bank switcher UI in header
- **09-09:** Banks & Vaults settings tab
- **09-10:** Wire existing pages to use bank/vault context
