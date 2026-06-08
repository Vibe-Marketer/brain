---
phase: quick-260608-opd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/functions/obsidian-sync/index.ts
  - supabase/migrations/YYYYMMDDHHMMSS_obsidian_sync_tokens.sql
  - src/features/settings/ObsidianConnectorSection.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "A CallVault user can generate a named personal API token scoped to their org from the Settings UI"
    - "An Obsidian plugin can authenticate with that token and call GET /obsidian-sync/calls to list calls with metadata"
    - "GET /obsidian-sync/calls/{recording_id}/transcript returns the full transcript in Obsidian-friendly markdown"
    - "The sync endpoint returns a cursor (last_synced_at) so the plugin can poll for only new/updated calls"
    - "Token revocation in CallVault immediately blocks further sync"
  artifacts:
    - path: "supabase/functions/obsidian-sync/index.ts"
      provides: "REST sync endpoint — list calls + get transcript, bearer token auth from mcp_tokens"
    - path: "supabase/migrations/YYYYMMDDHHMMSS_obsidian_sync_tokens.sql"
      provides: "obsidian_sync_tokens view or token_type column on mcp_tokens for Obsidian-scoped tokens"
    - path: "src/features/settings/ObsidianConnectorSection.tsx"
      provides: "UI to generate/name/revoke Obsidian personal tokens"
  key_links:
    - from: "src/features/settings/ObsidianConnectorSection.tsx"
      to: "mcp_tokens table"
      via: "generate-token Edge Function or direct Supabase client insert"
    - from: "supabase/functions/obsidian-sync/index.ts"
      to: "mcp_tokens"
      via: "Bearer token lookup, same pattern as mcp-server auth.ts"
---

<objective>
Expose a REST sync API that an Obsidian plugin can call with a personal API token to continuously pull calls and transcripts from CallVault into an Obsidian vault as markdown notes.

Purpose: Obsidian is a markdown-native knowledge base. CallVault already stores full transcripts. Connecting the two means every call becomes a searchable, linkable note automatically, with zero manual export.

Output: One new Edge Function (`obsidian-sync`), one migration (token labeling), one Settings UI section.

## Approach recommendation: Personal API tokens, NOT full OAuth PKCE

CallVault already has a complete token infrastructure (`mcp_tokens` table, `cv_org_` prefixed tokens, revocation). Full OAuth PKCE would require:
- Authorization server endpoints (already exist via Supabase OAuth server for MCP)
- A redirect_uri flow through the Obsidian plugin's local callback server
- PKCE code verifier/challenge round-trips

For an Obsidian plugin, **personal API tokens are the correct choice** because:
1. The token is generated once by the user in CallVault's Settings UI (30 seconds)
2. The plugin stores it in Obsidian's secure storage — no browser redirect or local server needed
3. CallVault's existing `mcp_tokens` table already handles scoping, revocation, and last_used_at tracking
4. The security model is identical to GitHub personal access tokens — well-understood by technical users

The Obsidian plugin (not built here) would: store the token in Obsidian's `obsidian.loadLocalStorage()`, call `/obsidian-sync/calls?since={ISO_timestamp}` on a configurable interval (default: every 15 min), write each call as a markdown file to a configurable vault folder.
</objective>

<execution_context>
@/Users/admin/dev/brain/.claude/get-shit-done/workflows/execute-plan.md
@/Users/admin/dev/brain/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@supabase/CLAUDE.md
@src/CLAUDE.md

<interfaces>
<!-- Key contracts from the existing codebase -->

From supabase/functions/mcp-server/auth.ts (token auth pattern):
```typescript
// mcp_tokens table shape (relevant columns)
// token TEXT, org_id UUID, workspace_id UUID, scope TEXT, revoked_at TIMESTAMPTZ,
// enabled_categories JSONB, last_used_at TIMESTAMPTZ

// Token lookup pattern used by MCP server:
const { data: tokenRow } = await supabase
  .from('mcp_tokens')
  .select('*')
  .eq('token', bearerToken)
  .is('revoked_at', null)
  .maybeSingle();
if (!tokenRow) return 401;
```

From supabase/functions/mcp-server/tools/read/list_calls.ts (recordings shape):
```typescript
// workspace_entries -> recordings join:
.from('workspace_entries')
.select(`recording_id, recordings (id, title, recording_start_time, duration, source_app, summary)`)
.in('workspace_id', workspaceIds)
.order('created_at', { ascending: false })
```

From supabase/functions/mcp-server/tools/read/get_transcript.ts (transcript shape):
```typescript
// recordings columns used:
.from('recordings')
.select('id, title, full_transcript, recording_start_time')
```

From supabase/functions/_shared/auth.ts:
```typescript
// For standard Supabase JWT auth (Settings UI token generation):
import { authenticateRequest } from '../_shared/auth.ts';
const authResult = await authenticateRequest(req, supabase, corsHeaders);
if (authResult instanceof Response) return authResult;
const { userId } = authResult;
```

