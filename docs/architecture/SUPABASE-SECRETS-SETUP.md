# Supabase Secrets Setup - YouTube API Keys

**Created:** 2025-11-25
**Status:** Ready to Execute

---

## Overview

This document contains the Supabase CLI commands needed to configure YouTube API secrets for Edge Functions. These commands should be run manually to ensure secrets are properly set in the Supabase project.

## Prerequisites

1. Supabase CLI installed and authenticated
2. Project linked: `supabase link --project-ref vltmrnjsubfzrgrtdqey`
3. Active internet connection

## Commands to Run

### Navigate to Project Root

```bash
cd <your-project-directory>
```

### Set YouTube Data API Key

```bash
supabase secrets set YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_API_KEY
```

**Expected Output:**

```
Finished supabase secrets set.
```

### Set Transcript API Key

```bash
supabase secrets set TRANSCRIPT_API_KEY=YOUR_TRANSCRIPT_API_KEY
```

**Expected Output:**

```
Finished supabase secrets set.
```

### Verify Secrets Were Set

```bash
supabase secrets list
```

**Expected Output:**

```
NAME                       VALUE
YOUTUBE_DATA_API_KEY       AIzaSyB***q75E
TRANSCRIPT_API_KEY         sk_qIg***NGr0
OPENAI_API_KEY             sk-proj***pEA
ANTHROPIC_API_KEY          sk-ant***AAA
... (other existing secrets)
```

### Test Secrets in Edge Function (Optional)

```bash
# Deploy a test function that uses the secrets
supabase functions deploy test-secrets

# Invoke it to verify
supabase functions invoke test-secrets
```

## Alternative: Set via Supabase Dashboard

If CLI is not available, you can set secrets via the web dashboard:

1. Go to: <https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/settings/functions>
2. Click "Edge Functions" → "Secrets"
3. Add new secrets:
   - Name: `YOUTUBE_DATA_API_KEY`
   - Value: `YOUR_YOUTUBE_API_KEY`
   - Click "Save"
4. Add second secret:
   - Name: `TRANSCRIPT_API_KEY`
   - Value: `YOUR_TRANSCRIPT_API_KEY`
   - Click "Save"

## Verification Checklist

After running the commands:

- [ ] Both secrets appear in `supabase secrets list`
- [ ] Values are masked/truncated (security feature)
- [ ] No error messages during `secrets set`
- [ ] Edge Functions can access secrets via `Deno.env.get()`

## Usage in Edge Functions

Once secrets are set, access them in Edge Functions:

```typescript
// In any Edge Function (e.g., supabase/functions/fetch-youtube-data/index.ts)
const youtubeApiKey = Deno.env.get('YOUTUBE_DATA_API_KEY');
const transcriptApiKey = Deno.env.get('TRANSCRIPT_API_KEY');

// Use in API calls
const response = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?key=${youtubeApiKey}&...`
);
```

## Security Notes

- Secrets are encrypted at rest in Supabase
- Only accessible to Edge Functions in the same project
- Not exposed in logs or error messages
- Can be rotated anytime via `supabase secrets set`

## Troubleshooting

### "Not logged in" Error

```bash
supabase login
```

### "Project not linked" Error

```bash
supabase link --project-ref vltmrnjsubfzrgrtdqey
```

### "Permission denied" Error

- Ensure you have Owner or Admin role in Supabase project
- Check organization permissions

### Secrets Not Available in Function

- Redeploy the function after setting secrets: `supabase functions deploy <function-name>`
- Secrets are loaded at function cold start, not runtime

## Next Steps

After setting secrets:

1. Create Edge Functions that use YouTube APIs (see `docs/youtube-api-setup.md`)
2. Deploy functions: `supabase functions deploy <function-name>`
3. Test from frontend using `supabase.functions.invoke()`

---

**Related Documentation:**

- Main YouTube API Guide: `docs/youtube-api-setup.md`
- Edge Functions: `supabase/functions/`
- Supabase Docs: <https://supabase.com/docs/guides/functions/secrets>

**Status:** Commands ready to execute when needed
