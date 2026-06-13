---
spike: 004
name: runtime-fit-assessment
type: standard
validates: "Given CallVault's locked stack, when Node/npm, Deno, and Bun are scored against API and CLI needs, then the best runtime/tooling option is clear."
verdict: VALIDATED
related: [002a, 002b, 003]
tags: [runtime, bun, deno, node]
---

# Spike 004: Runtime Fit Assessment

## What This Validates

Given CallVault's current constraints, when Bun is compared with Node/npm and Deno across backend API, contract tooling, and CLI needs, then the implementation choice is based on fit rather than novelty.

## Research

Supabase Edge Functions run TypeScript on Deno, and Supabase recommends per-function `deno.json` dependency management. The main CallVault repo is npm-only with Vite/Vitest/tsx. Bun is a fast all-in-one JS/TS toolkit, but adopting it here would create a third runtime/package-manager convention for no immediate benefit.

| Runtime/tooling | Best role | Pros | Cons | Verdict |
|-----------------|-----------|------|------|---------|
| Deno | Production Edge Functions | Already required by Supabase; TypeScript-native | Different import/dependency model from frontend | Keep for API runtime |
| Node/npm | Repo tooling, OpenAPI generation, CLI package | Already locked in repo; npm publish path; native `fetch` available | Not the Edge runtime | Best for tooling and CLI |
| Bun | Possible standalone CLI experiment | Fast TS execution; can be incrementally adopted | Banned/misaligned in this repo; not Supabase Edge runtime | Do not use for main path |

Sources checked:
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/dependencies
- https://docs.deno.com/runtime/fundamentals/node/
- https://bun.com/docs

## How to Run

```bash
node .planning/spikes/004-runtime-fit-assessment/runtime-fit-matrix.mjs
```

## What to Expect

The script prints a weighted score table.

## Investigation Trail

1. Scored runtimes against current backend, repo workflow, contract generation, CLI publishing, and operational simplicity.
2. Treated Bun as a candidate, not a requirement.
3. Penalized adding a new package manager/runtime to the main repo because CallVault has hard npm-only conventions.

## Results

VALIDATED. Best option:

- API runtime: keep Supabase Edge Functions on Deno.
- Contract/tooling: use OpenAPI-first with npm-based tooling.
- CLI: build/publish a Node/npm TypeScript CLI, generated or checked from OpenAPI.
- Bun: leave out of the main implementation unless a future standalone CLI benchmark shows enough value to justify a separate package.

