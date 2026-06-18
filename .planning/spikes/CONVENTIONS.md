# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack

- Use Node/npm scripts for local spike tooling in this repo.
- Keep production API-runtime assumptions aligned with Supabase Edge Functions on Deno.
- Do not introduce Bun into CallVault spike prototypes unless the spike specifically tests Bun as a standalone candidate.

## Structure

- Each spike lives at `.planning/spikes/NNN-name/`.
- Each spike includes a `README.md` with frontmatter, research, run commands, investigation trail, and result.
- Runnable prototypes should be dependency-light and executable with `node ...` unless the question explicitly requires another runtime.

## Patterns

- For API/platform spikes, prefer contract checks and route inventories over ad hoc prose only.
- Keep generated or prototype API commands aligned to OpenAPI `operationId` names.
- For connector feasibility spikes, separate "metadata available" from "recording/transcript media available" before recommending a user-visible connector label.

## Tools & Libraries

- Preferred for this API/CLI line: OpenAPI 3.1 contract, npm-based generators/checkers, Node CLI package, Supabase Edge Function runtime.
- Evaluate but do not default to: Bun, Hono, Speakeasy, Stainless.
