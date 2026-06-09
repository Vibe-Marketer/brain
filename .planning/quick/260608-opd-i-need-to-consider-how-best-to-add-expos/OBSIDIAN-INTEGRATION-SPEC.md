# Obsidian Integration Spec — CallVault

**Status:** Phase 1 shipped · Phase 2 (API fixes + direct plugin) pending
**Created:** 2026-06-09
**Refs:** commits `1db044f`, `046b691` · ISA at `~/.claude/PAI/MEMORY/WORK/260608-obsidian-sync-review/ISA.md`

---

## What Was Shipped (Phase 1)

Two commits landed the scaffolding:

| File | What it does |
|------|-------------|
| `supabase/migrations/20260608120000_obsidian_sync_token_label.sql` | Adds `token_source` discriminator + `token_label` to `mcp_tokens`; adds `generate_obsidian_token()` RPC with `cv_obs_` prefix |
| `supabase/functions/obsidian-sync/index.ts` | REST sync endpoint — `GET /calls` (paginated list) + `GET /calls/{uuid}/transcript` (markdown note) |
| `src/services/obsidian-tokens.service.ts` | Pure service: fetch/generate/revoke obsidian tokens |
| `src/hooks/useObsidianTokens.ts` | TanStack Query wrappers for the service |
| `src/components/settings/ObsidianConnectorSection.tsx` | Settings UI: generate named token, reveal once, revoke table |
| `src/components/settings/IntegrationsTab.tsx` | Wired `ObsidianConnectorSection` into Integrations tab |

**Auth model:** Personal API token (`cv_obs_` prefix) stored in `mcp_tokens` with `token_source='obsidian'`. Bearer lookup — not Supabase JWT. Completely isolated from MCP tokens.

---

## Phase 2: API Fixes (3 bugs blocking real use)

### Fix 1 — Cursor order (ISC-12, 13, 14, 15, 19, 23, 31)

**Problem:** `obsidian-sync/index.ts` currently uses `ORDER BY recording_start_time DESC`. Page 1 returns the 50 newest calls. `next_since` = MAX(date) of those 50 = the newest date. Page 2 has `since >= newest date` → 0 results. Historical bulk sync is impossible.

**Fix in `supabase/functions/obsidian-sync/index.ts`:**
```ts
// BEFORE:
.order('recording_start_time', { ascending: false })

// AFTER:
.order('recording_start_time', { ascending: true })
```

Add `has_more` to the response:
```ts
// fetch limit+1 rows, slice to limit, set has_more = fetched.length > limit
const rows = data.slice(0, limit)
const has_more = data.length > limit
```

Response shape after fix:
```json
{
  "calls": [...],        // up to `limit` items, ascending by date
  "next_since": "ISO",  // recording_start_time of the LAST item in calls[]
  "has_more": true,     // true = more pages exist
  "total": 247
}
```

---

### Fix 2 — Add `org_name` + `vault_path` (ISC-6, 7, 8, 9, 11, 32, 33, 34)

**Problem:** The API returns `workspace_name` but not `org_name`. The plugin cannot construct the vault path `CallVault/{org_name}/{workspace_name}/file.md` without a separate org lookup call.

**Fix in `obsidian-sync/index.ts` — join organizations:**
```ts
// In the workspace query, join organizations:
.from('workspaces')
.select('id, name, organization_id, organizations(name)')
.in('id', workspaceIds)

// Then build vault_path per call:
function sanitizePath(s: string): string {
  return s.replace(/[/\\:?*"<>|]/g, '-').trim()
}

function buildVaultPath(orgName: string, workspaceName: string, date: string, title: string): string {
  const dateStr = date.slice(0, 10) // YYYY-MM-DD
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return `CallVault/${sanitizePath(orgName)}/${sanitizePath(workspaceName)}/${dateStr}-${slug}.md`
}
```

Add to each call object in `GET /calls`:
```json
{
  "org_name": "Acme Corp",
  "vault_path": "CallVault/Acme Corp/Sales/2026-06-01-call-with-john.md"
}
```

Add to `GET /calls/{uuid}/transcript` response and YAML frontmatter block.

---

### Fix 3 — `include_transcript` param (ISC-16, 17, 18, 26, 27, 36)

**Problem:** Initial sync of 500 calls requires 500 individual transcript requests (N+1). An `include_transcript=true` param would embed the markdown inline, reducing to ~10 paginated list requests.

**Add to `GET /calls`:**
```ts
const includeTranscript = params.get('include_transcript') === 'true'
const effectiveLimit = includeTranscript ? Math.min(limit, 25) : limit  // silently cap at 25
```

When `include_transcript=true`, each call object gets a `markdown` field (full Obsidian-ready note, including YAML frontmatter). Calls without transcripts get `markdown: null`.

This drops initial sync of 500 calls from ~510 requests to `ceil(500/25)` = 20 requests.

---

## YAML Frontmatter Schema

Every transcript note returned by the API should open with:

```yaml
---
callvault_id: "uuid"
type: call
date: "2026-06-01"
date_time: "2026-06-01T14:30:00Z"
duration_min: 57
source: fathom
organization: "Acme Corp"
workspace: "Sales"
vault_path: "CallVault/Acme Corp/Sales/2026-06-01-call-with-john.md"
participants:
  - "John Smith"
  - "Jane Doe"
tags: []
folders: []
has_transcript: true
word_count: 4821
share_url: "https://app.callvaultai.com/share/abc123"
synced_at: "2026-06-09T00:00:00Z"
---
```

