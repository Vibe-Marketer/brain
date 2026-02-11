# SPEC-008: Integrations Box Design Cleanup

**Status:** Ready for PRD
**Created:** 2026-01-14
**Category:** Import/Integrations
**Priority:** UI Polish

---

## Summary

Simplify the integrations container design by removing unnecessary box styling and moving content up to reduce wasted space.

## What

Redesign the integrations section to be cleaner and more compact.

**Files affected:**
- `src/components/sync/IntegrationSyncPane.tsx`
- `src/components/sync/IntegrationStatusRow.tsx`

**Current:** Full box container with heavy borders/padding
**Done:** Cleaner, more compact design with content moved up

## Why

- Current box styling feels like overkill
- Excessive padding wastes vertical space
- Heavy container styling distracts from content
- Simpler design aligns with brand guidelines

## User Experience

- User sees integrations in a cleaner, more streamlined layout
- Less visual noise, more focus on integration status
- Content visible without excessive scrolling

## Scope

**Includes:**
- Reducing container padding
- Simplifying border/background styling
- Moving content up to reduce whitespace

**Excludes:**
- Changing integration functionality
- Modifying individual integration row content

## Acceptance Criteria

- [ ] Integrations section has reduced visual weight
- [ ] Content is more compact vertically
- [ ] Design feels cleaner and less "boxy"
- [ ] Still clearly grouped as a section

## User Story

**As a** CallVault user
**I want** a cleaner integrations section
**So that** I can focus on managing my integrations without visual clutter

---

*Spec ready for PRD generation.*
