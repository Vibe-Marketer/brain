# Architecture Research: CallVault v2.0

**Research Date:** 2026-02-22  
**Domain:** Brownfield frontend rebuild — same Supabase project, new repo  
**Overall Confidence:** HIGH (Supabase OAuth 2.1 docs verified; connector pattern derived from existing code analysis; repo structure from established Vite+React conventions)

---

## New Frontend Repo Structure

### Recommended Directory Layout

The new repo should be a clean Vite + React + TypeScript project. Because v2 adds Tauri/Electron as a future target, the architecture must not assume a browser host. All Supabase/API calls go through a `services/` layer so the renderer layer is host-agnostic.

```
callvault-v2/                         # New git repo (not brain/)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── tailwind.config.ts
├── components.json                   # shadcn/ui config
│
├── src/
│   ├── main.tsx                      # Entry point
│   ├── App.tsx                       # Router + providers
│   │
│   ├── app/                          # App-wide concerns
│   │   ├── providers.tsx             # QueryClient, AuthProvider, ThemeProvider
│   │   ├── router.tsx                # TanStack Router or React Router config
│   │   └── query-keys.ts             # Centralized query key factory
│   │
│   ├── features/                     # Feature-sliced design (vertical slices)
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── OAuthCallbackPage.tsx
│   │   │   └── useAuth.ts
│   │   ├── recordings/               # Core recordings domain (replaces fathom_calls)
│   │   │   ├── RecordingsList.tsx
│   │   │   ├── RecordingDetail.tsx
│   │   │   ├── useRecordings.ts      # Queries: recordings + vault_entries
│   │   │   └── types.ts
│   │   ├── vaults/                   # Bank/vault management
│   │   │   ├── VaultsPage.tsx
│   │   │   ├── VaultContext.tsx      # Active vault context
│   │   │   └── useVaults.ts
│   │   ├── import/                   # Import connectors UI
│   │   │   ├── ImportHub.tsx         # "Add source" entry point
│   │   │   ├── connectors/           # One folder per connector UI
│   │   │   │   ├── FathomConnector.tsx
│   │   │   │   ├── ZoomConnector.tsx
│   │   │   │   ├── GoogleMeetConnector.tsx
│   │   │   │   ├── YouTubeConnector.tsx
│   │   │   │   └── _registry.ts      # Connector registry (see below)
│   │   │   └── useImportStatus.ts
│   │   ├── chat/                     # AI chat (simplified bridge)
│   │   │   ├── ChatPage.tsx
│   │   │   └── useChat.ts            # useChat from Vercel AI SDK
│   │   ├── search/
│   │   │   └── SearchBar.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── WorkspaceSettings.tsx
│   │   │   └── MCPTokenSettings.tsx  # Per-workspace MCP URL display
│   │   └── analytics/
│   │       └── AnalyticsDashboard.tsx
│   │
│   ├── services/                     # API adapter layer (host-agnostic)
│   │   ├── supabase.ts               # Supabase client singleton
│   │   ├── recordings.service.ts     # All recording/vault_entry queries
│   │   ├── import.service.ts         # Trigger import edge functions
│   │   ├── mcp.service.ts            # MCP token management
│   │   └── connectors/               # Per-connector API adapters
│   │       ├── fathom.connector.ts
│   │       ├── zoom.connector.ts
│   │       ├── google-meet.connector.ts
│   │       └── youtube.connector.ts
│   │
│   ├── components/                   # Shared UI components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          # 4-pane layout (preserve from v1)
│   │   │   └── NavRail.tsx
│   │   ├── ui/                       # shadcn/ui primitives
│   │   └── shared/                   # Domain-agnostic components
│   │
│   ├── hooks/                        # Shared hooks (not feature-specific)
│   │   ├── useBreakpoint.ts
│   │   └── useKeyboardShortcut.ts
│   │
│   ├── stores/                       # Zustand (UI state only)
│   │   ├── panelStore.ts
│   │   └── preferencesStore.ts
│   │
│   ├── lib/                          # Pure utilities
│   │   ├── utils.ts                  # cn() etc
│   │   └── format.ts
│   │
│   └── types/                        # Global TypeScript types
│       ├── recording.ts              # Recording, VaultEntry, UnifiedRecording
│       ├── connector.ts              # ImportConnector interface
│       └── mcp.ts                    # MCPToken, WorkspaceMCPConfig
│
├── supabase/                         # Linked to SAME Supabase project (not copied)
│   └── (symlink or git submodule — see Integration Points)
│
└── src-tauri/                        # Added later, empty now, reserved
    └── .gitkeep
```

