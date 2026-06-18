# Spike Manifest

## Idea

Explore what it would take to evolve CallVault's existing production read-only REST API into a complete developer surface that can support direct API use, generated clients, and a CLI. Bun is evaluated as one candidate runtime, but the target decision is the best fit for CallVault's current npm, TypeScript, Supabase Edge Function, and Cloudflare proxy architecture.

**Addendum (2026-06-17) — printing-press data-layer adoption (spikes 005–007).** A second, related line: assess the feasibility and value of adapting the `cli-printing-press` pattern (github.com/mvanhorn/cli-printing-press) to our systems. The "big draw" is its **local-SQLite-data-hoard + offline compound-insight** layer — proven by the generated pp-fathom and pp-fireflies CLIs, which pull large amounts of external API data across many calls into a local SQLite store and run offline aggregate/insight commands over it. The generator emits **Go** CLIs, which is in direct tension with spike 004's Node/npm lock — so the assessment is explicitly *adopt-the-Go-generator (005)* vs *steal-the-pattern into TS/Node (006)*, plus whether the pattern's real payoff (hoarding **external** data we don't own a DB for, 007) is viable for the portfolio.

**Addendum (2026-06-18) — Calendly call recording connector feasibility (spikes 006–008).** Assess whether CallVault can support a client asking for "Calendly calls" from a "Calendly recorder." The key distinction is scheduling metadata versus actual recording/transcript media: Calendly public API/webhooks are scheduling-oriented, while Calendly Notetaker appears to hold recap media without a public pull API. The spike outcome should guide whether to build a native source, a Zapier/recap intake, or route the client through the underlying recorder source such as Zoom.

**Addendum (2026-06-18) — Full API/CLI platform deferred.** Spikes 001–004 establish that a full developer API and CLI are feasible and should be OpenAPI-first, but this is intentionally **parked** for now. The current active v2.0 Autonomous Operations work has higher priority, and opening a complete API surface would become a large project: expanded endpoint coverage, write scopes, generated docs/SDKs, CLI packaging, rate limits, idempotency, versioning, and support burden. The parked implementation brief is `.planning/spikes/API-CLI-PLATFORM-DEFERRED.md`.

## Requirements

- Preserve `https://api.callvaultai.com/v1/*` as the canonical machine API surface.
- Keep REST separate from MCP: JSON REST envelopes, not MCP markdown or JSON-RPC.
- Keep production API handlers on Supabase Edge Functions and Cloudflare routing unless a later phase explicitly changes platform.
- Prefer a contract-first OpenAPI workflow for generated clients, docs, and CLI planning.
- Do not introduce Bun into the main CallVault repo unless it wins on fit; currently npm/Node for repo tooling and Deno for Edge Functions remain the aligned default.
- Do not label a source as a recording connector unless the integration can actually retrieve transcript/media content, not only scheduling metadata.
- For Calendly specifically, distinguish "Calendly-scheduled calls" from "Calendly Notetaker recaps" and from the underlying recorder platform.

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
| 006 | calendly-recording-api-feasibility | standard | Given Calendly's current public API/docs, when we search for recording/transcript/media objects or webhook payloads, then we know whether CallVault can directly import "Calendly calls" as recordings. | INVALIDATED | [calendly, connector, recording-api, source-feasibility] |
| 007 | calendly-recorder-product-reality | standard | Given Calendly's current product surface, when we identify what "Calendly recorder" actually means in client usage, then we know whether this is native Calendly data or really Zoom/Google Meet/Teams/third-party recorder data scheduled by Calendly. | PARTIAL | [calendly, notetaker, product-reality, connector] |
| 008 | callvault-connector-implementation-fit | standard | Given CallVault's existing connector architecture, when the viable data path is known, then we can classify implementation as native OAuth connector, calendar-triggered recorder routing, or unsupported/partner-only. | PARTIAL | [calendly, callvault, connector-architecture, implementation-fit] |

## 005 Verdict (RedTeam)

**REAL-BUT-FRAGILE, L1-only.** The SQL compound-insight layer is a genuine, hard-to-copy edge — but it's a *build*, not a current asset (needs ingest-time structured-extraction columns + cross-provider normalization), it's "over Fathom calls" today (not all 5 providers), and the slogan is "extract once, aggregate forever" — not "no LLM." **L2 Honcho-self-hosted-per-individual is incoherent at multi-tenant scale (redesign).** **L3 coding-hooks = wrong audience (park).** MLV: ingest-time extraction → 3–5 SQL aggregate RPCs as MCP tools, **Fathom-only**, sold to ~5 power users to validate willingness-to-pay. See `005-aggregate-intelligence-moat-redteam/README.md`.

## 006–008 Verdict (Calendly Recording Connector)

**Native Calendly recording sync is currently INVALIDATED by public API evidence.** Calendly API/webhooks/MCP support scheduling data, invitees, routing forms, availability, shares, and webhook subscriptions, but no public recording/transcript/Notetaker recap pull resource was found. **Calendly Notetaker is real but limited/rolling out and exposed publicly through UI export plus Salesforce/HubSpot/Zapier push paths, not a documented first-party recording API.** Recommended path: connect the underlying recorder first (Zoom if applicable), or validate a Zapier `Recap created` payload and build a CallVault intake receiver branded as Calendly Notetaker/recap import. Do not ship a native "Calendly recordings" OAuth connector unless Calendly provides partner/private Notetaker API access or public endpoints appear.

## 001–004 Deferred Verdict (Full API/CLI Platform)

**Feasible, strategically useful, but not now.** CallVault already has the right foundation: `api.callvaultai.com/v1/*`, API tokens, Cloudflare proxy routing, and a small read-only REST Edge Function. The best future path is **OpenAPI-first + npm/Node tooling + Supabase Edge Functions**: keep the production API on Deno/Supabase, define the public contract in OpenAPI 3.1, generate/check TypeScript clients from that contract, and build the CLI as a separate Node/npm TypeScript package. Bun is not the aligned main path for this repo. Parked brief: `API-CLI-PLATFORM-DEFERRED.md`.
