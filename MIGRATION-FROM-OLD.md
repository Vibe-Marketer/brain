# Migration from Old Conversion-Brain

This guide walks you through migrating your Fathom call data from the old Lovable-hosted Supabase to your new independent Supabase instance.

## Prerequisites

- [x] Old conversion-brain project still accessible at `/Users/Naegele/dev/conversion-brain`
- [x] Old Supabase credentials in old project's `.env`
- [ ] New Supabase service role key

## Step 1: Get New Supabase Service Role Key

1. Go to https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey
2. Click **Settings** → **API**
3. Copy the **service_role** key (not the anon key)
4. Add it to `/Users/Naegele/dev/brain/.env`:

```bash
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
SUPABASE_URL="https://vltmrnjsubfzrgrtdqey.supabase.co"
```

## Step 2: Export Data from Old Supabase

```bash
cd /Users/Naegele/dev/conversion-brain

# Export all data
SUPABASE_URL="https://phfwibxcuavoqykrlcir.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZndpYnhjdWF2b3F5a3JsY2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQzNzc4OSwiZXhwIjoyMDc3MDEzNzg5fQ.9cvdPgZ9mtAKYuXGiW-M0oOPTjTDK4EkOfiC9hXVNpg" \
node scripts/export-via-api.js
```

**Output:** `database-export-2025-11-23.json` (or similar date)

This will export ALL tables including:
- `fathom_calls` - Your meeting recordings
- `fathom_transcripts` - Transcripts
- `processed_webhooks` - Webhook history
- `speakers`, `contacts`, `tags`, etc.

## Step 3: Copy Export to New Project

```bash
# Copy the export file
cp database-export-*.json /Users/Naegele/dev/brain/
```

## Step 4: Import into New Supabase

```bash
cd /Users/Naegele/dev/brain

# Make sure you have the service role key in .env first!
# Then run the import
node scripts/import-from-old-supabase.js database-export-2025-11-23.json
```

The script will:
- ✅ Upsert data (won't duplicate existing records)
- ✅ Handle foreign key dependencies automatically
- ✅ Import in batches to avoid timeouts
- ✅ Use `recording_id` as the conflict key for `fathom_calls`

## Step 5: Verify Migration

After import completes, verify your data:

1. **Check Supabase Dashboard:**
   - Go to https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/editor
   - Check `fathom_calls` table for your records
   - Verify `fathom_transcripts` are linked

2. **Check in App:**
   ```bash
   npm run dev
   ```
   - Navigate to Transcripts page
   - Verify calls are showing up
   - Test that transcripts load correctly

## Troubleshooting

### "Missing service role key"
- Go to Supabase Dashboard → Settings → API
- Copy **service_role** key (NOT anon key)
- Add to `.env` file

### "Table does not exist"
- Ensure migrations are applied: `supabase db push`
- Or if already pushed, check migration status

### "Foreign key constraint violation"
- This means the import order has a dependency issue
- The script handles this automatically, but if you modified tables, check schema

### "Duplicate key value violates unique constraint"
- This is expected if records already exist
- The script uses `upsert` with `onConflict`, so it should update existing records
- If it fails, it means the conflict column doesn't match

## Expected Results

| Table | Description | Expected Count |
|-------|-------------|----------------|
| `fathom_calls` | Meeting recordings | Your total meetings |
| `fathom_transcripts` | Transcripts | Same as fathom_calls |
| `processed_webhooks` | Webhook history | Varies |
| `speakers` | Speaker profiles | Number of unique speakers |
| `contacts` | Contact records | If you had any |

## What Gets Migrated

✅ **Migrated:**
- All Fathom meetings and transcripts
- Speakers and their data
- Contact records and associations
- Tags and categories
- Webhook processing history
- Sync job history

❌ **Not Migrated (recreate manually):**
- User accounts (re-register with same email)
- Fathom OAuth tokens (re-authorize Fathom)
- Webhook subscriptions (recreate via Settings)
- Edge Function secrets (reset in Supabase dashboard)

## Post-Migration Steps

1. **Re-authorize Fathom:**
   - Go to Settings → Fathom Configuration
   - Click "Connect Fathom"
   - Authorize again

2. **Recreate Webhook (if used):**
   - Settings → Webhook Configuration
   - Click "Create Webhook"

3. **Test Sync:**
   - Try syncing new meetings
   - Verify new webhooks work

## Cleanup (Optional)

After confirming everything works:

```bash
# Remove export file (it contains all your data)
rm /Users/Naegele/dev/brain/database-export-*.json
rm /Users/Naegele/dev/conversion-brain/database-export-*.json
```

## Need Help?

If something goes wrong:
1. Check the error messages from the import script
2. Check Supabase logs: Dashboard → Logs → Database
3. Verify `.env` has correct credentials
4. Ensure migrations are applied: `supabase db push`
