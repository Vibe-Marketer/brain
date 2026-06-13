# Spike Manifest

## Idea

Explore what it would take to evolve CallVault's existing production read-only REST API into a complete developer surface that can support direct API use, generated clients, and a CLI. Bun is evaluated as one candidate runtime, but the target decision is the best fit for CallVault's current npm, TypeScript, Supabase Edge Function, and Cloudflare proxy architecture.

## Requirements

- Preserve `https://api.callvaultai.com/v1/*` as the canonical machine API surface.
- Keep REST separate from MCP: JSON REST envelopes, not MCP markdown or JSON-RPC.
- Keep production API handlers on Supabase Edge Functions and Cloudflare routing unless a later phase explicitly changes platform.
- Prefer a contract-first OpenAPI workflow for generated clients, docs, and CLI planning.
- Do not introduce Bun into the main CallVault repo unless it wins on fit; currently npm/Node for repo tooling and Deno for Edge Functions remain the aligned default.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | api-surface-gap-map | standard | Given the current `/v1/*` implementation and docs, when compared to a complete developer/CLI-ready contract, then we get a concrete API gap map. | VALIDATED | [api, rest, planning] |
| 002a | openapi-first-toolchain | comparison | Given the existing Supabase Edge Function API, when an OpenAPI-first workflow is prototyped, then docs, clients, and CLI commands can be generated or validated from one contract. | VALIDATED | [openapi, sdk, docs] |
| 002b | code-first-router-toolchain | comparison | Given the same API, when a code-first route registry is prototyped, then validation and OpenAPI output can be generated without replacing the deployed runtime. | PARTIAL | [openapi, zod, edge-functions] |
| 003 | cli-implementation-path | standard | Given an API contract and token auth, when a CLI slice is prototyped, then the CLI packaging and command shape are clear. | VALIDATED | [cli, api, node] |
| 004 | runtime-fit-assessment | standard | Given CallVault's locked stack, when Node/npm, Deno, and Bun are scored against API and CLI needs, then the best runtime/tooling option is clear. | VALIDATED | [runtime, bun, deno, node] |

