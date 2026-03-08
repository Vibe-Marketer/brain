# Phase 17: Import Connector Pipeline - Research

**Researched:** 2026-02-27
**Domain:** Connector pipeline infrastructure, file upload + Whisper transcription, import source management UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import source management UI:**
- Card grid layout — each source is a card (like an integrations dashboard, Zapier-style)
- Full detail on each card: logo, source name, connected account email, status badge (active/paused/error), last sync time, call count imported, active/inactive toggle
- "Add Source" card or button lives on the same Import page — clicking it opens the OAuth flow or setup wizard inline
- Users connect new sources and manage existing ones from a single page

**New connector: File upload (audio/video):**
- First new connector to validate the pipeline — file upload with Whisper transcription
- Accepted formats: MP3, WAV, M4A, MP4, MOV, WebM — broad audio + video support
- Multi-file drag-and-drop upload — each file becomes a separate recording, processed in parallel or queued
- Transcription via OpenAI Whisper API — CallVault handles the API call, users don't need their own API key
- File uploads count toward the standard 10 imports/month free tier limit — consistent across all sources

**Sync behavior and feedback:**
- OAuth sources (Fathom, Zoom) support both auto-sync on schedule AND manual "Sync Now" button
- During sync: source card shows live progress ("Syncing... 4/12 calls") with progress bar/spinner
- When sync completes: toast notification summarizing results ("Fathom sync complete — 8 new calls imported")
- Dedup: duplicates silently skipped during import, but sync summary reports them ("Skipped 3 duplicates")
- Partial failures: import what works, surface errors. Failed calls shown in a "failed imports" section with retry option. No all-or-nothing rollback.

**Source connection flow:**
- Disconnecting a source keeps all imported calls — "Your calls are yours." Only future syncs stop.
- Disconnect confirmation: simple dialog — "Disconnect Fathom? Future syncs will stop. Your imported calls will be kept." One-click confirm.
- After first-time OAuth connection: auto-sync immediately — user sees calls appearing within seconds, no extra prompt.

### Claude's Discretion

- Error display pattern for sources with issues (expired tokens, API errors) — pick based on existing app error handling patterns
- OAuth flow UX (same-window redirect vs popup) — pick based on existing OAuth patterns in the app (v1 used redirect)
- Card grid responsive behavior (columns per breakpoint)
- Progress bar implementation details
- File upload chunk/stream strategy
- Auto-sync interval (hourly, daily, etc.)

### Deferred Ideas (OUT OF SCOPE)

- Grain connector — future phase (after pipeline validated with file upload)
- Fireflies.ai connector — future phase (after Grain)
- These would be added one at a time as new connectors, each validating the ≤230 line pipeline promise
</user_constraints>

---

## Summary

Phase 17 is a refactoring + new-connector phase. The primary deliverable is `_shared/connector-pipeline.ts` — a 5-stage shared utility that normalizes how all connectors write to the `recordings` table. The existing connectors (Fathom, Zoom, YouTube) currently write to `recordings` via their own ad-hoc implementations that share no code; the pipeline gives them a single, tested code path. The acceptance test for the pipeline is building the file-upload connector in ≤230 lines.

The technical foundation is solid. Phase 15 already migrated all data to `recordings` + `vault_entries` and injected `external_id` into every row's `source_metadata`. The dedup pattern the pipeline needs (check `source_metadata->>'external_id'`) is already proven in the YouTube import function. The OpenAI `OPENAI_API_KEY` is already configured in Supabase secrets and used by embeddings functions.

The biggest planning challenge is the Import Hub UI redesign. The existing `/import` page is minimal (YouTube URL form only). It must be replaced with a full source management dashboard while keeping the `ManualImport` route at `/import`. The existing `IntegrationManager` component (used in Settings IntegrationsTab) and `useIntegrationSync` hook provide working patterns for connection status and OAuth flow, but they lack the card grid layout, call count, active/inactive toggle, and progress feedback required by the locked decisions. These components will need to be extended or the Import page will build its own version atop the same hook.

