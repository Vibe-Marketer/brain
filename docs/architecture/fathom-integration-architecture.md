# Fathom Integration Architecture

**Last Updated:** 2025-11-29

This document describes how CallVault integrates with Fathom for meeting sync, covering both manual and automatic flows.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [Flow 1: Manual Sync (In-App)](#flow-1-manual-sync-in-app)
4. [Flow 2: Automatic Webhook Sync](#flow-2-automatic-webhook-sync)
5. [Edge Functions Reference](#edge-functions-reference)
6. [Troubleshooting](#troubleshooting)

---

## Overview

There are **two ways** meetings get into CallVault:

| Flow | Trigger | When It Happens | Auth Used |
|------|---------|-----------------|-----------|
| **Manual Sync** | User clicks "Fetch" → selects meetings → "Sync" | User actively browsing app | OAuth Token or API Key |
| **Webhook Sync** | Fathom sends webhook when call ends | Automatically, ~minutes after call | OAuth App Webhook Secret |

---

## Authentication Methods

### For Data Fetching (Manual Sync)

| Method | Header | Stored In | Use Case |
|--------|--------|-----------|----------|
| **OAuth Token** | `Authorization: Bearer {token}` | `user_settings.oauth_access_token` | Multi-user SaaS (recommended) |
| **API Key** | `X-Api-Key: {key}` | `user_settings.fathom_api_key` | Personal/backup |

**Priority:** OAuth is preferred. If OAuth token is expired, the system will:

1. Attempt to refresh using `oauth_refresh_token`
2. Fall back to API key if refresh fails

### For Webhook Verification

| Method | Header | Stored In | Use Case |
|--------|--------|-----------|----------|
| **OAuth App Secret** | `webhook-signature` (Svix format) | `FATHOM_OAUTH_WEBHOOK_SECRET` env var | ALL OAuth app webhooks |

**Important:** The OAuth app webhook secret is **shared for ALL users** who connect via OAuth. The `recorded_by.email` in the webhook payload tells you WHO recorded the call, but the signature is always verified with the same OAuth app secret.

---

## Flow 1: Manual Sync (In-App)

When user is actively using the app to browse/sync calls.

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MANUAL SYNC FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Fetch Meetings" in Sync Tab                            │
│     └─► useMeetingsSync.fetchMeetings()                                 │
│         └─► Edge Function: fetch-meetings                               │
│             └─► GET /external/v1/meetings (OAuth or API Key)            │
│             └─► Returns list with sync status (synced: true/false)      │
│                                                                          │
│  2. User sees list of unsynced meetings                                 │
│     └─► Can filter by date range                                        │
│     └─► Can select individual or bulk                                   │
│                                                                          │
│  3. User clicks "Sync Selected"                                         │
│     └─► useMeetingsSync.syncMeetings()                                  │
│         └─► Edge Function: sync-meetings                                │
│             └─► Creates sync_job record                                 │
│             └─► For each meeting:                                       │
│                 └─► GET /recordings/{id}/transcript                     │
│                 └─► GET /recordings/{id}/summary                        │
│                 └─► GET /meetings (paginated) for metadata              │
│                 └─► INSERT into fathom_calls                            │
│                 └─► INSERT into fathom_transcripts                      │
│             └─► Triggers embed-chunks for AI features                   │
│             └─► Triggers generate-ai-titles                             │
│                                                                          │
│  4. User can also sync single meeting                                   │
│     └─► useMeetingsSync.syncSingleMeeting()                             │
│         └─► Edge Function: fetch-single-meeting                         │
│         └─► Direct INSERT to fathom_calls (client-side)                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Functions Involved

| Function | Purpose | Auth |
|----------|---------|------|
| `fetch-meetings` | List all meetings from Fathom with sync status | OAuth/API Key |
| `sync-meetings` | Bulk sync selected meetings to database | OAuth/API Key |
| `fetch-single-meeting` | Get single meeting details for preview/sync | OAuth/API Key |

### User Settings Required

- `oauth_access_token` OR `fathom_api_key` - at least one required
- `oauth_refresh_token` - for automatic token refresh
- `host_email` - to identify which calls belong to user

---

## Flow 2: Automatic Webhook Sync

When Fathom automatically notifies us about new/updated calls.

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       WEBHOOK SYNC FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User finishes a call in Fathom                                      │
│     └─► Fathom processes recording                                      │
│     └─► Fathom generates transcript & summary                           │
│     └─► Fathom sends webhook to your endpoint (~2-10 min after call)    │
│                                                                          │
│  2. Webhook arrives at Edge Function: webhook                           │
│     POST https://[project].supabase.co/functions/v1/webhook             │
│     Headers:                                                             │
│       webhook-id: msg_XXXXX                                             │
│       webhook-timestamp: 1234567890                                     │
│       webhook-signature: v1,base64signature...                          │
│     Body: { recording_id, title, transcript, default_summary, ... }     │
│                                                                          │
│  3. Signature Verification                                              │
│     └─► Uses FATHOM_OAUTH_WEBHOOK_SECRET (env var)                      │
│     └─► Verifies Svix format: HMAC-SHA256(id.timestamp.body)            │
│     └─► If invalid → 401, logged to webhook_deliveries                  │
│                                                                          │
│  4. User Identification                                                 │
│     └─► Look up user by recorded_by.email → user_settings.host_email   │
│     └─► If no match → ERROR: user not found                             │
│                                                                          │
│  5. Process Meeting (if valid)                                          │
│     └─► UPSERT to fathom_calls                                          │
│     └─► INSERT to fathom_transcripts                                    │
│     └─► Mark webhook as processed (idempotency)                         │
│     └─► Log to webhook_deliveries (success)                             │
│                                                                          │
│  6. Meeting appears in user's Transcript Library automatically!         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Webhook Configuration

**Your OAuth App Webhook Endpoint:**

```
https://[project-ref].supabase.co/functions/v1/webhook
```

**Webhook Secret Location:**

- Set in Fathom Developer Portal when you registered your OAuth app
- Must be stored as `FATHOM_OAUTH_WEBHOOK_SECRET` in Supabase secrets
- Format: `whsec_XXXXXXXXXXXXX`

### Required Setup for Webhooks

1. **Fathom Developer Portal:**
   - Register OAuth app
   - Configure webhook endpoint URL
   - Note the webhook signing secret

2. **Supabase Secrets:**

   ```bash
   npx supabase secrets set FATHOM_OAUTH_WEBHOOK_SECRET='whsec_YOUR_SECRET_HERE'
   ```

3. **User Settings:**
   - `host_email` must be set to the email that appears as `recorded_by.email` in webhooks

### Webhook Payload Structure

```json
{
  "recording_id": 104819048,
  "title": "Team Sync Meeting",
  "created_at": "2025-11-27T15:23:19Z",
  "url": "https://fathom.video/calls/487839211",
  "share_url": "https://fathom.video/share/XXXX",
  "recorded_by": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "calendar_invitees": [...],
  "transcript": [
    {
      "speaker": { "display_name": "John Doe" },
      "text": "Hello everyone",
      "timestamp": "00:00:10"
    }
  ],
  "default_summary": {
    "markdown_formatted": "## Meeting Summary\n..."
  }
}
```

---

## Edge Functions Reference

| Function | Purpose | Auth Method | Trigger |
|----------|---------|-------------|---------|
| `fetch-meetings` | List meetings from Fathom API | OAuth/API Key | User action |
| `fetch-single-meeting` | Get one meeting's full details | OAuth/API Key | User action |
| `sync-meetings` | Bulk sync meetings to database | OAuth/API Key | User action |
| `webhook` | Receive & process Fathom webhooks | Webhook Secret | Fathom push |
| `test-fathom-connection` | Verify Fathom credentials work | OAuth/API Key | User action |

---

## Troubleshooting

### Manual Sync Issues

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| "Fathom credentials not configured" | No OAuth token or API key | Connect Fathom in Settings |
| "OAuth token expired" | Token needs refresh | Reconnect Fathom or wait for auto-refresh |
| Meetings not showing as synced | Recording ID mismatch | Check if recording_id types match (number vs string) |
| Rate limited (429) | Too many API calls | System handles this with exponential backoff |

### Webhook Issues

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| "Invalid webhook signature" | Wrong secret configured | Verify `FATHOM_OAUTH_WEBHOOK_SECRET` matches Developer Portal |
| "Cannot determine user_id" | No user with matching `host_email` | Add your Fathom email to Settings → host_email |
| Webhooks not arriving | Endpoint not configured | Check webhook URL in Fathom Developer Portal |
| Duplicate webhooks | Normal behavior | System handles idempotency via `processed_webhooks` table |

### Checking Webhook Status

Query `webhook_deliveries` table:

```sql
SELECT * FROM webhook_deliveries
ORDER BY created_at DESC
LIMIT 10;
```

Fields:

- `status`: 'success', 'failed', 'duplicate'
- `error_message`: Details if failed
- `signature_valid`: Whether signature verification passed
- `request_headers`: Full headers for debugging

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `fathom_calls` | Synced meeting metadata |
| `fathom_transcripts` | Individual transcript segments |
| `user_settings` | OAuth tokens, API keys, host_email |
| `sync_jobs` | Track bulk sync progress |
| `processed_webhooks` | Idempotency for webhooks |
| `webhook_deliveries` | Diagnostic log of all webhook attempts |

---

## Key Distinctions

### OAuth Token vs API Key

| Aspect | OAuth Token | API Key |
|--------|-------------|---------|
| Who can use | Any user who authorizes app | Only the key owner |
| Expires | Yes (needs refresh) | No |
| Include transcript in list | No | Yes |
| Multi-user friendly | Yes | No |

### OAuth App Webhook Secret vs Personal Webhook Secret

| Aspect | OAuth App Secret | Personal Secret |
|--------|------------------|-----------------|
| Scope | ALL users of your OAuth app | Single user's webhooks |
| Where configured | Fathom Developer Portal | Fathom API (per webhook) |
| Stored where | `FATHOM_OAUTH_WEBHOOK_SECRET` env | `user_settings.webhook_secret` |
| Used for | OAuth app webhooks | Personal API webhooks |

**Your app uses OAuth → Use OAuth App Webhook Secret only**

---

## Summary

1. **Manual Sync:** User-initiated, uses OAuth token (or API key fallback)
2. **Webhook Sync:** Automatic, uses OAuth app webhook secret (one secret for all users)
3. **User identification:** Via `host_email` matching `recorded_by.email`
4. **Auth priority:** OAuth > Token Refresh > API Key fallback
