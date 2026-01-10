# Migration Application Instructions

## Migration: 20260110000001_create_content_library_tables.sql

This migration creates the `content_library` and `templates` tables for the Content Library & Templates feature.

### Apply via Supabase Dashboard

1. **Open Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey

2. **Go to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Copy Migration SQL**
   - Open the migration file: `supabase/migrations/20260110000001_create_content_library_tables.sql`
   - Copy the entire contents

4. **Execute Migration**
   - Paste the SQL into the SQL Editor
   - Click "Run" to execute

### Verify Migration Success

After applying the migration, run these verification queries:

```sql
-- 1. Verify tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('content_library', 'templates');
-- Expected: 2 rows (content_library, templates)

-- 2. Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('content_library', 'templates');
-- Expected: rowsecurity = true for both tables

-- 3. Verify policies exist (should have 8 total: 4 per table)
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('content_library', 'templates');
-- Expected: 8 rows (4 policies per table: SELECT, INSERT, UPDATE, DELETE)

-- 4. Verify indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('content_library', 'templates');
-- Expected: Multiple indexes for performance

-- 5. Verify triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('content_library', 'templates');
-- Expected: update_*_updated_at triggers for both tables
```

### Tables Created

#### content_library
Stores AI-generated content for reuse:
- `id` - UUID primary key
- `user_id` - Owner reference
- `team_id` - Optional team association
- `content_type` - Type: email, social, testimonial, insight, other
- `title` - Content title (max 255 chars)
- `content` - The content text (max 50,000 chars)
- `tags` - Array of tags for filtering
- `metadata` - JSONB for flexible attributes
- `usage_count` - How many times used
- `created_at`, `updated_at` - Timestamps

#### templates
Stores reusable templates with variable placeholders:
- `id` - UUID primary key
- `user_id` - Owner reference
- `team_id` - Optional team association
- `name` - Template name (max 255 chars)
- `description` - Optional description
- `template_content` - Template with {{variables}} (max 50,000 chars)
- `variables` - JSONB array of variable definitions
- `content_type` - Type: email, social, testimonial, insight, other
- `is_shared` - Whether shared with team
- `usage_count` - How many times used
- `created_at`, `updated_at` - Timestamps

### RLS Policies

Both tables have Row Level Security enabled with these policies:

**content_library:**
- SELECT: Users can view their own content and team content
- INSERT: Users can insert their own content
- UPDATE: Users can update their own content
- DELETE: Users can delete their own content

**templates:**
- SELECT: Users can view their own templates and shared team templates
- INSERT: Users can insert their own templates
- UPDATE: Users can update their own templates
- DELETE: Users can delete their own templates

### Rollback (if needed)

```sql
-- WARNING: This will delete all data in these tables!
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.content_library CASCADE;
```