### Key Structural Decisions

**Feature-sliced design (vertical slices) over flat components:**
- Each feature owns its components, hooks, and types
- Prevents the v1 sprawl where `components/` had 45 top-level entries
- Services layer (`services/`) = only place that touches Supabase

**`src-tauri/` reserved from day 1:**
- Tauri will need a `src-tauri/` directory at project root
- Reserve it now — no code impact, prevents future restructuring
- All backend calls go through `services/` so Tauri IPC can be swapped in later

**Supabase functions stay in the existing `brain/` repo:**
- The new frontend repo links to the same Supabase project by URL/env
- No need to copy or symlink `supabase/` — edge functions deploy independently
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` point to same project

---

## Data Model Migration (fathom_calls → recordings)

### Current State

The migration infrastructure is **already built** in the existing codebase:

- `recordings` + `vault_entries` tables: **deployed** (migration `20260131000007`)
- `migrate_fathom_call_to_recording()` SQL function: **deployed** (migration `20260131000008`)
- `migrate_batch_fathom_calls()` batch function: **deployed**
- `get_migration_progress()` progress function: **deployed**
- `migrate-recordings` edge function: **deployed**
- `get_unified_recordings` search RPC: **deployed** (via `20260131300001_chat_vault_search_function.sql`)

The v2 frontend needs to **complete the migration** by ensuring all existing `fathom_calls` rows have corresponding `recordings` rows, then treating `recordings` as the authoritative source.

### Migration Sequence

**Phase 1 — Dual-write safety (implemented in edge functions already)**

The existing import functions write to `fathom_calls` (legacy). During migration, new imports from v2 should write directly to `recordings`. Before that cutover, verify all existing rows are migrated.

```
Step 1: Run get_migration_progress() to see current state
        → SELECT * FROM get_migration_progress();
        → Expect: total_fathom_calls, migrated_recordings, remaining

Step 2: If remaining > 0, run batch migration
        → POST /functions/v1/migrate-recordings (admin-only)
        → Runs migrate_batch_fathom_calls(100) repeatedly until complete=true
        → Each call: processes 100 rows, idempotent (safe to re-run)

Step 3: Verify 1:1 completeness
        → SELECT COUNT(*) FROM fathom_calls 
             WHERE NOT EXISTS (
               SELECT 1 FROM recordings 
               WHERE recordings.legacy_recording_id = fathom_calls.recording_id
             );
        → Should return 0

Step 4: Switch v2 frontend to query recordings table only
        → No queries to fathom_calls from new code
        → All reads use get_unified_recordings() RPC or recordings table directly

Step 5: New imports write directly to recordings table
        → v2 connector functions (edge functions) INSERT into recordings, not fathom_calls
        → Requires updating: fathom-oauth-callback, zoom-sync-meetings, 
          google-meet-sync-meetings, youtube-import
