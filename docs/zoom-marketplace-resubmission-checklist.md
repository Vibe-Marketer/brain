# Zoom Marketplace Resubmission Checklist

**Date:** April 3, 2026
**Status:** Preparing for resubmission

---

## Feedback Items & Resolutions

### 1. Test Plan & App Credentials
**Status:** DONE (needs you to add credentials)

- Test plan document: `docs/zoom-marketplace-test-plan.md`
- **Action needed:** Add this as a link in the release notes of next submission
- **Action needed:** Fill in the test account email/password in the test plan (or create a dedicated reviewer test account)
- Covers: authorization flow, every scope with justification, all features, webhook events, data handling

### 2. Free Account: Add CC or Complete Compliance Form
**Status:** YOU MUST DO THIS

Two options (pick one):
- **Option A:** Add a credit card to your Zoom account → [Support Article](https://support.zoom.us/hc/en-us/articles/207596143-Updating-your-credit-card)
- **Option B:** Fill out the compliance form → [Google Form](https://docs.google.com/forms/d/1Uawi16bKbB4VZF2pAiFDNy6DMSP57jP4zu_yWxlwpd0/viewform)

### 3. More Gallery Images
**Status:** YOU PICK SCREENSHOTS

Zoom wants images showing what users see when using the integration. Recommended screenshots:
- [ ] Dashboard / call library view with imported Zoom calls
- [ ] Call detail view showing transcript + AI summary
- [ ] Settings → Integrations → Zoom connected state
- [ ] Zoom OAuth consent screen
- [ ] Import page showing Zoom sync status
- [ ] Search results across transcripts

Existing screenshots available in `e2e/screenshots/` — or take fresh ones from production.

### 4. Privacy Policy
**Status:** DONE

- URL: **https://callvaultai.com/privacy**
- Company: 7x Systems LLC ✓
- Publicly accessible (no auth required) ✓
- Covers: data collection, processing, retention, deletion, GDPR/CCPA rights ✓

### 5. Terms of Use
**Status:** DONE

- URL: **https://callvaultai.com/terms**
- Company: 7x Systems LLC ✓
- Publicly accessible ✓

### 6. Support URL
**Status:** DONE (deploy docs site update)

- URL: **https://callvaultai.com/support** (website) or docs site `/reference/support`
- Created: `docs-site/reference/support.mdx`
- Includes: email (support@callvaultai.com), phone, response SLA, self-service resources, how to submit requests
- **Action needed:** Deploy docs site so the page is live, then confirm the URL

### 7. Documentation (Add / Use / Remove)
**Status:** DONE (deploy docs site update)

- URL: docs site `/integrations/zoom`
- **Adding the app:** Steps 1-4 in "Connecting Zoom" section ✓
- **Usage:** "What syncs", "Where synced calls land", "Sync timing" sections ✓
- **Removing the app:** NEW section added — covers disconnect from CallVault, uninstall from Zoom, data deletion implications ✓
- Troubleshooting guide included ✓
- **Action needed:** Deploy docs site so updated page is live

### 8. Beta Rejection (RESOLVED — Optional)
**Status:** SKIP — proceed with Published listing

Beta requires SSDLC evidence, SAST/DAST scans, pen test results, etc. Not needed for Published marketplace listing.

---

## Submission Checklist

Before hitting "Resubmit":

- [ ] **Test credentials:** Create or confirm a test account and add credentials to the test plan
- [ ] **Test plan link:** Upload test plan to Google Docs (or similar) and add the link to release notes
- [ ] **Zoom account:** Add credit card OR submit compliance form
- [ ] **Gallery images:** Upload 3-5 screenshots showing key integration features
- [ ] **Deploy docs site:** Push the support page + updated Zoom docs live
- [ ] **Confirm URLs work:**
  - [ ] https://callvaultai.com/privacy (already live ✓)
  - [ ] https://callvaultai.com/terms (already live ✓)
  - [ ] Support page URL (after deploy)
  - [ ] Zoom documentation URL (after deploy)
- [ ] **Release notes:** Mention all resolved items in the submission release notes

---

## URLs to Enter in Zoom Marketplace App Settings

| Field | URL |
|-------|-----|
| Privacy Policy URL | https://callvaultai.com/privacy |
| Terms of Use URL | https://callvaultai.com/terms |
| Support URL | https://docs.callvaultai.com/reference/support |
| Documentation URL | https://docs.callvaultai.com/integrations/zoom |