Migration token prefix convention (from 20260528163000):
```sql
-- cv_org_ prefix = org-scoped personal token
RETURN 'cv_org_' || encode(gen_random_bytes(32), 'hex');
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration + obsidian-sync Edge Function</name>
  <files>
    supabase/migrations/20260608120000_obsidian_sync_token_label.sql
    supabase/functions/obsidian-sync/index.ts
  </files>
  <action>
**Migration:** Add a `token_label` column to `mcp_tokens` if it doesn't already exist, and a `token_source` TEXT column with a CHECK constraint allowing 'mcp' | 'obsidian' | 'api' (default 'mcp'). This lets the UI filter/display Obsidian tokens separately from MCP tokens. Also create a `generate_obsidian_token(p_user_id UUID, p_org_id UUID, p_name TEXT)` SQL function that calls `generate_prefixed_mcp_token('organization')` and inserts a row into `mcp_tokens` with `token_source = 'obsidian'`, returning the raw token (shown once).

**Edge Function `obsidian-sync`:** A single Deno function at `supabase/functions/obsidian-sync/index.ts` that handles two REST routes by inspecting `req.url`:

Authentication for ALL routes: Extract `Authorization: Bearer {token}` header, look up in `mcp_tokens` WHERE `token = $1 AND revoked_at IS NULL AND token_source = 'obsidian'` using service-role client. Return 401 if not found. Update `last_used_at = now()` on success. Never use `authenticateRequest` here — that validates Supabase JWTs; Obsidian tokens are mcp_tokens rows, not JWTs.

**Route 1: `GET /obsidian-sync/calls`**
Query params: `since` (ISO 8601 timestamp, optional — defaults to epoch), `limit` (1-100, default 50), `workspace_id` (UUID, optional — if omitted, returns org-wide).
Response shape:
```json
{
  "calls": [
    {
      "id": "uuid",
      "title": "Call with Acme — 2026-06-01",
      "date": "2026-06-01T14:30:00Z",
      "duration_seconds": 3420,
      "source": "fathom",
      "summary": "...",
      "has_transcript": true,
      "workspace_id": "uuid",
      "workspace_name": "Sales"
    }
  ],
  "next_since": "2026-06-08T12:00:00Z",
  "total": 12
}
```
Implementation: join `workspace_entries` → `recordings` → `workspaces`. Filter by `recordings.recording_start_time > since` (or `recordings.created_at > since` as fallback). `next_since` = MAX(`recording_start_time`) of returned rows (allows cursor-based incremental sync).

**Route 2: `GET /obsidian-sync/calls/{recording_id}/transcript`**
Verify the recording belongs to the token's org (workspace_entries join). Return:
```json
{
  "id": "uuid",
  "title": "...",
  "date": "2026-06-01T14:30:00Z",
  "markdown": "# Call with Acme — June 1, 2026\n\n**Date:** June 1, 2026\n**Duration:** 57 min\n**Source:** Fathom\n\n## Summary\n\n...\n\n## Transcript\n\n..."
}
```
`markdown` field: format as a ready-to-save Obsidian note. Header = call title, frontmatter block (YAML) with `callvault_id`, `date`, `duration`, `source`, `workspace`, then H2 Summary (if present), H2 Transcript (full_transcript text verbatim). If no transcript, the Transcript section says "Transcript not available."

**Route matching:** parse URL pathname. If ends with `/calls`, route 1. If matches `/calls/{uuid}/transcript`, route 2. Otherwise 404.

Use the standard CORS preflight + error handling patterns from `supabase/CLAUDE.md`. Use Zod for query param validation.
  </action>
  <verify>
    <automated>supabase functions deploy obsidian-sync --use-api && curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" "$(supabase status 2>/dev/null | grep 'API URL' | awk '{print $3}')/functions/v1/obsidian-sync/calls" | grep -q "401" && echo "401 auth gate: PASS"</automated>
  </verify>
  <done>Migration applied. Edge Function deployed. GET /obsidian-sync/calls with invalid token returns 401. GET with valid obsidian token returns calls JSON. GET /calls/{id}/transcript with valid token returns markdown note JSON.</done>
</task>

<task type="auto">
  <name>Task 2: Settings UI — Obsidian token generator</name>
  <files>
    src/features/settings/ObsidianConnectorSection.tsx
    src/features/settings/SettingsPage.tsx (or equivalent settings root, add section)
  </files>
  <action>
Create `src/features/settings/ObsidianConnectorSection.tsx`. This is a Settings section, NOT in Connectors (Connectors is for data source OAuth flows; this is an API access token for a third-party tool).

**UI structure:**
- Section header: "Obsidian Integration" with a brief one-line description: "Sync your calls to Obsidian automatically. Generate a token, then enter it in the CallVault Obsidian plugin."
- Button: "Generate Obsidian Token" (only shown when no active tokens exist, or as secondary "Generate another")
- Token name input (required, max 50 chars, placeholder "e.g. My MacBook Obsidian") — shown inline before generation
- On generate: call Supabase RPC `generate_obsidian_token` with `p_name`, `p_org_id`. Display the raw token ONCE in a copy-to-clipboard box with a yellow warning: "Save this token now — it won't be shown again." This is the standard personal-token reveal pattern.
- Active tokens table: shows token name, created_at, last_used_at ("Never" if null), and a Revoke button. Revoke sets `revoked_at = now()` via a direct Supabase update (service-role not needed — use the user's JWT + RLS policy "users manage own tokens"). Filter by `token_source = 'obsidian'`.
- Setup instructions section below: collapsible `<details>` with:
  1. Install the CallVault Obsidian plugin (link: `obsidian://show-plugin?id=callvault` — placeholder)
  2. In Obsidian: Settings → CallVault → paste your token
  3. Configure sync folder and interval (default: `CallVault/` folder, every 15 min)
  4. First sync will import all calls; subsequent syncs import only new calls

