# Webhook Host Email Auto-Detection Fix

**Date:** December 10, 2025
**Issue:** Webhooks failing because host_email not set for users
**Solution:** Auto-detect host_email from Fathom API during OAuth and fetch-meetings

---

## The Problem

Fathom webhooks were failing with 401 "Invalid webhook signature" because:
1. Webhook signature verification was working correctly (secret was valid)
2. BUT webhooks couldn't route to correct user because `host_email` was NULL
3. Webhooks use `recorded_by.email` to match against `user_settings.host_email`
4. Without host_email set, webhooks couldn't find which user the call belonged to

**Root Cause:** Users had to manually configure host_email in Settings, but there was no obvious way for them to know they needed to do this or what value to use.

---

## The Solution

### 1. OAuth Callback Auto-Detection (Primary)

**File:** `supabase/functions/fathom-oauth-callback/index.ts`

After successful OAuth token exchange, immediately fetch one meeting to get the user's Fathom email:

```typescript
// AUTO-DETECT HOST EMAIL: Fetch one meeting to get the user's Fathom email
let detectedHostEmail: string | null = null;
try {
  const meetingsResponse = await fetch('https://fathom.video/external/v1/meetings?limit=1', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (meetingsResponse.ok) {
    const meetingsData = await meetingsResponse.json();
    if (meetingsData.items && meetingsData.items.length > 0) {
      const firstMeeting = meetingsData.items[0];
      if (firstMeeting.recorded_by?.email) {
        detectedHostEmail = firstMeeting.recorded_by.email;
        
        // Update host_email in user_settings
        await supabase
          .from('user_settings')
          .update({ host_email: detectedHostEmail })
          .eq('user_id', user.id);
      }
    }
  }
} catch (hostEmailError) {
  // Non-fatal - OAuth succeeded, just couldn't detect email
}
```

**Response now includes:**
- `host_email_detected`: The detected email (or null)
- `host_email_note`: User-friendly message explaining what happened

### 2. Fetch-Meetings Fallback Detection

**File:** `supabase/functions/fetch-meetings/index.ts`

For existing users who connected OAuth before this fix, detect and set host_email when they fetch meetings:

```typescript
// FALLBACK: Auto-detect and set host_email if not already configured
let hostEmailDetected: string | null = null;
if (!settings?.host_email && allMeetings.length > 0) {
  const meetingWithEmail = allMeetings.find(m => m.recorded_by?.email);
  if (meetingWithEmail?.recorded_by?.email) {
    hostEmailDetected = meetingWithEmail.recorded_by.email;
    
    // Update host_email in database (non-blocking)
    supabase
      .from('user_settings')
      .update({ host_email: hostEmailDetected })
      .eq('user_id', user.id)
      .then(/* ... */);
  }
}
```

---

## Key Technical Details

### FathomMeeting Interface

Added `recorded_by` field to capture the meeting recorder's info:

```typescript
interface FathomMeeting {
  recording_id: number;
  title: string;
  // ... other fields ...
  recorded_by?: {
    name: string;
    email: string;
    email_domain: string;
    team?: string;
  };
}
```

### Webhook Routing Flow

1. Fathom sends webhook with `recorded_by.email` in payload
2. Webhook function looks up `user_settings` by `host_email` matching `recorded_by.email`
3. If found, processes the call for that user
4. If not found, returns 404 "User not found"

### Why This Works

- **Fathom always includes `recorded_by.email`** in meeting data
- This email is the **Fathom account email** (not calendar invitee email)
- It's consistent across all calls recorded by that user
- Webhooks use the same email to identify the user

---

## Files Modified

1. `supabase/functions/fathom-oauth-callback/index.ts`
   - Added auto-detection after token exchange (lines 122-179)
   - Response now includes detection status

2. `supabase/functions/fetch-meetings/index.ts`
   - Added `recorded_by` to FathomMeeting interface (lines 117-123)
   - Added fallback detection logic (lines 340-363)
   - Modified settings query to include host_email (line 158)

---

## Testing Checklist

- [ ] New user connects OAuth → host_email auto-set
- [ ] Existing user (no host_email) fetches meetings → host_email auto-set
- [ ] Existing user (has host_email) fetches meetings → no change
- [ ] Webhook arrives → routes to correct user
- [ ] User with no meetings → graceful handling with note

---

## Related Documentation

- `docs/architecture/fathom-integration-architecture.md` - Architecture overview
- `docs/reference/fathom-webhook-reference.md` - Webhook signature details
- `supabase/functions/webhook/index.ts` - Webhook verification logic
