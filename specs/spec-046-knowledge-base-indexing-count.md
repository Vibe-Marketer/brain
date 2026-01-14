# SPEC-046: Knowledge Base Indexing - Incorrect Count

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Settings
**Priority:** UX Bug

---

## Summary

Fix the conflicting count display in Knowledge Base indexing. Shows "12 transcripts ready to index" but progress displays "1 of 933" - numbers don't match.

## What

Ensure indexing counts are accurate and consistent.

**Files to investigate:**
- Knowledge Base settings component
- Indexing status hooks
- `src/components/settings/` directory

**Current issues:**
1. Header says "12 transcripts ready to index"
2. Progress shows "1 of 933"
3. Numbers don't match
4. Unclear what's actually happening

**Done:** Accurate count displayed, numbers match actual indexing state

## Why

- Confusing conflicting information
- Users don't know true status
- Looks broken/unreliable
- Undermines trust in feature

## User Experience

- User sees accurate count of transcripts needing indexing
- Progress reflects actual state
- Numbers are consistent
- Clear understanding of indexing status

## Scope

**Includes:**
- Fixing count calculation
- Ensuring consistency between status and progress
- Accurate display of actual state

**Excludes:**
- Changing indexing functionality
- Adding new indexing features

## Acceptance Criteria

- [ ] Ready to index count is accurate
- [ ] Progress matches the ready count
- [ ] No conflicting numbers displayed
- [ ] User understands actual indexing state

## User Story

**As a** CallVault user
**I want** accurate indexing status information
**So that** I know how many transcripts are being processed

---

*Spec ready for PRD generation.*