**State:** use Supabase JS client with `useQuery`/`useMutation` from TanStack Query (follow existing hook pattern in `src/hooks/`). Load existing tokens on mount. Invalidate token list after generate/revoke.

**Wire into settings page:** Find the existing settings page component (likely `src/features/settings/SettingsPage.tsx` or similar). Add `<ObsidianConnectorSection />` after the existing connector/integration sections. Read `src/CLAUDE.md` before touching the settings page to confirm the exact component path and import conventions.

Styling: follow existing brand guidelines — no new color variables. Use Remix Icons only (`RiLinkM`, `RiFileCopyLine`, `RiDeleteBinLine`).
  </action>
  <verify>
    <automated>npm run build 2>&1 | grep -E "error TS|ERROR" | head -10; echo "Build exit: $?"</automated>
  </verify>
  <done>npm run build exits 0. ObsidianConnectorSection renders in Settings with generate/revoke token flow. Generated token appears in copy box once. Token table shows active tokens. Revoke marks revoked_at in DB.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Obsidian plugin → obsidian-sync Edge Function | Untrusted bearer token in Authorization header |
| Settings UI → generate_obsidian_token RPC | Authenticated user JWT, generates a high-value secret |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-opd-01 | Spoofing | obsidian-sync Bearer auth | mitigate | Validate token against mcp_tokens WHERE revoked_at IS NULL; constant-time comparison is handled by Postgres equality (not vulnerable to timing in this context) |
| T-opd-02 | Information Disclosure | GET /calls returns org-wide data | mitigate | Scope query to token's org_id; workspace_entries join ensures only org-owned recordings returned |
| T-opd-03 | Elevation of Privilege | obsidian token used against MCP endpoints | mitigate | token_source = 'obsidian' check in obsidian-sync; mcp-server only accepts tokens where token_source = 'mcp' (add check in mcp-server auth if not already present) |
| T-opd-04 | Tampering | Token generated but shown insecurely | mitigate | Token displayed once in UI with explicit "save now" warning; raw token never stored or re-fetchable |
| T-opd-05 | Repudiation | No audit of sync calls | accept | last_used_at on mcp_tokens provides sufficient audit trail for v1; per-call logging is v2 |
| T-opd-SC | Tampering | npm installs | accept | No new npm packages — Deno ESM imports only; Zod already in use |
</threat_model>

<verification>
1. Migration applied cleanly: `supabase db push` with no errors; `mcp_tokens` has `token_source` column
2. `obsidian-sync` deployed: `supabase functions deploy obsidian-sync --use-api` exits 0
3. Auth gate: `curl -H "Authorization: Bearer bad_token" {SUPABASE_URL}/functions/v1/obsidian-sync/calls` returns 401
4. Valid token gate: generate a test token via the Settings UI → copy it → `curl -H "Authorization: Bearer {token}" .../obsidian-sync/calls` returns `{"calls": [...], "next_since": "...", "total": N}`
5. Transcript endpoint: `curl -H "Authorization: Bearer {token}" .../obsidian-sync/calls/{id}/transcript` returns `{"markdown": "# Call with..."}` with YAML frontmatter
6. Build clean: `npm run build` exits 0 with ObsidianConnectorSection wired into settings
7. Token reveal: generating a token in the UI shows it once in a copy box; refreshing the page does NOT show the raw token again (only name + last_used_at)
</verification>

<success_criteria>
- A CallVault user generates an Obsidian token in Settings in under 60 seconds
- The `obsidian-sync` Edge Function is live at `{SUPABASE_URL}/functions/v1/obsidian-sync`
- GET `/calls?since=2026-01-01T00:00:00Z` returns paginated call metadata with cursor
- GET `/calls/{id}/transcript` returns a markdown string ready to write as a `.md` file
- Revoked tokens return 401 on the next request
- `npm run build` is clean
</success_criteria>

<output>
Create `.planning/quick/260608-opd-i-need-to-consider-how-best-to-add-expos/260608-opd-SUMMARY.md` when done
</output>
