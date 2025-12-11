# Root Cause Analysis: Fathom Webhook Signature Verification Failures

**Date**: 2025-12-10
**Issue**: ALL Fathom webhooks failing with 401 "Invalid webhook signature"
**Severity**: Critical
**Investigator**: Claude (via /brain-rca command)

---

## Summary

Fathom webhooks are failing signature verification because **the `FATHOM_OAUTH_WEBHOOK_SECRET` environment variable in Supabase does not match the actual webhook signing secret configured in the Fathom Developer Portal**. This is a configuration mismatch, not a code bug. The webhook function correctly implements both Svix and Fathom signature formats, but no secret being tested matches what Fathom is using to sign the webhooks.

---

## Investigation

### Symptoms

- **100% webhook failure rate** - Every POST to `/functions/v1/webhook` returns HTTP 401
- Error message: "Invalid webhook signature - all methods failed"
- Webhooks ARE being received (logged in `webhook_deliveries` table)
- GET health checks return 200 (endpoint is online)
- Multiple deployment versions (41-45) all fail identically

### Diagnostics Performed

1. **Supabase Edge Function Logs**: All POST requests to webhook endpoint return 401
2. **`webhook_deliveries` Table Analysis**: Found detailed verification results showing:
   - Personal secret by email: FAILED
   - OAuth app secret: FAILED
   - First user fallback: FAILED
3. **Webhook Function Code Review** ([supabase/functions/webhook/index.ts](supabase/functions/webhook/index.ts))
4. **User Settings Analysis**: Verified 3 users have `host_email` configured
5. **Request Header Analysis**: Confirmed Svix format (`webhook-signature: v1,base64sig`)

### Evidence from Logs

```
Webhook ID: msg_36fzURFRUjCAREqumS0pg7NFC75
Signature: v1,+Yu/Cga+rxg2Z+kffafHACpyH94/MbM/kqpTx/3LCgE=
User-Agent: Svix-Webhooks/1.81.0

Verification Results:
{
  "personal_by_email": { "available": true, "verified": false, "secret_preview": "whsec_Tj8Rg0AqT..." },
  "oauth_app_secret": { "available": true, "verified": false, "secret_preview": "whsec_pr7SHWnVz..." },
  "first_user_fallback": { "available": true, "verified": false, "secret_preview": "whsec_kHRpTR8nt..." }
}
```

### Root Cause

**Configuration Mismatch**: The `FATHOM_OAUTH_WEBHOOK_SECRET` stored in Supabase secrets does not match the webhook signing secret in the Fathom Developer Portal.

#### Why This Is the Root Cause

1. **Code is correct**: The webhook function implements BOTH signature verification methods:
   - **Svix format**: HMAC-SHA256(`base64Decode(secretAfterWhsec)`, `id.timestamp.body`)
   - **Fathom format**: HMAC-SHA256(`secret`, `body`)

2. **All secrets fail**: Three different secrets are tested, ALL fail. This rules out per-user issues.

3. **Headers are correct**: Webhooks have proper Svix headers (`webhook-id`, `webhook-timestamp`, `webhook-signature`)

4. **Same webhook ID, different signatures**: Fathom retries with new timestamps, generating new signatures. This is expected Svix behavior.

5. **Previous fix was different issue**: The Dec 10 host_email auto-detection fix addressed user routing, not signature verification. Signatures were already failing before that fix.

### What The Code Tests (All Fail)

| Method | Secret Used | Signed Content | Result |
|--------|-------------|----------------|--------|
| Fathom native | Full `whsec_XXX` | Body only | FAIL |
| Fathom simple | Full secret as UTF-8 | Body only | FAIL |
| Fathom simple (no prefix) | Part after `whsec_` as UTF-8 | Body only | FAIL |
| Fathom simple (base64 decoded) | Part after `whsec_` base64 decoded | Body only | FAIL |
| Svix format | Part after `whsec_` base64 decoded | `id.timestamp.body` | FAIL |

**The only explanation for ALL methods failing is that the secret doesn't match.**

