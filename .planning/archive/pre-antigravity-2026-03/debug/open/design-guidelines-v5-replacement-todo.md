# TODO: Replace Outdated Design Guidelines

Date: 2026-02-10
Status: Open (spec drafted, publication pending)

## Why

Current guidelines are partially out of date and do not fully match the live pane-first app architecture.

## Required Outcome

Create a new, authoritative guideline doc that reflects the current product and is implementation-ready.

## Current Progress

- Draft spec exists: `docs/specs/SPEC-pane-first-design-guidelines-refresh.md`
- Still pending: promote to canonical guideline and enforce via team workflow.

## Must Include

1. AppShell-first layout rules (Pane 1/2/3/4 behavior)
2. When secondary panes are required vs optional
3. Right-side detail pane (4th pane) interaction standards
4. Route-to-pane mapping rules for existing pages
5. Header pattern standards with examples
6. Tabs standards (base component usage + allowed overrides)
7. Token usage rules (no raw gray/purple in user-facing surfaces unless explicitly approved)
8. Loading/empty/error state standards
9. Migration checklist for legacy pages

## Constraint

- Reuse existing components/patterns first.
- Avoid creating net-new layout primitives unless there is no existing equivalent.
