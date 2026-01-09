# SPEC: RAG Embedding Pipeline Fixes

**Created:** 2025-01-08
**Status:** Draft
**Priority:** Critical
**Affects:** AI Chat, Search, Knowledge Base

---

## Executive Summary

The RAG (Retrieval-Augmented Generation) pipeline is critically broken, resulting in:
- **93.4% of calls NOT embedded** (only 78/1185 calls have chunks)
- **AI agent searches returning empty/limited results**
- **Embedding jobs silently failing** (marked "completed" with 0 chunks created)
- **Queue processing has stopped** despite pending work

This spec outlines 4 interconnected fixes to restore full RAG functionality.

---

## Table of Contents

1. [FIX-1: Embed-Chunks Worker Invocation](#fix-1-embed-chunks-worker-invocation)
2. [FIX-2: Manual Embedding Job for Missing Calls](#fix-2-manual-embedding-job-for-missing-calls)
3. [FIX-3: pg_cron Backup Worker](#fix-3-pg_cron-backup-worker)
4. [FIX-4: Statement Timeout Handling](#fix-4-statement-timeout-handling)
5. [Implementation Order](#implementation-order)
6. [Acceptance Criteria](#acceptance-criteria)

---

## Diagnostic Data (2025-01-08)

```
User: a@vibeos.com
User ID: ef054159-3a5a-49e3-9fd8-31fa5a180ee6

CALL DATA:
- Total calls: 1,185
- Calls with transcripts: 1,185

CHUNK DATA:
- Total chunks: 59,822
- Chunks with embeddings: 59,822 (100% of existing chunks)
- Unique recordings with chunks: 78
- Chunked call coverage: 6.6% (78/1,185)

EMBEDDING JOBS:
- Recent jobs show status "completed" with 0 chunks created
- Jobs are being finalized without processing queue items

EMBEDDING QUEUE:
- 1,000 items with status "completed"
- 1 item failed (statement timeout)
- 0 pending items (processing has stopped)

GAP:
- 933 calls are missing chunks entirely
```

---

## FIX-1: Embed-Chunks Worker Invocation

### Problem Statement

The `embed-chunks` Edge Function creates embedding jobs and queue entries correctly, but the subsequent invocation of `process-embeddings` fails silently.

**Current Code (embed-chunks/index.ts:183-200):**
```typescript
EdgeRuntime.waitUntil(
  (async () => {
    try {
      console.log(`Triggering process-embeddings worker for job ${job.id}`);
      const { error: invokeError } = await supabase.functions.invoke('process-embeddings', {
        body: { job_id: job.id, batch_size: 10 },
      });
      // Error is logged but not handled
    } catch (err) {
      console.error('Failed to trigger process-embeddings:', err);
    }
  })()
);
```

**Issues Identified:**
1. No Authorization header passed to `process-embeddings`
2. Error handling only logs, doesn't retry or alert
3. `process-embeddings` may require service role auth, not user JWT
4. Fire-and-forget pattern hides failures

### Root Cause

The `supabase.functions.invoke()` call uses the user's JWT from the original request context, but `process-embeddings` is a background worker that should run with service role permissions to access all user data.

### Proposed Solution

**Option A: Use Service Role Key for Worker Invocation (Recommended)**
```typescript
// In embed-chunks/index.ts
const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);

EdgeRuntime.waitUntil(
  (async () => {
    try {
      console.log(`Triggering process-embeddings worker for job ${job.id}`);

      // Use direct HTTP call with service role
      const response = await fetch(`${supabaseUrl}/functions/v1/process-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          batch_size: 10,
          triggered_by: 'embed-chunks'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`process-embeddings invocation failed: ${response.status} - ${errorText}`);

        // Update job status to indicate invocation failure
        await supabaseServiceClient
          .from('embedding_jobs')
          .update({
            error_message: `Worker invocation failed: ${response.status}`,
          })
          .eq('id', job.id);
      } else {
        console.log('Successfully triggered process-embeddings worker');
      }
    } catch (err) {
      console.error('Failed to trigger process-embeddings:', err);

      // Mark job as needing attention
      await supabaseServiceClient
        .from('embedding_jobs')
        .update({
          error_message: `Worker invocation exception: ${err.message}`,
        })
        .eq('id', job.id);
    }
  })()
);
```

**Option B: Make process-embeddings Self-Starting**

Add a database trigger that fires when new queue items are inserted, invoking the worker automatically.

### Files to Modify

1. `supabase/functions/embed-chunks/index.ts`
   - Update worker invocation to use service role auth
   - Add better error handling and job status updates

2. `supabase/functions/process-embeddings/index.ts`
   - Verify it accepts both service role and user JWT auth
   - Add logging for auth method used

### Testing Plan

1. Trigger a new embedding job via the UI
2. Check Supabase function logs for `embed-chunks` and `process-embeddings`
3. Verify queue items transition from `pending` -> `processing` -> `completed`
4. Confirm chunks are created in `transcript_chunks` table

---

## FIX-2: Manual Embedding Job for Missing Calls

### Problem Statement

933 calls have transcripts but no chunks/embeddings. These need to be processed to enable full RAG search coverage.

### Current State

```sql
-- Calls with transcripts: 1,185
-- Calls with chunks: 78
-- Gap: 1,107 calls need embedding (some may lack fathom_transcripts rows)
```

### Proposed Solution

**Step 1: Create a Migration/Backfill Script**

Create a new Edge Function or script that:
1. Identifies all calls with transcripts but no chunks
2. Creates embedding jobs in manageable batches (50-100 calls per job)
3. Monitors progress and reports completion

**Script: `scripts/backfill-embeddings.ts`**
```typescript
#!/usr/bin/env node
/**
 * BACKFILL EMBEDDINGS
 *
 * Identifies calls missing embeddings and queues them for processing.
 * Runs in batches to avoid overwhelming the system.
 */

