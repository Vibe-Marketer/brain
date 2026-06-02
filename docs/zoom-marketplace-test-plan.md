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

CallVault is a transcript library that imports Zoom cloud recordings and Zoom-generated transcripts, then provides search, organization, and AI-ready summaries for sales teams. The Zoom integration specifically:

1. **Connects** a user's Zoom account via OAuth
2. **Lists** available Zoom cloud recordings for manual import
3. **Imports** selected recordings and downloads the Zoom transcript file
4. **Organizes** them into workspaces and folders

---

## Scopes Used

| Scope | Purpose | Where Used |
|-------|---------|------------|
| `user:read:user` | Identify the connected Zoom user profile and email | OAuth callback calls `GET /users/me` after authorization |
| `cloud_recording:read:list_user_recordings` | List a user's cloud recordings to enable historical sync | Import page calls `GET /users/me/recordings` |
| `cloud_recording:read:list_recording_files` | Read recording file metadata, including transcript file entries | Import action calls `GET /meetings/{meetingUUID}/recordings` |
| `cloud_recording:read:content` | Download the Zoom-generated transcript file from `recording_files[].download_url` | Import action downloads only the VTT transcript file; CallVault does not need to download the full audio/video recording for transcript import |

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

**Scope exercised:** `user:read:user` via `GET /users/me` during OAuth callback to identify the connected Zoom profile/email.

### Step 3: List Available Cloud Recordings

1. Ensure your Zoom account has at least one processed cloud recording with **Audio transcript** enabled.
2. From the CallVault dashboard, go to **Import** in the sidebar.
3. Select the **Zoom** source.
4. Click the Zoom search/sync control to pull recent recordings.
5. New recordings appear in the import list.

**Scope exercised:** `cloud_recording:read:list_user_recordings` via `GET /users/me/recordings`.

### Step 4: Import a Recording and Transcript

1. Select a Zoom cloud recording that has a transcript file.
2. Click **Sync selected** or **Sync all**.
3. CallVault fetches recording file metadata for the selected recording.
4. CallVault locates the transcript file where `recording_files[].file_type` is `TRANSCRIPT` or `recording_files[].recording_type` is `audio_transcript`.
5. CallVault downloads that transcript file from `recording_files[].download_url` and parses the VTT text.
6. The imported call appears in the call library with transcript text.

**Scopes exercised:**
- `cloud_recording:read:list_recording_files` via `GET /meetings/{meetingUUID}/recordings`
- `cloud_recording:read:content` via transcript VTT download from `recording_files[].download_url`

### Step 5: View Imported Call

1. Click on any imported Zoom call in the call library
2. The detail panel opens showing:
   - Call title (from Zoom meeting topic)
   - Date and duration
   - Full transcript imported from Zoom's generated VTT transcript file
   - Summary, if generated after import
3. Use the source link to open the Zoom recording when available

### Step 6: Organize Calls

1. Calls can be moved to **Workspaces** (team-shared) or **Folders** (sub-organization)
2. Drag a call to a folder in the sidebar, or use the **Move to...** option
3. Set up **Routing Rules** (Settings → Automation) to auto-sort future imports by meeting title keywords

### Step 7: Search Across Calls

1. Click the **Search** bar at the top (or press `/`)
2. Type a keyword that appears in one of the imported call transcripts
3. Results show matching calls with highlighted transcript excerpts
4. Click a result to jump directly to that moment in the call

### Step 8: Disconnect Zoom

1. Go to **Settings → Integrations → Zoom**
2. Click **Disconnect**
3. The integration status changes to **Not connected**
4. No new recordings will sync
5. Previously imported calls remain in CallVault

---

## Webhook Events

The functional reviewer test above uses the manual OAuth import path and does not require additional webhook-related OAuth scopes. CallVault has a webhook endpoint for future recording notifications, but this resubmission scope justification is limited to the endpoints exercised in the walkthrough:

- `GET /users/me`
- `GET /users/me/recordings`
- `GET /meetings/{meetingUUID}/recordings`
- transcript VTT download from `recording_files[].download_url`

---

## Data Handling Summary

- **What data is accessed:** Zoom user profile/email, cloud recording metadata, transcript file metadata, Zoom-generated VTT transcript file content, meeting metadata (title, date, duration)
- **How data is stored:** Encrypted at rest in Supabase (PostgreSQL + S3-compatible storage), isolated per organization via Row Level Security
- **Data retention:** User-controlled; data persists until the user deletes calls or their account
- **Data deletion:** Users can delete individual calls, or delete their account to remove all data within 30 days
- **Third-party sharing:** None — CallVault does not share user data with third parties

---

## Support & Documentation

- **Privacy Policy:** https://callvaultai.com/privacy
- **Terms of Use:** https://callvaultai.com/terms
- **Support:** support@callvaultai.com | +1 (315) 335-8779
- **Documentation:** https://docs.callvaultai.com/integrations/zoom
- **App removal guide:** https://docs.callvaultai.com/integrations/zoom#removing-the-zoom-integration
