---
phase: quick-260608-opd
plan: "01"
subsystem: obsidian-sync
tags: [obsidian, api-tokens, edge-function, settings-ui, integrations]
dependency_graph:
  requires: [mcp_tokens table, mcp-server auth pattern, workspace_entries join pattern]
  provides: [obsidian-sync edge function, generate_obsidian_token RPC, ObsidianConnectorSection UI]
  affects: [supabase/functions/obsidian-sync, src/components/settings/IntegrationsTab, mcp_tokens schema]
tech_stack:
  added: [cv_obs_ token prefix, generate_obsidian_token RPC, token_source column discriminator]
  patterns: [personal-api-tokens, cursor-based pagination, obsidian-markdown-frontmatter]
key_files:
  created:
    - supabase/migrations/20260608120000_obsidian_sync_token_label.sql
    - supabase/functions/obsidian-sync/index.ts
    - src/services/obsidian-tokens.service.ts
    - src/hooks/useObsidianTokens.ts
    - src/components/settings/ObsidianConnectorSection.tsx
  modified:
    - src/components/settings/IntegrationsTab.tsx
decisions:
  - "Personal API tokens (not OAuth PKCE) chosen for Obsidian — one-time setup, no redirect flow required"
  - "token_source column discriminator added to mcp_tokens to prevent Obsidian tokens working on MCP endpoints and vice versa"
  - "cv_obs_ prefix chosen for Obsidian tokens to distinguish from cv_org_ (MCP org) and cv_ws_ (MCP workspace)"
  - "obsidian-sync uses service-role client with manual token auth, not authenticateRequest (which validates Supabase JWTs)"
  - "Obsidian section placed in IntegrationsTab (not MCPTab) since it is an API export integration, not an AI client connector"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-06-08T21:56:00Z"
  tasks_completed: 2
  files_changed: 6
---

# Quick Task 260608-opd: Obsidian Sync API Summary

Exposed a REST sync endpoint plus personal API token infrastructure so an Obsidian plugin can continuously pull calls and transcripts from CallVault.

## One-liner

Personal API token auth (`cv_obs_` prefix, `mcp_tokens.token_source='obsidian'`) gates a new `obsidian-sync` Edge Function that serves paginated call metadata with a cursor and Obsidian-ready markdown transcript notes.

## What Was Built

### Task 1: Migration + Edge Function (commit `1db044f`)

**Migration `20260608120000_obsidian_sync_token_label.sql`:**
- Added `token_source TEXT NOT NULL DEFAULT 'mcp' CHECK (... IN ('mcp', 'obsidian', 'api'))` column to `mcp_tokens`
- Added `token_label TEXT` column for human-readable display
- Created `generate_obsidian_token(p_org_id UUID, p_name TEXT)` SECURITY DEFINER RPC returning the raw token once
- Index on `token_source = 'obsidian' AND revoked_at IS NULL` for fast auth lookup
- Migration applied cleanly via `supabase db push`

**Edge Function `supabase/functions/obsidian-sync/index.ts`:**
- Deployed to Supabase (`obsidian-sync`)
- Auth: `Authorization: Bearer {token}` looked up against `mcp_tokens` WHERE `token_source = 'obsidian' AND revoked_at IS NULL`; fires `last_used_at` update asynchronously
- Route 1: `GET /obsidian-sync/calls` — paginated call list with `since`, `limit`, `workspace_id` params; returns `{ calls[], next_since, total }` cursor for incremental sync
- Route 2: `GET /obsidian-sync/calls/{uuid}/transcript` — returns `{ id, title, date, markdown }` where `markdown` has YAML frontmatter (`callvault_id`, `date`, `duration_min`, `source`, `workspace`, `synced_at`) plus H1 title, H2 Summary, H2 Transcript
- Zod validation on query params
- Org-scoped: all queries filter to the token's `org_id` via workspace membership
- 401 auth gate verified: `curl -H "Authorization: Bearer invalid" ... /calls` returns 401

### Task 2: Settings UI (commit `046b691`)

**`src/services/obsidian-tokens.service.ts`:**
- `getObsidianTokens()` — fetches active obsidian tokens for user (filtered by `token_source = 'obsidian'`, `revoked_at IS NULL`)
- `generateObsidianToken({ org_id, name })` — calls `generate_obsidian_token` RPC, returns raw token once
- `revokeObsidianToken(id)` — sets `revoked_at = now()` via authenticated user JWT

**`src/hooks/useObsidianTokens.ts`:**
- `useObsidianTokensList()` — TanStack Query wrapper, staleTime 60s
- `useGenerateObsidianToken({ onSuccess })` — mutation with onSuccess callback for token reveal
- `useRevokeObsidianToken()` — mutation, invalidates token list on success

**`src/components/settings/ObsidianConnectorSection.tsx`:**
- Section header "Obsidian Integration" with `RiLinkM` icon
- Generate form: token name input (max 50 chars), "Generate token" button
- Token reveal: amber warning box "Save this token now — it won't be shown again" with full token in monospace + copy button
- Active tokens table: name, created date, last sync date, Revoke button
- Revoke flow: `AlertDialog` confirm with explicit destructive action
- Collapsible setup instructions (4 steps: install plugin, paste token, configure folder/interval, sync behavior)
- Uses Remix Icons only (`RiAddLine`, `RiCheckLine`, `RiDeleteBinLine`, `RiFileCopyLine`, `RiLinkM`, `RiTimeLine`)

**`src/components/settings/IntegrationsTab.tsx`:**
- Added `<ObsidianConnectorSection />` after connector sections

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-opd-01: Bearer token spoofing | Mitigated — token lookup with `revoked_at IS NULL` gate |
| T-opd-02: Org data disclosure | Mitigated — all queries scoped to `token.org_id` via workspace join |
| T-opd-03: Obsidian token on MCP endpoints | Mitigated — `token_source = 'obsidian'` check in obsidian-sync; MCP server already accepts only unprefixed/cv_org_/cv_ws_ tokens |
| T-opd-04: Token shown insecurely | Mitigated — amber reveal box with one-time display warning |
| T-opd-05: No per-call sync audit | Accepted — `last_used_at` sufficient for v1 |
| T-opd-SC: npm installs | Accepted — no new npm packages; Zod already installed |

## Verification Results

- `supabase db push` applied migration with no errors
- `supabase functions deploy obsidian-sync --use-api` exited 0
- `curl -H "Authorization: Bearer invalid_token" .../obsidian-sync/calls` returns 401 — confirmed
- `npm run build` exits 0 — confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all wiring is live. The Obsidian plugin itself is not built (out of scope per plan); the `obsidian://show-plugin?id=callvault` link is a placeholder URL that will resolve once the plugin is published.

## Self-Check: PASSED

- `supabase/migrations/20260608120000_obsidian_sync_token_label.sql` — FOUND
- `supabase/functions/obsidian-sync/index.ts` — FOUND
- `src/services/obsidian-tokens.service.ts` — FOUND
- `src/hooks/useObsidianTokens.ts` — FOUND
- `src/components/settings/ObsidianConnectorSection.tsx` — FOUND
- commit `1db044f4` — FOUND
- commit `046b691a` — FOUND
