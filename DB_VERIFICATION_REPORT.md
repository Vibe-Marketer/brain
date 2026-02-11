# Database Verification Report - CallVault RAG Tools
**Date:** 2026-02-09 08:16 EST  
**Working Directory:** /Users/admin/repos/brain  
**Test User:** a@vibeos.com (ef054159-3a5a-49e3-9fd8-31fa5a180ee6)

---

## Executive Summary

❌ **CRITICAL ISSUES FOUND** - Multiple database migrations are **NOT applied** to production database, causing RAG tools to fail.

### Key Findings:
1. ❌ Migration `20260209080000` (filter_bank_id) - **NOT APPLIED**
2. ⚠️  Migration `20260208223800` (get_available_metadata) - **PARTIALLY WORKING**
3. ❌ `hybrid_search_transcripts` function - **BROKEN** (schema mismatch)
4. ❌ Edge function `chat-stream-v2` - **502 Bad Gateway** (likely due to missing DB functions)

---

## Test Results Summary

### 1. Database Function: get_available_metadata ✅/⚠️

**Status:** Function exists but has schema errors

**Test Results:**
```
✅ PASS: speakers - 0 results (function works, no data)
❌ FAIL: categories - Error: relation "call_categories" does not exist
✅ PASS: tags - 12 results
❌ FAIL: topics - Error: column tt.tag_text does not exist
```

**Test Command Used:**
```sql
SELECT * FROM public.get_available_metadata('ef054159-3a5a-49e3-9fd8-31fa5a180ee6', 'speakers');
```

**Issues Found:**
- Migration expects `call_categories` table which doesn't exist in current schema
- Migration expects `transcript_tags.tag_text` column which doesn't exist
- Only `speakers` and `tags` work with current schema

**Migration File:** `supabase/migrations/20260208223800_add_get_available_metadata.sql`

---

### 2. Database Function: hybrid_search_transcripts ❌

**Status:** Function BROKEN - schema mismatch

**Error:**
```
column fc.id does not exist
Code: 42703
```

**Root Cause:**
The function references `fc.id` but the `fathom_calls` table uses `recording_id` as its primary key, not `id`.

**Test With filter_bank_id Parameter:**
```typescript
await supabase.rpc('hybrid_search_transcripts', {
  query_text: 'test',
  query_embedding: embedding,
  filter_user_id: testUserId,
  filter_bank_id: null  // ❌ Cannot test - function crashes before reaching this
});
```

