# Fathom Webhook Technical Reference

**Last Updated:** 2025-11-29
**Source:** <https://developers.fathom.ai/webhooks>

---

## CRITICAL: Two Types of Webhooks

Fathom has **TWO COMPLETELY SEPARATE** webhook systems:

### 1. Personal API Webhooks

- **Created via:** Fathom Settings > API Access > Add Webhook
- **Secret stored:** `user_settings.webhook_secret`
- **Scope:** Only YOUR recordings (the user who created the webhook)
- **Use case:** Personal integrations, single-user apps

### 2. OAuth App Webhooks

- **Created via:** Fathom Developer Portal when registering an OAuth app
- **Secret stored:** `FATHOM_OAUTH_WEBHOOK_SECRET` environment variable
- **Scope:** ALL users who authorize the OAuth app
- **Use case:** Multi-user SaaS applications

**IMPORTANT:** These secrets are DIFFERENT. A webhook signed with one cannot be verified with the other.

---

## Webhook Signature Verification

### Headers Sent by Fathom

All webhooks include these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `webhook-id` | Unique message ID (same on retries) | `msg_2x2zwLOcWaRTzsLK8KtbQt1FTk9` |
| `webhook-timestamp` | Unix timestamp (seconds) | `1712345678` |
| `webhook-signature` | Signature with version prefix | `v1,BKQR1BIFji...` |

### Fathom's Documented Verification Method

From <https://developers.fathom.ai/webhooks#verifying-webhooks>:

```javascript
const crypto = require('crypto')

function verifyWebhook(secret, headers, rawBody) {
  const [version, signatureBlock] = headers['webhook-signature'].split(',')
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')

  const signatures = signatureBlock.split(' ')
  return signatures.includes(expected)
}
```

**Key points:**

- Use secret DIRECTLY (no base64 decoding)
- Hash the raw body ONLY (NOT id.timestamp.body)
- Multiple signatures may be space-delimited

### Svix Verification Method (What Fathom Actually Uses)

