# PRD-017: Google Meet Extra Confirmation Step

**Status:** Implemented
**Priority:** P2 - UX Friction
**Category:** Import/Integrations
**Spec:** [SPEC-017](../../specs/spec-017-google-meet-extra-confirmation.md)
**Created:** 2026-01-14

---

## Overview

Eliminate the extra confirmation screen after acknowledging Google Meet requirements. The "Connect with Google Meet" button should be on the requirements page itself.

## Problem Statement

After acknowledging requirements, users must click through yet another confirmation screen before connecting. This adds unnecessary friction to the connection flow.

## Goals

1. Reduce clicks to complete connection
2. Combine requirements and connect button
3. Streamline user flow

## User Stories

**US-017.1:** As a CallVault user connecting Google Meet, I want to connect immediately after reading requirements so that I don't have to click through extra screens.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | No separate confirmation after requirements | Must Have |
| FR-002 | Connect button on same page as requirements | Must Have |
| FR-003 | Button disabled until requirements acknowledged | Must Have |

## Technical Approach

**File:** `src/components/sync/InlineConnectionWizard.tsx`

Combine requirements step with connect button:
- Show requirements with checkbox
- "Connect with Google Meet" button below, disabled until checked
- Single click to proceed to OAuth

## Acceptance Criteria

- [x] No separate confirmation screen
- [x] Connect button on requirements page
- [x] ~~Button disabled until acknowledgment~~ (Improved: no acknowledgment needed - requirements are collapsible)
- [x] Single step from requirements to OAuth

---

*PRD generated from SPEC-017*