**Primary recommendation:** Build the pipeline utility first (Stage 1–5 as pure TypeScript with no side effects), rewire the simplest existing connector (YouTube) as the proof of concept, then build the file upload connector to validate the ≤230 line budget, then rebuild the Import UI. This order catches pipeline design mistakes before the UI depends on it.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@supabase/supabase-js` | 2.x | Supabase client for DB writes | In use |
| `OPENAI_API_KEY` env var | — | Already configured in Supabase secrets | Confirmed (used by embeddings) |
| Deno (Edge Functions) | Deploy | Runtime for connector edge functions | In use |
| React + react-router-dom | ^18 / ^6.30 | App framework + routing | In use |
| @tanstack/react-query | ^5.90 | Server state, sync job polling | In use |
| shadcn/ui + Tailwind | current | Card, Badge, Toggle, Progress components | In use |
| Remix Icon | current | Icon system | In use — mandatory |
| Sonner | current | Toast notifications | In use |

### New for this Phase
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| OpenAI Whisper API | REST | Audio-to-text transcription | Direct API call, no SDK needed — `OPENAI_API_KEY` exists |
| Supabase Storage | built-in | Temp staging for audio files >6MB before Whisper | No existing buckets — needs new `audio-uploads` private bucket |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Whisper API call | Vercel AI SDK | Whisper is a dedicated audio model; CLAUDE.md requires Vercel AI SDK for LLM features only — Whisper is not an LLM, direct API call is correct |
| Supabase Storage staging | Edge Function memory | Whisper limit is 25MB; Edge Function has 150MB memory limit but functions timeout at 150s; storage staging avoids timeout for transcription |
| Supabase Storage | Client-side upload directly to Whisper | Security: API key would be exposed client-side. Edge function intermediary is required. |

**Installation:** No new npm packages needed. Whisper is accessed via fetch() in Deno.

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/functions/
  _shared/
    connector-pipeline.ts    # NEW: 5-stage pipeline utility
    fathom-client.ts         # EXISTS: Fathom retry logic (unchanged)
    zoom-client.ts           # EXISTS: Zoom OAuth client (unchanged)
  file-upload-transcribe/
    index.ts                 # NEW: file upload + Whisper connector (~80 lines)
  youtube-import/
    index.ts                 # EXISTS: rewire to use pipeline (reduce from ~900 to ~150 lines)
  zoom-sync-meetings/
    index.ts                 # EXISTS: rewire stages 3–5 to use pipeline
  [fathom-webhook, etc.]
    index.ts                 # EXISTS: rewire stage 5 (insert) to use pipeline

src/
  pages/
    ImportHub.tsx            # NEW: replaces ManualImport.tsx at /import route
  components/
    import/
      SourceCard.tsx         # NEW: per-source card component
      ImportSourceGrid.tsx   # NEW: card grid container
      FileUploadDropzone.tsx # NEW: drag-and-drop upload area
      SourceProgressBar.tsx  # NEW: live sync progress in card
      FailedImportsSection.tsx # NEW: retry interface
      ImportProgress.tsx     # EXISTS: keep, reuse for file upload progress
      YouTubeImportForm.tsx  # EXISTS: keep or inline into ImportHub
  hooks/
    useImportSources.ts      # NEW: CRUD for import source status + poll sync progress
```

### Pattern 1: The 5-Stage Pipeline Interface

The `_shared/connector-pipeline.ts` file defines the shared stages as composable async functions. Each connector calls only the stages it needs. The interface design must be flat — no class hierarchy, no inheritance.

