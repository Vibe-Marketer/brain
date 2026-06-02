# Zoom Marketplace — Resubmission Release Notes

**Copy/paste this into the Release Notes field when resubmitting.**

---

## Release Notes Text

Thank you for the detailed feedback. We have addressed all items:

**1. Test Plan, Credentials & Scope Justification**
A step-by-step test plan covering authorization, every requested scope, and full app functionality is linked below. Test credentials for a reviewer account are included.

We removed unused scopes from the OAuth request and retained only the scopes exercised by the reviewer walkthrough:
- `user:read:user` — exercised by `GET /users/me` during OAuth callback to identify the connected Zoom profile/email.
- `cloud_recording:read:list_user_recordings` — exercised by `GET /users/me/recordings` when listing available cloud recordings.
- `cloud_recording:read:list_recording_files` — exercised by `GET /meetings/{meetingUUID}/recordings` when reading recording file metadata.
- `cloud_recording:read:content` — exercised when downloading the Zoom-generated VTT transcript file from `recording_files[].download_url`.

Removed unused scopes:
- `user:read:email`
- `cloud_recording:read:recording`

Test Plan: [LINK TO GOOGLE DOC — upload docs/zoom-marketplace-test-plan.md]

**2. Free Account Compliance**
[CHOOSE ONE]:
- Credit card has been added to our Zoom account.
- OR: Compliance form submitted via the provided Google Form.

**3. App Gallery Images**
Added 5 new screenshots showing:
- Call library dashboard with imported Zoom recordings
- Call detail view with AI-generated summary
- Full transcript view with export options (TXT, MD, PDF, DOCX)
- Import sources page showing Zoom integration
- Search across all transcripts

**4. Privacy Policy**
URL: https://callvaultai.com/privacy
- Company: 7x Systems LLC (doing business as CallVault)
- Publicly accessible, no authentication required
- Covers: data collection, processing, retention, deletion, GDPR/CCPA rights

**5. Terms of Use**
URL: https://callvaultai.com/terms
- Company: 7x Systems LLC (doing business as CallVault)
- Publicly accessible, no authentication required

**6. Support URL**
URL: https://docs.callvaultai.com/reference/support
- Support email: support@callvaultai.com
- Phone: +1 (315) 335-8779
- Response SLA: Critical within 4 business hours, High within 1 business day, Normal within 2 business days
- Business hours: Monday-Friday 9am-5pm ET
- Self-service resources: documentation, FAQ, keyboard shortcuts, changelog

**7. Documentation (Adding, Using, Removing the App)**
URL: https://docs.callvaultai.com/integrations/zoom
- Adding the app: Step-by-step OAuth connection guide
- Usage: What syncs, where calls land, sync timing, managing the connection
- Removing the app: Disconnect from CallVault, uninstall from Zoom Marketplace, data deletion implications with table of what happens to data for each action
- Troubleshooting guide included

**8. Beta Submission**
We are proceeding with Published listing (not Beta) at this time.

---

## URLs to Enter in App Build Flow

| Field | URL |
|-------|-----|
| Privacy Policy URL | https://callvaultai.com/privacy |
| Terms of Use URL | https://callvaultai.com/terms |
| Support URL | https://docs.callvaultai.com/reference/support |
| Documentation URL | https://docs.callvaultai.com/integrations/zoom |
