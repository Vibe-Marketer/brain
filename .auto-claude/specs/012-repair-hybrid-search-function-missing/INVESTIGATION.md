# Investigation Report: Missing hybrid_search_transcripts Function

**Date:** 2026-01-10
**Issue:** CallVault MCP Server's transcript search failing with "function not found in schema cache" error
**Status:** Root Cause Identified

---

## Executive Summary

The `public.hybrid_search_transcripts` PostgreSQL function exists in the production database but has an **outdated 15-parameter signature**. The chat-stream Edge Function expects the **new 16-parameter signature** with `filter_intent_signals` and `filter_user_tags` parameters. This signature mismatch causes PostgREST to report "function not found" because no function matches the requested parameters.

**Root Cause:** Migration `20260108000004_enhance_chat_tools_metadata_filters.sql` was never applied to the production database.

---

## 1. Root Cause

### Primary Finding

**Migration 20260108000004 was NEVER applied to the production Supabase database.**

The migration file exists in the repository (`supabase/migrations/20260108000004_enhance_chat_tools_metadata_filters.sql`) and defines the updated function signature, but the production database still has the old function version from migration `20251125235835_add_metadata_filters.sql`.

### Classification

| Category | Determination |
|----------|--------------|
| Function exists? | YES |
| Correct signature? | NO - Missing 1 parameter, wrong param name |
| Stale cache? | NO - Cache correctly reflects outdated function |
| Migration applied? | NO - Migration 20260108000004 never executed |

---

## 2. Evidence

### 2.1 TypeScript Types Analysis

The `src/integrations/supabase/types.ts` file is auto-generated from the production database schema using `supabase gen types typescript --linked`. Its contents definitively show the database state:

**Current Production Signature (lines 1288-1322):**

```typescript
hybrid_search_transcripts: {
  Args: {
    filter_categories?: string[]
    filter_date_end?: string
    filter_date_start?: string
    filter_intent?: string[]           // <-- WRONG NAME (should be filter_intent_signals)
    filter_recording_ids?: number[]
    filter_sentiment?: string
    filter_speakers?: string[]
    filter_topics?: string[]
    filter_user_id?: string
    full_text_weight?: number
    match_count?: number
    query_embedding: string
    query_text: string
    rrf_k?: number
    semantic_weight?: number
  }
  Returns: {
    call_category: string
    call_date: string
    call_title: string
    chunk_id: string
    chunk_index: number
    chunk_text: string
    fts_rank: number
    intent_signals: string[]
    recording_id: number
    rrf_score: number
    sentiment: string
    similarity_score: number
    speaker_email: string
    speaker_name: string
    topics: string[]
    // MISSING: user_tags, entities
  }[]
}
```

### 2.2 Expected vs Actual Comparison

| Aspect | Current (Production DB) | Expected (Migration 004) | Match? |
|--------|------------------------|-------------------------|--------|
| **Parameter Count** | 15 | 16 | NO |
| **Intent Signal Param** | `filter_intent` | `filter_intent_signals` | NO (wrong name) |
| **User Tags Param** | Missing | `filter_user_tags TEXT[]` | NO |
| **Return: user_tags** | Missing | `TEXT[]` | NO |
| **Return: entities** | Missing | `JSONB` | NO |
| **All other params** | Correct | Match | YES |
| **All other return cols** | Correct | Match | YES |

### 2.3 chat-stream Edge Function Call Pattern

The Edge Function (`supabase/functions/chat-stream/index.ts` lines 886-903) calls the function with the NEW parameter names:

```typescript
const { data: candidates, error } = await supabase.rpc('hybrid_search_transcripts', {
  query_text: query,
  query_embedding: queryEmbedding,
  match_count: candidateCount,
  full_text_weight: 1.0,
  semantic_weight: 1.0,
  rrf_k: 60,
  filter_user_id: user.id,
  filter_date_start: metadataFilters.date_start || null,
  filter_date_end: metadataFilters.date_end || null,
  filter_speakers: metadataFilters.speakers || null,
  filter_categories: metadataFilters.categories || null,
  filter_recording_ids: metadataFilters.recording_ids || null,
  filter_topics: metadataFilters.topics || null,
  filter_sentiment: metadataFilters.sentiment || null,
  filter_intent_signals: metadataFilters.intent_signals || null,  // NEW NAME
  filter_user_tags: metadataFilters.user_tags || null,            // NEW PARAM
});
```

