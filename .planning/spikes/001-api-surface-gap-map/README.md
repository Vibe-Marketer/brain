---
spike: 001
name: api-surface-gap-map
type: standard
validates: "Given the current `/v1/*` implementation and docs, when compared to a complete developer/CLI-ready contract, then we get a concrete API gap map."
verdict: VALIDATED
related: []
tags: [api, rest, planning]
---

# Spike 001: API Surface Gap Map

## What This Validates

Given CallVault's existing production REST API, when we compare its implementation, runbook, and prior Phase 06.2 decisions against a complete developer API surface, then the missing implementation and product-contract pieces are explicit enough to plan.

## Research

The baseline is local and already shipped: `supabase/functions/callvault-api/index.ts`, `docs/operations/api-runbook.md`, `cloudflare/api-proxy/worker.ts`, and the Phase 06.2 research artifact. Supabase's current Edge Function docs still align with CallVault's single-function REST approach: Edge Functions are TypeScript functions on Deno, and Supabase recommends custom routing inside one function for complete REST APIs when that reduces cold starts.

| Approach | Tool/Library | Pros | Cons | Status |
|----------|--------------|------|------|--------|
| Extend current `callvault-api` | Supabase Edge Functions + internal router | Lowest architecture drift; deployed pattern already works; one public `/v1/*` surface | Needs stronger schema contract and route registry | Chosen |
| Expose Supabase PostgREST | Supabase generated data API | Fastest table access | Leaks table schema; wrong product contract; conflicts with Phase 06.2 | Rejected |
| Separate API server | Node/Bun service | Full framework freedom | New deploy surface, auth boundary, ops footprint | Rejected for now |

Sources checked:
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/routing
- https://supabase.com/docs/guides/functions/http-methods

## How to Run

```bash
node .planning/spikes/001-api-surface-gap-map/gap-map.mjs
```

## What to Expect

The script prints the current routes, a target complete surface, and grouped gaps by severity.

## Investigation Trail

1. Confirmed existing production API is read-only and limited to workspaces, calls, call detail, contacts, and speakers.
2. Confirmed API tokens already use `token_source = 'api'` in `mcp_tokens`.
3. Compared route coverage to CLI/developer needs: bulk export, search, tags/folders, uploads/imports, admin/write actions, OpenAPI docs, rate limits, examples, and generated clients.

## Results

VALIDATED. The current REST API is a good foundation, not a complete developer platform. The next real phase should start with an OpenAPI contract and route registry, then add endpoint families by use case:

- Core read: existing but needs stable schema examples, cursor consistency, filters, and OpenAPI.
- Workflow read: folders, tags, summaries, transcript segments, source URLs, workspace entries.
- Write/import: paste transcript import, tag/folder assignment, routing/workspace placement.
- Platform: rate limits, idempotency, API errors, versioning, audit logs, token scopes.
- Developer UX: OpenAPI, generated TypeScript SDK, CLI, docs examples, smoke tests.

