# SPEC-045: Settings - Zoom Connect Broken

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** CRITICAL BUG

---

## Summary

Fix Zoom connection in Settings which goes nowhere when clicked - no response at all.

## What

Debug and fix Zoom OAuth initiation from Settings.

**Files to investigate:**
- `src/components/settings/IntegrationsTab.tsx`
- Zoom OAuth initialization
- `supabase/functions/` for Zoom handler

**Current:** Clicking to connect Zoom goes nowhere - no response
**Done:** Zoom OAuth flow initiates properly

## Why

- Same issue as SPEC-015 but in Settings
- Users can't connect Zoom
- No feedback at all on click
- Critical integration broken

## User Experience

- User clicks connect Zoom → Zoom OAuth page opens
- User authorizes → redirected back connected

## Scope

**Includes:**
- Fixing click handler
- OAuth URL generation
- Redirect handling

**Excludes:**
- Changing Zoom scopes

## Acceptance Criteria

- [ ] Connect Zoom button triggers action
- [ ] Zoom OAuth URL opens
- [ ] Callback handled properly
- [ ] Connected status shown on success

## User Story

**As a** CallVault user
**I want** to connect Zoom from Settings
**So that** I can import Zoom recordings

---

## Technical Notes

Related to SPEC-015 (Zoom Connect Broken in Import). Likely same root cause - fix should apply to both.

---

*Spec ready for PRD generation.*
