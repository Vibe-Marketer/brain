---
created: 2026-02-11T10:15
title: Canonize spec status and triage archived PRDs
area: documentation
files:
  - docs/specs/
  - docs/archive/specs-implemented/README.md
  - ralph-archived/prd/
  - .planning/audits/2026-02-11-spec-coverage-and-handoff.md
---

## Problem

Spec and PRD artifacts are scattered across `docs/specs` and `ralph-archived/prd`. Some are implemented, some partial, some de-scoped, and many are unverified against current architecture.

Without canonicalization, team members cannot quickly tell which specs are active, superseded, or archive-only.

## Solution

Run a one-pass documentation canonization process:

1. Create a single index mapping each `docs/specs` item to one of:
   - Implemented
   - Partially implemented
   - Not implemented
   - Superseded
   - Documentation/meta only
2. For each stale or superseded spec, add explicit pointer to current source (phase/requirement or newer spec).
3. Triage unknown PRDs in `ralph-archived/prd` into:
   - Keep as active backlog item
   - Merge into existing requirement/phase
   - Archive as historical
4. Update archive READMEs so "active specs" sections reflect reality.

## Context

Audit source: `.planning/audits/2026-02-11-spec-coverage-and-handoff.md`

High-level audit findings:
- `docs/specs`: 11 files total (2 implemented, 4 partial, 2 not implemented, 3 meta)
- `ralph-archived/prd`: 46 files total (8 implemented, 2 partial, 2 de-scoped, 34 unknown/unverified)