When PostgREST receives this call with `filter_intent_signals` and `filter_user_tags`, it cannot find a function with these exact parameters, resulting in:

```
"function not found in schema cache"
```

### 2.4 Migration File Locations

| Migration | Status | What It Creates |
|-----------|--------|-----------------|
| `20251125235835_add_metadata_filters.sql` | APPLIED | Old 15-param signature with `filter_intent` |
| `20260108000004_enhance_chat_tools_metadata_filters.sql` | NOT APPLIED | New 16-param signature with `filter_intent_signals` + `filter_user_tags` |

---

## 3. Recommended Fix

### Step 1: Apply Migration (Required)

Execute the full contents of `supabase/migrations/20260108000004_enhance_chat_tools_metadata_filters.sql` in the Supabase SQL Editor:

**URL:** https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/sql

The migration:
1. DROPs the existing function with the old signature
2. CREATEs the function with the new 16-parameter signature
3. Adds COMMENT on the function
4. GRANTs EXECUTE permissions to `authenticated` and `service_role` roles

### Step 2: Refresh Schema Cache (Required)

After applying the migration, refresh PostgREST's schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

**Note:** May need to run twice and wait 5-10 seconds between if cache persists.

### Step 3: Regenerate TypeScript Types (Required)

Regenerate the TypeScript types to reflect the updated database schema:

```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Step 4: Verify Fix (Required)

Run verification queries:

```sql
-- Verify function exists with correct param count
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'hybrid_search_transcripts';
-- Expected: pronargs = 16

-- Verify function has new parameters
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'hybrid_search_transcripts';
-- Expected: Contains 'filter_intent_signals' and 'filter_user_tags'
```

---

## 4. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration fails | Low | Migration is idempotent (uses DROP IF EXISTS + CREATE OR REPLACE) |
| Cache not refreshed | Low | Run NOTIFY twice, verify via test RPC call |
| Types not regenerated | Low | Run supabase gen types command |
| Breaking changes | None | All parameters have defaults, existing calls continue to work |

---

## 5. Verification Checklist

After applying the fix, verify:

- [ ] `hybrid_search_transcripts` function exists with 16 parameters
- [ ] Function parameter `filter_intent_signals` exists (not `filter_intent`)
- [ ] Function parameter `filter_user_tags` exists
- [ ] Return type includes `user_tags TEXT[]`
- [ ] Return type includes `entities JSONB`
- [ ] TypeScript types file shows new signature
- [ ] MCP tool searches return results without "function not found" error
- [ ] Metadata filter searches (sentiment, intent signals, user tags) work correctly

---

## 6. Related Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260108000004_enhance_chat_tools_metadata_filters.sql` | Migration to apply |
| `supabase/migrations/20251125235835_add_metadata_filters.sql` | Old migration (currently applied) |
| `supabase/functions/chat-stream/index.ts` | Edge Function that calls the RPC |
| `src/integrations/supabase/types.ts` | TypeScript types to regenerate |
| `docs/adr/adr-004-pgvector-hybrid-search.md` | Architecture documentation |

---

## 7. Timeline

| Date | Event |
|------|-------|
| 2025-11-25 | Migration 20251125235835 applied (15-param function created) |
| 2026-01-08 | Migration 20260108000004 created in repo (not applied to prod) |
| 2026-01-08 | chat-stream Edge Function updated to use new signature |
| 2026-01-09 | "function not found in schema cache" errors started |
| 2026-01-10 | Root cause identified: migration gap |

---

**Investigation completed by:** auto-claude agent
**Investigation status:** COMPLETE - Ready for Phase 3 (Apply Fix)

---

## 8. Verification Script

A SQL verification script has been created to validate the function signature after the fix is applied:

**Location:** `.auto-claude/specs/012-repair-hybrid-search-function-missing/verify-function-signature.sql`

**How to use:**
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/sql
2. Copy/paste the entire script content
3. Execute and review the VERIFICATION SUMMARY result

**Expected Result After Fix:**
```
✅ ALL CHECKS PASSED - Function has correct 16-parameter signature
```

**Key Checks:**
- pronargs = 16 (16 parameters)
- filter_intent_signals parameter present
- filter_user_tags parameter present
- user_tags in return type
- entities in return type
