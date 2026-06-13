---
spike: 002a
name: openapi-first-toolchain
type: comparison
validates: "Given the existing Supabase Edge Function API, when an OpenAPI-first workflow is prototyped, then docs, clients, and CLI commands can be generated or validated from one contract."
verdict: VALIDATED
related: [001]
tags: [openapi, sdk, docs]
---

# Spike 002a: OpenAPI-First Toolchain

## What This Validates

Given the current REST API, when we write the public contract first and validate implementation/docs against it, then CallVault gets a single source for API docs, TypeScript types/clients, CLI command planning, and drift checks.

## Research

| Approach | Tool/Library | Pros | Cons | Status |
|----------|--------------|------|------|--------|
| `openapi-typescript` | OpenAPI TypeScript | Small, common, npm-friendly; generates TS types from local/remote schemas | Types only, not full SDK/CLI | Best first step |
| Hey API `openapi-ts` | Hey API | Generates SDKs, Zod schemas, TanStack Query hooks; strong plugin system | More moving parts than types-only | Strong later option |
| OpenAPI Generator | OpenAPI Generator | Very broad language support | Heavier Java-based toolchain; generated TS can be less idiomatic | Later/multi-language option |
| Speakeasy | Speakeasy CLI/service | SDKs and CLI generation from OpenAPI | External platform/vendor workflow | Strong if CLI/SDK becomes product-grade |
| Stainless | Stainless service | High-quality SDKs/docs/CLI/MCP from OpenAPI | External paid/vendor workflow | Strong if developer platform becomes core |

Sources checked:
- https://openapi-ts.dev/cli
- https://github.com/hey-api/openapi-ts
- https://openapi-generator.tech/docs/generators/typescript/
- https://www.speakeasy.com/docs/sdks/create-client-sdks
- https://www.stainless.com/docs/

## How to Run

```bash
node .planning/spikes/002a-openapi-first-toolchain/check-openapi-contract.mjs
```

## What to Expect

The script confirms the prototype OpenAPI spec contains every currently implemented route and that every path has an `operationId`, which is required for stable SDK/CLI generation.

## Investigation Trail

1. Wrote a minimal OpenAPI 3.1 contract for the current five routes.
2. Added `operationId` values that map cleanly to future SDK methods and CLI commands.
3. Built a no-dependency drift check that reads the spec and the current Edge Function route strings.

## Results

VALIDATED. OpenAPI-first is the best near-term path. It fits the existing Supabase Edge Function runtime because it does not require replacing the handler. It also gives the future CLI a stable command map.

Recommended next build pattern:

1. Commit `docs/api/openapi.yaml` as the public contract.
2. Add `scripts/api/check-openapi-contract.mjs` to catch route/spec drift.
3. Generate TypeScript types with `openapi-typescript`.
4. When SDK/CLI quality matters, evaluate Speakeasy or Stainless against the same spec.

