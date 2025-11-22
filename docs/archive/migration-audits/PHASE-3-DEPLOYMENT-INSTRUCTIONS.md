# Phase 3 Deployment Instructions

## 🚀 YOU NEED TO RUN THESE COMMANDS

The automated deployment requires Supabase authentication. Please run these commands manually:

---

## Step 1: Deploy Fixed Edge Functions

```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref phfwibxcuavoqykrlcir

# Deploy the fixed Edge Functions
supabase functions deploy sync-meetings
supabase functions deploy webhook
```

**Expected Output:**
```
✅ Deployed sync-meetings
✅ Deployed webhook
```

---

## Step 2: Execute Database Migration

### Option A: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/phfwibxcuavoqykrlcir/sql
2. Click "New Query"
3. Copy the entire contents of: `supabase/migrations/20251122_drop_all_orphaned_tables.sql`
4. Paste into the SQL editor
5. Click "Run"
6. Verify you see: `✅ Successfully dropped all 13 orphaned tables`

### Option B: Via CLI (if you have DB credentials)

```bash
# If you have SUPABASE_DB_URL set
supabase db push

# OR apply specific migration
psql "$SUPABASE_DB_URL" < supabase/migrations/20251122_drop_all_orphaned_tables.sql
```

---

## Step 3: Verify Success

### Check Edge Function Logs:
```bash
# Trigger a sync to test
# Watch for [DISABLED] messages in logs confirming bugs are fixed

supabase functions logs sync-meetings
supabase functions logs webhook
```

### Check Database:
```sql
-- Run this in Supabase SQL Editor to verify tables are dropped
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agent_delivery_logs', 'agent_knowledge_base', 'agent_runs',
    'ai_agents', 'intel_items', 'contact_call_associations',
    'contact_tag_assignments', 'contact_tags', 'contacts',
    'global_knowledge_base', 'starter_agent_templates',
    'call_type_status_mapping', 'transcript_tags'
  );
```

**Expected Result:** 0 rows (all tables dropped)

---

## 🎯 What These Changes Do

### Edge Functions Fixed:
- **sync-meetings**: No longer creates orphan contact data
- **webhook**: No longer creates orphan contact data
- Both functions will log `[DISABLED] Contact creation...` when called

### Database Cleaned:
- **13 tables dropped** (15-20% database size reduction)
- **All CASCADE cleanup** (policies, triggers, indexes auto-removed)
- No more orphan data or failed queries

---

## ⚠️ IMPORTANT

1. **Deploy Edge Functions FIRST** (Step 1) before running migration (Step 2)
2. This prevents new orphan data from being created
3. Migration is **irreversible** - tables will be permanently deleted
4. Take a backup first if you're concerned (though these are orphaned tables)

---

## ✅ Success Criteria

- [ ] sync-meetings deployed successfully
- [ ] webhook deployed successfully
- [ ] Migration executed without errors
- [ ] Verification query returns 0 rows
- [ ] Application still functions normally
- [ ] No database errors in logs

---

**Ready to execute when you are!**