**Migration File:** `supabase/migrations/20260209080000_add_bank_id_filter.sql`  
**Migration Status:** NOT APPLIED (bank_id column doesn't exist)

---

### 3. Database Column: fathom_calls.bank_id ❌

**Status:** Column does NOT exist

**Test:**
```sql
SELECT recording_id, bank_id FROM fathom_calls LIMIT 1;
```

**Error:**
```
column fathom_calls.bank_id does not exist
```

**Expected By Migration:** `20260209080000_add_bank_id_filter.sql`  
**Impact:** `hybrid_search_transcripts` cannot filter by bank_id

---

### 4. Schema Verification

**fathom_calls columns found:**
```
recording_id, user_id, title, created_at, recording_start_time, 
recording_end_time, url, share_url, recorded_by_name, recorded_by_email, 
calendar_invitees, full_transcript, summary, title_edited_by_user, 
summary_edited_by_user, ai_generated_title, ai_title_generated_at, 
auto_tags, auto_tags_generated_at, synced_at, meeting_fingerprint, 
source_platform, is_primary, merged_from, fuzzy_match_score, 
google_calendar_event_id, google_drive_file_id, transcript_source, 
sentiment_cache, metadata
```

**Missing columns (expected by migrations):**
- `bank_id` (needed for migration 20260209080000)

**Missing tables (expected by migrations):**
- `call_categories` (needed by get_available_metadata)
- `transcript_tags` (or column `tag_text` in existing table)

---

### 5. E2E RAG Tools Test Results ❌

**Test Suite:** scripts/debug/root/test-rag-final-run.ts  
**Authentication:** ✅ SUCCESS (a@vibeos.com)  
**Edge Function:** ❌ 502 Bad Gateway on ALL requests

**Tools Tested:**
```
❌ Tool 1: searchTranscriptsByQuery    - HTTP 502
❌ Tool 2: searchBySpeaker             - HTTP 502
❌ Tool 3: searchByDateRange           - HTTP 502
❌ Tool 4: searchByCategory            - HTTP 502
❌ Tool 5: getAvailableMetadata        - HTTP 502
❌ Tool 6: getCallDetails              - HTTP 502
❌ Tool 7: getCallsList                - HTTP 502
❌ Tool 8: advancedSearch              - HTTP 502
```

**Result:** 0/8 tools passing (0%)

**Root Cause Analysis:**
The edge function `chat-stream-v2` is likely crashing because:
1. It calls `hybrid_search_transcripts` which references non-existent column `fc.id`
2. Database schema doesn't match function expectations
3. Missing migrations prevent proper function execution

---

## Migration Status

### Migrations Present in Codebase:
```
✅ supabase/migrations/20260208204500_add_get_user_email.sql
✅ supabase/migrations/20260208223800_add_get_available_metadata.sql
✅ supabase/migrations/20260209080000_add_bank_id_filter.sql
```

### Migrations Applied to Database:
```
❌ Unable to verify - schema_migrations table not accessible
⚠️  Based on schema checks, migrations appear NOT to be applied
```

### Evidence Migrations Are NOT Applied:
1. `fathom_calls.bank_id` column missing
2. `call_categories` table missing
3. `hybrid_search_transcripts` still references old schema (`fc.id` instead of `fc.recording_id`)

---

## Console Errors Check

**Playwright Test Results:**
- Last run status: FAILED
- Test suite: chat-interface history across page refresh
- File: `test-results/.last-run.json`
- Playwright report: `playwright-report/index.html`

**Source Code Console Statements:**
- Found 39 console.error/console.warn statements in src/ directory
- No recent runtime logs found in project directory

**Recommendation:** Check Supabase Edge Function logs for specific error details:
```
https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/functions/chat-stream-v2/logs
```

---

## Required Actions

### IMMEDIATE (P0 - Blocking):

1. **Fix hybrid_search_transcripts schema mismatch**
   - Migration references `fc.id` but table uses `fc.recording_id`
   - Update migration file before applying
   - File: `20260209080000_add_bank_id_filter.sql`

2. **Apply pending migrations via Supabase SQL Editor**
   - Navigate to: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/sql
   - Apply migrations in order (after fixing schema issues):
     1. `20260208223800_add_get_available_metadata.sql` (after fixing table references)
     2. `20260209080000_add_bank_id_filter.sql` (after fixing fc.id → fc.recording_id)

3. **Verify get_available_metadata table references**
   - Check if `call_categories` table exists or needs to be created
   - Check if `transcript_tags.tag_text` column exists or needs migration
   - Update migration to match actual schema

### MEDIUM (P1 - Important):

4. **Refresh Supabase schema cache**
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

5. **Test edge function after migrations**
   - Verify `chat-stream-v2` responds correctly
   - Rerun E2E tests: `npx tsx scripts/debug/root/test-rag-final-run.ts`

6. **Update PENDING_DATABASE_MIGRATION.md**
   - Document current status
   - Add migration order and dependencies
   - Note schema compatibility issues found

### LOW (P2 - Cleanup):

7. **Add migration verification script**
   - Create automated test to verify migrations are applied
   - Check for schema/migration drift
   - Run as part of CI/CD

---

## Test Artifacts

### Scripts Created:
- `scripts/debug/root/verify-db-functions.ts` - Function verification
- `scripts/debug/root/test-db-complete.ts` - Comprehensive DB tests
- `scripts/debug/root/check-schema-simple.ts` - Schema checker
- `scripts/debug/root/test-rag-final-run.ts` - E2E RAG tools test

### Test Output Files:
- This report: `DB_VERIFICATION_REPORT.md`

---

## Conclusion

**The RAG tools are completely non-functional due to unapplied database migrations and schema mismatches.**

Priority actions:
1. Fix schema references in migration files (fc.id → fc.recording_id)
2. Verify table existence (call_categories, transcript_tags)
3. Apply migrations to production database
4. Test edge function functionality
5. Rerun E2E tests to verify

**Estimated time to fix:** 2-4 hours (including testing and verification)

---

**Report Generated:** Mon 2026-02-09 08:16 EST  
**Subagent Session:** ed9f619b-a7bf-43aa-baec-f2dfd39542ee
