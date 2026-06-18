# Deferred Brief: Full API and CLI Platform

**Date:** 2026-06-18  
**Status:** Deferred / parked  
**Source spikes:** 001-api-surface-gap-map, 002a-openapi-first-toolchain, 002b-code-first-router-toolchain, 003-cli-implementation-path, 004-runtime-fit-assessment

## Decision

Do not start the full API/CLI platform now.

The spike outcome is positive: CallVault can grow into a full developer API and CLI from the existing REST foundation. But doing it properly is a new platform-sized project, and the current v2.0 Autonomous Operations work needs attention first.

## Current Foundation

CallVault already has:

- Public REST base: `https://api.callvaultai.com/v1`
- Cloudflare API proxy routing in `cloudflare/api-proxy/worker.ts`
- Supabase Edge Function entrypoint at `supabase/functions/callvault-api/`
- API tokens stored through the existing token foundation with `token_source = 'api'`
- Read-only endpoints for workspaces, calls, call detail, contacts, and speakers
- Operator runbook at `docs/operations/api-runbook.md`

This is enough for a narrow machine API. It is not yet a complete public developer platform.

## Recommended Future Architecture

Use this stack when the work resumes:

| Layer | Choice | Reason |
|-------|--------|--------|
| Public API runtime | Supabase Edge Functions / Deno | Already deployed and aligned with CallVault backend constraints |
| Public routing | Cloudflare Worker | Already owns `api.callvaultai.com` and `/v1/*` routing |
| Contract | OpenAPI 3.1 | Single source for docs, SDKs, CLI command mapping, and drift checks |
| Tooling | npm/Node scripts | Matches the repo's locked package manager and current tooling |
| Type generation | `openapi-typescript` first | Low-overhead way to generate TypeScript types from OpenAPI |
| CLI | Separate Node/npm TypeScript package | Best fit for distribution and repo conventions |
| Bun | Not the main path | Useful generally, but it adds a third runtime/package-manager convention here |

## What A Full API Actually Involves

A complete API is not just adding routes. It creates an external contract and support burden.

Minimum workstreams:

1. **Public Contract**
   - Commit `docs/api/openapi.yaml`
   - Define schemas, examples, errors, pagination, auth, rate-limit headers, and operationIds
   - Add drift checks so implementation and OpenAPI stay aligned

2. **Endpoint Coverage**
   - Keep current read endpoints
   - Add folders, tags, workspace entries, transcript segments, source URLs, and search/filter endpoints
   - Add write/import endpoints only when scopes, validation, idempotency, and audit logs are ready

3. **Auth, Scopes, and Safety**
   - Preserve org-scoped and workspace-scoped API tokens
   - Add read/write scopes before write endpoints
   - Track last used, audit sensitive actions, support token revocation, and document wrong-source token behavior
   - Add rate limits and predictable retry semantics

4. **Write Semantics**
   - Use idempotency keys for imports and mutations
   - Validate every request body with stable error codes
   - Keep recording ID handling behind existing UUID/BIGINT boundaries
   - Use existing service patterns rather than exposing raw table shapes

5. **Developer Surfaces**
   - Generate TypeScript types/client from OpenAPI
   - Publish a small CLI wrapper around the public API
   - Keep docs and examples generated or checked from the same contract
   - Add smoke tests for token success, missing token, wrong token source, revoked token, and representative data endpoints

## Proposed Endpoint Families

Start with contract-first read expansion:

- `GET /v1/workspaces`
- `GET /v1/calls`
- `GET /v1/calls/{id}`
- `GET /v1/calls/{id}/transcript`
- `GET /v1/folders`
- `GET /v1/tags`
- `GET /v1/contacts`
- `GET /v1/speakers`
- `GET /v1/search`

Only then add writes:

- `POST /v1/imports/transcript`
- `POST /v1/calls/{id}/tags`
- `DELETE /v1/calls/{id}/tags/{tag_id}`
- `PUT /v1/calls/{id}/folder`
- `PUT /v1/calls/{id}/workspace`

Do not add broad admin or destructive endpoints in the first API-platform phase.

## CLI Shape

The CLI should wrap the public API. It should not bypass CallVault through Supabase.

Initial command map:

```text
callvault auth status
callvault workspaces
callvault calls --workspace <id> --limit 20
callvault calls get <id>
callvault calls transcript <id>
callvault contacts
callvault speakers
```

Later write commands:

```text
callvault import transcript ./call.md --workspace <id>
callvault calls tag <id> --tag "Sales"
callvault calls move <id> --workspace <id>
```

## Resume Trigger

Come back to this when at least one of these is true:

- A real external integration needs API access beyond current read-only endpoints
- A customer or partner needs a CLI workflow
- Obsidian or another client should stop relying on in-app export surfaces and use a public API instead
- The v2.0 autonomous operations milestone is stable enough that a new developer-platform project will not distract from core reliability work

## First Phase When Resumed

Suggested phase title:

**API Platform Foundation: OpenAPI Contract, Route Registry, and Read Coverage**

Definition of done:

- `docs/api/openapi.yaml` exists and covers all current `/v1/*` routes
- Every API route has an `operationId`
- Contract drift check runs in npm tooling
- Existing routes still pass missing-token, wrong-token-source, revoked-token, and success checks
- A generated TypeScript type surface exists
- No Bun adoption in the main repo