```

**Phase 2 — Cutover (v2 go-live)**

Once v2 is launched and all reads come from `recordings`:

```
Step 6: Add read-only flag to fathom_calls (don't delete yet)
        → ALTER TABLE fathom_calls ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NOW();
        → This signals "no new writes", preserves data as audit trail

Step 7: Monitor for 2-4 weeks
        → Check for any code still writing to fathom_calls (should be zero)
        → Check analytics/automation functions still work correctly

Step 8: Remove fathom_calls reference from edge functions
        → Update any remaining references

Step 9: Archive/drop fathom_calls (future milestone, not v2)
        → ONLY after 100% confidence nothing reads it
        → Keep migration in Supabase history for audit trail
```

### Rollback Plan

At each step, rollback is safe:

| Step | Rollback Action |
|------|----------------|
| Steps 1-3 | No schema changes, simply stop migration |
| Step 4 | Re-point frontend queries back to fathom_calls |
| Step 5 | Revert edge function code, recordings data is preserved |
| Step 6 | Remove archived_at column |
| Steps 7-9 | Already committed — no rollback needed |

**Key safety property:** `migrate_fathom_call_to_recording()` is idempotent. Running it twice for the same row returns the existing recording UUID without creating duplicates. The `legacy_recording_id` unique constraint (`UNIQUE(bank_id, legacy_recording_id)`) enforces this at DB level.

### get_unified_recordings RPC Pattern

The recommended query pattern for v2 frontend (HIGH confidence — already deployed):

```typescript
// services/recordings.service.ts
export async function getUnifiedRecordings(vaultId: string, options?: {
  limit?: number;
  offset?: number;
  searchQuery?: string;
}) {
  const { data, error } = await supabase
    .rpc('get_unified_recordings', {
      p_vault_id: vaultId,
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
    });
  
  if (error) throw error;
  return data as UnifiedRecording[];
}
```

This RPC joins `recordings` + `vault_entries` and returns a unified view, avoiding N+1 queries and keeping component code clean.

---

## Import Connector Architecture

### Current Pattern (v1 Problem)

Each connector in v1 is a monolith:
- `zoom-sync-meetings/index.ts` — 978 lines, does: auth, fetch, dedup, transform, insert
- `google-meet-sync-meetings/index.ts` — 816 lines, same pattern
- `youtube-import/index.ts` — 906 lines, same pattern

Adding a new connector (Grain, Fireflies, etc.) currently requires writing ~800-1000 lines following an implicit pattern that is nowhere defined. It's a 2-week task per connector.

### Recommended Connector Architecture: The 5-Stage Pipeline

Every connector does exactly these 5 things. Codify this as a composable pipeline in `_shared/`:

```typescript
// supabase/functions/_shared/connector-pipeline.ts

export interface ConnectorContext {
  supabase: SupabaseClient;
  userId: string;
  bankId: string;
  vaultId: string;
}

export interface ConnectorConfig {
  sourceApp: string;          // 'zoom', 'google_meet', 'youtube', 'grain', etc.
  fetchMeetings: (ctx: ConnectorContext, credentials: unknown) => Promise<RawMeeting[]>;
  transformMeeting: (raw: RawMeeting) => RecordingInsert;
  getCredentials: (ctx: ConnectorContext) => Promise<unknown>;
  refreshCredentials?: (ctx: ConnectorContext, credentials: unknown) => Promise<unknown>;
  onProgress?: (processed: number, total: number) => void;
}

export interface RawMeeting {
  externalId: string;         // Platform's unique ID (for deduplication)
  title: string;
  startTime?: string;
  endTime?: string;
  transcript?: string;
  audioUrl?: string;
  videoUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordingInsert {
  title: string;
  source_app: string;
  source_metadata: Record<string, unknown>;
  full_transcript?: string;
  audio_url?: string;
  video_url?: string;
  recording_start_time?: string;
  recording_end_time?: string;
  global_tags?: string[];
}

export async function runConnectorPipeline(
  config: ConnectorConfig,
  context: ConnectorContext,
): Promise<{ synced: number; skipped: number; errors: number }> {
  // Stage 1: Get credentials (with optional refresh)
  let credentials = await config.getCredentials(context);
  
  // Stage 2: Fetch raw meetings from platform
  const rawMeetings = await config.fetchMeetings(context, credentials);
  
  let synced = 0, skipped = 0, errors = 0;
  
  for (const raw of rawMeetings) {
    try {
      // Stage 3: Check deduplication (by external_id in source_metadata)
      const exists = await checkDuplicate(context.supabase, context.bankId, config.sourceApp, raw.externalId);
      if (exists) { skipped++; continue; }
      
      // Stage 4: Transform to recordings schema
      const recordingData = config.transformMeeting(raw);
      
      // Stage 5: Insert recording + vault_entry
      await insertRecordingWithVaultEntry(context.supabase, {
        ...recordingData,
        bank_id: context.bankId,
        owner_user_id: context.userId,
      }, context.vaultId);
      
      synced++;
      config.onProgress?.(synced + skipped + errors, rawMeetings.length);
    } catch (e) {
      errors++;
      console.error(`Error syncing ${raw.externalId}:`, e);
    }
  }
  
  return { synced, skipped, errors };
}
```

### Adding a New Connector: 1-2 Day Pattern

With the pipeline in place, a new connector (e.g., Grain) is:

**Step 1: Create `_shared/grain-client.ts`** (~50 lines)
```typescript
export class GrainClient {
  constructor(private apiKey: string) {}
  async getRecordings(): Promise<GrainRecording[]> { ... }
}
```

**Step 2: Create `supabase/functions/grain-sync/index.ts`** (~80 lines)
```typescript
import { runConnectorPipeline } from '../_shared/connector-pipeline.ts';
import { GrainClient } from '../_shared/grain-client.ts';

const grainConnector: ConnectorConfig = {
  sourceApp: 'grain',
  
  getCredentials: async (ctx) => {
    const { data } = await ctx.supabase
      .from('user_settings')
      .select('grain_api_key')
      .eq('user_id', ctx.userId)
      .single();
    return data?.grain_api_key;
  },
  
  fetchMeetings: async (ctx, apiKey) => {
    const client = new GrainClient(apiKey as string);
    const recordings = await client.getRecordings();
    return recordings.map(r => ({
      externalId: r.id,
      title: r.title,
      transcript: r.transcript_text,
      startTime: r.started_at,
      metadata: { grain_url: r.share_url },
    }));
  },
  
  transformMeeting: (raw) => ({
    title: raw.title,
    source_app: 'grain',
    source_metadata: raw.metadata ?? {},
    full_transcript: raw.transcript,
    recording_start_time: raw.startTime,
  }),
};

Deno.serve(async (req) => {
  // ... auth, parse body, call runConnectorPipeline(grainConnector, context)
});
```

**Step 3: Create `src/features/import/connectors/GrainConnector.tsx`** (~100 lines)
```typescript
// UI: API key input, sync button, last synced status
```

**Step 4: Register in `_registry.ts`**
```typescript
// src/features/import/connectors/_registry.ts
export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  { id: 'fathom',       label: 'Fathom',       icon: FathomIcon,      component: FathomConnector },
  { id: 'zoom',         label: 'Zoom',          icon: ZoomIcon,        component: ZoomConnector },
  { id: 'google_meet',  label: 'Google Meet',   icon: GMeetIcon,       component: GoogleMeetConnector },
  { id: 'youtube',      label: 'YouTube',       icon: YouTubeIcon,     component: YouTubeConnector },
  { id: 'grain',        label: 'Grain',         icon: GrainIcon,       component: GrainConnector },  // ← new line
];
```

Total: ~230 lines, 1-2 days including tests. **This is the target state.**

### Connector Registry Interface

```typescript
// src/types/connector.ts
export interface ConnectorDefinition {
  id: string;                          // Must match source_app in recordings table
  label: string;                       // Display name
  icon: React.ComponentType;           // Brand icon
  component: React.ComponentType<ConnectorProps>;
  authType: 'oauth' | 'api_key' | 'url_only';
  description: string;
  docsUrl?: string;
}

export interface ConnectorProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}
```

### Deduplication in the Pipeline

The shared dedup check should use `source_metadata->>'external_id'` rather than title+time fingerprinting (which is error-prone). The pipeline stores the platform's canonical ID:

```sql
-- Dedup check in checkDuplicate()
SELECT id FROM recordings
WHERE bank_id = $bankId
  AND source_app = $sourceApp
  AND source_metadata->>'external_id' = $externalId