```typescript
// Source: architecture from Phase 17 requirements + existing youtube-import pattern

export interface ConnectorRecord {
  external_id: string;          // Dedup key — UNIQUE per user per source
  source_app: string;           // 'fathom' | 'zoom' | 'youtube' | 'file-upload'
  title: string;
  full_transcript: string;
  recording_start_time: string; // ISO string
  duration?: number;            // seconds
  source_metadata: Record<string, unknown>; // Must include external_id as first key
  bank_id?: string;             // Optional — pipeline resolves if omitted
  vault_id?: string;            // Optional — pipeline resolves if omitted
}

// Stage 3: Dedup check by external_id
export async function checkDuplicate(
  supabase: SupabaseClient,
  userId: string,
  sourceApp: string,
  externalId: string
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const { data } = await supabase
    .from('recordings')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('source_app', sourceApp)
    .filter("source_metadata->>'external_id'", 'eq', externalId)
    .maybeSingle();
  return { isDuplicate: !!data, existingId: data?.id };
}

// Stage 5: Insert recording + vault_entry
export async function insertRecording(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord
): Promise<{ id: string }> {
  // Resolve bank_id from user if not provided
  // Insert recordings row with source_metadata containing external_id
  // Insert vault_entries row
  // Return new recording UUID
}
```

### Pattern 2: Connector Adapter (≤230 lines total, all files combined)

Each connector is a thin adapter: an `index.ts` edge function (~80 lines) that handles auth + request parsing, calls Stages 1–2 (get credentials + fetch data), calls Stage 3 (dedup), calls Stage 4 (transform to ConnectorRecord), calls Stage 5 (insert). The pipeline handles no business logic — the connector handles no DB writes.

```typescript
// supabase/functions/file-upload-transcribe/index.ts
// Stage 1: credentials = OPENAI_API_KEY (from Deno.env)
// Stage 2: read multipart/form-data, buffer audio bytes
// Stage 3: checkDuplicate(supabase, userId, 'file-upload', file.name + file.size)
// Stage 4: POST to https://api.openai.com/v1/audio/transcriptions
// Stage 5: insertRecording(supabase, userId, record)
```

### Pattern 3: Import Hub Page (replaces ManualImport)

The existing `/import` route at `App.tsx` line currently points to `ManualImport`. The new `ImportHub` page takes over that route. The file structure keeps `ManualImport.tsx` temporarily or renames in place — planner will decide. The page uses AppShell (required for all pages per src/CLAUDE.md).

```typescript
// Pattern from existing ManualImport.tsx + IntegrationManager
import { AppShell } from "@/components/layout/AppShell";
// Card grid with useImportSources hook for real-time status
// File upload dropzone (HTML5 drag-and-drop, accepts audio + video MIME types)
// Each source card uses shadcn/ui Card + Badge + Switch
```

### Pattern 4: File Upload → Edge Function Flow

The constraint is Whisper's 25MB limit. Audio files can be larger. The plan must decide between:

**Option A (Recommended for MVP): Client uploads directly to edge function memory (≤25MB enforced client-side)**
- Frontend: validate file size before upload, reject >25MB with error message
- Frontend: POST multipart/form-data to `file-upload-transcribe` edge function
- Edge function: read file from request body, POST to Whisper API, insert recording
- Simplest path, ~80 lines in edge function
- Tradeoff: users cannot upload files >25MB

**Option B: Client uploads to Supabase Storage, edge function reads and sends to Whisper**
- Frontend: upload to Supabase Storage `audio-uploads` private bucket
- Trigger edge function (by RPC or webhook) with storage path
- Edge function: download from Storage, POST to Whisper
- Tradeoff: more complex, slower, but handles large files
- Note: No existing storage buckets — requires new migration + bucket setup

**Research verdict:** For Phase 17, Option A is appropriate. The 25MB limit covers most meeting recordings (a 60-minute MP3 at 128kbps is ~56MB — too large; at 64kbps is ~28MB — borderline). The MVP should enforce 25MB and display a clear error. Large file chunking is a Phase 22 enhancement. The accepted formats (MP4, MOV) are video containers — frontend should warn that only audio is transcribed.

### Pattern 5: Active/Inactive Toggle Storage

The locked UI has an active/inactive toggle per source. Currently there is no `import_sources` table — connection status lives in `user_settings` columns (`fathom_api_key`, `zoom_oauth_access_token`, etc.). The toggle state needs a home.

**Recommended approach:** Add `fathom_sync_active`, `zoom_sync_active`, `youtube_sync_active`, `file_upload_active` boolean columns to `user_settings`. Default `true` for connected sources. This avoids a new table and migration complexity. Migration is one ALTER TABLE. RLS is inherited from existing `user_settings` policies.

