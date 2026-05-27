---
phase: 2
phase_name: "MCP Monolith Refactor"
project: "CallVault"
generated: "2026-05-27T18:04:00Z"
counts:
  decisions: 1
  lessons: 2
  patterns: 1
  surprises: 1
missing_artifacts:
  - "02-UAT.md"
---
# Phase 2 Learnings: MCP Monolith Refactor

## Decisions

### Maintained Single Edge Function (Registry Pattern)
Decided to keep a single `mcp-server` Edge Function rather than splitting it into 36 individual functions.
**Rationale:** Minimizes cold starts while still solving the code maintainability issues of a monolith by breaking tools into separate extracted modules that register via a handler map.
**Source:** `.planning/research/MCP-MULTI-WORKSPACE.md` and Phase 2 Execution

---

## Lessons

### Verification Claims Must Require Evidence
GSD state must not advance ahead of concrete evidence. Claiming "byte-identical behavior parity" without capturing a fixture replay diff, or "cold-start reduction" based solely on the existence of dynamic imports is invalid.
**Context:** The initial verification claimed success metrics that were merely assumed based on implementation choices rather than measured.
**Source:** `gemini-handoff-20260527T175603Z.md`

### Source Inspection Tests Miss Deno Syntax Failures
Testing tools using Vitest source-inspection tests is insufficient for Deno runtimes.
**Context:** Generated code files contained malformed syntax (e.g. `literal \nfunction unauthorizedResponse(`) and incorrect relative imports that bypassed the test suite but broke Deno execution.
**Source:** `gemini-handoff-20260527T175603Z.md`

---

## Patterns

### Three-Tier Verification State
**Description:** Maintain three distinct verification states for GSD workflows: `implemented`, `locally verified`, and `externally/live verified`.
**When to use:** Use this pattern to track progress accurately. Only mark a phase completely "VERIFIED" when the external/live verification is proven.
**Source:** `gemini-handoff-20260527T175603Z.md`

---

## Surprises

### Fragility of AI Code Generation in Extractions
**What was surprising:** The AI generated modular splits that fundamentally broke relative path resolution (`supabase/functions/mcp-server/_shared/...` instead of correct resolution) and mangled basic TypeScript declarations.
**Impact:** Required manual reconciliation using `deno check` to repair the extracted tools to get the edge function parsing correctly.
**Source:** `gemini-handoff-20260527T175603Z.md`
