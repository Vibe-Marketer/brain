# PRD-040: New Profile Creation Flow

**Status:** Ready for Implementation
**Priority:** P2 - UX Bug
**Category:** Settings
**Spec:** [SPEC-040](../../specs/spec-040-new-profile-creation-flow.md)
**Created:** 2026-01-14

---

## Overview

Fix the new profile creation flow: no indication to scroll down, content doesn't update when switching profiles.

## Problem Statement

After creating a profile, users don't know where to find it. Profile selector doesn't update content, showing wrong data.

## Goals

1. Guide users to new profiles
2. Fix profile selector behavior
3. Show correct profile data

## User Stories

**US-040.1:** As a CallVault user with multiple profiles, I want profile management to work correctly so that I can maintain separate business profiles.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | New profile creation leads to the form | Must Have |
| FR-002 | Profile selector updates content on change | Must Have |
| FR-003 | Correct profile data always displayed | Must Have |
| FR-004 | No stale/wrong data shown | Must Have |

## Technical Approach

1. Auto-scroll to new profile after creation, OR show clear indication
2. Fix profile selector state management
3. Ensure selected profile data is fetched/displayed

## Acceptance Criteria

- [ ] New profile creation has clear guidance
- [ ] Profile selector updates displayed content
- [ ] Correct data shown for selected profile
- [ ] No stale data visible

---

*PRD generated from SPEC-040*
