#!/bin/bash

# Setup Secrets in Supabase
# This script helps you set all required secrets for Edge Functions

set -e

echo "🔐 Supabase Secrets Setup"
echo "========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${RED}❌ Project not linked${NC}"
    echo "Run: supabase link --project-ref vltmrnjsubfzrgrtdqey"
    exit 1
fi

echo -e "${GREEN}✅ Project linked${NC}"
echo ""

echo "This script will help you set the following secrets:"
echo ""
echo "Required:"
echo "  • OPENAI_API_KEY"
echo "  • FATHOM_OAUTH_CLIENT_ID_DEV"
echo "  • FATHOM_OAUTH_CLIENT_SECRET_DEV"
echo ""
echo "Optional:"
echo "  • FATHOM_OAUTH_CLIENT_ID (production)"
echo "  • FATHOM_OAUTH_CLIENT_SECRET (production)"
echo "  • ANTHROPIC_API_KEY"
echo "  • GEMINI_API_KEY"
echo ""
echo -e "${YELLOW}Note: Secrets are stored securely in Supabase Vault${NC}"
echo -e "${YELLOW}      You won't be able to view them after setting${NC}"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

echo ""
echo "Setting secrets..."
echo ""

# Function to set a secret
set_secret() {
    local name=$1
    local required=$2
    
    echo -n "Enter $name"
    if [ "$required" = "true" ]; then
        echo -n " (required): "
    else
        echo -n " (optional, press Enter to skip): "
    fi
    
    read -s value
    echo "" # New line after hidden input
    
    if [ -z "$value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ Required secret cannot be empty${NC}"
            return 1
        else
            echo -e "${YELLOW}⏭️  Skipped${NC}"
            return 0
        fi
    fi
    
    if supabase secrets set "$name=$value" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Set $name${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to set $name${NC}"
        return 1
    fi
}

# Set required secrets
echo -e "${BLUE}Required Secrets:${NC}"
echo ""

set_secret "OPENAI_API_KEY" "true"
set_secret "FATHOM_OAUTH_CLIENT_ID_DEV" "true"
set_secret "FATHOM_OAUTH_CLIENT_SECRET_DEV" "true"

echo ""
echo -e "${BLUE}Optional Secrets:${NC}"
echo ""

set_secret "FATHOM_OAUTH_CLIENT_ID" "false"
set_secret "FATHOM_OAUTH_CLIENT_SECRET" "false"
set_secret "ANTHROPIC_API_KEY" "false"
set_secret "GEMINI_API_KEY" "false"

echo ""
echo ""
echo -e "${GREEN}✅ Secrets setup complete!${NC}"
echo ""
echo "Verify secrets:"
echo "  supabase secrets list"
echo ""
echo "Next steps:"
echo "  1. Deploy Edge Functions: supabase functions deploy"
echo "  2. Test configuration: npm run dev"
echo ""