---

## Impact

- **Areas Affected**: Automatic webhook sync for ALL OAuth-connected users
- **User Impact**: New meeting recordings do NOT auto-sync to CallVault. Users must manually fetch meetings.
- **Duration**: Unknown start date. At least since Dec 10, likely longer.
- **Data Loss**: None - meetings can still be manually synced

---

## Resolution

### Immediate Fix (Required)

1. **Log into Fathom Developer Portal** (https://developers.fathom.ai or Fathom OAuth app settings)

2. **Locate the webhook signing secret** for your OAuth app
   - This is the secret shown when you registered the webhook endpoint
   - It should start with `whsec_`

3. **Update Supabase secrets**:
   ```bash
   npx supabase secrets set FATHOM_OAUTH_WEBHOOK_SECRET='whsec_YOUR_ACTUAL_SECRET_HERE'
   ```

4. **Redeploy webhook function** (or wait for cold start):
   ```bash
   npx supabase functions deploy webhook
   ```

5. **Test with a new meeting recording** - record a short test call and verify it auto-syncs

### Verification Steps

After updating the secret:

1. Check `webhook_deliveries` table for status='success' entries
2. Verify meetings appear in Transcript Library without manual fetch
3. Check Edge Function logs for "Webhook signature verified successfully"

### Long-term Prevention

1. **Document secrets location**: Add to team runbook where each secret is configured
2. **Secret rotation procedure**: When rotating secrets, update BOTH Fathom Developer Portal AND Supabase
3. **Monitoring**: Add alerting on webhook_deliveries failure rate
4. **Health check dashboard**: Create a view to monitor webhook success/failure ratio

---

## Evidence

### Webhook Deliveries (Recent Failures)

```sql
SELECT status, COUNT(*), MAX(created_at) as latest
FROM webhook_deliveries
GROUP BY status;
-- Result: ALL are 'failed' status
```

### Headers Received (Confirming Svix Format)

```json
{
  "user-agent": "Svix-Webhooks/1.81.0",
  "webhook-id": "msg_36fzURFRUjCAREqumS0pg7NFC75",
  "webhook-timestamp": "1765412784",
  "webhook-signature": "v1,691ZGGqQvXO3g+HELw/9QStCcXjF0GfbjMAfOJXSP28="
}
```

### Secrets Being Tested (All Different, All Fail)

| Source | Secret Preview | Why Tested |
|--------|----------------|------------|
| Personal (email match) | `whsec_Tj8Rg0AqT...` | User's personal webhook secret |
| OAuth app secret | `whsec_pr7SHWnVz...` | Environment variable |
| First user fallback | `whsec_kHRpTR8nt...` | Legacy fallback |

---

## Lessons Learned

1. **Two webhook systems are confusing**: Fathom has Personal API Webhooks AND OAuth App Webhooks with DIFFERENT secrets. Documentation should clearly distinguish these.

2. **Secret verification before deployment**: When setting up webhooks, immediately test with a real webhook to verify the secret works.

3. **Extensive logging helped**: The detailed verification results logging made diagnosis straightforward.

4. **Host email fix was a red herring**: The recent Dec 10 fix addressed user routing, but the underlying signature verification was already broken.

---

## Related Documentation

- [Fathom Integration Architecture](docs/architecture/fathom-integration-architecture.md)
- [Fathom Webhook Reference](docs/reference/fathom-webhook-reference.md)
- [Webhook Edge Function](supabase/functions/webhook/index.ts)

---

## Action Items

- [ ] **CRITICAL**: Obtain correct OAuth app webhook secret from Fathom Developer Portal
- [ ] Update `FATHOM_OAUTH_WEBHOOK_SECRET` in Supabase secrets
- [ ] Redeploy webhook function
- [ ] Verify with test meeting
- [ ] Consider adding webhook secret validation on startup (log warning if format invalid)
- [ ] Add monitoring for webhook success rate

---

**Status**: Root cause identified. Awaiting credential verification and update.
