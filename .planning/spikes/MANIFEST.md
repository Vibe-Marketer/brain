# Spike Manifest

## Idea

Explore what it would take to evolve CallVault's existing production read-only REST API into a complete developer surface that can support direct API use, generated clients, and a CLI. Bun is evaluated as one candidate runtime, but the target decision is the best fit for CallVault's current npm, TypeScript, Supabase Edge Function, and Cloudflare proxy architecture.

**Addendum (2026-06-17) — printing-press data-layer adoption (spikes 005–007).** A second, related line: assess the feasibility and value of adapting the `cli-printing-press` pattern (github.com/mvanhorn/cli-printing-press) to our systems. The "big draw" is its **local-SQLite-data-hoard + offline compound-insight** layer — proven by the generated pp-fathom and pp-fireflies CLIs, which pull large amounts of external API data across many calls into a local SQLite store and run offline aggregate/insight commands over it. The generator emits **Go** CLIs, which is in direct tension with spike 004's Node/npm lock — so the assessment is explicitly *adopt-the-Go-generator (005)* vs *steal-the-pattern into TS/Node (006)*, plus whether the pattern's real payoff (hoarding **external** data we don't own a DB for, 007) is viable for the portfolio.

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
| 005 | aggregate-intelligence-moat-redteam | standard | Given the printing-press pattern projected onto CallVault as a 3-layer moat (SQL outcomes + Honcho memory + coding-hooks), when adversarially stress-tested (32-agent repo-grounded RedTeam), then feasibility, the defensible kernel, and the minimum-lovable build are clear. | PARTIAL | [strategy, moat, sql-aggregation, honcho, mcp, redteam] |
| ~~006~~ | ~~steal-pattern-ts-prototype~~ | — | Superseded by 005: the question stopped being "does the pattern work in TS" (it does) and became "is the moat real / what to build" — answered by RedTeam, not a prototype. | SUPERSEDED | [folded-into-005] |
| ~~007~~ | ~~external-hoard-fit~~ | — | Folded into 005: the external-hoard angle = mirroring provider data CallVault already normalizes into Supabase; assessed in the RedTeam verdict (cross-provider normalization is the fragile dependency). | SUPERSEDED | [folded-into-005] |

## 005 Verdict (RedTeam)

**REAL-BUT-FRAGILE, L1-only.** The SQL compound-insight layer is a genuine, hard-to-copy edge — but it's a *build*, not a current asset (needs ingest-time structured-extraction columns + cross-provider normalization), it's "over Fathom calls" today (not all 5 providers), and the slogan is "extract once, aggregate forever" — not "no LLM." **L2 Honcho-self-hosted-per-individual is incoherent at multi-tenant scale (redesign).** **L3 coding-hooks = wrong audience (park).** MLV: ingest-time extraction → 3–5 SQL aggregate RPCs as MCP tools, **Fathom-only**, sold to ~5 power users to validate willingness-to-pay. See `005-aggregate-intelligence-moat-redteam/README.md`.