import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 50; // Calls per embedding job
const DELAY_BETWEEN_BATCHES_MS = 5000; // 5 seconds between batches

async function backfillEmbeddings(userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Get all calls with transcripts
  const { data: allCalls } = await supabase
    .from('fathom_calls')
    .select('recording_id')
    .eq('user_id', userId)
    .not('full_transcript', 'is', null);

  // 2. Get calls that already have chunks
  const { data: chunkedCalls } = await supabase
    .from('transcript_chunks')
    .select('recording_id')
    .eq('user_id', userId);

  const chunkedIds = new Set(chunkedCalls?.map(c => c.recording_id) || []);
  const missingIds = allCalls
    ?.filter(c => !chunkedIds.has(c.recording_id))
    .map(c => c.recording_id) || [];

  console.log(`Found ${missingIds.length} calls missing embeddings`);

  // 3. Process in batches
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    const batch = missingIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missingIds.length / BATCH_SIZE);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} calls)`);

    // Create embedding job
    const { data: job, error } = await supabase
      .from('embedding_jobs')
      .insert({
        user_id: userId,
        recording_ids: batch,
        status: 'running',
        progress_total: batch.length,
        progress_current: 0,
        chunks_created: 0,
        queue_total: batch.length,
        queue_completed: 0,
        queue_failed: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to create job for batch ${batchNum}:`, error);
      continue;
    }

    // Create queue entries
    const queueEntries = batch.map(recordingId => ({
      user_id: userId,
      job_id: job.id,
      recording_id: recordingId,
      status: 'pending',
    }));

    const { error: queueError } = await supabase
      .from('embedding_queue')
      .insert(queueEntries);

    if (queueError) {
      console.error(`Failed to queue batch ${batchNum}:`, queueError);
      continue;
    }

    // Trigger worker
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/process-embeddings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ job_id: job.id, batch_size: 10 }),
      }
    );

    if (!response.ok) {
      console.error(`Worker invocation failed for batch ${batchNum}`);
    } else {
      console.log(`Batch ${batchNum} queued successfully (job: ${job.id})`);
    }

    // Delay between batches
    if (i + BATCH_SIZE < missingIds.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log('Backfill complete!');
}

// CLI
const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx scripts/backfill-embeddings.ts <user_id>');
  process.exit(1);
}

