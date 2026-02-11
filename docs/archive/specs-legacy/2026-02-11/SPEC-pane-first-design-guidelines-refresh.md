# SPEC-pane-first-design-guidelines-refresh

Status: Draft
Priority: High
Owner: Product + Frontend
Date: 2026-02-10

## Executive Summary

This spec refreshes CallVault's design guidelines around the real pane-first architecture already present in the app. It defines mandatory AppShell structure, when pane 2 and pane 4 are required, and a migration workflow that prioritizes reuse of existing pages/components over re-creation.

## What

Create an updated guideline release (target: v4.3) that becomes the new implementation contract for UI consistency.

The updated guideline must include:

1. AppShell as mandatory page shell for authenticated app routes
2. Pane model definition and responsibilities
   - Pane 1: nav rail
   - Pane 2: contextual navigator/filter pane
   - Pane 3: primary working surface
   - Pane 4: detail/options panel via panel store + outlet
3. Route-to-pane mapping rules
4. Header, tab, loading, empty, and error state standards
5. Token usage standards and anti-patterns
6. Migration sequencing policy
   - update existing implementations first
   - avoid net-new primitives unless no equivalent exists
7. QA protocol for visual and interaction verification

## Why

- Current guidance is partially out of sync with shipped architecture, causing inconsistent page builds.
- Inconsistency appears as fit/finish issues, especially when pages skip pane 2 or pane 4 patterns.
- Teams need one authoritative source to avoid patchwork implementation and duplicate patterns.

## User Experience

Users should feel one coherent system regardless of route:

- Navigation context remains stable through pane 1 + pane 2
- Core work happens in pane 3
- Deeper detail opens in pane 4 rather than route-jumping where applicable
- Headers, spacing, and interaction timing feel consistent

## Scope

### In Scope

- Pane-first guideline refresh and versioned documentation update
- Route taxonomy for pane behavior expectations
- Migration checklist and acceptance criteria for page updates

### Out of Scope

- Full redesign of all pages in one pass
- Replacing call detail route architecture in this phase
- New design language unrelated to pane consistency

## Decisions Made

1. **Reuse-first policy**: existing pages/components are updated before building new abstractions.
2. **Pane policy**: page-level workflows that have selectable entities should expose pane 2; entity details/options should use pane 4 when available.
3. **Incremental rollout**: high-visibility pages are normalized first, then long-tail pages.
4. **Deferred call detail architecture**: `/call/:callId` remains in current location for now and is tracked separately.

## Acceptance Criteria

1. A guideline update document is published with clear pane-first rules and examples.
2. All new/updated UI work references the updated guideline and follows AppShell conventions.
3. A route audit table exists with expected pane behavior per route family.
4. A migration checklist exists and is used during implementation PRs.
5. No guideline section instructs teams to recreate existing working patterns when an existing pattern can be adapted.
