# Async Transcription Pipeline Research

**Project:** CallVault — Workstream 3 (Manual transcript upload: async + formats + reliability)
**Researched:** 2026-05-27
**Overall confidence:** HIGH (Supabase pgmq, EdgeRuntime.waitUntil, signed uploads, Realtime broadcast verified against official docs; Whisper format list verified against OpenAI help center)

---

## Executive Summary

**Recommended pipeline shape:** Browser uploads directly to Supabase Storage via a server-issued signed upload token (TUS protocol for files >25MB). On upload completion, a thin "enqueue" Edge Function inserts a row into `transcription_jobs` and `pgmq.send()`s the job. A `pg_cron`-scheduled worker Edge Function reads from pgmq with a 5-minute visibility timeout, transcribes via Deepgram for files >25MB (or Whisper for ≤25MB), and writes via the existing `runPipeline()`. A Postgres trigger on `recordings` calls `realtime.broadcast_changes()` to notify the client over a private workspace channel. Job state lives in `transcription_jobs` with a `read_ct >= 3` DLQ rule. Do NOT pursue ffmpeg.wasm in Edge Functions — instead, route any non-Whisper-native format (opus, ogg, flac) to Deepgram, which accepts those natively. This avoids both the Edge-Function bundle-size penalty and the 25MB Whisper cap in one move.

**Net result:** 25MB cap becomes 2GB (Deepgram direct upload) or effectively unlimited (URL-based async with callback). HTTP response time drops from 60–120s to <1s. Adds m4a/wav/ogg/opus/flac without server-side conversion. Stays inside the existing stack — no Redis, no SQS, no Docker.

---

## 1. Async Job Queue on Supabase (no external infra)

**Recommendation: pgmq via the `pgmq_public` schema + pg_cron worker.** This is now first-class on Supabase (GA as "Supabase Queues") — enable it from the dashboard once.

### Why pgmq, not a hand-rolled queue table

| Pattern | Why not |
|---|---|
| Hand-rolled `jobs` table + `pg_net.http_post()` for fire-and-forget | No visibility timeout. No exactly-once. You have to invent everything pgmq already implements. |
| Supabase Cron alone polling a status column | No locking — two cron runs race on the same row. |
| `EdgeRuntime.waitUntil()` only (no queue at all) | The HTTP request must keep waiting until the function instance shuts down (max 400s on paid). No retry on failure. Lose the job if the instance dies. |

pgmq gives you visibility timeout, exactly-once-within-window delivery, archive table, and `read_ct` for retry tracking — all in Postgres. Required version: PG 15.6.1.143+ (Supabase already provides this).

### Concrete topology

```
┌──────────┐    ┌─────────────────────┐    ┌──────────┐    ┌──────────────┐
│ Browser  │───▶│ Storage signed URL  │───▶│ Storage  │    │              │
│ TUS uplo │    │ (issued by Edge fn) │    │  bucket  │    │              │
└──────────┘    └─────────────────────┘    └─────┬────┘    │              │
                                                 │         │              │
                                                 ▼         │              │
                                         ┌───────────────┐ │  pgmq queue  │
                                         │ enqueue-trans │ │  "transcribe"│
                                         │  cribe-job    │─▶              │
                                         │  Edge Fn      │ │              │
                                         └───────────────┘ │              │
                                                           │              │
                                  pg_cron every 10s        │              │
                                         │                 │              │
                                         ▼                 │              │
                                  ┌─────────────────┐      │              │
                                  │ transcribe-     │◀─────│              │
                                  │ worker Edge Fn  │      └──────────────┘
                                  │ • read 1–3 msgs │
                                  │ • transcribe    │
                                  │ • runPipeline() │
                                  │ • pgmq.archive()│
                                  └─────────────────┘
```

### Code: enqueue from Edge Function

```typescript
// supabase/functions/enqueue-transcribe-job/index.ts
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const queue = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'pgmq_public' },
});

// 1. Insert canonical job row so the UI can show "pending" state
const { data: job } = await supabase
  .from('transcription_jobs')
  .insert({
    user_id: userId,
    organization_id: orgId,
    storage_path: storagePath,         // e.g. uploads/<userId>/<uuid>.m4a
    original_filename: filename,
    mime_type: mimeType,
    status: 'queued',
  })
  .select('id')
  .single();

// 2. Send to pgmq
await queue.rpc('send', {
  queue_name: 'transcribe',
  message: { job_id: job.id, storage_path: storagePath, mime_type: mimeType },
});
```

