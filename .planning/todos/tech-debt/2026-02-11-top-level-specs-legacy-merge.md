---
created: 2026-02-11T11:05
title: Top-level specs migration (legacy `specs/`)
area: tech-debt
source:
  - specs/spec-001-import-button-position.md
  - specs/spec-002-selected-indicator-collapsed.md
  - specs/spec-003-analytics-position.md
  - specs/spec-004-settings-position.md
  - specs/spec-005-search-box-spacing.md
  - specs/spec-006-search-box-hidden-default.md
  - specs/spec-007-import-extra-line.md
  - specs/spec-008-integrations-box-design.md
  - specs/spec-009-date-range-labeling.md
  - specs/spec-010-fetch-meetings-visibility.md
  - specs/spec-011-integration-icons-consistency.md
  - specs/spec-012-connect-button-active-state.md
  - specs/spec-013-connection-wizard-extra-steps.md
  - specs/spec-014-missing-requirements-info.md
  - specs/spec-016-google-meet-fathom-alternative.md
  - specs/spec-017-google-meet-extra-confirmation.md
  - specs/spec-018-google-connect-infinite-spinner.md
  - specs/spec-019-multiple-google-accounts.md
  - specs/spec-020-cancel-button-during-connection.md
  - specs/spec-021-integration-component-consistency.md
  - specs/spec-022-content-loading-state.md
  - specs/spec-023-content-cards-design.md
  - specs/spec-024-generator-naming.md
  - specs/spec-025-business-profile-edit.md
  - specs/spec-026-call-cards-size.md
  - specs/spec-029-missing-debug-tool.md
  - specs/spec-030-sorting-page-rework.md
  - specs/spec-032-team-status-display.md
  - specs/spec-036-excessive-divider-lines.md
  - specs/spec-037-edit-pencil-placement.md
  - specs/spec-038-confirmation-icons-visibility.md
  - specs/spec-039-email-edit-functionality.md
  - specs/spec-040-new-profile-creation-flow.md
  - specs/spec-041-users-tab-extra-lines.md
  - specs/spec-046-knowledge-base-indexing-count.md
  - specs/spec-047-loop-style-import-button.md
---

## Why this exists

The legacy top-level `specs/` directory duplicates old PRD/spec workflows. Keep-worthy ideas are consolidated here for future GSD planning.

## Consolidated backlog themes

1. UI polish batch (navigation spacing, icon visibility, form affordances, divider cleanup, import button styling).
2. Integration UX hardening (Google account handling, cancel/confirmation states, clearer requirements messaging).
3. Content/settings polish (card consistency, generator naming, business profile edit flow).
4. Larger epics to revisit: sorting/tagging rework, profile creation redesign, knowledge-base indexing visibility.

## Explicitly de-scoped / historical from legacy specs

- Coach invite specs (`spec-033`, `spec-034`) remain de-scoped with coach removal from active roadmap.
- Completed bug-fix specs (`spec-027`, `spec-028`, `spec-031`, `spec-035`, `spec-042`, `spec-043`, `spec-045`) are historical and should stay archived.
