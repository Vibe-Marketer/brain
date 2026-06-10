# Phase 9: Lint, Brand, and Documentation Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 09-lint-brand-and-documentation-hygiene
**Mode:** --auto (all areas auto-selected, recommended options chosen)
**Areas discussed:** Lint category prioritization, Active-doc forbidden-pattern scope, Guardrail form

---

## Lint Category Prioritization

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all 237 warnings | Including no-explicit-any and react-refresh splits | |
| Roadmap priority order: stale-disable → unused-vars → hook deps | Skip no-explicit-any and react-refresh as too invasive | ✓ |
| Stale-disable only | Minimal footprint, just run --fix | |

**Auto-selected:** Roadmap priority order — matches ROADMAP.md success criteria language exactly ("prioritizing unused imports, stale eslint-disable comments, and hook dependency warnings with plausible runtime impact").
**Notes:** 20 warnings auto-fixable with `--fix`. ~100 `no-explicit-any` warnings deferred — safe fix requires type investigation. 15 `react-refresh` warnings deferred — file splits are structural.

---

## Active-Doc Forbidden-Pattern Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Any mention of forbidden tool | Remove all lucide/framer-motion/AI-powered hits regardless of context | |
| Positive/recommending mentions only | Fix code examples and positive product copy; leave prohibition/negative-context mentions | ✓ |
| Archive all offending docs | Move to docs/archive/ | |

**Auto-selected:** Positive/recommending mentions only.
**Notes:** 
- `brand-guidelines-v4.4.md` mentions framer-motion ONLY in a "NEVER use" rule — correct as-is.
- `product-overview.md` uses "AI-powered" in "not AI-powered" framing — correct as-is.
- `BUTTON_VARIANTS.md:268` has a lucide-react import in a code example — needs fixing.
- `export-system.md:66` has positive "AI-powered summaries" framing — needs fixing.

---

## Guardrail Form

| Option | Description | Selected |
|--------|-------------|----------|
| CI grep gate (fails build) | Adds grep step to CI pipeline | |
| npm script + CLAUDE.md documentation | Lightweight grep command, manual + optional npm script | ✓ |
| ESLint custom rule | Custom plugin for forbidden doc patterns | |

**Auto-selected:** npm script + CLAUDE.md documentation — matches roadmap's "lightweight grep gate or documented check."
**Notes:** CI enforcement is deferred. This phase documents the command and optionally wires it as `npm run lint:docs`. CI gate is a future hardening decision.

---

## Claude's Discretion

- Exact grep patterns for the guardrail (distinguishing positive vs. prohibition context)
- Whether to add `@typescript-eslint/no-explicit-any` targeted suppressions for complex cases
- Specific Remix Icon substitutions for the BUTTON_VARIANTS.md lucide example

## Deferred Ideas

- Full `no-explicit-any` cleanup — ~100 warnings, type investigation required, separate effort
- `react-refresh/only-export-components` file splits — 15 warnings, structural, out of scope
- CI hard enforcement of doc lint gate — future hardening phase
- `TranscriptsTab` structural refactor — explicitly deferred by roadmap SC-03