### Code: worker (invoked by pg_cron every 10s)

```typescript
// supabase/functions/transcribe-worker/index.ts
Deno.serve(async () => {
  const queue = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'pgmq_public' },
  });

  // Read up to 3 messages, mark invisible for 300s (5 min, > expected Whisper/DG latency)
  const { data: msgs } = await queue.rpc('read', {
    queue_name: 'transcribe',
    sleep_seconds: 300,
    n: 3,
  });

  for (const m of msgs ?? []) {
    // DLQ rule: if seen ≥ 3 times already, archive to a_transcribe table and mark failed
    if (m.read_ct >= 3) {
      await markJobFailed(m.message.job_id, 'max_retries_exceeded');
      await queue.rpc('archive', { queue_name: 'transcribe', message_id: m.msg_id });
      continue;
    }

    try {
      await processJob(m.message);                              // Whisper or Deepgram
      await queue.rpc('archive', { queue_name: 'transcribe', message_id: m.msg_id });
    } catch (err) {
      console.error('[transcribe-worker] job failed, will retry:', err);
      // Do NOT delete — let visibility timeout expire so it gets retried
    }
  }

  return new Response('ok');
});
```

### Scheduling (one-time setup, SQL via migration)

```sql
select cron.schedule(
  'transcribe-worker',
  '*/10 * * * * *',  -- every 10 seconds (6-field cron, requires pg_cron 1.5+)
  $$
  select net.http_post(
    url := 'https://<project>.functions.supabase.co/transcribe-worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
  $$
);
```

### Scale envelope

100s of concurrent uploads is well inside pgmq's range. The pgmq author's own benchmarks show 10k+ msg/s on commodity Postgres. Bottleneck is downstream transcription concurrency, NOT the queue. Tune by raising `n` (messages-per-poll) or running multiple worker function instances behind the same cron tick — Postgres row-level locking on `pgmq_read` prevents double-delivery.

### DLQ pattern (no built-in primitive)

pgmq has no automatic DLQ. The recommended pattern is: check `read_ct` inside the worker, and on the Nth attempt move the message to `transcribe_dlq` (a sibling queue) via `pgmq.archive()` then `pgmq.send()` to the DLQ. Alternative: just archive and write `status='failed'` on the `transcription_jobs` row — pgmq's `a_<queue>` archive table is itself queryable for replay.

---

## 2. Direct-to-Storage Pre-Signed Uploads

**Recommendation: Two-tier flow.**
- **Files ≤6MB:** use `createSignedUploadUrl` + `uploadToSignedUrl` (single-shot, simple, no extra deps).
- **Files >6MB or unknown size:** use TUS resumable upload via `tus-js-client` with a signed upload token. TUS supports up to **50GB** on Pro plan, with built-in resume on flaky uploads.

This bypasses the Edge Function for the file bytes entirely — the Edge Function only issues a token. Solves the wall-clock problem at the upload stage.

### Code: server-side token issue (Edge Function)

```typescript
// supabase/functions/file-upload-init/index.ts
const path = `uploads/${userId}/${crypto.randomUUID()}-${sanitizedFilename}`;
const { data, error } = await supabase
  .storage
  .from('uploads')
  .createSignedUploadUrl(path, { upsert: false });

// data = { signedUrl, token, path }
return new Response(JSON.stringify({
  uploadUrl: data.signedUrl,
  token: data.token,
  path: data.path,
  bucket: 'uploads',
}));
```

Signed upload URLs are valid for **2 hours** (fixed, not configurable per Supabase docs).

### Code: client-side, small file (single-shot)

```typescript
// In src/components/import/FileUploadDropzone.tsx
const { data: init } = await supabase.functions.invoke('file-upload-init', {
  body: { filename: file.name, size: file.size, mimeType: file.type },
});

const { error: upErr } = await supabase
  .storage
  .from(init.bucket)
  .uploadToSignedUrl(init.path, init.token, file, { contentType: file.type });

// Then enqueue the transcription job
await supabase.functions.invoke('enqueue-transcribe-job', {
  body: { storage_path: init.path, filename: file.name, mime_type: file.type },
});
```