backfillEmbeddings(userId).catch(console.error);
```

**Step 2: Add Progress Monitoring**

Create a simple status endpoint or script to monitor backfill progress:

```typescript
// scripts/check-backfill-progress.ts
async function checkProgress(userId: string) {
  // Show active jobs, queue status, and chunk counts
}
```

### Execution Plan

1. First apply FIX-1 (worker invocation fix)
2. Run backfill script for user `ef054159-3a5a-49e3-9fd8-31fa5a180ee6`
3. Monitor progress via logs and status script
4. Verify chunk counts increase to match call counts

### Estimated Processing Time

- 933 missing calls
- ~50 calls per batch = 19 batches
- Each batch processes 10 recordings at a time
- Assuming 30 seconds per recording = ~5 minutes per batch
- Total: ~95 minutes (1.5 hours)

---

## FIX-3: pg_cron Backup Worker

### Problem Statement

The embedding queue system includes a pg_cron backup trigger (migration `20251128100000_embedding_queue_system.sql:257-278`) designed to ensure processing continues even if the self-chain breaks. This backup doesn't appear to be running.

**Current cron setup:**
```sql
PERFORM cron.schedule(
  'embedding-worker-backup',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/process-embeddings',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"triggered_by": "cron", "batch_size": 10}'::jsonb
  );
  $$
);
```

**Issues:**
1. No `Authorization` header in the cron HTTP call
2. pg_cron may not be enabled on the Supabase instance
3. pg_net extension may not be available
4. The URL is hardcoded (should use environment variable)

### Diagnostic Steps

```sql
-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check if job exists
SELECT * FROM cron.job WHERE jobname = 'embedding-worker-backup';

-- Check recent job runs
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'embedding-worker-backup')
ORDER BY start_time DESC
LIMIT 10;

-- Check if pg_net is available
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### Proposed Solution

**Option A: Fix the pg_cron Job (If Extensions Available)**

```sql
-- Drop existing job
SELECT cron.unschedule('embedding-worker-backup');

-- Create new job with proper auth
-- Note: We need to store the service role key securely
-- Option 1: Use Supabase Vault (if available)
-- Option 2: Use a dedicated webhook endpoint with API key auth

SELECT cron.schedule(
  'embedding-worker-backup',
  '*/2 * * * *',  -- Every 2 minutes (less aggressive)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/process-embeddings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{"triggered_by": "cron", "batch_size": 10}'::jsonb
  );
  $$
);
```

**Option B: External Cron Alternative (Recommended for Supabase)**

Since Supabase doesn't always have pg_cron available, use an external cron service:

1. **Supabase Edge Function with Scheduled Invoke:**
   - Use Supabase's built-in cron via `supabase functions deploy --schedule`

2. **External Service (Vercel Cron, GitHub Actions, etc.):**
   ```yaml
   # .github/workflows/embedding-worker.yml
   name: Embedding Worker Backup
   on:
     schedule:
       - cron: '*/5 * * * *'  # Every 5 minutes
   jobs:
     trigger-worker:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger embedding worker
           run: |
             curl -X POST \
               "${{ secrets.SUPABASE_URL }}/functions/v1/process-embeddings" \
               -H "Content-Type: application/json" \
               -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
               -d '{"triggered_by": "github-cron", "batch_size": 10}'
   ```

3. **Vercel Cron (if using Vercel):**
   ```json
   // vercel.json
   {
     "crons": [{
       "path": "/api/cron/embedding-worker",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

### Files to Create/Modify

1. Check Supabase project settings for pg_cron availability
2. If not available, create external cron trigger
3. Add monitoring/alerting for cron failures

### Testing Plan

1. Manually add items to `embedding_queue` with status `pending`
2. Wait for cron interval
3. Verify items are processed (status changes to `completed`)
4. Check function logs for cron-triggered invocations

---

## FIX-4: Statement Timeout Handling

### Problem Statement

One recording (107458944) failed with error:
```
Error inserting chunks for 107458944: canceling statement due to statement timeout
```

This indicates the chunk insertion query exceeded Supabase's statement timeout limit (likely 60 seconds).

### Root Cause Analysis

Looking at `process-embeddings/index.ts:426-441`:
```typescript
// Delete existing chunks for this recording (for re-indexing)
await supabase
  .from('transcript_chunks')
  .delete()
  .eq('recording_id', recording_id)
  .eq('user_id', user_id);

// Insert all chunks
const { data: insertedChunks, error: insertError } = await supabase
  .from('transcript_chunks')
  .insert(allChunksToInsert)
  .select('id');
