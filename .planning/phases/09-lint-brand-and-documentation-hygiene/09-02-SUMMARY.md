---
phase: 09-lint-brand-and-documentation-hygiene
plan: "02"
subsystem: docs
tags: [docs, brand, lint, remixicon, ai-ready]
dependency_graph:
  requires: []
  provides: [lint:docs npm script, clean active docs]
  affects: [docs/design/BUTTON_VARIANTS.md, docs/help/export-system.md, package.json]
tech_stack:
  added: []
  patterns: [grep-based doc linting, npm script guardrail]
key_files:
  created: []
  modified:
    - docs/design/BUTTON_VARIANTS.md
    - docs/help/export-system.md
    - package.json
decisions:
  - "framer-motion exclusion pattern broadened to match 'never' keyword (lowercase) in addition to 'NEVER use' to avoid false-positives from brand-guidelines negative mentions"
metrics:
  duration: "105s"
  completed: "2026-06-10"
  tasks_completed: 2
  files_modified: 3
---

# Phase 09 Plan 02: Doc Violations Fixed + lint:docs Guardrail Summary

Removed two active-doc brand violations and added a `lint:docs` npm script that guards against future drift — lucide-react import examples replaced with @remixicon/react, positive AI-powered copy replaced with AI-ready framing, and the guardrail script exits 0 clean with no warnings.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix BUTTON_VARIANTS.md and export-system.md | e13d5cf | docs/design/BUTTON_VARIANTS.md, docs/help/export-system.md |
| 2 | Add lint:docs npm script to package.json | a287e1b | package.json |

## Verification Results

- `grep -c 'lucide-react' docs/design/BUTTON_VARIANTS.md` → 0 (OK)
- `grep -n "AI-powered" docs/help/export-system.md` → no output (OK)
- `npm run lint:docs` → exits 0, prints "lint:docs complete", no WARNING lines
- Both files changed at exactly one line each (confirmed via git diff --stat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Broadened framer-motion exclusion pattern in lint:docs**
- **Found during:** Task 2 verification
- **Issue:** The plan's grep exclusion pattern `NEVER use|do not use|forbidden` did not catch lines in `brand-guidelines-v4.4.md` saying "never `framer-motion`" (lowercase, with backtick) and "not `framer-motion`" — these are negative/prohibition mentions, not positive use. The plan spec indicated those files are "correct as-is per D-08" but the pattern produced false-positive WARNINGs.
- **Fix:** Added `never` to the exclusion regex (`grep -Ev '...|never|...'`), which correctly filters all prohibition-context mentions of framer-motion.
- **Files modified:** package.json
- **Commit:** a287e1b

## Known Stubs

None — both doc files are fully wired and the lint:docs script is production-ready.

## Threat Flags

None — changes are documentation-only (BUTTON_VARIANTS.md, export-system.md) and a package.json scripts addition. No new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] `docs/design/BUTTON_VARIANTS.md` exists and contains no lucide-react
- [x] `docs/help/export-system.md` exists and contains no positive AI-powered
- [x] `package.json` contains exactly one `"lint:docs"` entry
- [x] Task 1 commit e13d5cf exists: `git log --oneline --all | grep e13d5cf` → found
- [x] Task 2 commit a287e1b exists: `git log --oneline --all | grep a287e1b` → found
