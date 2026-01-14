# PRD-019: Multiple Google Account Handling

**Status:** Ready for Implementation
**Priority:** P2 - UX Enhancement
**Category:** Import/Integrations
**Spec:** [SPEC-019](../../specs/spec-019-multiple-google-accounts.md)
**Created:** 2026-01-14

---

## Overview

Handle multiple Google account scenarios properly. Show clear indication when a Google account is already connected and handle attempts to connect additional accounts.

## Problem Statement

No indication of current connection status. Users trying to connect accounts don't know if one is already connected, leading to confusion and potential conflicts.

## Goals

1. Clear visibility of connected account
2. Handle "already connected" gracefully
3. Prevent user confusion

## User Stories

**US-019.1:** As a CallVault user with multiple Google accounts, I want clear visibility into which account is connected so that I can manage my integrations properly.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Show connected Google account email | Must Have |
| FR-002 | Clear "Connected" status visible | Must Have |
| FR-003 | Attempt to reconnect either works or explains why not | Must Have |

## Technical Approach

**Files:**
- `src/components/sync/IntegrationStatusRow.tsx`
- `src/components/sync/InlineConnectionWizard.tsx`

Display connected account info: "Google Meet - Connected (email@example.com)"

## Acceptance Criteria

- [ ] Connected account shows email/identifier
- [ ] "Connected" status clearly visible
- [ ] Reconnect attempt handled gracefully
- [ ] No silent failures or confusing states

---

*PRD generated from SPEC-019*