```

**Potential causes:**
1. Recording has extremely long transcript (many chunks)
2. Bulk insert of large array exceeds timeout
3. HNSW index updates during insert are slow
4. No batching for large chunk arrays

### Proposed Solution

**1. Batch Chunk Insertions**

Instead of inserting all chunks at once, batch them:

```typescript
// In process-embeddings/index.ts

const CHUNK_INSERT_BATCH_SIZE = 50; // Insert 50 chunks at a time

// Delete existing chunks (unchanged)
await supabase
  .from('transcript_chunks')
  .delete()
  .eq('recording_id', recording_id)
  .eq('user_id', user_id);

// Batch insert chunks
const allInsertedIds: string[] = [];

for (let i = 0; i < allChunksToInsert.length; i += CHUNK_INSERT_BATCH_SIZE) {
  const batch = allChunksToInsert.slice(i, i + CHUNK_INSERT_BATCH_SIZE);

  const { data: inserted, error: insertError } = await supabase
    .from('transcript_chunks')
    .insert(batch)
    .select('id');

  if (insertError) {
    // Log which batch failed for debugging
    console.error(`Chunk insert batch ${Math.floor(i/CHUNK_INSERT_BATCH_SIZE) + 1} failed:`, insertError);
    throw new Error(`Error inserting chunks batch for ${recording_id}: ${insertError.message}`);
  }

  if (inserted) {
    allInsertedIds.push(...inserted.map(c => c.id));
  }
}

console.log(`Inserted ${allInsertedIds.length} chunks in ${Math.ceil(allChunksToInsert.length/CHUNK_INSERT_BATCH_SIZE)} batches`);
```

**2. Add Timeout Handling and Retry**

```typescript
// Wrap chunk processing with timeout handling
async function processRecordingWithTimeout(
  supabase: SupabaseClient,
  openaiApiKey: string,
  task: QueueTask,
  timeoutMs: number = 55000 // 55 seconds, leaving buffer
): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Processing timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    processRecording(supabase, openaiApiKey, task)
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}
```

**3. Handle Extremely Large Transcripts**

For transcripts that generate 500+ chunks, consider:
- Breaking into multiple queue tasks
- Processing in a dedicated "large transcript" queue
- Adding a pre-check that estimates chunk count before processing

```typescript
// Pre-check transcript size
const { count: segmentCount } = await supabase
  .from('fathom_transcripts')
  .select('*', { count: 'exact', head: true })
  .eq('recording_id', recording_id)
  .eq('user_id', user_id);

