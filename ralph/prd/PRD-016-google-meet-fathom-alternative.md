# PRD-016: Google Meet Fathom Alternative Promotion

**Status:** Ready for Implementation
**Priority:** P2 - UX Enhancement
**Category:** Import/Integrations
**Spec:** [SPEC-016](../../specs/spec-016-google-meet-fathom-alternative.md)
**Created:** 2026-01-14

---

## Overview

Add Fathom as an alternative option for Google Meet users who don't have compatible Workspace plans, with affiliate link and clear messaging.

## Problem Statement

Google Meet has restrictions (Workspace Business/Standard Plus/Enterprise/Education Plus only). Personal account users hit a dead end with no alternative path forward.

## Goals

1. Provide alternative for ineligible users
2. Generate affiliate revenue
3. Improve conversion by removing dead ends

## User Stories

**US-016.1:** As a CallVault user with a personal Google account, I want to see an alternative when Google Meet doesn't work for me so that I can still record and import my meetings.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Fathom alternative shown when Google Meet has restrictions | Must Have |
| FR-002 | Clear messaging about why Fathom is an alternative | Must Have |
| FR-003 | Working affiliate link | Must Have |
| FR-004 | Visually appealing CTA | Should Have |

## Technical Approach

**File:** `src/components/sync/InlineConnectionWizard.tsx`

Add Fathom promotion section below Google Meet restrictions:

```tsx
<div className="mt-4 p-3 bg-muted rounded-lg">
  <p className="text-sm">Have a personal Google account?</p>
  <p className="text-sm text-muted-foreground">
    Connect Fathom instead - it's free and works with any account.
  </p>
  <Button variant="outline" asChild className="mt-2">
    <a href="[FATHOM_AFFILIATE_LINK]" target="_blank">
      Sign up for Fathom (Free)
    </a>
  </Button>
</div>
```

## Acceptance Criteria

- [ ] Fathom alternative shown for restricted users
- [ ] Clear messaging explaining the alternative
- [ ] Working affiliate link
- [ ] Doesn't feel like a dead end

---

*PRD generated from SPEC-016*
