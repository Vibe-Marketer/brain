# GitHub Actions Troubleshooting Guide

## Embedding Worker Workflow Failure

### Root Cause

The `embedding-worker.yml` workflow is failing with exit code 1 due to missing GitHub Actions secrets.

### Required Secrets

The workflow requires two secrets to be configured in the repository:

1. **SUPABASE_URL** - Your Supabase project URL
2. **SUPABASE_SERVICE_ROLE_KEY** - Your Supabase service role key (admin access)

### How to Configure Secrets

#### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository: https://github.com/Vibe-Marketer/brain
2. Click on **Settings** (top right menu)
3. In the left sidebar, click **Secrets and variables** → **Actions**

#### Step 2: Add Required Secrets

Click **New repository secret** for each of the following:

**Secret 1: SUPABASE_URL**
- Name: `SUPABASE_URL`
- Value: Your Supabase project URL (format: `https://your-project.supabase.co`)

**Secret 2: SUPABASE_SERVICE_ROLE_KEY**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: Your Supabase service role key (starts with `eyJ...`)

#### Step 3: Find Your Supabase Credentials

1. Log in to https://supabase.com
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Click **API** in the left sidebar
5. Copy the values:
   - **Project URL** → use for `SUPABASE_URL`
   - **service_role secret** → use for `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important**: Never commit these values to your repository! Only add them as GitHub Secrets.

### Verification Steps

After adding the secrets:

1. Go to **Actions** tab in your repository
2. Select the **Embedding Worker Cron** workflow
3. Click **Run workflow** (manual trigger)
4. Monitor the run to verify it completes successfully

### Common Issues

#### Issue: Secrets Not Available for Scheduled Workflows

**Symptoms**: Workflow still fails even after adding secrets

**Solutions**:
- Ensure GitHub Actions has permission to run scheduled workflows
- Check repository settings → **Actions** → **General** → **Workflow permissions**
- Verify scheduled workflows are not disabled

#### Issue: Organization-Level Secrets Not Accessible

**Symptoms**: Organization secrets exist but workflow can't access them

**Solutions**:
- Go to Organization Settings → Secrets
- Ensure secrets are allowed for the `brain` repository
- Add repository-level secrets instead (recommended for this project)

#### Issue: HTTP 401/403 from Supabase

**Symptoms**: Workflow runs but curl fails with unauthorized error

**Solutions**:
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key (not anon key)
- Check that the Edge Function `process-embeddings` exists
- Ensure the service role key hasn't been rotated/regenerated

### Improved Debugging (v2 Workflow)

The updated workflow (`.github/workflows/embedding-worker.yml`) now includes:

1. **Specific error messages** - Shows which secret is missing by name
2. **Safe shell options** (`set -euo pipefail`) - Fails fast on errors
3. **URL normalization** - Handles trailing slashes correctly
4. **Clearer output** - Better logging for status codes and responses

### Manual Testing

You can test the Edge Function manually using curl:

```bash
# Replace with your actual values
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -d '{"batch_size": 10, "triggered_by": "manual-test"}' \
  "${SUPABASE_URL}/functions/v1/process-embeddings"
```

Expected successful response:
```json
{
  "success": true,
  "processed": 10,
  "message": "Embeddings processed successfully"
}
```

### Next Steps

1. ✅ **Add the two required secrets** to GitHub Actions (see Step 2 above)
2. ✅ **Manually trigger the workflow** to verify it works
3. ✅ **Monitor the next scheduled run** (runs every 5 minutes)
4. ✅ **Check workflow logs** for detailed output if issues persist

### Need More Help?

If the workflow continues to fail after adding secrets:

1. **Capture the full workflow run logs**:
   - Go to Actions → Select the failed run → Click on the job
   - Copy the complete output from the "Trigger process-embeddings worker" step

2. **Check Supabase logs**:
   - Go to your Supabase project dashboard
   - Navigate to **Edge Functions** → **Logs**
   - Look for `process-embeddings` function invocations

3. **Verify the Edge Function exists**:
   - Check that `supabase/functions/process-embeddings/index.ts` is deployed
   - Ensure it's properly configured in your Supabase project

---

**Last Updated**: 2026-01-09
**Workflow Version**: v2 (improved debugging)
