# Spike Conventions

Patterns established across the v1 spike session (provider-API research, May 2026). New spike sessions follow these unless the question requires otherwise.

## Stack

- **Research-mode spikes:** documentation-only, no code. Output is a structured `README.md` per spike with frontmatter.
- **Runtime/OAuth-proof spikes** (deferred follow-ups 007-010): when built, will use the project's existing Supabase Edge Function stack (Deno, Zod, `@supabase/supabase-js@2`) so the spike code can be promoted directly into the phase build with minimal port effort.

## Structure

Per-spike directory layout:

```
.planning/spikes/
  MANIFEST.md                     # index + Requirements + verdicts
  CONVENTIONS.md                  # this file
  NNN-descriptive-kebab-name/
    README.md                     # frontmatter + Research + Investigation Trail + Results
    [optional sample/, scripts/, evidence/]
```

Spike numbers are zero-padded 3 digits (`001`, `002`, ...). Names use kebab-case.

## Patterns

### Reference-doc spikes (e.g., 001)

When the goal is to capture an existing system as a measurement template for downstream spikes, the spike's deliverable is the documentation itself. Verdict is `VALIDATED` once the doc accurately reflects the live system.

### Provider-research spikes (e.g., 002-005)

Research-only paper feasibility spikes use a fixed 8-section structure:

1. API Existence & Documentation
2. Authentication Model
3. Plan Tier Required
4. Transcript / Recording Endpoints
5. Webhooks
6. Rate Limits
7. TOS Clauses
8. Comparison vs reference template

This structure is mandatory — synthesis spikes (e.g., 006) read these sections directly into a comparison matrix, so deviating from the schema breaks downstream synthesis.

Verdict scale: `VALIDATED` (full integration buildable today), `CONDITIONAL` (buildable with caveats — plan tier, TOS, UX friction), `PARTIAL` (some capabilities missing — buildable as reduced scope), `INVALIDATED` (cannot match reference template).

### Synthesis spikes (e.g., 006)

When 3+ research spikes share a measurement template, run a synthesis spike that produces:

- A cross-cutting matrix (one row per dimension, one column per provider)
- Cross-cutting patterns (3-5 bullet observations that emerge from the matrix)
- A re-prioritization vs the user's original ordering, with reasoning
- A recommended follow-up spike list (gated by user-side prerequisites)

### Parallel research dispatch

When researching N providers/options that share a template, dispatch N agents in parallel (single message, multiple `Agent` tool calls). Provide each agent with:

- The exact reference template path (mandatory pre-read)
- The exact output path
- The exact frontmatter + section structure
- Provider-specific investigation hints (rebrandings, known plan-tier histories, suspect base URLs from community tools)
- A "be honest about uncertainty" instruction — INVALIDATED with evidence is more valuable than fake VALIDATED

### Verdict commits

Commit per spike with format:
```
docs(spike-NNN): [VERDICT] — [key finding]
```

The MANIFEST verdict column gets a one-line summary of the verdict + key constraint, not just the symbol — readers should be able to scan MANIFEST without opening individual READMEs.

## Tools & Libraries

- `WebSearch` + `WebFetch`: primary research tools for provider docs
- `Agent` (general-purpose): for parallel research dispatch
- `Read` (mandatory pre-read of reference template before any provider spike)
- No code-execution dependencies in research-mode spikes

## Requirements (carried from MANIFEST.md)

Re-read `MANIFEST.md` Requirements section before each new spike — the requirements have implications for verdict thresholds:

- **R-04** (plan-tier gating): means CONDITIONAL is the floor for any provider where API access is locked behind a paid plan. Don't claim VALIDATED without a clean self-serve free tier path.
- **R-03** (TOS storage clauses): blocks VALIDATED if the provider's TOS prohibits third-party storage or "value-added commercial product" usage.
