# PENDING DATABASE MIGRATION - ACTION REQUIRED

## Issue

Multiple chat tools are failing with errors like:
```
{
  "error": "Failed to retrieve metadata",
  "details": "Could not find the function public.get_available_metadata(p_metadata_type, p_user_id) in the schema cache"
}
```

## Root Cause

**The migration `20260108000004_enhance_chat_tools_metadata_filters.sql` was never applied to the production database.**

## Required Fix

### Step 1: Apply Migration via Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/sql
2. Copy the entire contents of: `supabase/migrations/20260108000004_enhance_chat_tools_metadata_filters.sql`
3. Paste into SQL Editor and click "Run"

### Step 2: Refresh Schema Cache

After migration, run:
```sql
NOTIFY pgrst, 'reload schema';
```

### Step 3: Verify

Run this verification query:
```sql
-- Should return 2 rows: hybrid_search_transcripts (16 params) and get_available_metadata (2 params)
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('hybrid_search_transcripts', 'get_available_metadata');
```

## What Gets Fixed

After applying this migration:
- `getAvailableMetadata` tool will work (metadata discovery for speakers, topics, tags, etc.)
- `searchByIntentSignal` tool will work (filter by buying signals, objections, etc.)
- `searchBySentiment` tool will work (filter by positive/negative/neutral)
- `searchByTopics` tool will work (filter by extracted topics)
- `searchByUserTags` tool will work (filter by user tags)
- `advancedSearch` tool will work with all metadata filters

## Code Changes Already Made

- Fixed TypeScript types parameter order for `get_available_metadata`
- Commit: 0669402

## Estimated Time

5-10 minutes

## Delete This File

After successfully applying the migration, you can delete this file:
```bash
rm PENDING_DATABASE_MIGRATION.md
```
