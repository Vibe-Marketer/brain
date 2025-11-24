#!/bin/bash

# Environment Configuration Test Script
# Tests both local .env and Supabase vault secrets

set -e

echo "🔍 Environment Configuration Test"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must be run from the project root${NC}"
    exit 1
fi

# Test 1: Local .env file
echo -e "${BLUE}Test 1: Local .env File${NC}"
echo "------------------------"

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Load .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs 2>/dev/null || true)
fi

# Check frontend variables
declare -a frontend_vars=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_PUBLISHABLE_KEY"
    "VITE_SUPABASE_PROJECT_ID"
)

frontend_ok=0
frontend_missing=0

for var in "${frontend_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Missing: $var${NC}"
        ((frontend_missing++))
    else
        echo -e "${GREEN}✅ Found: $var${NC}"
        ((frontend_ok++))
    fi
done

echo ""

# Check backend variables (optional in .env, should be in Supabase vault)
echo -e "${BLUE}Backend Variables in .env (optional):${NC}"
declare -a backend_vars=(
    "SUPABASE_SERVICE_ROLE_KEY"
    "OPENAI_API_KEY"
    "FATHOM_OAUTH_CLIENT_ID_DEV"
    "FATHOM_OAUTH_CLIENT_SECRET_DEV"
)

for var in "${backend_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠️  Not in .env: $var (should be in Supabase vault)${NC}"
    else
        echo -e "${GREEN}✅ Found in .env: $var${NC}"
    fi
done

echo ""
echo ""

# Test 2: Supabase CLI and secrets
echo -e "${BLUE}Test 2: Supabase Configuration${NC}"
echo "-------------------------------"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not installed${NC}"
    echo "   Install: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI installed${NC}"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "   Run: supabase login"
    echo ""
    echo "   Skipping secrets check..."
else
    echo -e "${GREEN}✅ Logged in to Supabase${NC}"
    echo ""
    
    # Check project link
    if [ ! -f ".supabase/config.toml" ]; then
        echo -e "${YELLOW}⚠️  Project not linked${NC}"
        echo "   Run: supabase link --project-ref vltmrnjsubfzrgrtdqey"
    else
        echo -e "${GREEN}✅ Project linked${NC}"
        echo ""
        
        # List secrets
        echo -e "${BLUE}Checking Supabase Vault Secrets:${NC}"
        echo ""
        
        declare -a required_secrets=(
            "SUPABASE_SERVICE_ROLE_KEY"
            "FATHOM_OAUTH_CLIENT_ID_DEV"
            "FATHOM_OAUTH_CLIENT_SECRET_DEV"
            "OPENAI_API_KEY"
        )
        
        declare -a optional_secrets=(
            "FATHOM_OAUTH_CLIENT_ID"
            "FATHOM_OAUTH_CLIENT_SECRET"
            "ANTHROPIC_API_KEY"
            "GEMINI_API_KEY"
            "SB_PUBLISHABLE_KEY"
            "SB_SECRET"
        )
        
        # Get secrets list
        secrets_output=$(supabase secrets list 2>/dev/null || echo "")
        
        if [ -z "$secrets_output" ]; then
            echo -e "${YELLOW}⚠️  Unable to fetch secrets (might need to redeploy functions)${NC}"
        else
            echo "Required secrets:"
            for secret in "${required_secrets[@]}"; do
                if echo "$secrets_output" | grep -q "$secret"; then
                    echo -e "${GREEN}  ✅ $secret${NC}"
                else
                    echo -e "${RED}  ❌ $secret${NC}"
                fi
            done
            
            echo ""
            echo "Optional secrets:"
            for secret in "${optional_secrets[@]}"; do
                if echo "$secrets_output" | grep -q "$secret"; then
                    echo -e "${GREEN}  ✅ $secret${NC}"
                else
                    echo -e "${YELLOW}  ⚠️  $secret (not set)${NC}"
                fi
            done
        fi
    fi
fi

echo ""
echo ""

# Test 3: Check if functions are deployed
echo -e "${BLUE}Test 3: Edge Functions Status${NC}"
echo "-----------------------------"

if [ -d "supabase/functions" ]; then
    function_count=$(find supabase/functions -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ Found $function_count Edge Functions${NC}"
    
    # List them
    echo ""
    echo "Functions to deploy:"
    for dir in supabase/functions/*/; do
        func_name=$(basename "$dir")
        echo "  • $func_name"
    done
    
    echo ""
    echo -e "${YELLOW}Note: After setting secrets, run:${NC}"
    echo "  supabase functions deploy"
else
    echo -e "${RED}❌ No functions directory found${NC}"
fi

echo ""
echo ""

# Summary
echo -e "${BLUE}=================================="
echo "Summary"
echo -e "==================================${NC}"
echo ""

if [ $frontend_missing -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend configuration complete${NC}"
else
    echo -e "${RED}❌ Frontend missing $frontend_missing variables${NC}"
fi

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Verify Supabase secrets: supabase secrets list"
echo "  2. Set any missing secrets: supabase secrets set SECRET_NAME=\"value\""
echo "  3. Deploy functions: supabase functions deploy"
echo "  4. Deploy test-secrets function: supabase functions deploy test-secrets"
echo "  5. Test via app: npm run dev -> Settings -> Test Connection"
echo ""
echo -e "${BLUE}For detailed testing, deploy test-secrets function and call it from your app.${NC}"
echo ""
