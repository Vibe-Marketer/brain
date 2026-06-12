# Phase 9: Lint, Brand, and Documentation Hygiene - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce avoidable maintenance drag without changing runtime behavior: clean high-signal lint warnings from the 237-warning baseline, remove positive/recommending mentions of forbidden brand/tooling from active docs, and document guardrails that prevent lucide-react, framer-motion, and positive "AI-powered" framing from returning.

No product behavior changes. No broad refactors. `npm run lint`, `npm run type-check`, and `npm run build` pass after cleanup.

</domain>

<decisions>
## Implementation Decisions

### Lint Category Priority

- **D-01:** Fix in this order: (1) stale `eslint-disable` directives first — 20 are auto-fixable with `npm run lint -- --fix`; (2) unused vars/imports — rename to `_prefix` pattern per existing convention (`argsIgnorePattern: "^_"`); (3) `react-hooks/exhaustive-deps` warnings with plausible runtime impact; (4) stop there.
- **D-02:** [informational] Skip `no-explicit-any` this phase — ~100 warnings, fixing safely requires type investigation that risks behavior change.
- **D-03:** [informational] Skip `react-refresh/only-export-components` (15 warnings) this phase — requires file splitting which is structural, not hygiene.
- **D-04:** Success threshold: material reduction from 237 baseline. Targeting stale-disable removal + unused-vars cleanup alone should drop ~30–40 warnings without touching logic.
- **D-05:** Hook dependency warnings to fix: prioritize the ones identified as having plausible runtime impact — specifically `completedJobTimeoutsRef.current` stale-ref warning and missing `useMemo`/`useCallback` deps where the fix is "add the dep" not "remove the array." Defer warnings where adding the dep would trigger a semantic change (use `// eslint-disable-next-line react-hooks/exhaustive-deps` with a comment explaining why).

### Active-Doc Forbidden Pattern Scope

- **D-06:** [informational] "Remove forbidden examples" means: fix positive/recommending occurrences only. Leave prohibition/negative-context mentions in place — they're documentation of the rule, not violations of it.
- **D-07:** Files needing changes:
  - `docs/design/BUTTON_VARIANTS.md:268` — has `import { Eye, ... } from "lucide-react"` in a code example. Replace with equivalent `@remixicon/react` imports.
  - `docs/help/export-system.md:66` — has "For AI-powered summaries and insights." Reframe to "AI-ready" language per brand guidelines.
- **D-08:** Files that are fine as-is (do NOT change):
  - `docs/design/brand-guidelines-v4.4.md` — mentions `framer-motion` only in a "NEVER use" prohibition context. Correct as-is.
  - `docs/product-overview.md` — uses "AI-powered" only in "not AI-powered" / "AI-ready, not AI-powered" framing. Correct as-is.
  - `docs/brand-guidelines-changelog.md` — historical reference, not active guidance.
  - All `docs/archive/` files — archived, not linked as current guidance per roadmap criteria.

### Guardrail Form

- **D-09:** Implement as a lightweight grep command documented in CLAUDE.md (root level). The command scans `docs/**/*.md` (excluding `docs/archive/`) for forbidden positive-recommending patterns.
- **D-10:** Optionally add as `npm run lint:docs` script in `package.json` so it runs alongside `npm run lint`. Keep it a warning-not-error at this stage.
- **D-11:** Forbidden patterns to gate: `lucide-react` in import statements, `framer-motion` in positive context, `"AI-powered"` as a product descriptor (distinguish from prohibition context with grep pattern).
- **D-12:** No CI pipeline changes this phase. Document the grep command so future contributors know what to run. CI gate is a future-phase hardening decision.

### Claude's Discretion

