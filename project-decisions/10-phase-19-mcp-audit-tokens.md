# Phase 19: MCP Audit + Workspace Tokens

**Type:** Audit + rename + infrastructure + UI

**Goal:** (1) Audit the deployed MCP Worker and produce a structured report, (2) Rename all Bank/Vault/Hub terminology to Organization/Workspace/Folder and redeploy — clean break, old names stop working, (3) Build per-workspace MCP tokens with DB table, Edge Function, Worker auth path, and React management UI.

---

## Plan 01 — MCP Audit

### Read and Catalogue the Entire MCP Worker

- [ ] Read all source files in the callvault-mcp Worker (`/Users/Naegele/Developer/mcp/callvault-mcp/src/`)
- [ ] Catalogue all 4 tools: `callvault_discover`, `callvault_get_schema`, `callvault_execute`, `callvault_continue`
- [ ] Catalogue all 23 resources (operations index + per-category + per-operation)
- [ ] Catalogue all 6 prompts (call_analysis, meeting_prep, weekly_digest, action_items, sales_pipeline, etc.)
- [ ] Catalogue all 16 operations across 6 categories: navigation, recordings, transcripts, search, contacts, analysis

### Test Against Live Worker

- [ ] Test each tool via curl against `callvault-mcp.naegele412.workers.dev`
- [ ] Document pass/fail for each operation
- [ ] Note: `sessionsCache` (in-memory Map for pagination) is lost between Worker isolates — document as known gap
- [ ] Note: `contacts.list` and `search.semantic` lack bank_id filtering — document as known gap

### Produce Audit Report

- [ ] Write `.planning/mcp-audit.md` with:
  - Full tool/resource/prompt inventory
  - Pass/fail test results
  - Naming migration inventory (which operation keys need to change)
  - Known gaps and their severity

---

## Plan 02 — Naming Rename + Redeploy

### Rename Operations

Only 2 operations need key changes:
- [ ] `navigation.list_banks` -> `navigation.list_organizations`
- [ ] `navigation.list_vaults` -> `navigation.list_workspaces`
- [ ] All other operation keys stay the same

### Update Files

- [ ] `operations.json` — rename operation keys and update all descriptions referencing bank/vault/hub
- [ ] `handlers/navigation.ts` — rename handler functions: `listBanks` -> `listOrganizations`, `listVaults` -> `listWorkspaces`
- [ ] `handlers/index.ts` — update HANDLERS record keys
- [ ] `prompts.ts` — update all bank/vault/hub text references in prompt templates

### Deploy and Verify

- [ ] Deploy: `unset CLOUDFLARE_API_TOKEN && wrangler deploy` (Phase 12 established this pattern — standard env var has insufficient write permissions)
- [ ] Verify new names return data via curl
- [ ] Verify old names return "unknown operation" error — clean break, no aliases

---

## Plan 03 — Token Infrastructure (DB + Edge Function)

### Database Migration

Create `workspace_mcp_tokens` table:

- [ ] `id` UUID primary key
- [ ] `vault_id` FK to vaults (the workspace this token accesses)
- [ ] `label` text (user-provided name)
- [ ] `token_hash` TEXT NOT NULL UNIQUE (SHA-256 hash of the actual token)
- [ ] `scoped_folder_ids` UUID[] (empty = whole workspace; populated = specific folders only)
- [ ] `created_by` FK to auth.users
- [ ] `is_revoked` boolean default false
- [ ] `revoked_at` timestamp nullable
- [ ] `revoked_by` FK to auth.users nullable
- [ ] `last_used_at` timestamp nullable
- [ ] `created_at` timestamp
- [ ] RLS policies: SELECT and UPDATE for workspace admins/owners via `is_vault_admin_or_owner()` function
- [ ] No INSERT from client — Edge Function uses service role key
- [ ] No DELETE — soft delete via `is_revoked` flag
- [ ] **Note:** Migration filename must avoid conflict with existing migrations (20260228000001 and 20260228000002 are taken)

### Build `generate-mcp-token` Edge Function