if (segmentCount > 1000) {
  console.log(`Large transcript detected (${segmentCount} segments), using conservative batch size`);
  // Use smaller embedding batch sizes for large transcripts
}
```

**4. Add Retry Logic for Timeout Errors**

In the queue system, specifically handle timeout errors:

```typescript
// In handleTaskFailure
if (errorMessage.includes('statement timeout') || errorMessage.includes('timeout')) {
  // For timeout errors, reset to pending with longer delay
  // These often succeed on retry when system is less loaded
  const backoffSeconds = 300; // 5 minutes for timeout retry

  await supabase.from('embedding_queue').update({
    status: 'pending', // Reset to pending, not failed
    attempts: newAttempts,
    last_error: errorMessage,
    next_retry_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
    locked_at: null,
    worker_id: null,
  }).eq('id', task.id);

  console.log(`Timeout error for ${task.recording_id}, scheduled retry in ${backoffSeconds}s`);
  return;
}
```

### Files to Modify

1. `supabase/functions/process-embeddings/index.ts`
   - Add batch insertion for chunks
   - Add timeout handling
   - Add special handling for large transcripts
   - Improve retry logic for timeout errors

### Testing Plan

1. Find a large transcript (500+ segments) to test with
2. Trigger embedding for that recording
3. Verify batch insertion completes without timeout
4. Test retry logic by simulating timeout errors

---

## Implementation Order

Execute fixes in this order for maximum effectiveness:

### Phase 1: Foundation Fixes (Do First)
1. **FIX-4: Statement Timeout Handling**
   - Prevents new failures during backfill
   - Low risk, isolated change
   - Estimated: 30 minutes

2. **FIX-1: Embed-Chunks Worker Invocation**
   - Critical for ongoing sync operations
   - Enables new calls to be embedded automatically
   - Estimated: 45 minutes

### Phase 2: Recovery (Do After Phase 1)
3. **FIX-2: Manual Embedding Backfill**
   - Depends on FIX-1 and FIX-4 working
   - Long-running process (~1.5 hours)
   - Can run in background

### Phase 3: Resilience (Do After Phase 2)
4. **FIX-3: pg_cron Backup Worker**
   - Safety net for future reliability
   - Lower priority than direct fixes
   - Estimated: 1 hour

---

## Acceptance Criteria

### FIX-1: Worker Invocation
- [ ] New embedding jobs successfully trigger `process-embeddings`
- [ ] Queue items transition from `pending` -> `processing` -> `completed`
- [ ] Function logs show successful worker invocations
- [ ] No silent failures in `EdgeRuntime.waitUntil()`

### FIX-2: Backfill
- [ ] Backfill script runs without errors
- [ ] 933 missing calls have chunks created
- [ ] Chunk coverage increases from 6.6% to >95%
- [ ] AI chat searches return results from previously missing calls

### FIX-3: Cron Backup
- [ ] Backup worker triggers every N minutes
- [ ] Stuck `pending` items get processed
- [ ] System recovers automatically from self-chain breaks
- [ ] Monitoring/alerts in place for cron failures

### FIX-4: Timeout Handling
- [ ] Large transcripts process without timeout errors
- [ ] Batch insertion works for 500+ chunk recordings
- [ ] Timeout errors trigger appropriate retry behavior
- [ ] Recording 107458944 successfully embedded

### Overall Success
- [ ] `hybrid_search_transcripts` returns relevant results for all queries
- [ ] AI agent tool calls succeed consistently
- [ ] New synced calls automatically get embeddings within 5 minutes
- [ ] Embedding job status accurately reflects actual progress

---

## Monitoring and Observability

### Key Metrics to Track

1. **Embedding Coverage**
   ```sql
   SELECT
     COUNT(DISTINCT fc.recording_id) as total_calls,
     COUNT(DISTINCT tc.recording_id) as embedded_calls,
     ROUND(COUNT(DISTINCT tc.recording_id)::numeric / COUNT(DISTINCT fc.recording_id) * 100, 1) as coverage_pct
   FROM fathom_calls fc
   LEFT JOIN transcript_chunks tc ON fc.recording_id = tc.recording_id AND fc.user_id = tc.user_id
   WHERE fc.user_id = '<user_id>'
     AND fc.full_transcript IS NOT NULL;
   ```

2. **Queue Health**
   ```sql
   SELECT
     status,
     COUNT(*) as count,
     MIN(created_at) as oldest,
     MAX(created_at) as newest
   FROM embedding_queue
   WHERE user_id = '<user_id>'
   GROUP BY status;
   ```

3. **Job Success Rate**
   ```sql
   SELECT
     status,
     COUNT(*) as jobs,
     SUM(chunks_created) as total_chunks,
     AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
   FROM embedding_jobs
   WHERE user_id = '<user_id>'
     AND created_at > NOW() - INTERVAL '7 days'
   GROUP BY status;
   ```

### Alerts to Configure

1. Queue items stuck in `processing` for >5 minutes
2. Jobs stuck in `running` status for >30 minutes
3. Embedding coverage drops below 90%
4. Multiple consecutive job failures

---

## Rollback Plan

If fixes cause issues:

1. **FIX-1 Rollback:** Revert embed-chunks changes, manually trigger workers
2. **FIX-2 Rollback:** N/A - backfill only adds data, doesn't modify
3. **FIX-3 Rollback:** Disable cron job, rely on self-chain
4. **FIX-4 Rollback:** Revert batch insertion, accept some timeouts

---

## References

- `supabase/functions/embed-chunks/index.ts` - Job creator
- `supabase/functions/process-embeddings/index.ts` - Queue worker
- `supabase/functions/sync-meetings/index.ts` - Sync trigger
- `supabase/migrations/20251128100000_embedding_queue_system.sql` - Queue schema
- `supabase/migrations/20251125000001_ai_chat_infrastructure.sql` - Chunk schema
- `scripts/diagnose-rag-status.cjs` - Diagnostic script

---

**END OF SPEC**
