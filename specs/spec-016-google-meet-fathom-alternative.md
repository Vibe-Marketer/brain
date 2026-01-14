# SPEC-016: Google Meet Fathom Alternative Promotion

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UX Enhancement

---

## Summary

Add Fathom as an alternative option for Google Meet users who don't have compatible Workspace plans. Include affiliate link and clear messaging about the free alternative.

## What

When displaying Google Meet restrictions, offer Fathom as an alternative path.

**Files to investigate:**
- `src/components/sync/InlineConnectionWizard.tsx`
- Google Meet requirements screen

**Current:**
- Google Meet shows restrictions (only Workspace Business/Standard Plus/Enterprise/Education Plus)
- Personal accounts told they can sync meeting data but not recordings
- No alternative offered

**Done:**
- Add Fathom affiliate link/CTA
- Messaging: "If you have another type of account, connect Fathom instead. Sign up free using this link."
- Users have a path forward regardless of Google account type

## Why

- Don't leave users at a dead end
- Fathom provides a free alternative
- Affiliate revenue opportunity
- Better user experience than "sorry, you can't use this"

## User Experience

- User with personal Google account sees restriction message
- Below restriction, sees Fathom alternative with clear CTA
- User can sign up for Fathom and connect it instead
- No dead ends in the flow

## Scope

**Includes:**
- Adding Fathom promotion section to Google Meet requirements
- Clear copy explaining the alternative
- Affiliate link (get from business team)
- Styling consistent with rest of wizard

**Excludes:**
- Building Fathom integration (already exists)
- Changing Google Meet restrictions

## Acceptance Criteria

- [ ] Fathom alternative shown when Google Meet has restrictions
- [ ] Clear messaging about why Fathom is an alternative
- [ ] Working affiliate link
- [ ] Visually appealing CTA that doesn't feel like a dead end

## User Story

**As a** CallVault user with a personal Google account
**I want** to see an alternative when Google Meet doesn't work for me
**So that** I can still record and import my meetings

---

*Spec ready for PRD generation.*
