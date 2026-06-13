---
spike: 002b
name: code-first-router-toolchain
type: comparison
validates: "Given the same API, when a code-first route registry is prototyped, then validation and OpenAPI output can be generated without replacing the deployed runtime."
verdict: PARTIAL
related: [001, 002a]
tags: [openapi, zod, edge-functions]
---

# Spike 002b: Code-First Router Toolchain

## What This Validates

Given CallVault's existing handler modules, when route metadata and schemas live beside route registration, then an OpenAPI-like contract can be generated from code without adopting a new API server.

## Research

Hono has credible Deno-compatible OpenAPI options. `@hono/zod-openapi` extends Hono to validate with Zod and generate OpenAPI docs. `hono-openapi` also targets automatic OpenAPI generation from validation libraries. Supabase docs support one Edge Function with internal routing, so a Hono-based internal router could fit technically.

| Approach | Tool/Library | Pros | Cons | Status |
|----------|--------------|------|------|--------|
| Keep current router + route metadata registry | Local TypeScript + Zod | Minimal dependency change; easy drift checks | Some manual OpenAPI conversion | Best code-first compromise |
| Hono + `@hono/zod-openapi` | Hono | Mature request router; generated docs; Deno-friendly | Replaces current route dispatch; adds Edge deps | Plausible later |
| Fully generated code from OpenAPI | openapi-generator/Speakeasy/Stainless | Strong downstream surfaces | Handler remains manually mapped | Better paired with 002a |

Sources checked:
- https://hono.dev/examples/zod-openapi
- https://hono.dev/examples/hono-openapi
- https://supabase.com/docs/guides/functions/routing

## How to Run

```bash
node .planning/spikes/002b-code-first-router-toolchain/route-registry-sketch.mjs
```

## What to Expect

The script prints a route registry and generated path map. It proves the shape is possible without adding dependencies.

## Investigation Trail

1. Sketched a route registry with method, path, operationId, auth, and schema labels.
2. Generated an OpenAPI-like `paths` object from the registry.
3. Compared against OpenAPI-first: code-first reduces duplication but risks making handler code the contract before the product surface is intentionally designed.

## Results

PARTIAL. Code-first route metadata is useful, but it should not replace OpenAPI-first planning yet. The best fit is hybrid:

- OpenAPI is the public contract.
- A local route registry in `callvault-api` maps handlers to operationIds.
- CI checks OpenAPI paths and operationIds against the registry.
- Hono can be reconsidered if route count grows enough that current dispatch becomes painful.

