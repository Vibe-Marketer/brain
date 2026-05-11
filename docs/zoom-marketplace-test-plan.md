# CallVault — Zoom Integration Test Plan

**For Zoom Marketplace Reviewers**
**App Name:** CallVault
**Company:** 7x Systems LLC
**Version:** 2.0
**Date:** April 2026

---

## Test Credentials

**CallVault App Login (for Zoom Marketplace reviewers):**
- URL: https://app.callvaultai.com
- Email: `hello@callvaultai.com`
- Password: `ZoomTest1!`

This is a dedicated reviewer test account. The account is pre-configured to land directly in the app (no first-run wizard), with an empty workspace ready for the reviewer to connect their own Zoom account and exercise the full integration flow — recordings will sync into the reviewer's workspace.

**Important:** The app uses the **Production Client ID** (`8DjTi5m9S1Cx7qaPHfbDQ`) during authorization.

**Reviewer support:** If access is blocked or credentials don't work, contact `support@callvaultai.com` and a fresh account will be provisioned within one business day.

---

## Overview

CallVault is a transcript library that imports Zoom cloud recordings, transcribes them, and provides search, organization, and AI-powered summaries for sales teams. The Zoom integration specifically:

1. **Connects** a user's Zoom account via OAuth
2. **Receives** cloud recording notifications via webhook
3. **Imports** recordings and transcripts automatically
4. **Organizes** them into workspaces and folders

---

## Scopes Used

| Scope | Purpose | Where Used |
|-------|---------|------------|
| `cloud_recording:read:list_user_recordings` | List a user's cloud recordings to enable historical sync | Fetch Meetings screen, initial import |
| `cloud_recording:read:recording` | Download individual recording files and transcripts | Auto-import after webhook notification |
| `user:read:email` | Identify the connected Zoom user by email | Display connected account info in Settings |
| `meeting:read:list_meetings` | List meetings for sync status display | Import status dashboard |

---

## Step-by-Step Test Walkthrough

### Step 1: Create Account / Sign In

1. Navigate to **https://app.callvaultai.com**
2. Sign in with the test credentials provided above
3. You will land on the main dashboard showing the call library

### Step 2: Connect Zoom Integration

1. Click the **Settings** icon in the sidebar (gear icon, bottom-left)
2. Navigate to **Integrations**
3. Find the **Zoom** card and click **Connect**
4. You will be redirected to Zoom's OAuth consent screen
5. Sign in to your Zoom account and click **Allow**
6. You will be redirected back to CallVault
7. The Zoom integration now shows as **Connected** with your Zoom email

**Scopes exercised:** OAuth authorization flow uses all requested scopes.

### Step 3: Trigger a Recording Import

**Option A — Automatic via webhook (recommended):**
1. Start a Zoom meeting with cloud recording enabled
2. End the meeting and wait for Zoom to process the recording (~2-5 minutes)
3. CallVault receives a `recording.completed` webhook
4. The recording appears in your **My Calls** workspace within 5 minutes

**Option B — Manual sync:**
1. From the dashboard, go to **Import** in the sidebar
2. Click **Sync** next to Zoom to pull recent recordings
3. New recordings will appear in the import list
4. They are automatically imported and transcribed

**Scopes exercised:** `cloud_recording:read:list_user_recordings`, `cloud_recording:read:recording`

### Step 4: View Imported Call

1. Click on any imported Zoom call in the call library
2. The detail panel opens showing:
   - Call title (from Zoom meeting topic)
   - Date and duration
   - Full transcript (auto-generated)
   - AI summary
3. Use the audio/video player to play back the recording

### Step 5: Organize Calls

1. Calls can be moved to **Workspaces** (team-shared) or **Folders** (sub-organization)
2. Drag a call to a folder in the sidebar, or use the **Move to...** option
3. Set up **Routing Rules** (Settings → Automation) to auto-sort future imports by meeting title keywords

### Step 6: Search Across Calls

1. Click the **Search** bar at the top (or press `/`)
2. Type a keyword that appears in one of the imported call transcripts
3. Results show matching calls with highlighted transcript excerpts
4. Click a result to jump directly to that moment in the call

### Step 7: Disconnect Zoom

1. Go to **Settings → Integrations → Zoom**
2. Click **Disconnect**
3. The integration status changes to **Not connected**
4. No new recordings will sync
5. Previously imported calls remain in CallVault

**Scope exercised:** `user:read:email` (displays connected account), disconnect revokes tokens.

---

## Webhook Events Used

| Event | Purpose |
|-------|---------|
| `recording.completed` | Triggers automatic import when a cloud recording finishes processing |
| `recording.transcript_completed` | Triggers transcript import when Zoom's transcript is ready |
| `meeting.started` | Updates meeting status for real-time sync display |
| `meeting.ended` | Updates meeting status; precedes recording.completed |

**Webhook Endpoint:** `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/zoom-webhook`
**Validation:** HMAC-SHA256 signature verification (CRC validation) per Zoom docs.

---

## Data Handling Summary

- **What data is accessed:** Cloud recordings (audio/video files), recording transcripts, meeting metadata (title, date, duration, participants), user email
- **How data is stored:** Encrypted at rest in Supabase (PostgreSQL + S3-compatible storage), isolated per organization via Row Level Security
- **Data retention:** User-controlled; data persists until the user deletes calls or their account
- **Data deletion:** Users can delete individual calls, or delete their account to remove all data within 30 days
- **Third-party sharing:** None — CallVault does not share user data with third parties

---

## Support & Documentation

- **Privacy Policy:** https://callvaultai.com/privacy
- **Terms of Use:** https://callvaultai.com/terms
- **Support:** support@callvaultai.com | (+1) 307-218-2437
- **Documentation:** https://docs.callvaultai.com/integrations/zoom
- **App removal guide:** https://docs.callvaultai.com/integrations/zoom#removing-the-zoom-integration