### Code: client-side, large file (TUS resumable)

```typescript
import * as tus from 'tus-js-client';

const { data: { session } } = await supabase.auth.getSession();

const upload = new tus.Upload(file, {
  endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
  headers: {
    authorization: `Bearer ${session.access_token}`,
    'x-upsert': 'false',
  },
  uploadDataDuringCreation: true,
  removeFingerprintOnSuccess: true,
  metadata: {
    bucketName: 'uploads',
    objectName: path,                // same path scheme as above
    contentType: file.type,
    cacheControl: '3600',
  },
  chunkSize: 6 * 1024 * 1024,        // MANDATORY 6MB — do not change
  onProgress: (sent, total) => setProgress(sent / total),
  onSuccess: () => enqueueJob(path),
  onError: (err) => toast.error(`Upload failed: ${err.message}`),
});

upload.start();
```

**6MB chunk size is mandatory** per Supabase docs ("it must be set to 6MB (for now) do not change it"). Each upload URL is valid for 24 hours.

### Bucket setup (one-time migration)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 2147483648, null);  -- 2GB cap, all MIME (validate in function)

-- RLS: users can only insert into their own folder
create policy "users upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own uploads"
  on storage.objects for select
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
```

### Magic-byte validation still required

Current `file-upload-transcribe/index.ts:18-61` does magic-byte sniffing before sending to Whisper. Keep that logic — move it into the **worker** function, which downloads the first 12 bytes from Storage via signed URL. Don't trust client-supplied MIME types.

---

## 3. Lifting the 25MB Whisper Cap

**Recommendation: provider routing, NOT chunking.** Route ≤25MB → Whisper (cheap, already wired, $0.006/min). Route >25MB → Deepgram Nova-3 via URL-based async callback ($0.0218/min, 2GB direct-upload ceiling, no duration limit when using callback mode).

### Why provider routing beats chunking

Chunking strategies (silence detection via VAD, 2-second overlap, dedupe at merge boundaries — see OpenAI Cookbook) require:
- ffmpeg or a WASM audio decoder in the Edge Function bundle (see Section 6 for why this is bad)
- Bookkeeping for chunk ordering and merge
- Speaker continuity tracking across chunks
- Increased Whisper API calls (more cost, more rate-limit pressure)
- Loss of context at chunk boundaries even with overlap

Deepgram pays for itself at the engineering cost. $0.0218/min is ~3.6× Whisper's $0.006/min, but only kicks in for >25MB files (typically >25-30 min audio). Customers uploading 90-minute meetings get a working product at 0.5-2× the cost; customers uploading <25MB pay the same as today.

**Note on `gpt-4o-transcribe`:** Same 25MB hard cap as `whisper-1`, plus a 25-minute audio length limit. Not a workaround. Better quality than whisper-1 for short audio but doesn't help with the size problem.

### Code: provider router in worker

```typescript
async function processJob(payload: { job_id: string; storage_path: string; mime_type: string }) {
  const { data: file } = await supabase.storage.from('uploads').download(payload.storage_path);
  const sizeBytes = file.size;

  let transcript: string;
  let segments: TranscriptSegment[] | null = null;

  if (sizeBytes <= 25 * 1024 * 1024 && isWhisperNativeFormat(payload.mime_type)) {
    // ≤25MB AND format Whisper supports → cheap path
    transcript = await transcribeWithWhisper(file);
  } else {
    // >25MB OR opus/ogg/flac → Deepgram callback mode
    const { transcript: t, segments: s } = await transcribeWithDeepgram(payload.storage_path);
    transcript = t;
    segments = s;
  }

  await runPipeline(supabase, userId, {
    external_id: `upload-${payload.job_id}`,
    source_app: 'file-upload',
    title: cleanFilename(payload.original_filename),
    full_transcript: transcript,
    transcript_segments: segments,
    ...
  });

  await supabase.from('transcription_jobs').update({ status: 'completed' }).eq('id', payload.job_id);
}
```

### Deepgram callback mode (avoids the 10-minute sync timeout)

For files where Deepgram's synchronous processing would exceed 10 minutes wall-clock (returns 504), use the callback feature: pass a `callback` URL pointing at a CallVault Edge Function. Deepgram immediately returns a `request_id` and POSTs the result to your URL when done. Up to 10 retries with 30s delay on 5xx response. This is the pattern that lets you transcribe multi-hour audio without holding any connection open.

```typescript
const dgRes = await fetch('https://api.deepgram.com/v1/listen?callback=' +
  encodeURIComponent(`${SUPABASE_URL}/functions/v1/deepgram-callback?job_id=${jobId}`) +
  '&model=nova-3&smart_format=true&diarize=true&punctuate=true', {
  method: 'POST',
  headers: {
    Authorization: `Token ${DEEPGRAM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  // Pass a signed download URL — Deepgram fetches the file itself
  body: JSON.stringify({ url: signedDownloadUrl }),
});
// dgRes is { request_id }; the actual transcript arrives at the callback later
```

The callback Edge Function (`deepgram-callback/index.ts`) verifies the request signature, looks up `job_id` from query, writes the recording via `runPipeline()`, and updates `transcription_jobs.status='completed'`. The worker function returns to the queue immediately after sending — it does NOT wait for the callback. This is critical: pgmq `archive()` should happen after the callback succeeds, OR the worker writes a `pending_callback` state and pgmq archives optimistically with a separate stuck-job sweeper.

### Anti-pattern: chunking inside an Edge Function

If you absolutely must stay on Whisper for >25MB files, do the chunking client-side (browser has WebCodecs and AudioContext), NOT server-side. Server-side chunking in Deno requires either a) ffmpeg.wasm in the bundle (slow cold start, see Section 6), or b) downloading the full file to `/tmp` and shelling out — and Edge Functions don't have a shell. Recommendation: don't do it. Use Deepgram for >25MB.

---

## 4. Background Job Processing Pattern

### Wall-clock limits (verified)

- **Free plan:** 150 seconds (2m 30s) total per function invocation including `EdgeRuntime.waitUntil()` work.
- **Paid plan:** 400 seconds (6m 40s) total.

These limits caused the original synchronous problem. The pgmq+cron worker pattern sidesteps them: each worker run only processes 1-3 messages and is bounded at the per-invocation level, but the overall pipeline can run unbounded across invocations.

### `EdgeRuntime.waitUntil` — when to use it

Use sparingly inside the worker, NOT in the request-handling enqueue function.

```typescript
// GOOD: worker returns immediately, but background task finishes within the 400s budget
Deno.serve(async () => {
  const work = processQueueMessages();
  EdgeRuntime.waitUntil(work);
  return new Response('worker scheduled', { status: 202 });
});
```

Useful when worker is invoked by an HTTP cron call that has a short timeout (some Cron platforms cap at 5-10s) but the actual work takes 30-60s.

**Local testing caveat:** `EdgeRuntime.waitUntil` background tasks don't run in `supabase functions serve` unless `policy = "per_worker"` is set in `supabase/config.toml`. Easy to miss.

### Retry strategy

pgmq's visibility timeout IS the retry mechanism. Set `sleep_seconds: 300` (5 min) when reading. If the worker dies mid-job, the message becomes visible again after 5 min and gets picked up. `read_ct` tracks attempts. On `read_ct >= 3` → DLQ. No exponential backoff primitive — implement manually by setting `pgmq.set_vt()` to push the next visible-at further out if you want backoff.

### Observability for stuck jobs

Single SQL query against `pgmq.q_transcribe` exposes:
- messages with `vt > now()` and `read_ct > 0` → currently being processed (or worker died, visibility timeout will rescue)
- messages with `read_ct >= 2` → suspicious, will hit DLQ next attempt
- archive table `pgmq.a_transcribe` → all completed/dead messages

Add a `transcription_jobs` dashboard view in the existing admin tab. Cron sweeper every 5 minutes: find `transcription_jobs` rows where `status='queued'` AND `created_at < now() - interval '30 minutes'` → mark `status='stuck'` and alert.

### Fan-out

For 100s of concurrent uploads, a single worker reading `n=3` every 10s = 18 messages/min. Increase by:
1. Bumping `n` to 10 (180/min)
2. Running multiple cron jobs offset by 5s
3. (Premium) Deepgram async callbacks remove the worker from the critical path entirely — worker only initiates, callback function receives the result

No need for explicit fan-out infrastructure. Postgres handles concurrent `pgmq_read` correctly via SELECT...FOR UPDATE SKIP LOCKED under the hood.

---

## 5. Realtime Notification UX

**Recommendation: Broadcast from Database via `realtime.broadcast_changes()` on a per-workspace private topic.** Not `postgres_changes` (doesn't scale, RLS-heavy), not raw `realtime.send` from client (unauthenticated noise).

### Why broadcast-from-DB beats postgres_changes

Supabase officially recommends Broadcast over Postgres Changes "for most use cases" and explicitly flags Postgres Changes as less scalable. Postgres Changes requires keeping a Postgres replication slot busy per subscriber and re-evaluating RLS on every update — for a single-table change, fine, but the moment you're broadcasting "job X is done for workspace Y to N clients," Broadcast wins.

### Topology

```
Postgres trigger on recordings INSERT
        │
        ▼
realtime.broadcast_changes(topic := 'workspace:' || NEW.organization_id, ...)
        │
        ▼
Supabase Realtime fans out over websocket
        │
        ▼
Client subscribes to channel `workspace:<orgId>`
        │
        ▼
On event: invalidate React Query caches (calls.all, workspaceEntries.all)
        │
        ▼
TanStack Query refetches → new recording appears in UI
```

### Code: Postgres trigger (migration)

```sql
create or replace function broadcast_new_recording()
returns trigger
language plpgsql
security definer
as $$
begin
  perform realtime.broadcast_changes(
    'workspace:' || NEW.organization_id::text,  -- topic
    TG_OP,                                       -- event = 'INSERT' / 'UPDATE'
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  return NEW;
end;
$$;

create trigger broadcast_recording_changes
  after insert or update of full_transcript, summary
  on public.recordings
  for each row
  execute function broadcast_new_recording();

-- RLS for the realtime.messages channel
create policy "members read their workspace broadcasts"
  on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'workspace:%'
    and exists (
      select 1 from organization_memberships
      where user_id = auth.uid()
      and organization_id::text = split_part(realtime.topic(), ':', 2)
    )
  );
```

### Code: client subscription (TanStack Query invalidation)

```typescript
// src/hooks/useTranscriptionRealtime.ts
export function useTranscriptionRealtime(organizationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`workspace:${organizationId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        // New recording inserted — invalidate the call list caches
        invalidateCallListCaches(queryClient);
        toast.success(`New recording: ${payload.payload.record.title}`);
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        // Transcript completed — surgical invalidation for that specific recording
        queryClient.invalidateQueries({
          queryKey: queryKeys.calls.byId(payload.payload.record.id),
        });
      });

    supabase.realtime.setAuth();  // required for private channels
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId, queryClient]);
}
```

Mount this hook in `Layout.tsx` once `organizationId` is known. Single websocket per session covers every recording event for the active workspace.

### UX recommendation

For the upload-in-flight experience:
1. **Optimistic insert** — show a "Transcribing..." placeholder row in the call list immediately after upload completes (use `transcription_jobs` row as the source).
2. **Polling fallback** — TanStack Query background refetch every 30s on `transcription_jobs` for the user, in case realtime drops.
3. **Broadcast notification** — replaces the placeholder with the real recording row when the broadcast event fires.
4. **Friendly error** — `transcription_jobs.status='failed'` row stays visible with a "Retry" button. No silent failures.

This is the canonical "Stripe webhook UX" pattern adapted to transcription.

---

## 6. Audio Format Support

**Recommendation: skip server-side conversion entirely.** Route formats Whisper doesn't natively accept (opus, flac, raw ogg) to Deepgram. Deepgram supports all of them out of the box.

### Whisper API native formats (verified from OpenAI help center)

`mp3, mp4, mpeg, mpga, m4a, wav, webm`

**NOT supported:** `opus, flac, ogg, aac` (standalone)

### Why NOT ffmpeg.wasm in Edge Functions

- **No first-party Deno support** for ffmpeg.wasm (last clean status: open feature request from 2020, no resolution)
- **Bundle bloat:** ffmpeg.wasm is 25-40MB compressed → bloats Edge Function cold start
- **Memory:** Deno Deploy isolates have memory limits below ffmpeg's typical working set for video → conversion of large files OOMs
- **CPU time:** Decoding 90-minute audio takes minutes of CPU even in wasm → eats the wall-clock budget you just freed up
- **No system ffmpeg** — Supabase confirmed there's no native ffmpeg binary available; wasm is the only path

### Format routing table

| Format | MIME | Whisper native? | Route to |
|---|---|---|---|
| MP3 | `audio/mpeg` | Yes | Whisper |
| WAV | `audio/wav`, `audio/x-wav` | Yes | Whisper |
| M4A | `audio/x-m4a`, `audio/mp4` | Yes | Whisper |
| MP4 | `video/mp4` | Yes | Whisper |
| MOV | `video/quicktime` | Yes (treat as mp4) | Whisper |
| WebM | `video/webm`, `audio/webm` | Yes (container; codec may vary) | Whisper |
| Opus | `audio/opus` | **No** | Deepgram |
| OGG | `audio/ogg` | **No** | Deepgram |
| FLAC | `audio/flac` | **No** | Deepgram |
| AAC | `audio/aac` | **No** | Deepgram |

Update `ACCEPTED_TYPES` in `file-upload-transcribe/index.ts:8-12` to add opus/ogg/flac/aac. Update `validateMagicBytes()` to recognize their signatures (FLAC = `fLaC`, Opus-in-Ogg = `OggS`, plain Ogg = `OggS`).

### Edge case: WebM container with Opus codec

The WebM container is Whisper-supported, but if the codec inside is Opus only (common from MediaRecorder browser API), behavior is undefined per OpenAI docs. Safe play: route any WebM to Deepgram. Costs slightly more for WebM-from-browser uploads but eliminates the silent-fail class.

---

## 7. Transcript Format Parsers

**Recommendation: `subtitle` (npm) for SRT/VTT, custom parser for Otter JSON.** Deno-compatible via `npm:subtitle@latest` import.

### Library choice

| Library | License | Deno compat | Notes |
|---|---|---|---|
| `subtitle` (gsantiago/subtitle.js) | MIT | npm: prefix works | Streaming parse, SRT + VTT, TypeScript-first. Active maintenance. |
| `@plussub/srt-vtt-parser` | MIT | npm: prefix works | Dependency-free, smaller, less feature-complete. |
| `@qgustavor/srt-parser` | MIT | Officially Deno-supported | Simple SRT only. |
| `srt-parser-2` | MIT | npm: prefix works | Most-downloaded npm SRT parser. |

**Pick `subtitle`** — covers SRT + VTT in one library, matches the existing VTT parser shape, and the existing `_shared/vtt-parser.ts` can be deprecated in favor of it after a side-by-side test pass.

### Code: SRT parser in Deno

```typescript
// supabase/functions/_shared/srt-parser.ts
import { parseSync, type Node } from 'npm:subtitle@4.2.2';