LIMIT 1;
```

This requires adding `external_id` as a consistent key in `source_metadata` across all connectors. **Existing connectors need a one-time migration** to normalize their `source_metadata` (low risk, additive only).

---

## Per-Workspace MCP Token Architecture

### Problem Statement

Currently: MCP tokens are per-user. A coach using Claude as an AI assistant can query ALL their calls. 

v2 need: Coach creates a workspace (vault), generates a workspace-scoped MCP URL. Client gets that URL and can only see recordings in that vault — not the coach's other vaults.

### Solution: Supabase OAuth 2.1 Client ID + RLS Scoping

**This is exactly what Supabase's OAuth 2.1 server was designed for** (HIGH confidence — verified in official Supabase docs).

The JWT issued by Supabase for an OAuth client includes a `client_id` claim. RLS policies can use `(auth.jwt() ->> 'client_id')` to scope access.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Coach's CallVault App                           │
│                                                                     │
│  Settings → Workspace → "MCP Access" → [Generate Token]            │
│                                         ↓                           │
│  Calls: POST /functions/v1/create-mcp-token                        │
│  Body: { vault_id: "uuid-of-coaching-vault" }                      │
│                                         ↓                           │
│  Returns: {                                                         │
│    mcp_url: "callvault-mcp.naegele412.workers.dev",                │
│    client_id: "cv-ws-xxxxxxxx",   ← workspace-scoped client        │
│    instructions: "Add to Claude with this URL..."                  │
│  }                                                                  │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│              Supabase OAuth 2.1 Server                              │
│                                                                     │
│  auth.oauth_clients table:                                          │
│  {                                                                  │
│    client_id: "cv-ws-xxxxxxxx",                                     │
│    name: "MCP: Coaching Vault - John Smith",                       │
│    owner_user_id: <coach_user_id>,                                  │
│    allowed_redirect_uris: ["callvault-mcp.workers.dev/callback"],  │
│    metadata: { vault_id: "uuid-of-coaching-vault" }                │
│  }                                                                  │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│              Cloudflare Workers MCP Server                          │
│                                                                     │
│  Token exchange → Supabase issues JWT:                              │
│  {                                                                  │
│    "sub": "coach-user-uuid",                                        │
│    "client_id": "cv-ws-xxxxxxxx",                                   │
│    "role": "authenticated"                                          │
│  }                                                                  │
│                                                                     │
│  MCP tools run as coach user, but RLS restricts to vault           │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│              PostgreSQL RLS (vault-scoped access)                   │
│                                                                     │
│  New RLS policy on vault_entries:                                   │
│  CREATE POLICY "MCP clients see only their scoped vault"            │
│  ON vault_entries FOR SELECT                                        │
│  USING (                                                            │
│    -- Normal user session: all their vaults                         │
│    (auth.jwt() ->> 'client_id') IS NULL                             │
│    AND is_vault_member(vault_id, auth.uid())                        │
│  ) OR (                                                             │
│    -- MCP client: only the specific vault it was scoped to          │
│    (auth.jwt() ->> 'client_id') IS NOT NULL                         │
│    AND vault_id = get_mcp_client_vault_id(auth.jwt() ->> 'client_id') │
│    AND auth.uid() = get_mcp_client_owner(auth.jwt() ->> 'client_id') │
│  );                                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

#### Database Schema Addition

```sql
-- New table: workspace_mcp_tokens
-- Tracks which OAuth client_id maps to which vault
CREATE TABLE workspace_mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,           -- Supabase OAuth client_id
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,                               -- "John Smith coaching vault"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ                    -- NULL = active
);

