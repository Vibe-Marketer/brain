# SPEC-024: Generator Naming

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Content Section
**Priority:** UX Clarity

---

## Summary

Rename "Call Content Generator" to something more descriptive like "Social Post Generator" that actually describes what the feature does.

## What

Update naming/labeling for the content generator feature.

**Files to investigate:**
- Content generator components
- Navigation labels referencing this feature
- `src/components/content/` directory

**Current:** "Call Content Generator" - vague, doesn't describe output
**Done:** "Social Post Generator" or similar - describes what it creates

## Why

- Current name doesn't explain the feature
- Users don't know what they'll get
- "Call Content" is too generic
- Clear naming improves feature discovery

## User Experience

- User sees "Social Post Generator" → understands it creates social posts
- Feature purpose is immediately clear
- No ambiguity about what the tool does

## Scope

**Includes:**
- Renaming in UI labels
- Updating any navigation references
- Consistent naming across all instances

**Excludes:**
- Changing feature functionality
- Renaming internal code/components

## Acceptance Criteria

- [ ] Generator has descriptive name
- [ ] Name appears consistently everywhere
- [ ] Name describes output type (social posts)

## User Story

**As a** CallVault user
**I want** the content generator to have a clear name
**So that** I know what it creates before I use it

---

## Naming Options

- "Social Post Generator"
- "Post Generator"
- "Social Content Generator"
- "Generate Social Posts"

---

*Spec ready for PRD generation.*