- The exact grep patterns for the guardrail (to distinguish positive vs. prohibition context) — Claude can design these.
- Whether to use a simple `grep -r` or a more structured lint-docs script.
- Whether to add `@typescript-eslint/no-explicit-any` annotations to suppress specific complex cases if they block a clean lint pass.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brand & Design Rules
- `docs/design/brand-guidelines-v4.4.md` — Authoritative design system; defines the animation import rule (`motion/react` not `framer-motion`) and icon rule (`@remixicon/react` only). The framer-motion mentions here are prohibition context — correct as-is.
- `docs/CLAUDE.md` (root) — Hard constraints table (AI-02, FOUND-09, Icons, Animation). Guardrail documentation goes here.
- `src/CLAUDE.md` — Frontend hard constraints; cross-reference for icon and animation rules.

### Lint Configuration
- `eslint.config.js` — Active ESLint flat config. Rules: `@typescript-eslint/no-unused-vars` (warn), `@typescript-eslint/no-explicit-any` (warn), stale-disable detection active.
- `tsconfig.app.json` — `noUnusedLocals` and `noUnusedParameters` are enabled; `strictNullChecks` is OFF.

### Docs Being Fixed
- `docs/design/BUTTON_VARIANTS.md` — Has forbidden lucide-react import at line 268.
- `docs/help/export-system.md` — Has positive "AI-powered" language at line 66.

### Codebase Conventions
- `.planning/codebase/CONVENTIONS.md` — Import organization, hard constraints summary, icon/animation rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `eslint.config.js` — Already has `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"`. Unused arg fixes are simple prefix-rename.
- `npm run lint -- --fix` — Auto-removes stale `eslint-disable` directives. Run this first.

### Established Patterns
- Unused arg suppression: rename to `_varName` — already established by `argsIgnorePattern` and `varsIgnorePattern` in eslint config.
- `// eslint-disable-next-line react-hooks/exhaustive-deps` with explanatory comment — acceptable for hook dep warnings where adding the dep would change semantics.

### Integration Points
- `package.json` — Add `"lint:docs"` script pointing to the grep gate command.
- Root `CLAUDE.md` — Document the grep gate command in the Hard Constraints section.

### Current State (audited 2026-06-10)
- **237 warnings total** (baseline): ~100 `no-explicit-any`, 15 `react-refresh/only-export-components`, 20 stale `eslint-disable`, ~10 `react-hooks/exhaustive-deps`, ~12 `no-unused-vars`.
- **20 warnings auto-fixable** with `npm run lint -- --fix`.
- **Hook dep warnings with runtime impact:** `completedJobTimeoutsRef.current` stale ref, missing `useMemo` deps for `availableWorkspaces`/`excludedWorkspaces` lengths, missing `useCallback` dep for `queryClient`.

</code_context>

<specifics>
## Specific Ideas

- The BUTTON_VARIANTS.md fix should replace the lucide example with actual Remix Icons equivalents (e.g., `RiEyeLine`, `RiPencilLine`, `RiDownloadLine`, `RiCloseLine`, `RiArrowLeftLine`, `RiArrowRightLine`, `RiSearchLine`, `RiUserLine` from `@remixicon/react`).
- Guardrail grep pattern for docs (positive lucide): `grep -rn "from 'lucide" docs/ --include="*.md" | grep -v "docs/archive/"` — any hit is a violation.
- Guardrail grep for positive AI-powered (heuristic): `grep -rn '"AI-powered"\|AI-powered [A-Z]' docs/ --include="*.md" | grep -v "archive/\|not AI-powered\|AI-ready"` — requires human review of hits.

</specifics>

<deferred>
## Deferred Ideas

- **Full `no-explicit-any` cleanup** — ~100 warnings requiring type investigation; separate phase or ongoing maintenance task.
- **`react-refresh/only-export-components` file splits** — 15 warnings, structural; out of scope per roadmap SC-03.
- **CI enforcement of doc lint gate** — Making `lint:docs` a CI failure gate is a future hardening decision. This phase documents the command; CI wiring is deferred.
- **`TranscriptsTab` structural refactor** — Explicitly deferred by roadmap SC-03 "unless a warning fix requires a narrow extraction."

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-lint-brand-and-documentation-hygiene*
*Context gathered: 2026-06-10*