-- Helper function for RLS
CREATE OR REPLACE FUNCTION get_mcp_client_vault_id(p_client_id TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT vault_id FROM workspace_mcp_tokens 
  WHERE client_id = p_client_id AND revoked_at IS NULL
$$;

CREATE OR REPLACE FUNCTION get_mcp_client_owner(p_client_id TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT owner_user_id FROM workspace_mcp_tokens
  WHERE client_id = p_client_id AND revoked_at IS NULL
$$;
```

#### New Edge Function: `create-mcp-token`

```typescript
// supabase/functions/create-mcp-token/index.ts (~120 lines)
// POST body: { vault_id, label }
// 1. Verify user is vault owner
// 2. Register OAuth client with Supabase auth.oauth_clients
// 3. Insert row into workspace_mcp_tokens
// 4. Return { client_id, mcp_url, setup_instructions }
```

#### Cloudflare Workers Changes

The MCP server on Cloudflare Workers currently authenticates via Supabase OAuth and runs all tools as the authenticated user. For v2, it needs to:

1. **Read `client_id` from the JWT** — already present in token
2. **Pass `client_id` to Supabase queries** — RLS handles the rest automatically
3. **No changes to tool definitions** — the DB layer enforces vault scoping

This is the key insight: **the MCP Worker code barely changes**. RLS does the filtering. The Worker just needs to forward the token correctly (which it already does via Supabase OAuth 2.1).

#### Revocation

```typescript
// POST /functions/v1/revoke-mcp-token
// Body: { client_id }
// 1. UPDATE workspace_mcp_tokens SET revoked_at = NOW()
// 2. Revoke OAuth client in Supabase (if API supports it)
// Result: Token immediately invalid at RLS layer
```

---

## Edge Function Reorganization

### Current Inventory (42 non-AI functions remaining)

After removing ~23 AI content-generation functions, the remaining functions fall into these groups:

```
GROUP 1: Connectors / Import (20 functions)
  OAuth flows (3 per platform × 3 platforms + Fathom key):
  ├── fathom-oauth-url, fathom-oauth-callback, fathom-oauth-refresh
  ├── zoom-oauth-url, zoom-oauth-callback, zoom-oauth-refresh
  ├── google-oauth-url, google-oauth-callback, google-oauth-refresh
  ├── save-fathom-key, test-fathom-connection, create-fathom-webhook
  Import/Sync:
  ├── fetch-meetings, fetch-single-meeting (Fathom fetch)
  ├── sync-meetings, resync-all-calls (Fathom sync orchestration)
  ├── zoom-fetch-meetings, zoom-sync-meetings, zoom-webhook
  ├── google-meet-fetch-meetings, google-meet-sync-meetings, google-poll-sync
  └── youtube-api, youtube-import

GROUP 2: Embedding Pipeline (7 functions)
  ├── embed-chunks           — Creates vector embeddings
  ├── backfill-chunk-metadata— Enriches existing chunks
  ├── enrich-chunk-metadata  — Adds metadata to chunks
  ├── process-embeddings     — Orchestrates embedding pipeline
  ├── retry-failed-embeddings— Handles failed embedding jobs
  ├── rerank-results         — Cross-encoder reranking
  └── semantic-search        — Semantic search endpoint

GROUP 3: AI Chat (2 functions — simplified in v2)
  ├── chat-stream-v2         — Main chat (simplify to ~100 line bridge)
  └── chat-stream-legacy     — Delete in v2

GROUP 4: Automation (5 functions)
  ├── automation-engine      — Rule evaluation
  ├── automation-scheduler   — Cron trigger
  ├── automation-email       — Email action
  ├── automation-sentiment   — Sentiment trigger
  └── auto-tag-calls         — Tag automation

GROUP 5: Billing / Subscription (4 functions)
  ├── polar-checkout
  ├── polar-create-customer
  ├── polar-customer-state
  └── polar-webhook

GROUP 6: Sharing / Collaboration (3 functions)
  ├── share-call
  ├── check-client-health
  └── migrate-recordings

GROUP 7: MCP / Workspace (new in v2, 2 functions)
  ├── create-mcp-token       — New: Register workspace OAuth client
  └── revoke-mcp-token       — New: Revoke workspace token

GROUP 8: Config / Misc (4 functions)
  ├── get-config-status
  ├── get-available-models
  ├── sync-openrouter-models
  ├── save-host-email
  └── test-secrets
```

### Reorganization Recommendation

**Don't rename existing functions** — Supabase function names are part of the public URL, and v1 clients may still be running during migration. Instead:

1. **Create new connector functions** that write to `recordings` directly (GROUP 1 v2 variants)
2. **Keep old connector functions** as deprecated until v1 is fully off
3. **Add GROUP 7** (MCP workspace tokens) as new functions
4. **Simplify chat-stream-v2** to the ~100 line bridge (remove 14 AI tools, replace with simple chat)
5. **Delete chat-stream-legacy** when v1 is off

**The `_shared/connector-pipeline.ts`** described above is the key reorganization move — it doesn't rename functions, it extracts the common pattern so future functions are thin wrappers.

### Function Naming for New Connector Functions

When writing new v2 variants of connector sync functions:

```
zoom-sync-v2/       — Writes to recordings table directly
google-meet-sync-v2/— Writes to recordings table directly  
fathom-sync-v2/     — Writes to recordings table directly
youtube-import-v2/  — Writes to recordings table directly
grain-sync/         — New connector (follows pipeline pattern)
```

Old functions remain deployed during transition, then removed.

---

## Build Order

For fastest working state from zero, build in this sequence:

```
PHASE 1: Foundation (Day 1-2)
  → New repo scaffold (Vite + React + TypeScript + Tailwind + shadcn)
  → Supabase client connected (env vars pointing to existing project)
  → Auth flow working (login, session, protected routes)
  → AppShell layout (port from v1)

  ✓ Working state: Can log in, see empty shell

PHASE 2: Read existing recordings (Day 3-4)  
  → Query get_unified_recordings() RPC (already deployed)
  → RecordingsList page showing existing data
  → RecordingDetail page
  → Run batch migration to ensure fathom_calls → recordings complete

  ✓ Working state: Can see all existing calls, browse them

PHASE 3: Core import connectors (Week 2)
  → Build _shared/connector-pipeline.ts (new shared utility)
  → Fathom connector v2 (OAuth + sync → recordings directly)
  → YouTube import v2
  → Import hub UI (ConnectorRegistry pattern)

  ✓ Working state: Can import new calls from primary sources

PHASE 4: AI chat + search (Week 3)
  → Simplify chat-stream-v2 to bridge (remove AI bloat)
  → Chat UI (port useChat hook from v1)
  → Search bar connected to semantic-search function

  ✓ Working state: Full read-query-chat loop working

PHASE 5: Bank/Vault management (Week 3-4)
  → Vaults page
  → Vault context switching
  → Vault membership UI
  → Settings page (workspace configuration)

  ✓ Working state: Multi-vault navigation

PHASE 6: Per-workspace MCP tokens (Week 4-5)
  → workspace_mcp_tokens table migration
  → create-mcp-token edge function
  → MCP token settings UI
  → Test with Claude: scope a token to a vault, verify isolation

  ✓ Working state: Coaches can share workspace-scoped MCP URLs

PHASE 7: Additional connectors (Week 5+)
  → Zoom sync v2
  → Google Meet sync v2
  → First new connector (Grain or Fireflies) using pipeline
```

### Critical Path Dependencies

```
Auth (Phase 1) → ALL other phases
Recordings data visible (Phase 2) → Chat/search (Phase 4)
Connector pipeline (Phase 3) → All future connectors
Bank/Vault UI (Phase 5) → MCP workspace tokens (Phase 6)
```

**Don't skip Phase 2 before Phase 3.** The batch migration must complete before v2 writes new imports to `recordings`, otherwise you'll have a split data state with some calls only in `fathom_calls`.

---

## Integration Points

### New Frontend ↔ Existing Supabase

```typescript
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// .env.local (new repo — same values as brain/ project)
// VITE_SUPABASE_URL=https://[existing-project-ref].supabase.co
// VITE_SUPABASE_ANON_KEY=[same anon key]
```

**No schema changes required** to connect — the new frontend is a new client of the same Supabase project. RLS policies already enforce isolation.

### New Frontend ↔ Cloudflare Workers MCP

The MCP server URL doesn't change: `callvault-mcp.naegele412.workers.dev`

The Cloudflare Worker authenticates via Supabase OAuth 2.1 (already implemented). For workspace-scoped tokens, the Worker receives JWTs with a `client_id` claim — this is already present in all Supabase OAuth 2.1 tokens. No changes to the Worker's auth flow.

**What does change on the Worker:** The MCP tools may need to pass `client_id` as a context hint when querying Supabase, but since RLS already filters by `client_id` in the JWT, the Worker's database queries don't need modification. The DB enforces scoping automatically.

### Existing Supabase Functions ↔ New v2 Recordings Table

The embedding pipeline (`process-embeddings`, `embed-chunks`, etc.) currently writes chunk metadata using `fathom_calls.recording_id` (BIGINT). For v2 recordings, chunks need to reference `recordings.id` (UUID).

**Two options:**

| Option | Description | Risk |
|--------|-------------|------|
| A: New `recording_uuid` column in chunks table | Add `recording_uuid UUID REFERENCES recordings(id)` to the chunks table | LOW — additive |
| B: Change chunk FK to UUID | Replace `recording_id BIGINT` with `recording_id UUID` | HIGH — breaks existing embeddings |

**Recommendation: Option A** — Add `recording_uuid` as an additional column alongside the existing `recording_id`. The embedding pipeline for new recordings populates `recording_uuid`. Legacy chunks keep their `recording_id`. The `get_unified_recordings` RPC can join on either.

### Tauri/Electron Future-Proofing

The `services/` layer in the v2 repo is the single boundary:

```typescript
// services/recordings.service.ts
// This is the ONLY file that changes when adapting to Tauri

// Browser version:
import { supabase } from './supabase';
export async function getRecordings(vaultId: string) {
  return supabase.rpc('get_unified_recordings', { p_vault_id: vaultId });
}

// Tauri version (future swap):
// import { invoke } from '@tauri-apps/api/tauri';
// export async function getRecordings(vaultId: string) {
//   return invoke('get_recordings', { vaultId });
// }
```

Feature components import from `services/`, never from `supabase` directly. This one discipline enables the Tauri swap without touching feature code.

---

## Architecture Anti-Patterns to Avoid

### Anti-Pattern 1: Writing New Imports to fathom_calls

**What:** New import connectors (v2) write to `fathom_calls` instead of `recordings`  
**Why bad:** Prolongs the migration, continues the split data state  
**Instead:** All v2 connectors write directly to `recordings` + `vault_entries`

### Anti-Pattern 2: Per-Component Supabase Imports

**What:** `import { supabase } from '@/lib/supabase'` scattered throughout components  
**Why bad:** Couples UI to Supabase, breaks Tauri path, hard to mock in tests  
**Instead:** All Supabase calls through `services/*.service.ts`

### Anti-Pattern 3: Workspace MCP Tokens via API Keys (not OAuth)

**What:** Generate a static API key stored in a column, pass it to Claude  
**Why bad:** No token expiration, no revocation, no RLS integration, no audit trail  
**Instead:** Supabase OAuth 2.1 client with `client_id` in JWT — RLS handles scoping automatically

### Anti-Pattern 4: One Giant "sync-all" Edge Function

**What:** Single function handles all sources: "if zoom, do zoom; if google, do google"  
**Why bad:** Untestable, deployment of one connector breaks all others, 2000+ lines  
**Instead:** One function per connector, shared logic in `_shared/connector-pipeline.ts`

### Anti-Pattern 5: Hardcoding Vault IDs in MCP Tools

**What:** MCP tools accept a `vault_id` parameter, coach embeds it in tool config  
**Why bad:** Client can change the parameter and access other vaults  
**Instead:** RLS derives vault access from JWT `client_id` — no parameter needed or trusted

---

## Sources

| Source | URL | Confidence |
|--------|-----|------------|
| Supabase MCP Authentication docs | https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication | HIGH |
| Supabase Token Security & RLS docs | https://supabase.com/docs/guides/auth/oauth-server/token-security | HIGH |
| Supabase OAuth 2.1 server overview | https://supabase.com/docs/guides/auth/oauth-server | HIGH |
| Existing recordings table migration | `supabase/migrations/20260131000007_create_recordings_tables.sql` | HIGH |
| Existing migration functions | `supabase/migrations/20260131000008_migration_function.sql` | HIGH |
| Existing connector functions (analysis) | `supabase/functions/zoom-sync-meetings/index.ts` et al. | HIGH |
| Vite project structure | https://vitejs.dev/guide/ | HIGH |
| Feature-sliced design principles | https://feature-sliced.design/ | MEDIUM (training data, not verified) |
| Connector pipeline pattern | Derived from existing codebase analysis | HIGH |
| Tauri future-proofing via services layer | Standard DI pattern, training data | MEDIUM |