Fathom uses **Svix** (<https://www.svix.com>) for webhook delivery. User-Agent: `Svix-Webhooks/1.81.0`

Svix uses a DIFFERENT signature format:

```javascript
// Svix format
const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
const secretBytes = base64Decode(secretAfterWhsec_Prefix)
const expected = crypto
  .createHmac('sha256', secretBytes)
  .update(signedContent)
  .digest('base64')
```

**Key differences from Fathom docs:**

1. Signs `id.timestamp.body` concatenated (not just body)
2. Secret has `whsec_` prefix, remainder is base64-encoded
3. Must base64-decode the secret before using

### Which Method to Use?

**Our implementation supports BOTH** methods and tries them in order:

1. Fathom native (x-signature header, simple body hash)
2. Svix (webhook-signature header, id.timestamp.body hash)

---

## Webhook Payload Structure

From <https://developers.fathom.ai/api-reference/webhook-payloads/new-meeting-content-ready>

```json
{
  "recording_id": 123456789,
  "title": "Meeting Title",
  "meeting_title": "Calendar Event Title",
  "url": "https://fathom.video/xyz123",
  "share_url": "https://fathom.video/share/xyz123",
  "created_at": "2025-03-01T17:01:30Z",
  "recording_start_time": "2025-03-01T16:01:12Z",
  "recording_end_time": "2025-03-01T17:00:55Z",
  "recorded_by": {
    "name": "User Name",
    "email": "user@example.com",
    "team": "Team Name",
    "email_domain": "example.com"
  },
  "transcript": [...],
  "default_summary": {
    "template_name": "general",
    "markdown_formatted": "## Summary\n..."
  },
  "action_items": [...],
  "calendar_invitees": [...]
}
```

**Critical field:** `recorded_by.email` - This tells you WHO recorded the call, used to match to `user_settings.host_email`

---

## Our Webhook Verification Logic

Location: `supabase/functions/webhook/index.ts`

**Priority order for finding webhook secret:**

1. **Match by email:** Look up `user_settings` where `host_email` = `recorded_by.email`
   - Use that user's `webhook_secret`
   - This works for Personal API Webhooks

2. **OAuth app secret:** Use `FATHOM_OAUTH_WEBHOOK_SECRET` environment variable
   - This works for OAuth App Webhooks
   - All OAuth users' webhooks use this ONE shared secret

3. **Fallback:** First user's `webhook_secret` (legacy support)

---

## Common Issues

### "Invalid webhook signature"

**Causes:**

1. Wrong secret being used (personal vs OAuth mismatch)
2. `FATHOM_OAUTH_WEBHOOK_SECRET` doesn't match Developer Portal
3. Body was modified before verification (JSON parsed then stringified)

**Debug steps:**

1. Check `webhook_deliveries` table for the failed webhook
2. Look at `request_headers` to see which signature format was used
3. Verify secret matches source (Settings for personal, Developer Portal for OAuth)

### Webhook not received at all

**Causes:**

1. Webhook not configured in Fathom
2. Endpoint URL incorrect in Fathom settings
3. User didn't authorize the OAuth app (for OAuth webhooks)

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `webhook_deliveries` | Log of all webhook attempts (success/fail/duplicate) |
| `processed_webhooks` | Idempotency tracking (webhook_id → processed_at) |
| `user_settings.webhook_secret` | Personal webhook secret per user |
| `user_settings.host_email` | Email to match `recorded_by.email` |

---

## Testing Webhooks

### Manual Test

1. Record a 2-minute test call in Fathom
2. Wait ~2-10 minutes for processing
3. Check `webhook_deliveries` table for the result

### Verify Endpoint

```bash
curl https://[project].supabase.co/functions/v1/webhook
# Should return: {"status":"online","message":"Webhook endpoint is ready",...}
```

---

## Current Status (2025-11-29)

### What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Manual sync/search | ✅ Working | OAuth token fetches meetings successfully |
| Personal API Webhooks | ✅ Working | Andrew's Nov 27 call synced via personal webhook |
| OAuth App Webhooks | ❓ Unknown | No evidence they're arriving at our endpoint |

### Known Issues

1. **11:52PM Test Call (Nov 29)** - Did NOT auto-sync
   - No entry in `webhook_deliveries` table
   - No entry in `processed_webhooks` table
   - **Conclusion:** Webhook was never received at all

2. **Sefy's Call Failed** - `msg_364DhiOSXlm1IMgZKe7GnXurUdT`
   - Error: "Invalid webhook signature"
   - This was an OAuth app webhook (Sefy is not in our `user_settings`)
   - The `FATHOM_OAUTH_WEBHOOK_SECRET` may not match what's in Developer Portal

### Action Items to Verify

1. **Check Fathom Developer Portal:**
   - Is webhook URL correct? Should be: `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/webhook`
   - Does webhook secret match `FATHOM_OAUTH_WEBHOOK_SECRET` env var?

2. **Verify Personal Webhook Setup:**
   - In Fathom Settings > API Access, is webhook configured?
   - Does webhook URL match: `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/webhook`?

### Supabase Project Reference

| Environment | Project ID | Webhook Endpoint |
|-------------|------------|------------------|
| **CURRENT** | `vltmrnjsubfzrgrtdqey` | `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/webhook` |
| OLD (deprecated) | `pwscjdytgcyiavqiufqs` | Do NOT use |

### Secrets Reference

| Secret | Purpose | Where Stored |
|--------|---------|--------------|
| Personal webhook secret | Personal API webhook | `user_settings.webhook_secret` |
| OAuth app webhook secret | OAuth app webhook | `FATHOM_OAUTH_WEBHOOK_SECRET` env |

**These are DIFFERENT secrets for DIFFERENT webhook types!**

---

## References

- Fathom Webhooks Guide: <https://developers.fathom.ai/webhooks>
- Fathom Webhook Payload: <https://developers.fathom.ai/api-reference/webhook-payloads/new-meeting-content-ready>
- Fathom OAuth Guide: <https://developers.fathom.ai/oauth>
- Svix Webhook Verification: <https://docs.svix.com/receiving/verifying-payloads/how>