**Field notes:**
- `callvault_id` — UUID for deep linking and dedup on re-sync
- `type: call` — enables Obsidian Dataview queries across all call notes
- `participants` — from `recordings.speakers` (already parsed JSON array in most sources)
- `tags` / `folders` — CallVault tag/folder names; populated from workspace_entries joins
- `share_url` — resolved via `resolveShareUrl()` from `src/lib/recording-source-url.ts` (not a raw column)
- `word_count` — `full_transcript.split(/\s+/).length` — enables Dataview word-count queries
- `synced_at` — ISO timestamp the plugin wrote the file; embedded at sync time by the plugin, not the API

**Markdown body structure:**
```markdown
# {title}

**Date:** June 1, 2026
**Duration:** 57 min
**Source:** Fathom
**Workspace:** Sales

## Summary

{summary text}

## Transcript

{full_transcript verbatim}
```

---

## Direct Obsidian Plugin Strategy

**The goal:** User clicks "Send to Obsidian" in CallVault → file appears in vault. One workflow, not two.

### Mechanism: Obsidian Local REST API

The [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) community plugin runs a local HTTP server at `http://localhost:27123`. CallVault's web app can `PUT` a file directly into the vault:

```http
PUT http://localhost:27123/vault/CallVault/Acme%20Corp/Sales/2026-06-01-call.md
Authorization: Bearer {obsidian-api-key}
Content-Type: text/markdown

{full markdown content with YAML frontmatter}
```

The file appears in Obsidian immediately. No ZIP, no import dialog, no drag-and-drop.

### What the UI needs

In the call detail pane (pane 4), add an "Export to Obsidian" button alongside the existing SmartExport. On click:
1. Fetch transcript markdown from `obsidian-sync/calls/{id}/transcript` (already live)
2. `PUT` to `http://localhost:27123/vault/{vault_path}` with the markdown
3. Show success toast ("Saved to Obsidian") or error if Local REST API is not running

User must have Local REST API plugin installed and running (one-time setup). Store the Obsidian API key in the existing `ObsidianConnectorSection` (add a second field alongside the CallVault token).

### What the CallVault Obsidian Plugin does (for ongoing sync)

A separate CallVault community plugin handles background sync without the Local REST API dependency — it runs inside Obsidian and has direct vault write access:

```
Settings:
  - CallVault API token (cv_obs_ token from Settings)
  - Vault root folder (default: CallVault/)
  - Sync interval (default: 15 min)
  - Workspaces to sync (all or filtered list)

On sync cycle:
  1. Load cursor from plugin data (last_synced_at)
  2. GET /obsidian-sync/calls?since={cursor}&include_transcript=true&limit=25
  3. For each call: this.app.vault.create(vault_path, markdown) or adapter.process() if exists
  4. Paginate until has_more=false
  5. Store new cursor

First sync:
  - since=epoch (no cursor stored)
  - Processes all historical calls
  - Estimated: ~20 requests for 500-call org (with include_transcript=true)
```

---

## Initial Sync Strategy (for before the plugin exists)

Use the existing `SmartExportDialog` with a new `by-workspace` option.

**Add to `src/lib/export-utils.ts`:**
```ts
export async function exportByWorkspace(calls: Call[], org_name: string): Promise<void> {
  const zip = new JSZip()
  for (const call of calls) {
    const workspaceFolder = sanitizePathSegment(call.workspace_name || 'Uncategorized')
    const filename = buildFilename(call)
    const content = generateMarkdownContent(call)  // existing function
    zip.file(`${workspaceFolder}/${filename}`, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `CallVault-${org_name}-export.zip`)
}
```

**Add to `SmartExportDialog.tsx` `OrganizationType`:**
```ts
"by-workspace"  // Groups into {workspace_name}/{date}-{title}.md
```

User exports ZIP → extracts into their Obsidian vault's `CallVault/` folder → matches the exact path structure the API and plugin use. One-time migration path.

---

## Two-Track Sync Architecture

```
INITIAL SYNC
  ↓
Option A: SmartExportDialog → "by-workspace" → ZIP → drag into vault
  (available now after export-utils.ts change)

Option B: CallVault Obsidian Plugin → since=epoch → processes all history
  (when plugin ships)

Option C: "Export to Obsidian" button → Local REST API → direct vault write
  (requires user to install Local REST API plugin)

─────────────────────────────────────────────────────

ONGOING SYNC (automatic)
  ↓
CallVault Plugin polls every 15 min:
  GET /obsidian-sync/calls?since={last_cursor}&include_transcript=true
  → writes new/updated calls to vault
  → stores new cursor

User experience: calls appear in Obsidian automatically.
No manual action after initial setup.
```

---

## Build Order

1. **Fix cursor + has_more** in `obsidian-sync/index.ts` (unblocks all pagination)
2. **Add org_name + vault_path** to both routes (unblocks plugin path construction)
3. **Add include_transcript param** (performance: 25x fewer requests for bulk sync)
4. **Enrich YAML frontmatter** (participants, tags, folders, share_url, word_count)
5. **Add by-workspace export** to `SmartExportDialog` + `export-utils.ts`
6. **"Export to Obsidian" button** in detail pane (Local REST API path)
7. **Build CallVault Obsidian community plugin** (TypeScript, direct vault write)

Steps 1–5 are backend + minor UI. Steps 6–7 are new surfaces and can be separate quick tasks.

---

## ISA Reference

Full ISA with 36 ISCs at `~/.claude/PAI/MEMORY/WORK/260608-obsidian-sync-review/ISA.md`.

**Currently passing:** ISC-1,2,3,4,5,10,20,21,22,25,28,29,30,35 (14/36)
**Blocked on Phase 2 fixes:** ISC-6,7,8,9,11,12,13,14,15,16,17,18,23,26,27,31,32,33,34,36 (20/36)
**Pending by-workspace export:** ISC-24 (1/36)
**N/A (plugin out of scope):** ISC-19 (verifies the bug, not a ship blocker)
