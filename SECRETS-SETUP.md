# Secrets Configuration Guide

This guide explains where secrets go and how to test your configuration.

## Understanding Secrets in This Project

### Where Secrets Are Stored

**1. Local `.env` file** (Frontend only)
- Used by: Vite (your React app)
- Location: `/Users/Naegele/dev/brain/.env`
- Contains:
  ```bash
  VITE_SUPABASE_URL="https://..."
  VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
  VITE_SUPABASE_PROJECT_ID="vltmrnjsubfzrgrtdqey"
  ```

**2. Supabase Vault** (Backend only)
- Used by: Edge Functions (Deno runtime)
- Managed via: `supabase secrets set` command
- Contains:
  - Core: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-set)
  - Fathom: `FATHOM_OAUTH_CLIENT_ID_DEV`, `FATHOM_OAUTH_CLIENT_SECRET_DEV`
  - AI: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

### Why Two Places?

- **Frontend** (browser) = public, can't have secrets → uses `.env` with `VITE_` prefix
- **Backend** (Edge Functions) = secure server-side → uses Supabase Vault

## Quick Setup

### 1. Test Current Configuration

```bash
./scripts/test-environment.sh
```

This checks:
- ✅ `.env` file has frontend variables
- ✅ Supabase CLI is installed and logged in
- ✅ Project is linked
- ✅ Lists all secrets in vault

### 2. Set Secrets via CLI

**Option A: Interactive Script (Recommended)**
```bash
./scripts/setup-secrets.sh
```

**Option B: Manual Commands**
```bash
# Required
supabase secrets set OPENAI_API_KEY="sk-proj-..."
supabase secrets set FATHOM_OAUTH_CLIENT_ID_DEV="your-client-id"
supabase secrets set FATHOM_OAUTH_CLIENT_SECRET_DEV="your-client-secret"

# Optional
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
supabase secrets set GEMINI_API_KEY="..."
```

### 3. Verify Secrets

```bash
supabase secrets list
```

You should see:
```
NAME                            | DIGEST
--------------------------------|--------
ANTHROPIC_API_KEY               | [hash]
FATHOM_OAUTH_CLIENT_ID_DEV      | [hash]
FATHOM_OAUTH_CLIENT_SECRET_DEV  | [hash]
GEMINI_API_KEY                  | [hash]
OPENAI_API_KEY                  | [hash]
SUPABASE_ANON_KEY               | [hash]
SUPABASE_DB_URL                 | [hash]
SUPABASE_SERVICE_ROLE_KEY       | [hash]
SUPABASE_URL                    | [hash]
```

### 4. Deploy Edge Functions

After setting secrets, deploy functions so they can access them:

```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy test-secrets
```

### 5. Test via App

```bash
# Start dev server
npm run dev

# Deploy test-secrets function first:
supabase functions deploy test-secrets

# Then call it from your app (requires login)
# Or use curl:
curl -X POST https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/test-secrets \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json"
```

## Required Secrets

### OPENAI_API_KEY
- Get from: https://platform.openai.com/api-keys
- Format: `sk-proj-...`
- Used for: AI-powered transcript analysis

### FATHOM_OAUTH_CLIENT_ID_DEV
- Get from: Fathom Developer Portal
- Used for: OAuth authentication with Fathom (development)

### FATHOM_OAUTH_CLIENT_SECRET_DEV
- Get from: Fathom Developer Portal
- Used for: OAuth token exchange (development)

## Optional Secrets

### FATHOM_OAUTH_CLIENT_ID & FATHOM_OAUTH_CLIENT_SECRET
- Production OAuth credentials
- Only needed if you have separate prod credentials

### ANTHROPIC_API_KEY
- Get from: https://console.anthropic.com/
- Format: `sk-ant-...`
- Future use for Claude AI

### GEMINI_API_KEY
- Get from: Google AI Studio
- Future use for Gemini AI

## Troubleshooting

### "Secrets not showing up in `supabase secrets list`"

**Cause:** You added them in the Supabase Dashboard vault, but they need to be set via CLI for Edge Functions.

**Fix:**
```bash
# Re-set via CLI
./scripts/setup-secrets.sh
```

### "Edge Function can't access secret"

**Cause:** Functions not redeployed after setting secrets.

**Fix:**
```bash
supabase functions deploy
```

### "Permission denied when setting secrets"

**Cause:** Not logged in or project not linked.

**Fix:**
```bash
supabase login
supabase link --project-ref vltmrnjsubfzrgrtdqey
```

### "How do I update a secret?"

Just set it again:
```bash
supabase secrets set SECRET_NAME="new-value"
supabase functions deploy
```

### "Can I see the secret values?"

No, they're hashed in the vault for security. You can only see:
- Secret names
- Digest (hash) of the value

To verify they work, use the `test-secrets` function.

## Security Best Practices

✅ **DO:**
- Store backend secrets in Supabase Vault
- Use `.env` only for frontend (public) variables
- Prefix frontend variables with `VITE_`
- Add `.env` to `.gitignore` (already done)
- Rotate secrets regularly

❌ **DON'T:**
- Commit secrets to git
- Share secrets in plain text
- Use production secrets in development
- Store service role key in frontend code

## Related Files

- `.env` - Frontend environment variables
- `scripts/test-environment.sh` - Test configuration
- `scripts/setup-secrets.sh` - Interactive secrets setup
- `supabase/functions/test-secrets/` - Secret testing endpoint

## Quick Reference

```bash
# List all secrets
supabase secrets list

# Set a secret
supabase secrets set NAME="value"

# Delete a secret
supabase secrets unset NAME

# Deploy functions
supabase functions deploy

# Test configuration
./scripts/test-environment.sh
```
