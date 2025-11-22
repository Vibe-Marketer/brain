# 🚀 EXPORT YOUR DATABASE NOW (Bypasses Lovable Deployment)

**Problem:** Lovable hasn't deployed the Edge Function after 35+ minutes.

**Solution:** Run export directly from your local machine - NO CORS, NO waiting!

---

## Step 1: Get Your Service Role Key

You need your `SUPABASE_SERVICE_ROLE_KEY` from Lovable.

**How to find it:**

### Option A: Check Lovable Environment Variables
1. Go to your Lovable project settings
2. Look for "Environment Variables" or "Secrets"
3. Find `SUPABASE_SERVICE_ROLE_KEY`
4. Copy the value (starts with `eyJ...`)

### Option B: Inspect Edge Function Environment
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste this code:
```javascript
// This makes a test call to any Edge Function that logs env vars
// (Note: This won't work, but Lovable might show the key in error messages)
```

### Option C: Contact Lovable Support
If you can't find it in the UI, ask Lovable support for your `SUPABASE_SERVICE_ROLE_KEY`.

---

## Step 2: Run the Local Export Script

Once you have your keys, run:

```bash
# Navigate to your project directory
cd /Users/Naegele/dev/conversion-brain

# Run the export script with your credentials
node scripts/export-database-local.js \
  "https://phfwibxcuavoqykrlcir.supabase.co" \
  "YOUR_SERVICE_ROLE_KEY_HERE"
```

**Replace `YOUR_SERVICE_ROLE_KEY_HERE`** with your actual service role key.

---

## What Happens

```
🚀 Starting LOCAL database export...
📡 Connecting to: https://phfwibxcuavoqykrlcir.supabase.co

📊 Exporting data from 64 tables...

  ⏳ users... ✅ 15 rows
  ⏳ organizations... ✅ 3 rows
  ⏳ projects... ✅ 28 rows
  ... (all 64 tables) ...

🎉 DATABASE EXPORT COMPLETE!

📊 Summary:
   • Exported: 64/64 tables
   • Total rows: 12,543
   • Failed: 0 tables

💾 Saved to: /Users/Naegele/dev/conversion-brain/database-export-2025-11-21.json
📦 File size: 15.3 MB

✅ Ready for migration!
```

---

## Step 3: Verify Export File

Check that the file was created:

```bash
ls -lh database-export-*.json
```

You should see a file like `database-export-2025-11-21.json` with a size of several MB.

---

## Step 4: Run the Migration

Once you have the export file, follow the migration guide:

```bash
# Create new Supabase project first at https://supabase.com/dashboard
# Then run:
./scripts/migrate-everything.sh database-export-2025-11-21.json
```

See [MIGRATION-README.md](./MIGRATION-README.md) for complete migration instructions.

---

## Why This Works

- **No CORS issues** - Runs on your local machine, not in browser
- **Direct database access** - Uses service role key for full admin access
- **No Lovable delays** - Doesn't rely on Lovable deployment
- **Same export format** - Creates identical JSON file as Edge Function would

---

## Troubleshooting

### "Missing required credentials"

Make sure you're providing both the URL and service role key:
```bash
node scripts/export-database-local.js \
  "https://phfwibxcuavoqykrlcir.supabase.co" \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ACTUAL_KEY..."
```

### "Permission denied" errors

You're using the ANON key instead of SERVICE_ROLE_KEY. The anon key (VITE_SUPABASE_PUBLISHABLE_KEY) won't work - you need the service role key.

### "Module not found: @supabase/supabase-js"

Install dependencies first:
```bash
npm install
```

---

## Alternative: Use Environment Variables

If you don't want to paste keys in the command line:

```bash
# Create temporary .env.export file
echo "SUPABASE_URL=https://phfwibxcuavoqykrlcir.supabase.co" > .env.export
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here" >> .env.export

# Run export
export $(cat .env.export | xargs) && node scripts/export-database-local.js

# Clean up
rm .env.export
```

---

## Summary

1. ✅ Get `SUPABASE_SERVICE_ROLE_KEY` from Lovable
2. ✅ Run `node scripts/export-database-local.js <URL> <KEY>`
3. ✅ Verify export file created
4. ✅ Run migration script

**BADA BOOM BADA BING - Database exported without waiting for Lovable! 🚀**
