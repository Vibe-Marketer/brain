# PRD-045: Settings - Zoom Connect Broken

**Status:** Ready for Implementation
**Priority:** P0 - CRITICAL BUG
**Category:** Settings
**Spec:** [SPEC-045](../../specs/spec-045-settings-zoom-connect.md)
**Created:** 2026-01-14

---

## Overview

Fix Zoom connection in Settings which goes nowhere when clicked.

## Problem Statement

Same issue as PRD-015 but in Settings. Zoom connect button is non-responsive.

## Goals

1. Restore Zoom OAuth initiation
2. Enable connection from Settings
3. Fix shared root cause with PRD-015

## User Stories

**US-045.1:** As a CallVault user, I want to connect Zoom from Settings so that I can import Zoom recordings.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Connect Zoom button triggers action | Must Have |
| FR-002 | Zoom OAuth URL opens | Must Have |
| FR-003 | Callback handled properly | Must Have |
| FR-004 | Connected status on success | Must Have |

## Technical Notes

Related to PRD-015. Likely same root cause - fix should apply to both locations.

**Files:**
- `src/components/settings/IntegrationsTab.tsx`
- Zoom OAuth edge function

## Acceptance Criteria

- [ ] Button triggers OAuth
- [ ] Zoom auth page opens
- [ ] Callback handled
- [ ] "Connected" status shown

---

*PRD generated from SPEC-045*
