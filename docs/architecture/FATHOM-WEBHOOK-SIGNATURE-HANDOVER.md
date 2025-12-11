# Fathom Webhook Signature Verification - Complete Handover Document

**Date:** 2025-12-10
**Project:** CallVault (Brain)
**Issue:** All Fathom webhooks failing signature verification
**Status:** Investigation complete, root cause isolated, awaiting user verification
**Priority:** HIGH - Blocking all webhook processing

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Investigation Timeline](#investigation-timeline)
4. [Technical Findings](#technical-findings)
5. [Code Changes Made](#code-changes-made)
6. [Verification Tests Performed](#verification-tests-performed)
7. [Current Deployment Status](#current-deployment-status)
8. [Root Cause Analysis](#root-cause-analysis)
9. [Database State](#database-state)
10. [Outstanding Actions](#outstanding-actions)
11. [Key Files and Locations](#key-files-and-locations)
12. [Appendix: Test Data](#appendix-test-data)

---

## Executive Summary

**CRITICAL FINDING:** The Svix signature verification algorithm implementation is **100% correct** - verified against the official Svix test case. The most likely cause of failure is a **mismatch between the webhook secret stored in our database and the secret configured in Fathom's webhook settings**.

**What's Working:**
- Algorithm implementation matches Svix official test case exactly
- Raw body is being read correctly
- Secret format is valid (base64 decodes to 24 bytes)
- Email-based secret lookup is working

**What's Not Working:**
- ALL webhook signature verifications fail
- Both personal secrets AND OAuth app secret fail

**Next Step Required:** User must verify that the webhook secret in their Fathom settings matches what's stored in our database.

---

## Problem Statement

### Symptom
Every webhook received from Fathom fails signature verification with `signature_valid: false`. This is blocking all call transcript processing.

### Historical Context
- User explicitly rejected a previous "host_email auto-detection" fix as it was NOT the root cause
- User stated emphatically: "FOR THE 800TH TIME THIS IS THE FUCKING WEBHOOK SECRET, HAS BEEN THE WEBHOOK SECRET, AND NOTHING HAS CHANGED"
- The issue is NOT about email matching or finding secrets - secrets ARE being found correctly
- The issue is that the signature computation never matches

### Scope of Impact
- ALL users' webhooks are failing
- ALL verification methods fail (personal secret, OAuth app secret, fallback secret)
- No transcripts are being processed from Fathom

---

## Investigation Timeline

### Phase 1: Initial Analysis
- Identified that ALL webhooks have `signature_valid: false`
- Confirmed secrets ARE being found (email matching works)
- Ruled out host_email as the issue

### Phase 2: Algorithm Verification
- Verified Svix algorithm against official test case - **PASSED**
- Official test case used:
  ```
  Secret: whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw
  MsgId: msg_p5jXN8AQM9LWM0D4loKWxJek
  Timestamp: 1614265330
  Payload: {"test": 2432232314}
  Expected: v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=
  Result: MATCH
  ```

### Phase 3: Fathom SDK Analysis
- Downloaded and analyzed `fathom-typescript` npm package (v0.0.37)
- Confirmed Fathom SDK uses standard Svix library:
  ```javascript
  import { Webhook } from "svix";
  static verifyWebhook(webhookSecret, headers, payload) {
      const wh = new Webhook(webhookSecret);
      return wh.verify(payload, headers);
  }
  ```
- This confirms Fathom uses standard Svix verification, NOT a custom algorithm

### Phase 4: Svix Source Analysis
- Downloaded and analyzed `svix` npm package (v1.82.0)
- Confirmed exact algorithm:
  1. Strip `whsec_` prefix from secret
  2. Base64 decode the remaining part to get raw key bytes
  3. Compute: `HMAC-SHA256(key_bytes, msgId.timestamp.payload)`
  4. Compare base64-encoded result

### Phase 5: Enhanced Debug Logging
- Added comprehensive signature debug logging
- Deployed multiple versions with additional verification methods
- Current deployment: Version 47 (approximately)

---

## Technical Findings

### Svix Signature Algorithm (VERIFIED CORRECT)

```javascript
// 1. Extract secret key
const secretPart = secret.replace('whsec_', '');  // Remove prefix
const secretBytes = Buffer.from(secretPart, 'base64');  // Base64 decode

// 2. Create signed content
const signedContent = `${webhookId}.${timestamp}.${rawBody}`;

// 3. Compute HMAC-SHA256
const hmac = crypto.createHmac('sha256', secretBytes);
hmac.update(signedContent);
const signature = 'v1,' + hmac.digest('base64');
```

### Headers Fathom Sends
```
webhook-id: msg_XXXXXXXXXXXXXXXXXXXX
webhook-timestamp: 1765412784 (Unix timestamp)
webhook-signature: v1,BASE64_SIGNATURE (may have multiple space-separated)
svix-id: (same as webhook-id)
svix-timestamp: (same as webhook-timestamp)
svix-signature: (same as webhook-signature)
```

### Fathom Documentation vs Reality
- **Fathom docs show simplified example:** HMAC of body only (no id.timestamp)
- **Fathom SDK actually uses:** Full Svix format (id.timestamp.body)
- This discrepancy caused initial confusion but we now know the correct format

### Verification Methods Tried
1. **Full Svix format** - `HMAC(base64decode(secret), id.timestamp.body)` - CORRECT
2. **Simple body only** - `HMAC(secret_as_string, body)` - Per Fathom docs example
3. **Secret variations:**
   - Full `whsec_XXXX` as UTF-8 string
   - Just `XXXX` part as UTF-8 string
   - `XXXX` part base64 decoded

All methods fail, indicating the secret itself may be wrong.

---

## Code Changes Made

### File: `/Users/Naegele/dev/brain/supabase/functions/webhook/index.ts`

#### 1. Added `signatureDebugInfo` Object (around line 158)
```typescript
const signatureDebugInfo: {
  received_signature?: string;
  svix_computed?: string;
  simple_full_secret?: string;
  simple_no_prefix?: string;
  simple_base64_decoded?: string;
  raw_body_length?: number;
  raw_body_first_100?: string;
  raw_body_last_100?: string;
  webhook_id?: string;
  webhook_timestamp?: string;
} = {};
```

#### 2. Enhanced `verifySvixSignature()` (lines 172-249)
- Added detailed logging of computed vs received signatures
- Added character-by-character comparison when mismatch
- Added secret preview logging
- Stores debug info in `signatureDebugInfo` object

#### 3. Enhanced `verifyFathomSimpleSignature()` (lines 51-155)
- Tries multiple secret formats
- Stores computed signatures in debug info
- Logs each attempt and result

#### 4. Updated Failed Webhook Payload Storage (around line 700)
```typescript
payload: {
  verification_results: verificationResults,
  signature_debug: signatureDebugInfo  // NEW - includes computed signatures
}
```

#### 5. Updated Error Response (around line 710)
```typescript
return new Response(
  JSON.stringify({
    error: 'Invalid signature',
    verification_results: verificationResults,
    signature_debug: signatureDebugInfo,  // NEW
    hint: 'Check logs for which secrets were tested and their results'
  }),
  { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

---

## Verification Tests Performed

### Test 1: Official Svix Test Case
```
Input:
  Secret: whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw
  MsgId: msg_p5jXN8AQM9LWM0D4loKWxJek
  Timestamp: 1614265330
  Payload: {"test": 2432232314}

Expected: v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=
Computed: v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=
Result: EXACT MATCH
```

### Test 2: Secret Format Validation
```
User Secret: whsec_Tj8Rg0AqTHI76PU9A5m9H1nmEQrKEDyF
  Base64 part: Tj8Rg0AqTHI76PU9A5m9H1nmEQrKEDyF
  Decoded: 24 bytes (correct)
  Hex: 4e3f1183402a4c723be8f53d0399bd1f59e6110aca103c85

OAuth Secret: whsec_pr7SHWnVzm0zBBqWBbghv8913cUgSy+F
  Base64 part: pr7SHWnVzm0zBBqWBbghv8913cUgSy+F
  Decoded: 24 bytes (correct)
  Hex: a6bed21d69d5ce6d33041a9605b821bfcf75ddc5204b2f85
```

### Test 3: Real Webhook Data
```
Recording ID: 107903798
Webhook ID: msg_36fzURFRUjCAREqumS0pg7NFC75
Timestamp: 1765412784
Received Signature: v1,691ZGGqQvXO3g+HELw/9QStCcXjF0GfbjMAfOJXSP28=
Content-Length: 12317 bytes
Host Email: andrew@aisimple.co

Result: FAILED with all secrets tested
```

---

## Current Deployment Status

### Latest Deployment
- **Version:** 47 (approximately - check Supabase dashboard)
- **Deployed:** 2025-12-10
- **Function:** `webhook`
- **Project:** vltmrnjsubfzrgrtdqey

### What's in Production
- Enhanced debug logging for signature comparison
- Multiple verification method attempts
- Debug info stored in `webhook_deliveries.payload`
- Detailed console logging for Supabase logs

### How to Check Logs
1. Go to: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/functions
2. Select the `webhook` function
3. View logs for recent invocations
4. Look for `🔐 SVIX SIGNATURE COMPARISON:` entries

---

## Root Cause Analysis

### CONFIRMED NOT THE ISSUE:
1. **Algorithm implementation** - Verified correct against official test
2. **Raw body reading** - Using `req.text()` correctly
3. **Secret format** - Both secrets decode correctly to 24 bytes
4. **Email matching** - Secrets ARE being found by email lookup
5. **Header parsing** - Correctly extracting webhook-id, timestamp, signature

### MOST LIKELY ROOT CAUSE:
**The webhook secret stored in the database does not match the webhook secret configured in Fathom.**

Possible scenarios:
1. User regenerated the webhook in Fathom but didn't update our database
2. Multiple webhooks configured with different secrets
3. OAuth app webhook using a different secret than stored

### LESS LIKELY BUT POSSIBLE:
1. Fathom changed their signing algorithm (unlikely - they use standard Svix)
2. Character encoding issue with the raw body (unlikely - we use `req.text()`)
3. Supabase edge function modifying the body (unlikely)

---

## Database State

### User Settings with Webhook Secrets
```sql
SELECT user_id, host_email, webhook_secret, updated_at
FROM user_settings
WHERE webhook_secret IS NOT NULL
ORDER BY updated_at DESC;
```

Current data (as of 2025-12-10):
| host_email | webhook_secret | updated_at |
|------------|----------------|------------|
| ptomlinson@leveragedva.com | whsec_aIK4iiGslMn+xdy0TsEoO7s0RpfagbwK | 2025-12-10 |
| andrew@aisimple.co | whsec_Tj8Rg0AqTHI76PU9A5m9H1nmEQrKEDyF | 2025-12-09 |
| daniel@maramamarketing.com | whsec_kHRpTR8ntw6l+GjFVEu9b9AHligbJWsU | 2025-11-30 |

### OAuth App Webhook Secret
```
Location: .env file
Key: FATHOM_OAUTH_WEBHOOK_SECRET
Value: whsec_pr7SHWnVzm0zBBqWBbghv8913cUgSy+F
```

### Recent Failed Webhook Deliveries
```sql
SELECT id, recording_id, status, signature_valid, payload, created_at
FROM webhook_deliveries
WHERE status = 'failed' AND signature_valid = false
ORDER BY created_at DESC
LIMIT 5;
```

---

## Outstanding Actions

### IMMEDIATE (User Action Required)

**ACTION 1:** Verify Fathom Webhook Secret
1. Log into Fathom at https://fathom.video
2. Go to Settings > API Access > Webhooks
3. Find the webhook configured for CallVault
4. Compare the webhook secret shown to: `whsec_Tj8Rg0AqTHI76PU9A5m9H1nmEQrKEDyF`
5. If different, either:
   - Update the database with the correct secret, OR
   - Regenerate the webhook in Fathom and update the database

**ACTION 2:** Trigger Test Webhook
1. Complete a short test call in Fathom
2. Wait for webhook to fire
3. Check Supabase function logs for debug output
4. Look for `🔐 SVIX SIGNATURE COMPARISON:` to see computed vs received

### FOLLOW-UP (After Secret Verification)

**If secrets match but still failing:**
1. Check the Supabase logs for the exact computed vs received signatures
2. Compare raw body length (should be ~12317 bytes for the test call)
3. Check if there's any body transformation happening

**If secrets don't match:**
1. Update the database with the correct secret
2. Verify all users have correct secrets stored
3. Consider adding a UI to let users update their webhook secret

---

## Key Files and Locations

### Main Files
| File | Purpose |
|------|---------|
| `/supabase/functions/webhook/index.ts` | Webhook handler with signature verification |
| `/.env` | Contains `FATHOM_OAUTH_WEBHOOK_SECRET` |
| `/docs/handover/FATHOM-WEBHOOK-SIGNATURE-HANDOVER.md` | This document |

### Database Tables
| Table | Relevant Columns |
|-------|------------------|
| `user_settings` | `user_id`, `host_email`, `webhook_secret` |
| `webhook_deliveries` | `recording_id`, `status`, `signature_valid`, `payload`, `request_headers` |

### Key Functions in webhook/index.ts
| Function | Line (approx) | Purpose |
|----------|---------------|---------|
| `verifySvixSignature()` | 172-249 | Standard Svix verification |
| `verifyFathomSimpleSignature()` | 51-155 | Alternative body-only verification |
| `verifyWebhookSignature()` | 251-300 | Main verification orchestrator |
| `signatureDebugInfo` | 158 | Debug object for storing comparison data |

### Supabase Dashboard Links
- Functions: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/functions
- Database: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/editor

---

## Appendix: Test Data

### Real Webhook from Recording 107903798
```json
{
  "webhook_id": "msg_36fzURFRUjCAREqumS0pg7NFC75",
  "webhook_timestamp": "1765412784",
  "webhook_signature": "v1,691ZGGqQvXO3g+HELw/9QStCcXjF0GfbjMAfOJXSP28=",
  "content_length": "12317",
  "recorded_by_email": "andrew@aisimple.co",
  "recording_title": "FATHOM TEST - Webhook Bullshit"
}
```

### Secrets Tested
```
1. Personal (andrew@aisimple.co): whsec_Tj8Rg0AqTHI76PU9A5m9H1nmEQrKEDyF
2. OAuth App: whsec_pr7SHWnVzm0zBBqWBbghv8913cUgSy+F
3. Fallback (daniel@): whsec_kHRpTR8ntw6l+GjFVEu9b9AHligbJWsU
```

### Node.js Test Script for Verification
```javascript
const crypto = require('crypto');

// Test Svix algorithm
const secret = 'whsec_YOUR_SECRET_HERE';
const webhookId = 'msg_XXXXX';
const timestamp = '1234567890';
const body = '{"your": "payload"}';

const secretPart = secret.replace('whsec_', '');
const secretBytes = Buffer.from(secretPart, 'base64');
const signedContent = `${webhookId}.${timestamp}.${body}`;
const hmac = crypto.createHmac('sha256', secretBytes);
hmac.update(signedContent);
const signature = 'v1,' + hmac.digest('base64');

console.log('Computed signature:', signature);
```

---

## Summary for Continuation

**TL;DR:** The signature verification algorithm is correct. The issue is almost certainly that the webhook secret in Fathom doesn't match what's stored in our database. The user needs to verify this in their Fathom settings.

**Critical Path:**
1. User verifies/updates Fathom webhook secret
2. Trigger new test webhook
3. Check Supabase logs for confirmation
4. If still failing, analyze the debug output for clues

**Do NOT:**
- Assume the algorithm is wrong (it's been verified)
- Keep trying new verification methods (they've all been tried)
- Suggest the secret "might have changed" without user verification

---

*Document created: 2025-12-10*
*Last updated: 2025-12-10*
*Author: Claude (Opus 4.5)*
