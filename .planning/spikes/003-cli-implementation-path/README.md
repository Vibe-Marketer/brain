---
spike: 003
name: cli-implementation-path
type: standard
validates: "Given an API contract and token auth, when a CLI slice is prototyped, then the CLI packaging and command shape are clear."
verdict: VALIDATED
related: [001, 002a]
tags: [cli, api, node]
---

# Spike 003: CLI Implementation Path

## What This Validates

Given a bearer-token REST API, when a minimal CLI wraps the current endpoints, then CallVault can support `callvault workspaces`, `callvault calls`, and `callvault calls get <id>` without new backend architecture.

## Research

| Approach | Tool/Library | Pros | Cons | Status |
|----------|--------------|------|------|--------|
| Native Node CLI + generated OpenAPI types | Node 22+, npm, native `fetch` | Fits repo; no runtime surprise; easy npm publish | Manual command parser unless adding a CLI lib | Best first slice |
| Commander.js | npm package | Familiar commands/help/subcommands | Adds one CLI dependency | Good if CLI grows |
| Speakeasy/Stainless CLI generation | Vendor tooling | Can generate API CLI from OpenAPI; strong agent/tooling story | External platform and generated repo workflow | Later if CLI is product-grade |
| Bun CLI | Bun | Fast TS execution and single-file binary options | Misaligned with current repo package manager and Edge runtime | Not first choice |

Sources checked:
- https://www.speakeasy.com/product/cli-generation
- https://www.stainless.com/docs/
- https://bun.com/docs

## How to Run

Dry run, no token needed:

```bash
node .planning/spikes/003-cli-implementation-path/callvault-cli.mjs workspaces --dry-run
node .planning/spikes/003-cli-implementation-path/callvault-cli.mjs calls --limit 5 --dry-run
```

Live run, token needed:

```bash
CALLVAULT_API_TOKEN=... node .planning/spikes/003-cli-implementation-path/callvault-cli.mjs workspaces
```

## What to Expect

Dry run prints the exact request that would be made. Live run prints returned JSON.

## Investigation Trail

1. Built a zero-dependency CLI using Node native `fetch` and `process.argv`.
2. Kept the command map aligned with OpenAPI operationIds from Spike 002a.
3. Avoided adding Commander until command volume justifies it.

## Results

VALIDATED. A CLI should be a separate npm-published TypeScript/Node package or a repo subpackage later, not Bun inside the main app. Use OpenAPI operationIds as the command planning spine:

- `listWorkspaces` -> `callvault workspaces`
- `listCalls` -> `callvault calls`
- `getCall` -> `callvault calls get <id>`
- `listContacts` -> `callvault contacts`
- `listSpeakers` -> `callvault speakers`