**Alternative:** New `import_sources` table with `(user_id, source_app, is_active, last_sync_at, call_count, account_email)` — cleaner schema, but requires migration + RLS + JOIN on every status read.

**Research verdict:** New `import_sources` table is architecturally cleaner and future-proof for Phase 18 routing rules (rules reference sources by name). Use this approach. See Open Questions below.

### Anti-Patterns to Avoid

- **Writing to `fathom_calls_archive` from new connectors:** The archive is read-only per Phase 15 decision. All new imports write directly to `recordings`. The existing `fathom_calls` VIEW is read-only and must not be inserted into.
- **Using numeric `recording_id` for new connectors:** YouTube import generates a hacky `9000000000000 + timestamp` numeric ID to write to `fathom_calls`. The pipeline writes UUIDs to `recordings`. New connectors never touch `fathom_calls_archive` at all.
- **Blocking edge functions on large file transcription:** Whisper API can take 30–120 seconds for long audio. Use `EdgeRuntime.waitUntil()` for background processing (same pattern as `zoom-sync-meetings`).
- **Exposing OPENAI_API_KEY client-side:** File must flow through edge function. Never proxy the key to the browser.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio transcription | Custom STT | Whisper API (`/v1/audio/transcriptions`) | Whisper is mature, 99 languages, 25MB limit covers MVP |
| Drag-and-drop UI | Custom drag events | HTML5 `ondragover` + `ondrop` or shadcn/ui file input | Native browser APIs are sufficient; no library needed for MVP |
| Dedup logic | Fuzzy matching | Exact `external_id` match in `source_metadata` | Fuzzy matching (existing in zoom-sync-meetings) is for cross-platform dedup; within a single connector, exact ID match is correct and simple |
| Real-time sync progress | WebSockets | Supabase Realtime on `sync_jobs` table | Already used by `zoom-sync-meetings` via `sync_jobs` table; reuse the polling pattern |
| OAuth for new connectors | Custom OAuth | Existing `fathom-oauth-url/callback`, `zoom-oauth-url/callback` patterns | Templates exist; file upload has no OAuth (it's direct upload) |

**Key insight:** The pipeline's value is eliminating the database insert complexity from each connector, not abstracting OAuth or API calls. Keep Stages 1–2 in each connector; only share Stages 3–5.

---

## Common Pitfalls

### Pitfall 1: Edge Function Timeout on Long Transcription

**What goes wrong:** A 30-minute audio file takes 60–90 seconds to transcribe. Supabase Edge Functions have a 150-second wall-clock limit. If transcription + DB insert exceeds that, the function returns 500 and the recording is lost.

**Why it happens:** Synchronous `await fetch(whisperUrl, { body: formData })` blocks until Whisper responds. Large files = long wait.

**How to avoid:** Return 202 immediately with a job ID, run transcription in `EdgeRuntime.waitUntil()`. Client polls `sync_jobs` for status. This is identical to the `zoom-sync-meetings` pattern.

**Warning signs:** File uploads <10MB work fine in testing; 30+ minute files fail in production.

### Pitfall 2: `fathom_calls_archive` Compatibility VIEW

**What goes wrong:** The connector pipeline writes to `recordings`. But existing Zoom sync (`zoom-sync-meetings`) still writes to `fathom_calls` (which is now the VIEW over `fathom_calls_archive`). Inserting into the VIEW fails silently or errors depending on Postgres VIEW configuration.

**Why it happens:** Phase 15 archived `fathom_calls` via RENAME but created a compatibility VIEW. Inserts into that VIEW are not configured (no INSTEAD OF trigger), so they will fail with a Postgres error.

**How to avoid:** Rewiring Zoom sync to write to `recordings` is part of this phase's scope (IMP-01). Verify the rewire is complete before declaring connectors normalized. Do NOT write to `fathom_calls` VIEW.

**Warning signs:** `supabase.from('fathom_calls').insert(...)` will error — catch and fix, don't suppress.

### Pitfall 3: external_id Collision Between Sources

**What goes wrong:** Zoom meeting ID `"abc123"` and Fathom call ID `"abc123"` happen to match. The dedup check finds a false duplicate and silently skips the import.

**Why it happens:** `external_id` is only unique within a connector, not globally.

**How to avoid:** The dedup query in Stage 3 MUST filter by both `owner_user_id` AND `source_app`. The pipeline interface already enforces this: `checkDuplicate(supabase, userId, sourceApp, externalId)`. Never dedup across sources.

**Warning signs:** "Video already imported" error on a different platform's content.

### Pitfall 4: 25MB Whisper Limit Surprise in Production

**What goes wrong:** MP4 video files from phone recordings are typically 100–500MB. Users expect to upload a 1-hour meeting video and get a transcript.

**Why it happens:** Video files have video stream + audio stream; the file is large even if audio is short. Whisper accepts MP4 but rejects anything over 25MB.

**How to avoid:** Client-side validation before upload: check `file.size > 25 * 1024 * 1024` and display specific error: "File too large. Maximum 25MB. For video files, consider extracting audio first." This is an acceptable MVP limitation per Claude's Discretion (file upload chunk strategy).

**Warning signs:** Users report "upload failed" for video files without clear error messages.

### Pitfall 5: Import Hub Wiring — ManualImport Route

**What goes wrong:** The new `ImportHub` page is built but the route at `/import` still points to `ManualImport.tsx`. The YouTube Import form in the old ManualImport page also disappears.

**Why it happens:** Two files, one route. Easy to orphan the old page without deleting it, or to forget to migrate the YouTube URL import form into the new page.

**How to avoid:** The planner should make a clean decision: either rename `ManualImport.tsx` → `ImportHub.tsx` in place and rewrite its contents, or create new file and update App.tsx. Do not maintain both.

### Pitfall 6: Call Count in Source Card

**What goes wrong:** The card must show "call count imported" per source. There's no pre-aggregated count column. Querying `COUNT(*) FROM recordings WHERE source_app='fathom' AND owner_user_id=...` on every page load hits the DB for every card.

**Why it happens:** The `import_sources` table (if built) would cache this count, but it needs to stay current.

**How to avoid:** Use a single aggregate query: `SELECT source_app, COUNT(*) FROM recordings WHERE owner_user_id = $1 GROUP BY source_app`. One query, all counts. Cache in React Query with reasonable stale time (5 min). The count is decorative — slight staleness is fine.

---

## Code Examples

### Stage 3 — Dedup Check

```typescript
// supabase/functions/_shared/connector-pipeline.ts
// Source: derived from existing youtube-import/index.ts dedup pattern (line 560–593)

export async function checkDuplicate(
  supabase: SupabaseClient,
  userId: string,
  sourceApp: string,
  externalId: string
): Promise<{ isDuplicate: boolean; existingRecordingId?: string }> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('source_app', sourceApp)
    .filter("source_metadata->>'external_id'", 'eq', externalId)
    .maybeSingle();

  if (error) {
    console.error('[pipeline] dedup check error:', error);
    // Fail open — don't block import on dedup error
    return { isDuplicate: false };
  }

  return { isDuplicate: !!data, existingRecordingId: data?.id };
}
```

### Stage 5 — Insert Recording + Vault Entry

```typescript
// Source: adapted from youtube-import/index.ts lines 810–873

export async function insertRecording(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord
): Promise<{ id: string }> {
  // Resolve personal bank_id if not provided
  let bankId = record.bank_id;
  if (!bankId) {
    const { data: membership } = await supabase
      .from('bank_memberships')
      .select('banks!inner(id, type)')
      .eq('user_id', userId)
      .eq('banks.type', 'personal')
      .maybeSingle();
    bankId = (membership as any)?.banks?.id;
    if (!bankId) throw new Error('No personal bank found for user');
  }

  // Ensure source_metadata includes external_id as first key
  const sourceMetadata = {
    external_id: record.external_id,
    ...record.source_metadata,
  };

  const { data: newRecording, error } = await supabase
    .from('recordings')
    .insert({
      bank_id: bankId,
      owner_user_id: userId,
      title: record.title,
      full_transcript: record.full_transcript,
      source_app: record.source_app,
      source_metadata: sourceMetadata,
      duration: record.duration ?? null,
      recording_start_time: record.recording_start_time,
      global_tags: [],
    })
    .select('id')
    .single();

  if (error) throw error;

  // Create vault_entry in personal vault
  const { data: vault } = await supabase
    .from('vaults')
    .select('id')
    .eq('bank_id', bankId)
    .eq('vault_type', 'personal')
    .maybeSingle();

  if (vault) {
    await supabase.from('vault_entries').insert({
      vault_id: vault.id,
      recording_id: newRecording.id,
    });
  }

  return { id: newRecording.id };
}
```

### File Upload Edge Function Skeleton

```typescript
// supabase/functions/file-upload-transcribe/index.ts
// Demonstrates the ≤230 line budget for the entire file upload connector

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkDuplicate, insertRecording } from '../_shared/connector-pipeline.ts';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Auth
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await supabase.auth.getUser(token!);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

  // Stage 2: Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400, headers: corsHeaders });
  if (file.size > MAX_FILE_SIZE) return new Response(JSON.stringify({ error: 'File exceeds 25MB limit' }), { status: 400, headers: corsHeaders });

  // Stage 3: Dedup by filename + size as external_id
  const externalId = `${file.name}-${file.size}`;
  const { isDuplicate } = await checkDuplicate(supabase, user.id, 'file-upload', externalId);
  if (isDuplicate) return new Response(JSON.stringify({ error: 'File already imported', exists: true }), { headers: corsHeaders });

  // Stage 4: Transcribe via Whisper
  const whisperForm = new FormData();
  whisperForm.append('file', file);
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('response_format', 'text');
  const whisperRes = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: whisperForm,
  });
  if (!whisperRes.ok) return new Response(JSON.stringify({ error: 'Transcription failed' }), { status: 502, headers: corsHeaders });
  const transcript = await whisperRes.text();

  // Stage 5: Insert
  const recording = await insertRecording(supabase, user.id, {
    external_id: externalId,
    source_app: 'file-upload',
    title: file.name.replace(/\.[^.]+$/, ''), // strip extension
    full_transcript: transcript,
    recording_start_time: new Date().toISOString(),
    source_metadata: { original_filename: file.name, file_size: file.size },
  });

  return new Response(JSON.stringify({ success: true, recordingId: recording.id }), { headers: corsHeaders });
});
// ~65 lines — well within 230-line budget for full connector (adapter + registration)
```

### SourceCard Component Pattern

```tsx
// src/components/import/SourceCard.tsx
// Follows IntegrationStatusCard.tsx pattern (src/components/settings/IntegrationStatusCard.tsx)
// but adds toggle, call count, last sync, and progress

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface SourceCardProps {
  name: string;
  logo: React.ReactNode;
  status: 'active' | 'paused' | 'error' | 'disconnected';
  accountEmail?: string;
  lastSyncAt?: string;
  callCount?: number;
  isActive: boolean;
  onToggle: (active: boolean) => void;
  onSync?: () => void;
  onDisconnect?: () => void;
  syncProgress?: { current: number; total: number };
}
```

### Whisper API Call Pattern (Verified)

```typescript
// Source: OpenAI official docs (https://developers.openai.com/api/docs/guides/speech-to-text/)
// Endpoint: POST https://api.openai.com/v1/audio/transcriptions
// Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
// Max size: 25MB
// Model options: whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe

const formData = new FormData();
formData.append('file', audioFile);       // File object from multipart parse
formData.append('model', 'whisper-1');    // whisper-1 is cheapest and sufficient for MVP
formData.append('response_format', 'text'); // Returns plain text — simplest format

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openAIApiKey}`,
    // Do NOT set Content-Type — fetch sets multipart/form-data with boundary automatically
  },
  body: formData,
});