- [ ] Auth: verify JWT from request
- [ ] Validate request body with Zod: `vault_id`, `label`, optional `scoped_folder_ids`
- [ ] Check workspace admin/owner permission
- [ ] Check tier limits: Free = 0 tokens (MCP is the free/paid paywall), Pro = 5 per workspace, Team = 25 per workspace
- [ ] Generate token: `cv_mcp_` prefix + 64 hex chars (32 bytes from `crypto.getRandomValues`) = 71 chars total
- [ ] Hash with SHA-256
- [ ] INSERT token record using service-role Supabase client
- [ ] Return `token_secret` in response — this is shown once to the user and never retrievable again

---

## Plan 04 — Worker Auth Path (MCP Token Validation)

### Add Service Role Key to Worker

- [ ] Run `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` — this was NOT set in Phase 12 (only anon key was needed for OAuth path)

### Extend Request Context

- [ ] Add `tokenWorkspaceId` and `tokenScopedFolderIds` to `RequestContext` in `types.ts`

### Build Token Validation

- [ ] Create `validateMcpToken()` in `auth-middleware.ts`:
  - Hash incoming token with SHA-256
  - Look up hash in `workspace_mcp_tokens` table using service-role client
  - Check `is_revoked = false`
  - **CRITICAL (P9 Pitfall):** Do a LIVE `vault_memberships` check to verify the token creator still has workspace access. User removed from workspace after token creation = token stops working.
  - Return validation result with workspace_id and scoped_folder_ids

### Implement Two-Path Auth in Worker

- [ ] In `worker.ts`, check if Authorization header starts with `cv_mcp_`:
  - YES -> MCP token path: validate token, create service-role Supabase client, set workspace context in RequestContext
  - NO -> Existing OAuth JWT path (unchanged)

### Build Scope Enforcement

- [ ] Create `applyTokenScope()` helper for handlers — filters all queries by `tokenWorkspaceId` when set
- [ ] A scoped token must NOT be able to read recordings from a different workspace
- [ ] A revoked token must return 401

### Non-Blocking Last-Used Tracking

- [ ] Create `updateTokenLastUsed()` function
- [ ] Use `ctx.waitUntil()` for non-blocking execution (doesn't delay the response)
- [ ] Update at most once per hour per token (periodic, not per-request — reduces DB writes)

---

## Plan 05 — React Token Management UI

### Service + Hook Layer

- [ ] Create `src/services/mcp-tokens.service.ts`:
  - `getMcpTokens(workspaceId)` — list tokens for a workspace
  - `generateMcpToken(workspaceId, label, scopedFolderIds?)` — calls Edge Function via `supabase.functions.invoke`
  - `revokeMcpToken(tokenId)` — direct Supabase UPDATE (allowed by RLS UPDATE policy for admins)

- [ ] Create `src/hooks/useMcpTokens.ts`:
  - `useMcpTokens(workspaceId)` — query hook
  - `useGenerateMcpToken()` — mutation hook
  - `useRevokeMcpToken()` — mutation hook

### Token Row Component

- [ ] Build `McpTokenRow.tsx` — dense Airtable-style table row:
  - Name column
  - Scope badge ("Whole workspace" or "3 folders")
  - Last Used column (with stale indicator when >30 days)
  - Created date
  - Revoke button (with confirmation)

### Generate Token Dialog

- [ ] Build `GenerateMcpTokenDialog.tsx` — two-state dialog:
  - **State 1 (Form):** Name input + scope selector:
    - Radio: "Whole workspace" or "Specific folders"
    - If specific folders: checkbox list of folders in the workspace
  - **State 2 (Show-Once):** Displays the generated token secret:
    - Token displayed in monospace with copy button
    - Two MCP config JSON blocks (mcp-remote format + HTTP transport format)
    - "I've copied it" dismissal button
    - **CRITICAL:** Dialog must NOT be closeable by clicking outside or pressing Escape in show-once state — prevent accidental loss of the token

### Workspace MCP Panel

- [ ] Build `WorkspaceMcpPanel.tsx`:
  - Token list table using McpTokenRow
  - Empty state when no tokens exist
  - Loading state
  - "Generate Token" button (disabled for Free tier users with upgrade prompt)

### Integrate into Workspace Detail Page

- [ ] Add Radix Tabs to workspace detail route (`/workspaces/$workspaceId`): Members tab + MCP tab
- [ ] MCP tab renders WorkspaceMcpPanel
- [ ] **Note:** Verify the workspace detail route file exists in the callvault codebase before building on it