export function parseSRT(srtContent: string): TranscriptSegment[] {
  const nodes = parseSync(srtContent);
  return nodes
    .filter((n): n is Node & { type: 'cue' } => n.type === 'cue')
    .map((cue) => ({
      start_ms: cue.data.start,
      end_ms: cue.data.end,
      text: cue.data.text,
      speaker: extractSpeakerFromSRTText(cue.data.text),
    }));
}

function extractSpeakerFromSRTText(text: string): string | undefined {
  // "John Smith: hello world" → speaker = "John Smith"
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s.'_-]{0,49}):\s+/);
  return m?.[1];
}
```

### Otter export format

Otter exports as either SRT (use the parser above) or TXT with speaker labels. There's no official Otter JSON export format that's published. The TXT format is:

```
Speaker 1  0:01
Lorem ipsum dolor sit amet...

Speaker 2  0:15
Consectetur adipiscing elit...
```

Custom parser, ~30 LOC:

```typescript
// supabase/functions/_shared/otter-parser.ts
const OTTER_LINE = /^(.+?)\s+(\d+):(\d{2})(?::(\d{2}))?$/;

export function parseOtterTxt(content: string): TranscriptSegment[] {
  const lines = content.split('\n');
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const m = line.match(OTTER_LINE);
    if (m) {
      if (current) segments.push(current);
      const [, speaker, a, b, c] = m;
      const start_ms = c
        ? (Number(a) * 3600 + Number(b) * 60 + Number(c)) * 1000
        : (Number(a) * 60 + Number(b)) * 1000;
      current = { start_ms, text: '', speaker: speaker.trim() };
    } else if (current) {
      current.text = current.text ? `${current.text} ${line}` : line;
    }
  }
  if (current) segments.push(current);
  return segments;
}
```

### Generic JSON transcript

For "JSON" format, define a CallVault-canonical schema rather than trying to match every tool's export. Document it in `docs/architecture/transcript-formats.md`. Recommend: same shape as `transcript_segments` already used in the `recordings` table — `[{start_ms, end_ms, speaker, text}]`. Reject anything that doesn't conform (or auto-detect Deepgram/AssemblyAI shapes and remap; their JSON shapes are documented).

### Wiring

In `save-pasted-transcript/index.ts`, add a format detector before calling the existing `parseVTTWithMetadata`:

```typescript
function detectTranscriptFormat(text: string): 'vtt' | 'srt' | 'otter' | 'json' | 'fathom' | 'raw' {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (/^WEBVTT/i.test(trimmed)) return 'vtt';
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}\s+-->/m.test(trimmed)) return 'srt';
  if (/\b\d+:\d{2}\b/.test(trimmed) && /^[A-Z][a-zA-Z\s]+\s+\d+:\d{2}/m.test(trimmed)) return 'otter';
  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+:/m.test(trimmed)) return 'fathom';
  return 'raw';
}
```

---

## Anti-Patterns to Avoid

### 1. Hidden synchronous Whisper call inside the "async" worker

If the worker calls Whisper synchronously on a 100MB file, you've moved the wall-clock problem from the upload Edge Function to the worker Edge Function. Same 400s ceiling. Same failure mode.

**Avoid by:** routing >25MB to Deepgram **callback** mode (worker returns immediately after issuing the request; callback handler writes the result).

### 2. Status-polling endpoint instead of Realtime

Naive async pipelines add a `GET /jobs/:id/status` endpoint and have the client poll every 2 seconds. At 100 concurrent uploads × 30s average completion × 0.5/sec poll = 1500 wasted Edge Function invocations per upload batch. Cost adds up and creates a Postgres connection storm.

**Avoid by:** Realtime broadcast as the happy path; polling only as the 30-second fallback in case the websocket dropped.

### 3. Trusting client-supplied file size / MIME / duration

Once the file is in Storage via signed URL, treat the client-supplied metadata as untrusted. The worker should:
- `head` the object to get real size
- read first 12 bytes for magic-byte validation
- (optionally) probe duration with a lightweight tool before sending to the transcription provider

The 25MB ceiling, format gate, and quota check all need to happen against the **server-confirmed** file, not the client's hint.

### 4. Using `pg_net.http_post` as a fire-and-forget queue replacement

Tempting because it's already in your stack. Don't. `pg_net` has no retry, no visibility timeout, no exactly-once, and silently swallows errors. Use it only for the cron → worker invocation hop (where the worker itself provides the durability via pgmq).

### 5. Putting the heavy provider logic in the SAME function as enqueue

The enqueue Edge Function should be <50 LOC and return in <200ms. If you bundle Deepgram SDK + Whisper SDK + transcript parsers + magic-byte validation into the same function as the file-upload entry point, you're back to a cold-start tax on every upload click.

**Avoid by:** keeping enqueue thin. Worker can be fat — its cold start doesn't block the user.

### 6. Storing the raw audio file forever

Default Storage lifetime is forever. Audio files of 90-minute calls add up fast. Add a Storage lifecycle rule (or cron job) to delete `uploads/*` files older than 7 days **after** the recording row has been written. The transcript is the long-lived artifact; the source audio is ephemeral.

### 7. Letting failed jobs vanish silently

Without a `transcription_jobs` table, a job that fails after the upload has no surface to retry from. The user uploaded a file, the UI said "uploading...", and then... nothing. **Avoid by:** persisting `transcription_jobs` row from the moment of enqueue, surfacing failures in the UI with retry button (MAN-05).

### 8. Integration tests that mock Supabase

The CONCERNS doc cites the Phase 30 / BUG-01 incident — a mocked test passed for the exact UUID/BIGINT bug that broke prod. Don't repeat for the async pipeline. The MAN-04 integration tests must hit a real Supabase test project: upload a real file, watch the job flow through pgmq, assert the recording row exists with expected segments.

---

## References

**Supabase official docs (HIGH confidence):**
- [Background Tasks | Supabase Docs](https://supabase.com/docs/guides/functions/background-tasks)
- [Edge Function wall clock time limit | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/edge-function-wall-clock-time-limit-reached-Nk38bW)
- [Edge Functions: Background Tasks, Ephemeral Storage, and WebSockets](https://supabase.com/blog/edge-functions-background-tasks-websockets)
- [PGMQ Extension | Supabase Docs](https://supabase.com/docs/guides/queues/pgmq)
- [Supabase Queues | Supabase Docs](https://supabase.com/docs/guides/queues)
- [Supabase Queues launch blog post](https://supabase.com/blog/supabase-queues)
- [Create signed upload URL | JS reference](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Upload to a signed URL | JS reference](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl)
- [Resumable Uploads | Supabase Docs](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Storage v3: Resumable Uploads with support for 50GB files](https://supabase.com/blog/storage-v3-resumable-uploads)
- [Broadcast | Supabase Docs](https://supabase.com/docs/guides/realtime/broadcast)
- [Realtime: Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database)
- [Subscribing to Database Changes | Supabase Docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

**Community/dev patterns (MEDIUM confidence — verified against official docs):**
- [Build Queue Worker using Supabase Cron, Queue and Edge Function](https://dev.to/suciptoid/build-queue-worker-using-supabase-cron-queue-and-edge-function-19di) — pgmq + cron + edge worker complete pattern
- [Background Jobs and Queues for Self-Hosted Supabase with pgmq](https://www.supascale.app/blog/background-jobs-and-queues-for-selfhosted-supabase-with-pgmq)
- [PGMQ GitHub](https://github.com/pgmq/pgmq) — DLQ pattern via read_ct

**OpenAI / Whisper (HIGH confidence — official sources):**
- [OpenAI Audio API FAQ](https://help.openai.com/en/articles/7031512-audio-api-faq) — 25MB limit, supported formats list
- [OpenAI Cookbook: Enhancing Whisper transcriptions](https://cookbook.openai.com/examples/whisper_processing_guide) — chunking + silence detection guidance
- [Whisper Discussion: supported formats](https://github.com/openai/whisper/discussions/2292)
- [OpenAI Community: Opus not supported](https://community.openai.com/t/support-for-opus-file-format/1127125)

**Deepgram (HIGH confidence — official):**
- [Deepgram Pre-Recorded Audio docs](https://developers.deepgram.com/docs/pre-recorded-audio)
- [Deepgram Callback docs](https://developers.deepgram.com/docs/using-callbacks-to-return-transcripts-to-your-server)
- [Deepgram Audio File Too Large troubleshooting](https://drdroid.io/integration-diagnosis-knowledge/deepgram-audio-file-too-large) — 2GB direct, 10-min sync timeout
- [Best Speech-to-Text APIs in 2026 (Deepgram benchmark)](https://deepgram.com/learn/best-speech-to-text-apis-2026)

**Transcript parsers (HIGH confidence — npm registry):**
- [subtitle on npm](https://www.npmjs.com/package/subtitle) — SRT + VTT
- [@plussub/srt-vtt-parser on npm](https://www.npmjs.com/package/@plussub/srt-vtt-parser)
- [@qgustavor/srt-parser on npm](https://www.npmjs.com/package/@qgustavor/srt-parser) — Deno-tested
- [Otter SRT export docs](https://help.otter.ai/hc/en-us/articles/11742706003735-Create-captions-subtitles-for-your-video)

**ffmpeg.wasm (LOW confidence on Edge Function viability — explicit anti-pattern):**
- [ffmpeg.wasm Deno support issue (still open)](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/110)
- [Supabase Add ffmpeg support discussion](https://github.com/orgs/supabase/discussions/27280) — confirms no native ffmpeg in Edge Functions