const transcriptText = await response.text(); // plain text when response_format='text'
```

---

## Codebase Findings (What Already Exists)

### What the Pipeline Must Normalize

The three existing connectors each have their own DB write patterns:

| Connector | Current DB Write | State |
|-----------|-----------------|-------|
| **YouTube** (`youtube-import`) | Writes to `fathom_calls_archive` (line 753) AND `recordings` (line 810) — dual write | Both writes still happening; `fathom_calls_archive` insert now fails because VIEW is read-only |
| **Zoom** (`zoom-sync-meetings`) | Writes to `fathom_calls` (line 290 — now the VIEW), then separately to `recordings` (line 829) | Same dual write problem; VIEW insert fails |
| **Fathom** (webhook) | Writes to `fathom_calls` (now VIEW) — no `recordings` write at all | Single write, now broken |

**Critical finding:** Phase 15 archived `fathom_calls` via RENAME. A compatibility VIEW was created. But INSERTS into the VIEW will fail (Postgres does not route inserts to the base table through a plain SELECT VIEW — it requires INSTEAD OF triggers). The existing sync functions are currently writing to a broken target. This phase must fix all three.

### Dedup Pattern Already Working

The YouTube import dedup (lines 560–593 of `youtube-import/index.ts`) uses:
```typescript
.filter('metadata->>youtube_video_id', 'eq', videoId)
```
This queries the old `fathom_calls_archive` table. The new pipeline uses:
```typescript
.filter("source_metadata->>'external_id'", 'eq', externalId)
```
on the `recordings` table. Same pattern, different table and column. The `external_id` key is already present in all migrated recordings (confirmed by Phase 15 STATE.md: "All 1,554 migrated recordings now have external_id in source_metadata").

### user_settings Structure (Confirmed)

The `useIntegrationSync` hook queries these columns from `user_settings`:
- `fathom_api_key` — Fathom API key (set = connected)
- `oauth_access_token` / `oauth_token_expires` — Fathom OAuth tokens
- `google_oauth_access_token` / `google_oauth_token_expires` / `google_oauth_email` — Google Meet
- `zoom_oauth_access_token` / `zoom_oauth_token_expires` — Zoom
- `dedup_priority_mode`, `dedup_platform_order` — dedup settings

**For the import_sources table approach:** New table needed. `user_settings` does not have active/inactive toggles, call counts, or last sync timestamps per source. `sync_jobs` has progress info but per-job, not per-source aggregate.

### sync_jobs Table (Confirmed)

The `sync_jobs` table has: `user_id`, `recording_ids[]`, `status`, `progress_current`, `progress_total`, `synced_ids[]`, `failed_ids[]`, `completed_at`. This is the polling mechanism for real-time sync progress. The existing `IntegrationStatusRow` component already polls this via Supabase Realtime. Re-use this for Import Hub card progress bars.

### OPENAI_API_KEY Already Configured

Confirmed from `test-secrets/index.ts` and `process-embeddings/index.ts`. The key is present in Supabase secrets. No new secret configuration needed for Whisper.

### OAuth Pattern (redirect, not popup)

STATE.md confirms: "v1 used redirect" for OAuth. `fathom-oauth-url` returns an auth URL and the frontend does `window.location.href = response.data.authUrl`. The same redirect pattern applies to Zoom (`zoom-oauth-url`). After redirect, `OAuthCallback` page at `/oauth/callback` handles the exchange.

---

## State of the Art

| Old Approach | Current Approach | Relevant to Phase 17 |
|--------------|------------------|---------------------|
| `fathom_calls` as primary table | `recordings` + `vault_entries` post-Phase 15 | All new writes go to `recordings` |
| No shared connector code | `_shared/connector-pipeline.ts` (to build) | This is the primary deliverable |
| `fathom_calls_archive` compatibility VIEW | Read-only; no inserts | Existing sync functions are broken |
| `gpt-4o-transcribe` (newer) | `whisper-1` | `whisper-1` is sufficient and cheaper for MVP |

---

## Open Questions

1. **import_sources table vs user_settings columns**
   - What we know: `user_settings` stores connection status today; no active/inactive toggle or call count exists
   - What's unclear: Whether a dedicated `import_sources` table is needed for Phase 17 or Phase 18 will add it
   - Recommendation: Build `import_sources` table in Phase 17 migration. It stores `(user_id, source_app, is_active, last_sync_at, account_email)`. Call counts are computed via query, not stored (avoid stale counts). Phase 18 routing rules will reference `source_app` matching this table.

2. **How to handle the existing sync functions writing to the broken fathom_calls VIEW**
   - What we know: `zoom-sync-meetings` and `fathom-webhook` write to `fathom_calls` (now a VIEW). Phase 15 archived it as `fathom_calls_archive`. INSERTS into the VIEW fail.
   - What's unclear: Whether the fathom-webhook is currently receiving new calls and failing silently in production
   - Recommendation: Treat this as an urgent fix in Phase 17 Wave 1. The pipeline rewire is not optional — it fixes a production bug.

3. **Auto-sync interval for OAuth sources (Claude's Discretion)**
   - What we know: Google Meet has `google-poll-sync` function; Zoom uses on-demand `zoom-sync-meetings`; Fathom uses webhooks
   - What's unclear: Whether to add a scheduled auto-sync cron for Zoom/Fathom beyond what exists
   - Recommendation: For Phase 17, "auto-sync" means "sync immediately after first-time OAuth connection" per the locked decision. A full scheduled cron is Phase 18+ scope. The Import Hub "Sync Now" button covers manual re-sync.

4. **Where does file upload fit in the existing /import route?**
   - What we know: `/import` currently shows ManualImport (YouTube URL form only). The new page needs source cards + file upload dropzone.
   - Recommendation: Replace `ManualImport.tsx` content wholesale. The YouTube URL form becomes one section of the Import Hub (or a modal). The file upload dropzone is the prominent new addition.

5. **Whisper model choice**
   - What we know: Three options — `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`
   - What's unclear: Relative cost and quality for meeting audio
   - Recommendation: Start with `whisper-1` — $0.006/minute, battle-tested, well-supported in docs. `gpt-4o-transcribe` is newer but more expensive; add as upgrade option later.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `/supabase/functions/youtube-import/index.ts` — existing dedup and insert patterns
- Codebase: `/supabase/functions/zoom-sync-meetings/index.ts` — EdgeRuntime.waitUntil, sync_jobs pattern
- Codebase: `/supabase/functions/_shared/zoom-client.ts` and `fathom-client.ts` — retry patterns
- Codebase: `/supabase/migrations/20260227000002_archive_fathom_calls.sql` — fathom_calls_archive state
- Codebase: `/supabase/migrations/20260227000001_fix_migration_function.sql` — external_id injection confirmed
- Codebase: `/supabase/migrations/20260131000007_create_recordings_tables.sql` — recordings schema
- Codebase: `/src/hooks/useIntegrationSync.ts` — integration status patterns
- Codebase: `/src/components/settings/IntegrationStatusCard.tsx` — card component pattern
- Codebase: `/.planning/STATE.md` — external_id backfill confirmed, fathom_calls archive status
- OpenAI official docs: `https://developers.openai.com/api/docs/guides/speech-to-text/` — Whisper supported formats, 25MB limit, endpoint

### Secondary (MEDIUM confidence)
- WebSearch: Whisper 25MB limit confirmed across multiple community sources
- WebSearch: Supabase Edge Function multipart form upload pattern from official example

### Tertiary (LOW confidence, needs validation)
- Supabase Storage TUS resumable upload for files >6MB — not researched in depth; flagged as future enhancement path

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; Whisper API endpoint verified
- Architecture: HIGH — pipeline interface derived from existing codebase patterns
- Pitfalls: HIGH — fathom_calls VIEW breakage is a confirmed production issue; other pitfalls from code analysis
- File upload Whisper flow: MEDIUM — API verified; 25MB limit confirmed; chunking strategy for >25MB is LOW

**Research date:** 2026-02-27
**Valid until:** 2026-03-28 (stable tech; OpenAI API pricing/model availability may change)
