# Onboarding Wizard Fixes

## Summary of Changes

### 1. Webhook Step Text Updates ✅

**File:** `src/components/settings/wizard/WebhookStep.tsx`

**Changes Made:**
- **Step 1**: Changed "Copy this webhook URL" → "Copy the webhook destination URL"
- **Step 2**: Updated Fathom URL from `https://fathom.video/api_settings/new` → `https://fathom.video/customize`
- **Step 3**: Changed "Add new webhook" → "Add the webhook"

### 2. OAuth Configuration Fix ✅

**Problem:** Edge function returned 500 error: "OAuth not configured. Contact administrator."

**Root Cause:** Missing `FATHOM_OAUTH_REDIRECT_URI_DEV` and `FATHOM_OAUTH_REDIRECT_URI` in Supabase secrets.

**Solution:** Added the missing secrets:
```bash
FATHOM_OAUTH_REDIRECT_URI_DEV="http://localhost:8080/oauth/callback"
FATHOM_OAUTH_REDIRECT_URI="https://vltmrnjsubfzrgrtdqey.supabase.co/oauth/callback"
```

**Functions Redeployed:**
- ✅ `fathom-oauth-url` 
- ✅ `fathom-oauth-callback`

## Current OAuth Configuration

All required secrets are now set:

| Secret | Status | Purpose |
|--------|--------|---------|
| `FATHOM_OAUTH_CLIENT_ID_DEV` | ✅ | Development OAuth client ID |
| `FATHOM_OAUTH_CLIENT_SECRET_DEV` | ✅ | Development OAuth client secret |
| `FATHOM_OAUTH_REDIRECT_URI_DEV` | ✅ | Development callback URL |
| `FATHOM_OAUTH_CLIENT_ID` | ✅ | Production OAuth client ID |
| `FATHOM_OAUTH_CLIENT_SECRET` | ✅ | Production OAuth client secret |
| `FATHOM_OAUTH_REDIRECT_URI` | ✅ | Production callback URL |

## Testing the Wizard

### Prerequisites
1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:8080`
3. Login or create account

### Test Steps

**Step 1: Webhook Configuration**
1. You should see "Copy the webhook destination URL" (updated text ✅)
2. Click "Copy" button
3. Click "Click Here" button
4. Should open `https://fathom.video/customize` (updated URL ✅)
5. Text should say "Add the webhook" (updated text ✅)

**Step 2: OAuth Connection**
1. Click "Connect with Fathom OAuth" button
2. Should redirect to Fathom authorization page (no 500 error ✅)
3. Authorize the app
4. Should redirect back to `http://localhost:8080/oauth/callback`
5. Should see "Successfully Connected!"
6. Should auto-redirect to Settings

### Expected Results

✅ All text updated correctly
✅ Fathom URL points to `/customize`
✅ OAuth flow completes without errors
✅ Tokens stored in database
✅ Wizard marked as complete

## OAuth Flow Diagram

```
User clicks "Connect OAuth"
    ↓
Frontend calls /functions/v1/fathom-oauth-url
    ↓
Edge function generates auth URL with:
  - client_id (from FATHOM_OAUTH_CLIENT_ID_DEV)
  - redirect_uri (from FATHOM_OAUTH_REDIRECT_URI_DEV)
  - state (CSRF token)
    ↓
User redirected to Fathom authorization page
    ↓
User authorizes
    ↓
Fathom redirects to: http://localhost:8080/oauth/callback?code=...&state=...
    ↓
Frontend captures code & state
    ↓
Frontend calls /functions/v1/fathom-oauth-callback
    ↓
Edge function:
  1. Validates state
  2. Exchanges code for tokens
  3. Stores tokens in user_settings
    ↓
Success! User is connected
```

## Troubleshooting

### Issue: Still getting 500 error on OAuth
**Solution:** Functions may need a few seconds after deployment. Wait 30 seconds and try again.

### Issue: Redirect URL mismatch
**Check:** 
1. Fathom dashboard → OAuth app settings
2. Authorized redirect URIs must include:
   - `http://localhost:8080/oauth/callback` (development)
   - Your production URL + `/oauth/callback`

### Issue: State parameter invalid
**Cause:** User's browser blocked cookies or localStorage
**Solution:** Check browser privacy settings

## Files Modified

- ✅ `src/components/settings/wizard/WebhookStep.tsx` - Text and URL updates
- ✅ Supabase secrets (via CLI) - Added redirect URIs
- ✅ Edge functions redeployed - Now have access to new secrets

## Next Steps

1. **Test the complete flow** in dev environment
2. **Update Fathom OAuth app** to include both redirect URIs
3. **Test in production** after deploying

## Notes

- OAuth redirect URIs MUST match exactly what's configured in your Fathom OAuth app
- If you deploy to a custom domain, update `FATHOM_OAUTH_REDIRECT_URI` accordingly
- Development always uses `http://localhost:8080`, production uses your Supabase project URL or custom domain
