#!/bin/bash

# Migration Helper Script
# Guides you through migrating data from old conversion-brain

set -e

echo "🚀 Conversion Brain Data Migration"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the project root (/Users/Naegele/dev/brain)"
    exit 1
fi

# Check if scripts directory exists
if [ ! -d "scripts" ]; then
    mkdir -p scripts
fi

# Step 1: Check for service role key
echo "Step 1: Checking .env configuration..."
if ! grep -q "SUPABASE_SERVICE_ROLE_KEY" .env 2>/dev/null; then
    echo "⚠️  Missing SUPABASE_SERVICE_ROLE_KEY in .env"
    echo ""
    echo "Please add your new Supabase service role key to .env:"
    echo "  1. Go to https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey"
    echo "  2. Settings → API → Copy 'service_role' key"
    echo "  3. Add to .env: SUPABASE_SERVICE_ROLE_KEY=\"eyJhbG...\""
    echo ""
    read -p "Press Enter when ready to continue..."
fi

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if we have the credentials now
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY still not set in .env"
    exit 1
fi

if [ -z "$SUPABASE_URL" ] && [ -z "$VITE_SUPABASE_URL" ]; then
    echo "❌ Error: SUPABASE_URL or VITE_SUPABASE_URL not set in .env"
    exit 1
fi

# Use VITE_SUPABASE_URL if SUPABASE_URL is not set
if [ -z "$SUPABASE_URL" ]; then
    export SUPABASE_URL="$VITE_SUPABASE_URL"
fi

echo "✅ Environment configured"
echo ""

# Step 2: Check for old project
OLD_PROJECT="/Users/Naegele/dev/conversion-brain"
if [ ! -d "$OLD_PROJECT" ]; then
    echo "❌ Error: Old project not found at $OLD_PROJECT"
    exit 1
fi

echo "Step 2: Found old project at $OLD_PROJECT"
echo ""

# Step 3: Check for existing export
EXPORT_FILE=$(ls database-export-*.json 2>/dev/null | head -1)

if [ -z "$EXPORT_FILE" ]; then
    echo "Step 3: No export found. Running export from old Supabase..."
    echo ""
    
    cd "$OLD_PROJECT"
    
    OLD_URL="https://phfwibxcuavoqykrlcir.supabase.co"
    OLD_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZndpYnhjdWF2b3F5a3JsY2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQzNzc4OSwiZXhwIjoyMDc3MDEzNzg5fQ.9cvdPgZ9mtAKYuXGiW-M0oOPTjTDK4EkOfiC9hXVNpg"
    
    echo "Exporting from: $OLD_URL"
    SUPABASE_URL="$OLD_URL" SUPABASE_SERVICE_ROLE_KEY="$OLD_KEY" node scripts/export-via-api.js
    
    # Find the newly created export
    EXPORT_FILE=$(ls -t database-export-*.json 2>/dev/null | head -1)
    
    if [ -z "$EXPORT_FILE" ]; then
        echo "❌ Error: Export failed"
        exit 1
    fi
    
    # Copy to new project
    echo ""
    echo "Copying export to new project..."
    cp "$EXPORT_FILE" /Users/Naegele/dev/brain/
    
    cd /Users/Naegele/dev/brain
    EXPORT_FILE=$(basename "$EXPORT_FILE")
else
    echo "Step 3: Found existing export: $EXPORT_FILE"
    echo ""
    read -p "Use this export? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting. Delete the old export and run again."
        exit 1
    fi
fi

# Step 4: Import
echo ""
echo "Step 4: Importing data into new Supabase..."
echo "Target: $SUPABASE_URL"
echo ""

node scripts/import-from-old-supabase.js "$EXPORT_FILE"

echo ""
echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Check your data: npm run dev"
echo "  2. Re-authorize Fathom in Settings"
echo "  3. Test syncing new meetings"
echo ""
echo "See MIGRATION-FROM-OLD.md for detailed post-migration steps."
echo ""
